// travelCommunity컴포넌트 UI - CommunityDBManager 커뮤니티의 채널/채팅/메세지 데이터 관리 - realtimeChatUtilsFB는 유틸리티 컴포넌트. fireBase서버 기능담당
// travelCommunity 컴포넌트가 메인 로직에서 사용되고, travelCommunity 내부에서 CommunityDBManager와 realtimeChatUtilsFB를 사용한다. 
// travelCommunity컴포넌트 <-> communityDBManager.js <-> realtimeChatUtilsFB.js

import { doc, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp, where, setDoc, increment } from 'firebase/firestore';
// date-fns 대신 JavaScript 내장 함수 사용
import { createChatRoom as createChatRoomModel, createMessage, dispatchCommunityEvent, CommunityEventTypes } from '../../models/communityModels.js';
import { firebasedb } from '../../firebaseCli';
import { validateTargetClass } from '../../../lib/services/utilsfordata/chatFirebaseUtils.js';
// 동적 임포트를 정적 임포트로 변경
import * as realtimeChatUtils from '../../../lib/services/realtimeChatUtilsFB.js';



// 현재 활성화된 실시간 채팅 리스너를 관리할 객체
const chatListeners = {};

// 현재 활성화된 타이핑 상태 리스너를 관리할 객체
const typingListeners = {};

/**
 * 커뮤니티 DB 관리 모듈
 * 채팅방 목록 및 메시지 관리를 담당
 */
class CommunityDBManager {
  constructor() {
    this.subscribers = new Set(); // 구독자 관리
    this.currentRoomId = null; // 현재 활성화된 채팅방 ID
    this.typingStatus = {}; // 사용자별 타이핑 상태 관리
    this.userInfo = null; // 현재 사용자 정보
  }

  /**
   * 초기화 함수 - ModuleManager에서 호출
   */
  initialize() {
    console.log('[CommunityDBManager] 초기화됨');
    return this;
  }
  
  /**
   * 이벤트 기반 초기화 함수 - 컴포넌트에서 호출
   * @param {Object} userInfo - 사용자 정보
   * @param {EventTarget} target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<Object>} 채팅 데이터 (rooms, messages, roomId)
   */
  async initializeWithEvents(userInfo, target) {
    let validatedTarget = null;
    
    try {
      // 사용자 정보 저장
      this.userInfo = userInfo;
      
      // target이 .travelCommunity-container 클래스를 가진 DOM 요소인지 검증
      validatedTarget = validateTargetClass(target, 'travelCommunity-container', 'CommunityDBManager.initializeWithEvents');
      
      console.log('[CommunityDBManager] 이벤트 기반 초기화 시작', { userInfo });
      
      // 채팅방 목록 로드 및 이벤트 발행
      const chatData = await this.loadChatData(null, { target: validatedTarget, messageLimit: 50 /* 기본 메시지 수 */ });
      
      // CHAT_ROOMS_LOADED 이벤트 발행
      this.notifySubscribers(CommunityEventTypes.CHAT_ROOMS_LOADED, { 
        rooms: chatData.rooms,
        roomId: chatData.roomId, 
        messages: chatData.messages // loadChatData now includes initial messages
      }, validatedTarget);
      
      console.log('[CommunityDBManager] 이벤트 기반 초기화 완료');
      return chatData;
    } catch (error) {
      console.error('[CommunityDBManager] 이벤트 기반 초기화 오류:', error);
      
      // 오류 이벤트 발행 - 유효한 target이 있는 경우에만 사용
      if (validatedTarget) {
        this.notifySubscribers(CommunityEventTypes.ERROR, {
          error: error.message,
          functionName: 'CommunityDBManager.initializeWithEvents',
          details: error.stack
        }, validatedTarget);
      } else if (target && typeof target.dispatchEvent === 'function') {
        // 검증 전에 오류가 발생한 경우 원본 target 사용 시도
        try {
          this.notifySubscribers(
            CommunityEventTypes.ERROR, 
            { 
              error: error.message,
              functionName: 'CommunityDBManager.initializeWithEvents (fallback target)',
              details: error.stack 
            }, 
            target
          );
        } catch (dispatchError) {
          console.error('[CommunityDBManager] 오류 이벤트 발행 실패:', dispatchError);
        }
      }
      
      throw error;
    }
  }

