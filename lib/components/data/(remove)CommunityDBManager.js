// travelCommunity 컴포넌트의 데이터 액세스 계층 (Data Access Layer)
// Redux 상태 관리와 통합되어 Firestore 데이터베이스와의 통신을 담당
// 모든 상태는 Redux 스토어에서 관리하며, 이 모듈은 데이터 액세스 기능만 제공

import { doc, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp, where, setDoc, increment } from 'firebase/firestore';
import { createChatRoom as createChatRoomModel, createMessage } from '../../models/communityModels.js';
import { firebasedb } from '../../lib/firebaseCli';
import * as realtimeChatUtils from '../../services/realtimeChatUtilsFB.js';

/**
 * 커뮤니티 DB 관리 모듈
 * 채팅방 목록 및 메시지 관리를 담당
 * Redux 상태 관리와 통합되어 데이터 액세스 계층 역할 수행
 */

class CommunityDBManager {
  constructor() {
    // 리스너 관리 객체
    this.chatListeners = {}; // 실시간 채팅 리스너 관리 객체
    this.typingListeners = {}; // 타이핑 상태 리스너 관리 객체
    this._isCreatingTestRoom = false; // 테스트 채팅방 생성 중복 방지 플래그
  }

  /**
   * 초기화 함수 - ModuleManager에서 호출
   */
  initialize() {
    console.log('[CommunityDBManager] 초기화됨');
    return this;
  }
  
  /**
   * 초기화 함수 - Redux Thunk에서 호출
   * @param {Object} userInfo - 사용자 정보
   * @returns {Promise<Object>} 채팅 데이터 (rooms, messages, roomId)
   */
  async initializeWithEvents(userInfo) {
    try {
      console.log('[CommunityDBManager] 초기화 시작', { userInfo });
      
      // 채팅 데이터 로드 (userInfo는 저장하지 않고 필요한 경우 Redux에서 가져오도록 함)
      const chatData = await this.loadChatData(null, { messageLimit: 50 });
      
      console.log('[CommunityDBManager] 초기화 완료');
      return chatData;
    } catch (error) {
      console.error('[CommunityDBManager] 초기화 오류:', error);
      throw error; // Redux Thunk에서 rejectWithValue로 처리
    }
  }

