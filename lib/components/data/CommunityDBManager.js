import { doc, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp, where, setDoc, increment } from 'firebase/firestore';
import { firebasedb } from '../../../firebase';

// 현재 활성화된 실시간 채팅 리스너를 관리할 객체
const chatListeners = {};

/**
 * 커뮤니티 DB 관리 모듈
 * 채팅방 목록 및 메시지 관리를 담당
 */
class CommunityDBManager {
  constructor() {
    this.subscribers = new Set(); // 구독자 관리
    this.currentRoomId = null; // 현재 활성화된 채팅방 ID
  }

  /**
   * 초기화 함수 - ModuleManager에서 호출
   */
  initialize() {
    console.log('[CommunityDBManager] 초기화됨');
    return this;
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
   * 채팅방 목록 가져오기
   * @returns {Promise<Array>} 채팅방 목록
   */
  async getChatRooms() {
    try {
      const roomsQuery = query(
        collection(firebasedb, "chatRooms"),
        orderBy("lastMessageTime", "desc")
      );
      
      const querySnapshot = await getDocs(roomsQuery);
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
      
      return rooms;
    } catch (error) {
      console.error("채팅방 목록 가져오기 오류:", error);
      return [];
    }
  }

  /**
   * 특정 채팅방의 메시지 가져오기
   * @param {string} roomId - 채팅방 ID
   * @param {number} messageLimit - 가져올 메시지 수 제한
   * @returns {Promise<Array>} 메시지 목록
   */
  async getChatMessages(roomId, messageLimit = 50) {
    try {
      const messagesQuery = query(
        collection(firebasedb, "chatRooms", roomId, "messages"),
        orderBy("timestamp", "asc"),
        limit(messageLimit)
      );
      
      const querySnapshot = await getDocs(messagesQuery);
      const messages = [];
      
      querySnapshot.forEach((doc) => {
        const messageData = doc.data();
        messages.push({
          id: doc.id,
          username: messageData.username,
          userType: messageData.userType || '',
          message: messageData.message,
          timestamp: messageData.timestamp ? messageData.timestamp.toDate() : new Date(),
          isBold: messageData.isBold || false
        });
      });
      
      return messages;
    } catch (error) {
      console.error(`채팅방 ${roomId} 메시지 가져오기 오류:`, error);
      return [];
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
      // 메시지 컬렉션에 추가
      const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
      const newMessage = {
        username: messageData.username,
        userType: messageData.userType || '',
        message: messageData.message,
        timestamp: serverTimestamp(),
        isBold: messageData.isBold || false
      };
      
      const docRef = await addDoc(messagesRef, newMessage);
      
      // 채팅방 문서 업데이트 (최근 메시지 정보)
      const roomRef = doc(firebasedb, "chatRooms", roomId);
      await setDoc(roomRef, {
        lastMessage: messageData.message,
        lastMessageTime: serverTimestamp(),
        lastSender: messageData.username,
        messageCount: increment(1)
      }, { merge: true });
      
      return docRef.id;
    } catch (error) {
      console.error("메시지 전송 오류:", error);
      throw error;
    }
  }

  /**
   * 실시간 채팅 리스너 설정
   * @param {string} roomId - 채팅방 ID
   * @param {Function} callback - 메시지 수신 시 호출할 콜백 함수
   * @returns {Function} 리스너 해제 함수
   */
  setupChatListener(roomId, callback) {
    if (!roomId || typeof callback !== 'function') {
      console.error('잘못된 파라미터로 채팅 리스너 설정 시도');
      return () => {}; // 더미 해제 함수 반환
    }

    try {
      console.log(`[CommunityDBManager] 채팅방 ${roomId} 리스너 설정 시작`);
      
      // 기존 리스너가 있으면 정리
      if (chatListeners[roomId]) {
        console.log(`[CommunityDBManager] 기존 리스너 제거: ${roomId}`);
        chatListeners[roomId]();
        delete chatListeners[roomId];
      }
      
      // 현재 활성화된 채팅방 ID 업데이트
      this.currentRoomId = roomId;
      
      // 메시지 컬렉션 참조
      const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      
      console.log(`[CommunityDBManager] 실시간 리스너 설정 중: ${roomId}`);
      
      // 실시간 리스너 설정
      const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
        console.log(`[CommunityDBManager] 실시간 데이터 변경 감지: ${roomId}, 문서 수: ${querySnapshot.size}`);
        
        const messages = [];
        
        querySnapshot.forEach((doc) => {
          const messageData = doc.data();
          messages.push({
            id: doc.id,
            username: messageData.username,
            userType: messageData.userType || '',
            message: messageData.message,
            timestamp: messageData.timestamp ? messageData.timestamp.toDate() : new Date(),
            isBold: messageData.isBold || false
          });
        });
        
        // 메시지 정렬 (시간순)
        messages.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return 0;
        });
        
        console.log(`[CommunityDBManager] 콜백 호출: ${roomId}, 메시지 수: ${messages.length}`);
        
        // 콜백 호출
        callback(messages);
        
        // 구독자에게도 알림
        this.notifySubscribers(roomId, messages);
      }, (error) => {
        console.error(`[CommunityDBManager] 실시간 리스너 오류: ${roomId}`, error);
      });
      
      // 리스너 저장
      chatListeners[roomId] = unsubscribe;
      console.log(`[CommunityDBManager] 리스너 설정 완료: ${roomId}`);
      
      return unsubscribe;
    } catch (error) {
      console.error(`[CommunityDBManager] 채팅 리스너 설정 오류 (${roomId}):`, error);
      return () => {};
    }
  }

  /**
   * 채팅방 생성하기
   * @param {Object} roomData - 채팅방 데이터
   * @returns {Promise<string>} 생성된 채팅방 ID
   */
  async createChatRoom(roomData) {
    try {
      const roomsRef = collection(firebasedb, "chatRooms");
      const newRoom = {
        name: roomData.name,
        description: roomData.description || '',
        createdAt: serverTimestamp(),
        messageCount: 0,
        lastMessageTime: serverTimestamp(),
        isPublic: roomData.isPublic || true
      };
      
      const docRef = await addDoc(roomsRef, newRoom);
      return docRef.id;
    } catch (error) {
      console.error("채팅방 생성 오류:", error);
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
   * @param {string} roomId - 채팅방 ID
   * @param {Array} messages - 메시지 목록
   */
  notifySubscribers(roomId, messages) {
    this.subscribers.forEach(subscriber => {
      subscriber(roomId, messages);
    });
  }

  /**
   * 모든 리스너 정리 (컴포넌트 언마운트 시 호출)
   */
  cleanupListeners() {
    Object.keys(chatListeners).forEach(roomId => {
      if (chatListeners[roomId]) {
        chatListeners[roomId]();
        delete chatListeners[roomId];
      }
    });
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const communityDBManager = new CommunityDBManager();
export default communityDBManager;