  /**
   * 정리 함수 - ModuleManager에서 호출
   */
  cleanup() {
    this.subscribers.clear();
    this.currentRoomId = null;
    
    // 모든 채팅 리스너 정리
    Object.keys(chatListeners).forEach(roomId => {
      if (chatListeners[roomId]) {
        chatListeners[roomId]();
        delete chatListeners[roomId];
      }
    });
    
    console.log('[CommunityDBManager] 정리됨');
  }

  /**
   * 일시 중단 함수 - ModuleManager에서 호출
   */
  suspend() {
    // 모든 채팅 리스너 정리
    Object.keys(chatListeners).forEach(roomId => {
      if (chatListeners[roomId]) {
        chatListeners[roomId]();
        delete chatListeners[roomId];
      }
    });
    
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
   * 채팅 데이터 로드 (채팅방 목록 및 메시지)
   * @param {string} roomId - 채팅방 ID (선택적)
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 채팅 데이터 (rooms, messages, roomId)
   */
  async loadChatData(requestedRoomId = null, options = {}) {
    try {
      const { messageLimit = 50 } = options; // 메시지 제한 옵션 추가
      console.log(`[CommunityDBManager] 채팅 데이터 로드 시작 (requestedRoomId: ${requestedRoomId || '없음'})`);
      
      // 채팅방 목록 로드
      const rooms = await this.getChatRooms();
      
      // 채팅방이 없는 경우 테스트 채팅방 생성 (중복 생성 방지)
      if (rooms.length === 0) {
        // 이미 테스트 채팅방 생성 중인지 확인하는 정적 변수
        if (this._isCreatingTestRoom) {
          console.log('[CommunityDBManager] 테스트 채팅방 이미 생성 중, 중복 생성 방지');
          return { rooms: [], messages: [], roomId: null };
        }
        
        console.log('[CommunityDBManager] 채팅방 없음, 테스트 채팅방 생성 시도');
        this._isCreatingTestRoom = true; // 생성 중 플래그 설정
        
        try {
          // 테스트 채팅방 생성
          const testRoomData = {
            name: "테스트 채팅방",
            isPublic: true,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            members: ['user-1'],
            admins: ['user-1'],
            lastMessage: '환영합니다! 이것은 테스트 채팅방입니다.',
            lastMessageTime: new Date()
          };
          
          const newRoomId = await this.createChatRoom(testRoomData);
          console.log(`[CommunityDBManager] 테스트 채팅방 생성 성공: ${newRoomId}`);
          
          // 테스트 메시지 추가
          await this.sendMessage(newRoomId, {
            username: '시스템',
            message: '환영합니다! 이것은 테스트 채팅방입니다.',
            timestamp: new Date(),
            senderId: 'system'
          });
          
          // 채팅방 목록 다시 가져오기 (재귀 호출 제거)
          const updatedRooms = await this.getChatRooms();
          const validRoomId = newRoomId;
          
          // 선택된 채팅방 표시
          const roomsWithSelected = updatedRooms.map(room => ({
            ...room,
            isSelected: room.id === validRoomId
          }));
          
          // 생성된 채팅방의 메시지 가져오기
          const messages = await this._getRawChatMessages(validRoomId, messageLimit);
          
          this._isCreatingTestRoom = false; // 생성 완료 플래그 제거
          return { rooms: roomsWithSelected, messages, roomId: validRoomId };
        } catch (createError) {
          this._isCreatingTestRoom = false; // 오류 발생 시 플래그 제거
          console.error('[CommunityDBManager] 테스트 채팅방 생성 실패:', {
            message: createError.message,
            code: createError.code,
            details: createError.details,
            stack: createError.stack
          });
          return { rooms: [], messages: [], roomId: null };
        }
      }
      
      // 채팅방 ID가 없거나 유효하지 않은 경우 첫 번째 채팅방 선택
      const validRoomId = requestedRoomId && rooms.some(room => room.id === requestedRoomId) 
        ? requestedRoomId 
        : rooms[0]?.id;
      
      // 선택된 채팅방 표시
      const roomsWithSelected = rooms.map(room => ({
        ...room,
        isSelected: room.id === validRoomId
      }));
      
      // 메시지 로드 (선택된 채팅방이 있는 경우)
      let messages = [];
      if (validRoomId) {
        try {
          messages = await this._getRawChatMessages(validRoomId, messageLimit);
          console.log(`[CommunityDBManager] 채팅 메시지 로드 성공: ${messages.length}개`);
        } catch (messageError) {
          console.error(`[CommunityDBManager] 메시지 로드 오류:`, messageError);
          // 메시지 로드 실패해도 채팅방 목록은 반환
        }
      }
      
      console.log(`[CommunityDBManager] 채팅 데이터 로드 완료 (roomId: ${validRoomId || '없음'})`);
      return { 
        rooms: roomsWithSelected, 
        messages, // initial messages for the determined room
        roomId: validRoomId 
      };
    } catch (error) {
      console.error('[CommunityDBManager] 채팅 데이터 로드 오류:', error);
      // 오류 발생 시 빈 데이터 반환
      return { rooms: [], messages: [], roomId: null };
    }
  }

  /**
   * 채팅방 목록 가져오기
   * @returns {Promise<Array>} 채팅방 목록
   */
  async getChatRooms() {
    try {
      console.log("[CommunityDBManager] 채팅방 목록 가져오기 시작");
      
      // 먼저 lastMessageTime 필드가 있는 문서만 가져오는 쿼리 시도
      try {
        const roomsWithTimeQuery = query(
          collection(firebasedb, "chatRooms"),
          where("lastMessageTime", "!=", null),
          orderBy("lastMessageTime", "desc")
        );
        
        const querySnapshot = await getDocs(roomsWithTimeQuery);
        const rooms = [];
        
        querySnapshot.forEach((doc) => {
          const roomData = doc.data();
          rooms.push({
            id: doc.id,
            name: roomData.name,
            badge: roomData.messageCount || '',
            isSelected: false,
            notification: roomData.hasNewMessages || false,
            lastMessage: roomData.lastMessage || '',
            lastMessageTime: roomData.lastMessageTime ? roomData.lastMessageTime.toDate() : null
          });
        });
        
        console.log(`[CommunityDBManager] 채팅방 목록 가져오기 성공 (lastMessageTime 있는 문서): ${rooms.length}개`);
        return rooms;
      } catch (timeQueryError) {
        console.warn("lastMessageTime 필드로 정렬된 쿼리 실패, 기본 쿼리로 시도:", timeQueryError);
        
        // lastMessageTime 필드가 없는 경우 기본 쿼리 시도
        const basicQuery = query(
          collection(firebasedb, "chatRooms")
        );
        
        const querySnapshot = await getDocs(basicQuery);
        const rooms = [];
        
        querySnapshot.forEach((doc) => {
          const roomData = doc.data();
          rooms.push({
            id: doc.id,
            name: roomData.name || `채팅방 ${doc.id.substring(0, 5)}`,
            badge: roomData.messageCount || '',
            isSelected: false,
            notification: roomData.hasNewMessages || false,
            lastMessage: roomData.lastMessage || '',
            lastMessageTime: roomData.lastMessageTime ? roomData.lastMessageTime.toDate() : null
          });
        });
        
        // 수동으로 정렬 (lastMessageTime이 있는 문서 우선, 없는 문서는 뒤로)
        rooms.sort((a, b) => {
          if (a.lastMessageTime && b.lastMessageTime) {
            return b.lastMessageTime - a.lastMessageTime;
          } else if (a.lastMessageTime) {
            return -1; // a가 앞으로
          } else if (b.lastMessageTime) {
            return 1;  // b가 앞으로
          }
          return 0;    // 둘 다 없으면 순서 유지
        });
        
        console.log(`[CommunityDBManager] 채팅방 목록 가져오기 성공 (기본 쿼리): ${rooms.length}개`);
        return rooms;
      }
    } catch (error) {
      console.error("[CommunityDBManager] 채팅방 목록 가져오기 오류:", {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack,
        name: error.name,
        fullError: error
      });
      return [];
    }
  }

  /**
   * 특정 채팅방의 메시지 가져오기
   * @param {string} roomId - 채팅방 ID
   * @param {number} [messageLimit=50] - 메시지 수 제한
   * @returns {Promise<ChatMessage[]>} 표준화된 메시지 객체 배열
   */
  /**
   * 내부용: 특정 채팅방의 메시지 가져오기 (이벤트 발행 없음)
   * @param {string} roomId - 채팅방 ID
   * @param {number} [messageLimit=50] - 메시지 수 제한
   * @returns {Promise<ChatMessage[]>} 표준화된 메시지 객체 배열
   */
  async _getRawChatMessages(roomId, messageLimit = 50) {
    // Current getChatMessages logic will be here, unchanged for now, just renamed.
    // This method will be used by loadChatData/initializeWithEvents for the initial message load.

    try {
      const messagesQuery = query(
        collection(firebasedb, 'chatRooms', roomId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(messageLimit)
      );
      const querySnapshot = await getDocs(messagesQuery);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // 데이터 가공 및 유효성 검사
        const messageData = {
          id: doc.id,
          ...data,
          senderId: data.userId || 'anonymous', // userId를 senderId로 매핑, 기본값 설정
          timestamp: data.timestamp?.toDate() || new Date(), // Firestore Timestamp를 Date 객체로 변환
          updatedAt: data.updatedAt?.toDate() || null
        };
        
        // 디버깅용 로그
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[CommunityDBManager] 메시지 데이터 가공:`, {
            id: messageData.id,
            senderId: messageData.senderId,
            message: messageData.message?.substring(0, 20) + (messageData.message?.length > 20 ? '...' : '')
          });
        }
        
        return createMessage(messageData);
      });
    } catch (error) {
      console.error(`[CommunityDBManager] 메시지 로드 오류 (${roomId}):`, error);
      throw { code: 'FETCH_MESSAGES_FAILED', message: '메시지 로드 실패' };
    }
  }

  /**
   * 특정 채팅방의 메시지 가져오기 및 이벤트 발행
   * @param {string} roomId - 채팅방 ID
   * @param {Object} options - 추가 옵션 (target 포함)
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상
   * @param {number} [options.messageLimit=50] - 메시지 수 제한
   */
  async getChatMessages(roomId, options = {}) {
    const { target, messageLimit = 50 } = options;
    let validatedTarget = null;
    try {
      validatedTarget = validateTargetClass(target, 'travelCommunity-container', 'CommunityDBManager.getChatMessages');
      if (!validatedTarget) {
        console.warn('[CommunityDBManager.getChatMessages] 유효하지 않은 이벤트 대상입니다.');
        // throw new Error('유효하지 않은 이벤트 대상입니다.'); // 또는 오류를 발생시키지 않고 조용히 실패
        return; // 대상이 없으면 진행 불가
      }

      const messages = await this._getRawChatMessages(roomId, messageLimit);
      
      this.notifySubscribers(CommunityEventTypes.MESSAGES_UPDATED, { 
        roomId,
        messages 
      }, validatedTarget);

    } catch (error) {
      console.error(`[CommunityDBManager.getChatMessages] 메시지 로드 오류 (${roomId}):`, error);
      if (validatedTarget) {
        this.notifySubscribers(CommunityEventTypes.ERROR, {
          error: error.message || '메시지 로드 실패',
          functionName: 'CommunityDBManager.getChatMessages',
          details: error.stack,
          roomId
        }, validatedTarget);
      } else if (target && typeof target.dispatchEvent === 'function') {
        try {
          this.notifySubscribers(CommunityEventTypes.ERROR, { 
            error: error.message || '메시지 로드 실패',
            functionName: 'CommunityDBManager.getChatMessages (fallback target)',
            details: error.stack,
            roomId
          }, target);
        } catch (dispatchError) {
          console.error('[CommunityDBManager.getChatMessages] 오류 이벤트 발행 실패:', dispatchError);
        }
      }
      // 이 함수는 값을 반환하지 않으므로, 오류를 다시 throw할 필요는 없음.
    }
  }

  /**
   * 메시지 전송하기
   * @param {string} roomId - 채팅방 ID
   * @param {Object} messageData - 메시지 데이터
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<string>} 생성된 메시지 ID
   */
  async sendMessage(roomId, messageData, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        throw new Error('이벤트 대상이 필요합니다');  
      }
      const { sendMessage, clearCache } = realtimeChatUtils;
      const messageId = await sendMessage(roomId, messageData, { target });
      clearCache('messages', roomId);
      clearCache('chatRooms');
      
      // 성능 최적화: 전체 메시지를 다시 가져오는 대신 새 메시지만 알림
      // 리스너가 이미 실시간 업데이트를 처리하므로 여기서는 messageSent 이벤트만 발행
      this.notifySubscribers('messageSent', { 
        roomId, 
        messageId, 
        message: createMessage({
          id: messageId,
          ...messageData,
          timestamp: new Date()
        })
      }, target);
      
      return messageId;
    } catch (error) {
      console.error(`메시지 전송 오류 (${roomId}):`, error);
      // 일관된 오류 처리
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers('error', { roomId, error: error.message }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }

  /**
   * 실시간 채팅 리스너 설정
   * @param {string} roomId - 채팅방 ID
   * @param {Function} callback - 메시지 수신 시 호출할 콜백 함수
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Function} 리스너 해제 함수
   */
  setupChatListener(roomId, options = {}) {
    if (!roomId) {
      console.error('잘못된 파라미터로 채팅 리스너 설정 시도');
      return () => {};
    }

    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        throw new Error('이벤트 대상이 필요합니다');
      }
      console.log(`[CommunityDBManager] 채팅방 ${roomId} 리스너 설정 시작`);

      if (chatListeners[roomId]) {
        console.log(`[CommunityDBManager] 기존 리스너 제거: ${roomId}`);
        chatListeners[roomId]();
        delete chatListeners[roomId];
      }

      this.currentRoomId = roomId;

      const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        console.log(`[CommunityDBManager] 실시간 데이터 변경 감지: ${roomId}, 문서 수: ${snapshot.size}`);

        const messages = snapshot.docs.map(doc => createMessage({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(),
        }));

        callback(messages);

        this.notifySubscribers('messagesUpdated', { roomId, messages }, target);
      }, (error) => {
        console.error(`[CommunityDBManager] 실시간 리스너 오류: ${roomId}`, error);
        this.notifySubscribers(CommunityEventTypes.ERROR, { roomId, error: error.message, functionName: 'CommunityDBManager.setupChatListener.onSnapshotError', details: error.stack }, target);
      });

      chatListeners[roomId] = unsubscribe;
      console.log(`[CommunityDBManager] 리스너 설정 완료: ${roomId}`);

      return unsubscribe;
    } catch (error) {
      console.error(`[CommunityDBManager] 채팅 리스너 설정 오류 (${roomId}):`, error);
      // 오류 이벤트 발행 (일관된 오류 처리)
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers(CommunityEventTypes.ERROR, { roomId, error: error.message, functionName: 'CommunityDBManager.setupChatListener', details: error.stack }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      return () => {};
    }
  }

  /**
   * 채팅방 생성하기
   * @param {Object} roomData - 채팅방 데이터
   * @param {Object} options - 옵션 (useCache 등)
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<string>} 생성된 채팅방 ID
   */
  async createChatRoom(roomData, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        console.warn(`[CommunityDBManager] 유효하지 않은 이벤트 대상: createChatRoom`, new Error().stack);
        throw new Error('이벤트 대상이 필요합니다');
      }
      
      console.log('[CommunityDBManager] 채팅방 생성 시작:', roomData, options);
      
      // 정적 임포트 사용 (이름 충돌 방지 위해 alias 사용)
      const { createChatRoom: createChatRoomInFB, clearCache } = realtimeChatUtils;
      
      // 입력된 roomData를 ChatRoom 모델에 맞게 표준화 (Firestore 저장 전)
      // createChatRoomModel은 createdAt, lastMessageTime 등을 ISO 문자열로 변환합니다.
      // realtimeChatUtilsFB.createChatRoom (즉, createChatRoomInFB)이 Firestore Timestamp를 직접 다룬다면,
      // 이 단계에서 생성된 ISO 문자열을 Timestamp로 변환하거나, createChatRoomInFB 내부에서 처리해야 합니다.
      // 또는 Firestore에 저장할 필드만 선택적으로 구성해야 할 수 있습니다.
      // 여기서는 모델을 적용하여 데이터를 표준화하는 데 중점을 둡니다.
      const standardizedRoomDataForDB = createChatRoomModel(roomData);

      // 채팅방 생성 (Firestore에 저장)
      // createChatRoomInFB에 전달하는 데이터는 Firestore가 기대하는 형식이어야 합니다.
      // 예를 들어, standardizedRoomDataForDB의 createdAt (ISO 문자열)을 Firestore Timestamp로 변환해야 할 수 있습니다.
      // 이 부분은 createChatRoomInFB의 구현에 따라 달라집니다. 지금은 표준화된 객체를 전달합니다.
      const roomId = await createChatRoomInFB(standardizedRoomDataForDB);
      console.log('[CommunityDBManager] 채팅방 생성 완료, ID:', roomId);
      
      // 캐시 무효화 (useCache 옵션이 false인 경우에만)
      // options.useCache는 createChatRoomInFB 호출 시 전달되어 Firestore 레벨에서 캐시 사용 여부를 결정할 수도 있고,
      // CommunityDBManager 레벨에서의 캐시 관리일 수도 있습니다. 여기서는 CommunityDBManager의 캐시로 가정합니다.
      if (options && options.useCache === false) { // 명시적으로 false일 때만 캐시 클리어
        // clearCache는 realtimeChatUtilsFB에서 가져왔으므로, 해당 유틸리티의 캐시를 지칭할 가능성이 높습니다.
        // 'chatRooms' 캐시를 지우는 것이 적절해 보입니다.
        clearCache('chatRooms'); 
      }
      
      // 구독자에게 알림 (roomId를 포함하여 모델 다시 적용)
      const newRoomDataForNotification = createChatRoomModel({ ...standardizedRoomDataForDB, id: roomId });
      this.notifySubscribers('chatRooms', {
        type: 'create',
        id: roomId,
        data: newRoomDataForNotification
      }, target);
      
      return roomId;
    } catch (error) {
      console.error("[CommunityDBManager] 채팅방 생성 오류:", error);
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers('error', { error: error.message }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }

  /**
   * 구독자 등록 (컴포넌트에서 호출)
   * @param {Function} subscriber - 데이터 변경 시 호출될 함수
   * @returns {Function} 구독 해제 함수
   */
  subscribe(subscriber) {
    if (typeof subscriber !== 'function') {
      console.error('잘못된 구독자 형식');
      return () => {};
    }
    
    this.subscribers.add(subscriber);
    
    // 구독 해제 함수 반환
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * 모든 구독자에게 데이터 변경 알림
   * @param {string} eventType - 이벤트 타입 ('messagesUpdated', 'roomUpdated', 'error' 등)
   * @param {Object} data - 이벤트 관련 데이터 객체. 예: { roomId: 'xyz', messages: [...], error: '...' }
   * @param {EventTarget} target - 이벤트를 디스패치할 대상
   */
  notifySubscribers(eventType, data, target) {
    // 최소한의 방어적 검사만 유지
    if (!target) {
      console.error(`[CommunityDBManager] 이벤트 대상이 누락됨: ${eventType}`);
      return;
    }
    
    try {
      // 이벤트 디스패치 - 모든 이벤트 발행은 이 함수를 통해 중앙화
      dispatchCommunityEvent(eventType, data, target);
      
      // 로깅 추가 - 개발 환경에서만 상세 로깅 수행
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CommunityDBManager] 이벤트 디스패치 성공: ${eventType}`, {
          eventType,
          dataKeys: Object.keys(data || {}),
          targetElement: target instanceof HTMLElement ? target.className : typeof target
        });
      }
      
      // 참고: 기존 콜백 기반 구독자 알림은 dispatchCommunityEvent로 통합되어 제거됨
      // 이전 버전에서는 this.subscribers.forEach(subscriber => subscriber(eventType, data))와 같은 콜백 호출이 있었지만,
      // 이벤트 기반 아키텍처로 완전히 전환하여 모든 통신은 커스텀 이벤트를 통해 이루어짐
    } catch (error) {
      console.error(`[CommunityDBManager] 이벤트 디스패치 오류: ${eventType}`, error);
      throw error; // 오류 재전파하여 호출자가 처리할 수 있도록 함
    }
  }