  /**
   * 정리 함수 - ModuleManager에서 호출
   */
  cleanup() {
    // 실시간 리스너 정리
    Object.values(this.chatListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    Object.values(this.typingListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    
    // 리스너 객체 초기화 - 새 객체 할당
    this.chatListeners = {};
    this.typingListeners = {};
    
    console.log('[CommunityDBManager] 정리됨');
  }

  /**
   * 일시 중단 함수 - ModuleManager에서 호출
   */
  suspend() {
    // 실시간 리스너 정리
    Object.values(this.chatListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    Object.values(this.typingListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    
    // 리스너 객체 초기화 - 새 객체 할당
    this.chatListeners = {};
    this.typingListeners = {};
    
    console.log('[CommunityDBManager] 일시 중단됨');
    return true;
  }

  /**
   * 재개 함수 - ModuleManager에서 호출
   */
  resume() {
    console.log('[CommunityDBManager] 재개됨');
    return true;
  }

  /**
   * 테스트 채팅방 생성 (내부 메서드)
   * @returns {Promise<string|null>} 생성된 채팅방 ID 또는 null
   */
  async createTestChatRoom() {
    // 동시 생성 방지
    if (this._isCreatingTestRoom) return null;
    this._isCreatingTestRoom = true;
    
    try {
      // 테스트 채팅방 데이터 생성
      const testRoomData = {
        name: '테스트 채팅방',
        isPublic: true,
        createdBy: 'system',
        createdAt: serverTimestamp(),
        members: ['user-1'],
        admins: ['user-1'],
        lastMessage: '환영합니다! 이것은 테스트 채팅방입니다.',
        lastMessageTime: serverTimestamp()
      };
      
      // 채팅방 생성
      const roomId = await this.createChatRoom(testRoomData);
      console.log('[CommunityDBManager] 테스트 채팅방 생성됨:', roomId);
      
      // 환영 메시지 자동 전송
      await this.sendMessage(roomId, {
        username: '시스템',
        message: '환영합니다! 이것은 테스트 채팅방입니다.',
        timestamp: new Date(),
        senderId: 'system'
      });
      
      return roomId;
    } catch (error) {
      console.error('[CommunityDBManager] 테스트 채팅방 생성 오류:', error);
      return null;
    } finally {
      this._isCreatingTestRoom = false;
    }
  }

  /**
   * 채팅 데이터 로드 (채팅방 목록 및 메시지)
   * @param {string} requestedRoomId - 채팅방 ID (선택적)
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 채팅 데이터 (rooms, messages, roomId)
   */
  async loadChatData(requestedRoomId = null, options = {}) {
    const { messageLimit = 50 } = options;
    
    try {
      console.log('[CommunityDBManager] 채팅 데이터 로드 시작', { requestedRoomId, messageLimit });
      
      // 1. 채팅방 목록 로드
      let rooms = await this.getChatRooms();
      
      // 채팅방이 없는 경우 테스트 채팅방 생성
      if (rooms.length === 0) {
        console.log('[CommunityDBManager] 채팅방이 없음, 테스트 채팅방 생성 시도');
        const newRoomId = await this.createTestChatRoom();
        if (newRoomId) {
          rooms = await this.getChatRooms();
        }
      }
      
      // 2. 요청된 채팅방 ID 검증
      const validRoomId = requestedRoomId && rooms.some(room => room.id === requestedRoomId)
        ? requestedRoomId
        : rooms[0]?.id; // 유효하지 않은 경우 첫 번째 채팅방 사용
      
      // 3. 채팅방 목록에 선택 상태 추가
      const roomsWithSelected = rooms.map(room => ({
        ...room,
        isSelected: room.id === validRoomId
      }));
      
      // 4. 메시지 로드 (유효한 채팅방 ID가 있는 경우에만)
      let messages = [];
      if (validRoomId) {
        try {
          messages = await this._getRawChatMessages(validRoomId, messageLimit);
          console.log(`[CommunityDBManager] 채팅방 메시지 로드 완료 (${messages.length} 개)`);
        } catch (messageError) {
          console.error(`[CommunityDBManager] 메시지 로드 오류 (${validRoomId}):`, messageError);
          // 오류가 발생해도 계속 진행 (빈 메시지 목록 사용)
        }
      }
      
      // 5. 채팅 데이터 반환
      const chatData = { 
        rooms: roomsWithSelected, 
        messages, 
        roomId: validRoomId 
      };
      
      console.log('[CommunityDBManager] 채팅 데이터 로드 완료');
      return chatData;
    } catch (error) {
      console.error('[CommunityDBManager] 채팅 데이터 로드 오류:', error);
      throw error;
    }
  }

  /**
   * 채팅방 목록 가져오기
   * @returns {Promise<Array>} 채팅방 목록
   */
  async getChatRooms() {
    try {
      // Firestore 쿼리 직접 사용
      const roomsQuery = query(
        collection(firebasedb, 'chatRooms'),
        orderBy('lastMessageTime', 'desc')
      );
      const querySnapshot = await getDocs(roomsQuery);
      const rooms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastMessageTime: doc.data().lastMessageTime?.toDate() || null
      }));
      
      console.log(`[CommunityDBManager] 채팅방 목록 로드 완료 (${rooms.length}개)`);
      return rooms;
    } catch (error) {
      console.error('[CommunityDBManager] 채팅방 목록 로드 오류:', error);
      throw error; // Redux Thunk에서 처리하도록 오류 전파
    }
  }

  /**
   * 내부용: 특정 채팅방의 메시지 가져오기
   * @param {string} roomId - 채팅방 ID
   * @param {number} [messageLimit=50] - 메시지 수 제한
   * @returns {Promise<ChatMessage[]>} 표준화된 메시지 객체 배열
   */
  async _getRawChatMessages(roomId, messageLimit = 50) {
    try {
      if (!roomId) {
        console.warn('[CommunityDBManager] 유효하지 않은 채팅방 ID');
        return [];
      }
      
      // 정적 임포트 사용
      const { getChatMessages } = realtimeChatUtils;
      
      // 메시지 가져오기
      const messages = await getChatMessages(roomId, messageLimit);
      
      console.log(`[CommunityDBManager] 메시지 로드 완료 (${roomId}, ${messages.length}개)`);
      return messages;
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 로드 오류 (${roomId}):`, error);
      throw error;
    }
  }

  /**
   * 특정 채팅방의 메시지 가져오기
   * @param {string} roomId - 채팅방 ID
   * @param {Object} options - 추가 옵션
   * @param {number} [options.messageLimit=50] - 메시지 수 제한
   * @returns {Promise<Array>} 메시지 배열
   */
  async getChatMessages(roomId, options = {}) {
    const { messageLimit = 50 } = options;
    
    try {
      if (!roomId) {
        console.warn('[CommunityDBManager] 유효하지 않은 채팅방 ID');
        return [];
      }
      
      const messages = await this._getRawChatMessages(roomId, messageLimit);
      
      // 메시지 정렬 (시간순) - 정렬 책임을 여기서 명시적으로 처리
      const sortedMessages = messages.sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateA - dateB;
      });
      
      return sortedMessages;
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 가져오기 오류 (${roomId}):`, error);
      throw error;
    }
  }