  /**
   * 모든 리스너 정리 (컴포넌트 언마운트 시 호출)
   */
  cleanupListeners() {
    try {
      console.log('[CommunityDBManager] 리스너 정리 시작');
      
      // 모든 채팅 리스너 정리
      Object.keys(chatListeners).forEach(roomId => {
        try {
          if (chatListeners[roomId] && typeof chatListeners[roomId] === 'function') {
            chatListeners[roomId]();
            console.log(`[CommunityDBManager] 채팅 리스너 정리: ${roomId}`);
          }
        } catch (error) {
          console.warn(`[CommunityDBManager] 채팅 리스너 정리 오류 (${roomId}):`, error);
        } finally {
          delete chatListeners[roomId];
        }
      });
      
      // 모든 타이핑 리스너 정리
      Object.keys(typingListeners).forEach(roomId => {
        try {
          if (typingListeners[roomId] && typeof typingListeners[roomId] === 'function') {
            typingListeners[roomId]();
            console.log(`[CommunityDBManager] 타이핑 리스너 정리: ${roomId}`);
          }
        } catch (error) {
          console.warn(`[CommunityDBManager] 타이핑 리스너 정리 오류 (${roomId}):`, error);
        } finally {
          delete typingListeners[roomId];
        }
      });
      
      // 리스너 객체 초기화
      Object.keys(chatListeners).length = 0;
      Object.keys(typingListeners).length = 0;
      
      console.log('[CommunityDBManager] 모든 리스너 정리됨');
    } catch (error) {
      console.error('[CommunityDBManager] 리스너 정리 중 오류:', error);
    }
  }

  /**
   * 메시지 읽음 처리
   * @param {string} roomId - 채팅방 ID
   * @param {Array<string>} messageIds - 읽음 처리할 메시지 ID 배열
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<Object>} 읽음 처리 결과
   */
  async markMessagesAsRead(roomId, messageIds, userId, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        console.warn(`[CommunityDBManager] 유효하지 않은 이벤트 대상: markMessagesAsRead`, new Error().stack);
        throw new Error('이벤트 대상이 필요합니다');
      }
      
      // realtimeChatUtilsFB에서 필요한 함수 가져오기
      const { markMessagesAsRead, clearCache } = await import('../../../lib/services/realtimeChatUtilsFB.js');
      
      // 메시지 읽음 처리 옵션 설정
      const readOptions = {
        ...options,
        communityDBManager: this, // 구독자 알림을 위해 자신을 전달
        notifySubscribers: true
      };
      
      // 메시지 읽음 처리
      const result = await markMessagesAsRead(roomId, messageIds, userId, readOptions);
      
      // 캐시 무효화
      clearCache('messages', roomId);
      clearCache('chatRooms');
      
      // 구독자에게 알림
      this.notifySubscribers('messagesRead', {
        roomId,
        messageIds,
        userId,
        timestamp: new Date()
      }, target);
      