  /**
   * 채팅방 생성하기
   * @param {Object} roomData - 채팅방 데이터
   * @param {Object} options - 옵션
   * @returns {Promise<string>} 생성된 채팅방 ID
   */
  async createChatRoom(roomData, options = {}) {
    try {
      // 정적 임포트 사용
      const { createChatRoom: createChatRoomInFB } = realtimeChatUtils;
      
      // 채팅방 데이터 표준화
      const standardizedRoomData = {
        ...createChatRoomModel(roomData),
        createdAt: roomData.createdAt || serverTimestamp(),
        lastMessageTime: roomData.lastMessageTime || serverTimestamp()
      };
      
      // 채팅방 생성
      const roomId = await createChatRoomInFB(standardizedRoomData);
      console.log(`[CommunityDBManager] 채팅방 생성 완료: ${roomId}`);
      
      return roomId;
    } catch (error) {
      console.error('[CommunityDBManager] 채팅방 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 메시지 전송하기
   * @param {string} roomId - 채팅방 ID
   * @param {Object} messageData - 메시지 데이터
   * @returns {Promise<string>} 생성된 메시지 ID
   */
  async sendMessage(roomId, messageData) {
    try {
      // 정적 임포트 사용
      const { sendMessage } = realtimeChatUtils;
      
      // 메시지 데이터 표준화
      const standardizedMessageData = createMessage({
        ...messageData,
        timestamp: messageData.timestamp || new Date()
      });
      
      // 메시지 전송
      const messageId = await sendMessage(roomId, standardizedMessageData);
      console.log(`[CommunityDBManager] 메시지 전송 완료: ${messageId}`);
      
      return messageId;
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 전송 오류 (${roomId}):`, error);
      throw error;
    }
  }

  /**
   * 메시지 리스너 설정 (Redux Thunk 호환)
   * @param {string} roomId - 채팅방 ID
   * @param {Function} callback - 메시지 변경 시 호출할 콜백 함수
   * @returns {Function} 리스너 해제 함수
   */
  async listenForMessages(roomId, callback) {
    try {
      // 기존 리스너 정리
      if (this.chatListeners[roomId]) {
        console.log(`[CommunityDBManager] 기존 메시지 리스너 제거: ${roomId}`);
        this.chatListeners[roomId]();
        delete this.chatListeners[roomId];
      }
      
      // 정적 임포트 사용
      const { listenForMessages: listenForMessagesFB } = realtimeChatUtils;
      
      // 메시지 리스너 설정
      const unsubscribe = await listenForMessagesFB(roomId, (messages) => {
        // 콜백 함수 호출
        if (typeof callback === 'function') {
          callback(messages);
        }
      });
      
      // 리스너 저장
      this.chatListeners[roomId] = unsubscribe;
      console.log(`[CommunityDBManager] 메시지 리스너 설정 완료: ${roomId}`);
      
      return unsubscribe;
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 리스너 설정 오류 (${roomId}):`, error);
      return () => {};
    }
  }

  /**
   * 타이핑 상태 리스너 설정 (Redux Thunk 호환)
   * @param {string} roomId - 채팅방 ID
   * @param {Function} callback - 타이핑 상태 변경 시 호출할 콜백 함수
   * @returns {Function} 리스너 해제 함수
   */
  async listenForTypingStatus(roomId, callback) {
    try {
      // 기존 리스너 정리
      if (this.typingListeners[roomId]) {
        console.log(`[CommunityDBManager] 기존 타이핑 리스너 제거: ${roomId}`);
        this.typingListeners[roomId]();
        delete this.typingListeners[roomId];
      }
      
      // 정적 임포트 사용
      const { setupTypingListener } = realtimeChatUtils;
      
      // 타이핑 상태 리스너 설정
      const unsubscribe = await setupTypingListener(roomId, (typingUsers) => {
        // 콜백 함수 호출
        if (typeof callback === 'function') {
          callback(typingUsers);
        }
      });
      
      // 리스너 저장
      this.typingListeners[roomId] = unsubscribe;
      console.log(`[CommunityDBManager] 타이핑 리스너 설정 완료: ${roomId}`);
      
      return unsubscribe;
    } catch (error) {
      console.error(`[CommunityDBManager] 타이핑 리스너 설정 오류 (${roomId}):`, error);
      return () => {};
    }
  }

  /**
   * 타이핑 상태 업데이트
   * @param {string} roomId - 채팅방 ID
   * @param {string} userId - 사용자 ID
   * @param {boolean} isTyping - 입력 상태
   * @returns {Promise<void>}
   */
  async updateTypingStatus(roomId, userId, isTyping) {
    try {
      // 정적 임포트 사용
      const { updateTypingStatus } = realtimeChatUtils;
      
      // 타이핑 상태 업데이트
      await updateTypingStatus(roomId, userId, isTyping);
      
      console.log(`[CommunityDBManager] 타이핑 상태 업데이트: ${roomId}, ${userId}, ${isTyping ? '입력중' : '입력중지'}`);
    } catch (error) {
      console.error(`[CommunityDBManager] 타이핑 상태 업데이트 오류 (${roomId}):`, error);
      throw error; // Redux Thunk에서 처리하도록 오류 전파
    }
  }

  /**
   * 파일 업로드 (Redux Thunk 호환)
   * @param {string} roomId - 채팅방 ID
   * @param {File} file - 업로드할 파일
   * @param {Object} userInfo - 사용자 정보
   * @returns {Promise<Object>} 업로드 결과 (url, name)
   */
  async uploadFile(roomId, file, userInfo) {
    try {
      if (!userInfo?.userId) {
        throw new Error('사용자 정보가 필요합니다.');
      }
      
      const { uploadFileAndSendMessage } = realtimeChatUtils;
      const messageData = { 
        message: 'File upload', 
        senderId: userInfo.userId 
      };
      
      const result = await uploadFileAndSendMessage(roomId, messageData, file);
      return { url: result.fileUrl, name: file.name };
    } catch (error) {
      console.error(`[CommunityDBManager] 파일 업로드 오류 (${roomId}):`, error);
      throw error;
    }
  }

  /**
   * 메시지 수정
   * @param {string} roomId - 채팅방 ID
   * @param {string} messageId - 메시지 ID
   * @param {string} newText - 새 메시지 내용
   * @param {string} userId - 사용자 ID (권한 검증용)
   * @returns {Promise<void>}
   */
  async editMessage(roomId, messageId, newText, userId) {
    try {
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다.');
      }
      
      const { editMessage } = realtimeChatUtils;
      await editMessage(roomId, messageId, newText, userId); // userId 전달
      console.log(`[CommunityDBManager] 메시지 수정 완료: ${messageId} (by ${userId})`);
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 수정 오류 (${roomId}, ${messageId}):`, error);
      throw error;
    }
  }

  /**
   * 메시지 삭제
   * @param {string} roomId - 채팅방 ID
   * @param {string} messageId - 메시지 ID
   * @param {string} userId - 사용자 ID (권한 검증용)
   * @returns {Promise<void>}
   */
  async deleteMessage(roomId, messageId, userId) {
    try {
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다.');
      }
      
      const { deleteMessage } = realtimeChatUtils;
      await deleteMessage(roomId, messageId, userId); // userId 전달
      console.log(`[CommunityDBManager] 메시지 삭제 완료: ${messageId} (by ${userId})`);
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 삭제 오류 (${roomId}, ${messageId}):`, error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const communityDBManager = new CommunityDBManager();
export default communityDBManager;