      return result;
    } catch (error) {
      console.error(`메시지 읽음 처리 오류 (${roomId}):`, error);
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers('error', { roomId, error: error.message }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }
  
  /**
   * 메시지 수정
   * @param {string} roomId - 채팅방 ID
   * @param {string} messageId - 메시지 ID
   * @param {string} newMessage - 새로운 메시지 내용
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<void>}
   */
  async editMessage(roomId, messageId, newMessage, userId, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        throw new Error('이벤트 대상이 필요합니다');
      }
      const { editMessage, clearCache } = realtimeChatUtils;
      await editMessage(roomId, messageId, newMessage, userId);
      clearCache('messages', roomId);
      this.notifySubscribers(CommunityEventTypes.MESSAGE_EDITED, { roomId, messageId, newMessage, userId, timestamp: new Date() }, target);
      console.log(`메시지 수정 성공: ${roomId}, ${messageId}`);
    } catch (error) {
      console.error(`메시지 수정 오류 (${roomId}, ${messageId}):`, error);
      // 일관된 오류 처리
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers('error', { roomId, error: error.message }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }
  
  /**
   * 메시지 삭제
   * @param {string} roomId - 채팅방 ID
   * @param {string} messageId - 메시지 ID
   * @param {string} userId - 사용자 ID
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<void>}
   */
  async deleteMessage(roomId, messageId, userId, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        throw new Error('이벤트 대상이 필요합니다');
      }
      const { deleteMessage, clearCache } = realtimeChatUtils;
      await deleteMessage(roomId, messageId, userId);
      clearCache('messages', roomId);
      clearCache('chatRooms');
      this.notifySubscribers(CommunityEventTypes.MESSAGE_DELETED, { roomId, messageId, userId, timestamp: new Date() }, target);
      console.log(`메시지 삭제 성공: ${roomId}, ${messageId}`);
    } catch (error) {
      console.error(`메시지 삭제 오류 (${roomId}, ${messageId}):`, error);
      // 일관된 오류 처리
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers('error', { roomId, error: error.message }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }
  
  /**
   * 첨부 파일 업로드 및 메시지 전송
   * @param {string} roomId - 채팅방 ID
   * @param {Object} messageData - 메시지 데이터
   * @param {File} file - 업로드할 파일
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Promise<string>} 생성된 메시지 ID
   */
  async uploadFileAndSendMessage(roomId, messageData, file, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        console.warn(`[CommunityDBManager] 유효하지 않은 이벤트 대상: uploadFileAndSendMessage`, new Error().stack);
        throw new Error('이벤트 대상이 필요합니다');
      }
      
      // 정적 임포트 사용
      const { uploadFileAndSendMessage, clearCache } = realtimeChatUtils;
      
      // 파일 업로드 및 메시지 전송
      const messageId = await uploadFileAndSendMessage(roomId, messageData, file);
      
      // 캐시 무효화
      clearCache('messages', roomId);
      clearCache('chatRooms');
      
      // 구독자에게 알림
      const messages = await this.getChatMessages(roomId);
      this.notifySubscribers(CommunityEventTypes.MESSAGES_UPDATED, { roomId, messages }, target);
      
      console.log(`파일 업로드 및 메시지 전송 성공: ${roomId}, ${messageId}`);
      return messageId;
    } catch (error) {
      console.error(`파일 업로드 오류 (${roomId}):`, error);
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers(CommunityEventTypes.ERROR, { roomId, error: error.message, functionName: 'CommunityDBManager.uploadFileAndSendMessage', details: error.stack }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      throw error;
    }
  }
  
  /**
   * 입력 상태 업데이트
   * @param {string} roomId - 채팅방 ID
   * @param {string} userId - 사용자 ID
   * @param {boolean} isTyping - 입력 상태
   * @returns {Promise<void>}
   */
  async updateTypingStatus(roomId, userId, isTyping) {
    try {
      // 이전 상태와 동일한 경우 업데이트 스킵
      if (this.typingStatus[roomId]?.[userId] === isTyping) {
        return;
      }
      
      // 정적 임포트 사용
      const { updateTypingStatus } = realtimeChatUtils;
      
      // 입력 상태 업데이트
      await updateTypingStatus(roomId, userId, isTyping);
      
      // 로컬 상태 업데이트
      if (!this.typingStatus[roomId]) {
        this.typingStatus[roomId] = {};
      }
      this.typingStatus[roomId][userId] = isTyping;
      
      console.log(`입력 상태 업데이트: ${roomId}, ${userId}, ${isTyping ? '입력중' : '입력중지'}`);
    } catch (error) {
      console.error(`입력 상태 업데이트 오류 (${roomId}):`, error);
      // 오류가 발생해도 UI에 영향을 주지 않도록 오류를 전파하지 않음
    }
  }
  
  /**
   * 실시간 입력 상태 리스너 설정
   * @param {string} roomId - 채팅방 ID
   * @param {Function} callback - 입력 상태 변경 시 호출할 콜백 함수
   * @param {Object} options - 추가 옵션
   * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (예: .travelCommunity-container DOM 요소)
   * @returns {Function} 리스너 해제 함수
   */
  async setupTypingListener(roomId, options = {}) {
    try {
      const { target } = options;
      if (!target || typeof target.dispatchEvent !== 'function') {
        console.warn(`[CommunityDBManager] 유효하지 않은 이벤트 대상: setupTypingListener`, new Error().stack);
        throw new Error('이벤트 대상이 필요합니다');
      }
      
      // 기존 리스너 정리
      if (typingListeners[roomId]) {
        console.log(`[기존 타이핑 리스너 제거: ${roomId}`);
        typingListeners[roomId]();
        delete typingListeners[roomId];
      }
      
      // 정적 임포트 사용
      const { setupTypingListener } = realtimeChatUtils;
      
      // 입력 상태 리스너 설정
      const unsubscribe = await setupTypingListener(roomId, (typingUsers) => {
        // 로컬 상태 업데이트
        this.typingStatus[roomId] = typingUsers;
        
        // 구독자에게 알림
        this.notifySubscribers(CommunityEventTypes.TYPING_STATUS, {
          roomId,
          typingUsers,
          timestamp: new Date()
        }, target);
      });
      
      // 리스너 저장
      typingListeners[roomId] = unsubscribe;
      console.log(`타이핑 리스너 설정 완료: ${roomId}`);
      
      return unsubscribe;
    } catch (error) {
      console.error(`타이핑 리스너 설정 오류 (${roomId}):`, error);
      if (options.target && typeof options.target.dispatchEvent === 'function') {
        this.notifySubscribers(CommunityEventTypes.ERROR, { roomId, error: error.message, functionName: 'CommunityDBManager.setupTypingListener', details: error.stack }, options.target);
      } else {
        console.warn(`[CommunityDBManager] 오류 이벤트 디스패치 실패: 유효한 대상 없음`);
      }
      return () => {};
    }
  }

  /**
   * 현재 로드된 채팅방 목록을 반환합니다.
   * @returns {ChatRoom[]} 현재 로컬에 캐시된 채팅방 목록 또는 빈 배열
   */
  getCurrentUserChatRooms() {
    return this.chatRooms || [];
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const communityDBManager = new CommunityDBManager();
export default communityDBManager;