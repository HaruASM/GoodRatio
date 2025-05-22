'use client';

// travelCommunity컴포넌트 UI - CommunityDBManager 커뮤니티의 채널/채팅/메세지 데이터 관리 - realtimeChatUtilsFB는 유틸리티 컴포넌트. fireBase서버 기능담당
// travelCommunity 컴포넌트가 메인 로직에서 사용되고, travelCommunity 내부에서 CommunityDBManager와 realtimeChatUtilsFB를 사용한다. 
// travelCommunity컴포넌트 <-> communityDBManager.js <-> realtimeChatUtilsFB.js

// realtimeChatUtilsFB.js가 chatFirebaseUtils.js와 chatFirestoreBatch.js 두 파일만 사용한다
// chatFirebaseUtils.js는 로깅, 오류 처리, 권한 확인 등의 기본 유틸리티를 담당합니다.
// chatFirestoreBatch.js는 Firestore 배치 처리를 담당합니다.
// realtimeChatUtilsFB.js는 채팅 관련 비즈니스 로직을 담당합니다.

/**
 * Firestore를 활용한 커뮤니티 및 채팅 기능 유틸리티
 * 
 * 이 모듈은 Firebase Firestore를 사용하여 채팅 기능을 구현하는 유틸리티 함수들을 제공합니다.
 * 기본 Firebase 설정은 firebase.js에서 가져오며, 이 파일은 순수하게 채팅 관련 기능만 담당합니다.
 * 
 * 추가 기능:
 * - 메시지 읽음 상태 관리
 * - 파일 업로드 및 처리
 * - 채팅방 초대 링크 생성
 * - 메시지 수정 및 삭제
 * - 사용자 입력 상태 표시
 * - 푸시 알림 트리거
 * - 캐싱 시스템을 추가하여 Firestore 쿼리 성능을 최적화합니다.
 */

// Firebase 모듈 가져오기
import { 
  log, logError, handleFirestoreError, checkRoomPermission,
  getDocsWithCache, clearCache, cache,
  setCacheResult, setCacheCursor, deleteCacheCursor,
  firebasedb, firebaseStorage, validateEventTarget
} from './utilsfordata/chatFirebaseUtils';

// clearCache 함수를 다시 내보내기 (다른 파일에서 사용하기 위해)
export { clearCache };
import { FirestoreBatch, createBatch } from './utilsfordata/chatFirestoreBatch';
import { createMessage, dispatchCommunityEvent } from '../models/communityModels';

// Firebase Firestore 관련 함수들 가져오기
import { collection, doc, addDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment } from 'firebase/firestore';

// Firebase Storage 관련 함수들 가져오기
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 현재 활성화된 실시간 리스너를 관리할 객체
const activeListeners = {};

// LRUCache 클래스와 cache 객체는 chatFirebaseUtils.js로 이동되었습니다.

// 유틸리티 함수들은 별도 파일로 분리되었습니다.

// checkRoomPermission 함수는 chatFirebaseUtils.js로 이동되었습니다.

// clearCache 함수는 chatFirebaseUtils.js로 이동되었습니다.

/**
 * 채팅방 생성 함수
 * Firestore에 새로운 채팅방 문서를 생성합니다.
 * 입력된 roomData의 타임스탬프 관련 필드(예: createdAt)는 무시되고,
 * Firestore의 serverTimestamp()를 사용하여 실제 생성 시점의 타임스탬프가 기록됩니다.
 * @param {Object} roomData - 채팅방 데이터 (communityModels.js의 ChatRoom 모델을 따르는 것이 권장됨)
 * @returns {Promise<string>} 생성된 채팅방의 ID
 * @description Firestore에 저장되는 채팅방 데이터는 ChatRoom 모델의 주요 필드를 따르며, 타임스탬프(createdAt, updatedAt, lastMessageTime)는 serverTimestamp()로 설정됩니다.
 */
export const createChatRoom = async (roomData) => {
  try {
    log(`[realtimeChatUtilsFB] 채팅방 생성 시작: ${JSON.stringify(roomData)}`);
    const roomsRef = collection(firebasedb, "chatRooms");
    const newRoom = {
      name: roomData.name,
      description: roomData.description || '',
      // createdAt은 roomData에서 전달된 값을 사용하지 않고, Firestore 서버 시간을 기준으로 설정합니다.
      // 만약 roomData.createdAt (ISO 문자열)을 사용해야 한다면, firebase.firestore.Timestamp.fromDate(new Date(roomData.createdAt)) 등으로 변환 필요.
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messageCount: 0,
      lastMessageTime: serverTimestamp(),
      isPublic: roomData.isPublic !== undefined ? roomData.isPublic : true,
      members: roomData.members || [],
      admins: roomData.admins || [],
      createdBy: roomData.createdBy || null
    };
    
    log(`[realtimeChatUtilsFB] 생성할 채팅방 데이터: ${JSON.stringify(newRoom)}`);
    const docRef = await addDoc(roomsRef, newRoom);
    log(`[realtimeChatUtilsFB] 채팅방 생성 성공: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    log(`[realtimeChatUtilsFB] 채팅방 생성 오류: ${error.message}`, 'error');
    handleFirestoreError(error, '채팅방 생성');
    throw error; // 오류를 상위로 전파하여 적절히 처리할 수 있도록 함
  }
};

/**
 * 채팅방 목록 가져오기 (최적화된 버전 - 캡싱, 페이지네이션 지원, 사용자별 필터링, 섹션별 그룹화 지원)
 * @param {Object} options - 옵션 (정렬, 필터링 등)
 * @returns {Promise<Object>} 채팅방 목록과 페이지네이션 정보 또는 섹션별 채팅방 목록
 */
export const getChatRooms = async (options = {}) => {
  try {
    const { 
      userId = null,             // 사용자별 채팅방 필터링을 위한 사용자 ID
      orderField = "lastMessageTime", 
      orderDirection = "desc", 
      limitCount = 20, 
      filterPublic = null,
      startAfterRoom = null,
      useCache = true,
      forceRefresh = false,
      groupBySection = false     // 섹션별 그룹화 여부
    } = options;
    
    // 섹션별 그룹화인 경우 다른 캐시 키 사용
    const cacheKey = groupBySection
      ? `chatRoomsSection_${userId || 'all'}_${orderField}_${orderDirection}_${limitCount}`
      : `chatRooms_${userId || 'all'}_${orderField}_${orderDirection}_${limitCount}_${filterPublic}_${startAfterRoom}`;
    
    // 강제 새로고침이 요청되면 캐시 삭제
    if (forceRefresh) {
      clearCache('chatRooms', userId);
    }
    
    let roomsQuery = collection(firebasedb, "chatRooms");
    let queryConstraints = [];
    
    // 사용자별 채팅방 필터링 - 현재 사용자가 참여한 채팅방만 조회
    if (userId) {
      queryConstraints.push(where("members", "array-contains", userId));
    }
    
    // 섹션별 그룹화인 경우 페이지네이션을 사용하지 않고 더 많은 채팅방을 가져옴
    const effectiveLimitCount = groupBySection ? Math.max(limitCount, 50) : limitCount;
    
    // 공개/비공개 필터링 (섹션별 그룹화에서는 사용하지 않음)
    if (!groupBySection && filterPublic !== null) {
      queryConstraints.push(where("isPublic", "==", filterPublic));
    }
    
    // 정렬 추가
    queryConstraints.push(orderBy(orderField, orderDirection));
    
    // 페이지네이션 처리 (섹션별 그룹화에서는 사용하지 않음)
    if (!groupBySection && startAfterRoom) {
      // startAfterRoom이 ID인 경우
      if (typeof startAfterRoom === 'string') {
        const roomDoc = await getDoc(doc(firebasedb, "chatRooms", startAfterRoom));
        if (roomDoc.exists()) {
          queryConstraints.push(startAfter(roomDoc));
        }
      } 
      // startAfterRoom이 마지막 문서인 경우
      else {
        queryConstraints.push(startAfter(startAfterRoom));
      }
    }
    
    // 결과 제한
    if (effectiveLimitCount > 0) {
      queryConstraints.push(limit(effectiveLimitCount + 1)); // 더 불러와서 다음 페이지 여부 확인
    }
    
    const finalQuery = query(roomsQuery, ...queryConstraints);
    // getDocsWithCache 함수를 사용하여 캐시 처리
    const querySnapshot = await getDocsWithCache(finalQuery, cacheKey, useCache);
    
    const rooms = [];
    let lastVisible = null;
    let hasMore = false;
    
    // 요청한 개수보다 하나 더 가져왔다면 다음 페이지가 있는 것
    if (querySnapshot.size > effectiveLimitCount) {
      hasMore = true;
    }
    
    let count = 0;
    querySnapshot.forEach((doc) => {
      // 요청한 개수만큼만 처리
      if (count < effectiveLimitCount) {
        const roomDataFromDB = doc.data();
        const standardizedRoom = createChatRoom({
          id: doc.id,
          ...roomDataFromDB,
          // createChatRoom에서 timestamp 필드(createdAt, lastMessageTime)를 ISO 문자열로 변환합니다.
          // Firestore의 Timestamp 객체를 직접 전달하면 모델 내에서 처리됩니다.
          lastMessageTime: roomDataFromDB.lastMessageTime, // Timestamp 객체 또는 null
          createdAt: roomDataFromDB.createdAt, // Timestamp 객체 또는 null
          // badge는 모델에서 messageCount 등을 기반으로 설정될 수 있으나, 여기서는 직접 전달
          badge: roomDataFromDB.messageCount || roomDataFromDB.badge, // messageCount 또는 badge 필드 사용
          notification: roomDataFromDB.hasNewMessages || false, // UI 관련 필드
          isSelected: false, // UI 관련 필드, 목록 조회 시 기본값
        });
        rooms.push(standardizedRoom);
        
        // 마지막 문서 저장 (페이지네이션용)
        if (!groupBySection && count === effectiveLimitCount - 1) {
          lastVisible = doc;
        }
      }
      count++;
    });
    
    // 섹션별 그룹화인 경우
    if (groupBySection) {
      // reduce를 사용하여 섹션별로 그룹화 (성능 최적화)
      const sections = rooms.reduce((acc, room) => {
        const sectionName = room.sectionName || 'other';
        
        if (!acc[sectionName]) {
          acc[sectionName] = {
            name: sectionName,
            rooms: []
          };
        }
        
        acc[sectionName].rooms.push(room);
        return acc;
      }, {});
      
      // 빈 섹션 제거
      Object.keys(sections).forEach(key => {
        if (sections[key].rooms.length === 0) {
          delete sections[key];
        }
      });
      
      // 결과 캐싱 - 새로 추가한 함수 사용
      if (useCache) {
        setCacheResult(cacheKey, sections);
        log(`섹션별 채팅방 목록 캐싱: ${Object.keys(sections).length}개 섹션`);
      }
      
      log(`섹션별 채팅방 목록 조회 성공: ${Object.keys(sections).length}개 섹션`);
      return sections;
    } 
    // 일반 목록 반환
    else {
      // 결과 캐싱 - 새로 추가한 함수 사용
      if (useCache) {
        setCacheResult(cacheKey, rooms);
        if (hasMore) {
          setCacheCursor(cacheKey, lastVisible);
        } else {
          deleteCacheCursor(cacheKey);
        }
      }
      
      log(`채팅방 목록 조회 성공: ${rooms.length}개, 더 불러올 데이터 ${hasMore ? '있음' : '없음'}`);
      
      return {
        rooms,
        hasMore,
        lastVisible
      };
    }
  } catch (error) {
    handleFirestoreError(error, '채팅방 목록 조회');
    
    return options.groupBySection ? {} : {
      rooms: [],
      hasMore: false,
      lastVisible: null
    };
  }
};

/**
 * 특정 채팅방의 메시지 가져오기 (최적화된 버전 - 캐싱, 페이지네이션 지원, 보안 검사 추가)
 * @param {string} roomId - 채팅방 ID
 * @param {Object} options - 옵션 (정렬, 제한 등)
 * @returns {Promise<{messages: ChatMessage[], hasMore: boolean, lastVisible: Object|null}>}
 */
export const getChatMessages = async (roomId, options = {}) => {
  try {
    const { 
      userId = null,             // 사용자 ID (채팅방 접근 권한 확인용)
      orderDirection = "asc", 
      limitCount = 50, 
      startAfterMsg = null,
      useCache = true,
      forceRefresh = false,
      filterDeleted = true,      // 삭제된 메시지 필터링 옵션
      includeReadStatus = true   // 읽음 상태 포함 여부
    } = options;
    
    // 채팅방 접근 권한 확인 (사용자가 채팅방 멤버인지 확인)
    if (userId) {
      // 공통 함수를 사용하여 권한 확인
      await checkRoomPermission(roomId, userId, false);
    }
    
    // 캐싱 키 생성
    const cacheKey = `messages_${roomId}_${orderDirection}_${limitCount}_${startAfterMsg}_${filterDeleted}_${includeReadStatus}`;
    
    // 강제 새로고침이 요청되면 해당 캐시 삭제
    if (forceRefresh) {
      cache.lastResults.delete(cacheKey);
    }
    
    // 캐싱된 결과가 있는지 확인
    if (useCache && !forceRefresh) {
      const cachedMessages = cache.lastResults.get(cacheKey);
      if (cachedMessages) {
        log(`캐싱된 메시지 목록 사용: ${roomId}, ${cachedMessages.length}개`);
        return {
          messages: cachedMessages,
          hasMore: cache.lastCursor.has(cacheKey),
          lastVisible: cache.lastCursor.get(cacheKey)
        };
      }
    }
    
    let messagesQuery = collection(firebasedb, "chatRooms", roomId, "messages");
    let queryConstraints = [];
    
    // 삭제된 메시지 필터링
    if (filterDeleted) {
      queryConstraints.push(where("isDeleted", "in", [false, null])); // isDeleted가 false이거나 없는 경우
    }
    
    // 정렬 추가
    queryConstraints.push(orderBy("timestamp", orderDirection));
    
    // 페이지네이션 처리
    if (startAfterMsg) {
      // startAfterMsg가 ID인 경우
      if (typeof startAfterMsg === 'string') {
        const messageDoc = await getDoc(doc(firebasedb, "chatRooms", roomId, "messages", startAfterMsg));
        if (messageDoc.exists()) {
          queryConstraints.push(startAfter(messageDoc));
        }
      } 
      // startAfterMsg가 마지막 문서인 경우
      else {
        queryConstraints.push(startAfter(startAfterMsg));
      }
    }
    
    // 결과 제한
    if (limitCount > 0) {
      queryConstraints.push(limit(limitCount + 1)); // 더 불러와서 다음 페이지 여부 확인
    }
    
    const finalQuery = query(messagesQuery, ...queryConstraints);
    const querySnapshot = await getDocsWithCache(finalQuery, cacheKey);
    
    const messages = [];
    let lastVisible = null;
    let hasMore = false;
    
    // 요청한 개수보다 하나 더 가져왔다면 다음 페이지가 있는 것
    if (querySnapshot.size > limitCount) {
      hasMore = true;
    }
    
    let count = 0;
    querySnapshot.forEach((doc) => {
      // 요청한 개수만큼만 처리
      if (count < limitCount) {
        const messageData = doc.data();
        messages.push(createMessage({
          id: doc.id,
          ...messageData, // Pass all data from Firestore
          senderId: messageData.userId || null, // userId → senderId
          timestamp: messageData.timestamp ? messageData.timestamp.toDate() : new Date(),
          updatedAt: messageData.updatedAt ? messageData.updatedAt.toDate() : null,
          // readBy needs special handling if includeReadStatus is false, createMessage might need adjustment or handle undefined
          readBy: includeReadStatus ? (messageData.readBy || []) : undefined 
        }));
        
        // 마지막 문서 저장 (페이지네이션용)
        if (count === limitCount - 1) {
          lastVisible = doc;
        }
      }
      count++;
    });
    
    // 정렬 방향에 따라 메시지 정렬
    messages.sort((a, b) => orderDirection === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    
    // 사용자가 지정된 경우, 읽지 않은 메시지 자동 읽기 처리
    if (userId && includeReadStatus) {
      const unreadMessages = messages.filter(msg => !msg.readBy.includes(userId));
      if (unreadMessages.length > 0) {
        // 읽지 않은 메시지 ID 목록
        const unreadIds = unreadMessages.map(msg => msg.id);
        // 비동기로 읽음 처리 (결과를 기다리지 않음)
        markMessagesAsRead(roomId, unreadIds, userId).catch(err => {
          logError('자동 읽기 처리 오류', err);
        });
      }
    }
    
    // 개별 메세지 캐싱은 getDocsWithCache에서 이미 처리하민로 제거
    
    log(`메세지 목록 처리 완료: ${roomId}, ${messages.length}개, 더 불러올 데이터 ${hasMore ? '있음' : '없음'}`);
    
    return {
      messages,
      hasMore,
      lastVisible
    };
  } catch (error) {
    handleFirestoreError(error, `채팅 메시지 조회 오류 (${roomId})`);
    
    return {
      messages: [],
      hasMore: false,
      lastVisible: null
    };
  }
};

/**
 * 메시지 전송하기 (개선된 버전 - 보안 검사 및 에러 핸들링 강화)
 * @param {string} roomId - 채팅방 ID
 * @param {Object} messageData - 메시지 데이터
 * @param {Object} options - 추가 옵션
 * @param {EventTarget} options.target - 이벤트를 디스패치할 대상 (필수)
 * @returns {Promise<string>} 생성된 메시지 ID
 */
export const sendMessage = async (roomId, messageData, options = {}) => {
  const { target } = options;
  
  // 중앙화된 유효성 검사 함수 사용
  validateEventTarget(target, 'realtimeChatUtilsFB.sendMessage');
  
  try {

    // 메시지 데이터 검증
    if (!messageData.message && (!messageData.attachments || messageData.attachments.length === 0)) {
      throw new Error('empty_message');
    }

    // 채팅방 접근 권한 확인 (사용자가 채팅방 멤버인지 확인)
    if (messageData.userId) {
      // 공통 함수를 사용하여 권한 확인 (읽기 전용 채팅방 검사 포함)
      await checkRoomPermission(roomId, messageData.userId, true);
    }

    // 메시지 컬렉션에 추가
    const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
    const newMessage = {
      username: messageData.username,
      userType: messageData.userType || '',
      message: messageData.message || '',
      timestamp: serverTimestamp(),
      isBold: messageData.isBold || false,
      userId: messageData.userId || null,
      attachments: messageData.attachments || [],
      reactions: {},
      readBy: messageData.userId ? [messageData.userId] : []  // 보낸 사람은 자동으로 읽음 처리
    };

    const docRef = await addDoc(messagesRef, newMessage);

    // 채팅방 문서 업데이트 (최근 메시지 정보)
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    await updateDoc(roomRef, {
      lastMessage: messageData.message || (
        messageData.attachments && messageData.attachments.length > 0 ? 
        `파일: ${messageData.attachments[0].name || '첨부파일'}` : ''
      ),
      lastMessageTime: serverTimestamp(),
      lastSender: messageData.username,
      lastSenderId: messageData.userId || null,
      messageCount: increment(1),
      updatedAt: serverTimestamp(),
      // 새 메시지 알림 플래그 설정
      hasNewMessages: true
    });

    // 관련 캐시 무효화 (메시지 추가로 인한 변경 반영)
    clearCache('messages', roomId);  // 해당 채팅방의 메시지 캐시 무효화
    clearCache('chatRooms');         // 채팅방 목록 캐시 무효화 (최근 메시지 정보 변경)

    // 선택적으로 푸시 알림 트리거 (사용자 ID가 있는 경우)
    if (messageData.userId && messageData.triggerNotification !== false) {
      try {
        // 필요한 데이터만 추출하여 전달
        await triggerPushNotification({
          roomId,
          message: messageData.message,
          senderId: messageData.userId,
          senderName: messageData.username,
          // 첨부파일 정보가 있는 경우만 전달
          attachments: messageData.attachments?.length > 0 ? messageData.attachments : undefined
        });
      } catch (notificationError) {
        // 알림 오류는 메시지 전송에 영향을 주지 않음
        logError(`알림 전송 오류 (${roomId})`, notificationError);
      }
    }

    // 커스텀 이벤트 발행 - target 전달
    dispatchCommunityEvent('messageSent', {
      roomId,
      messageId: docRef.id,
      messageData: newMessage,
    }, target);

    log(`메시지 전송 성공: ${roomId}, ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    // 오류 이벤트도 target에 디스패치
    dispatchCommunityEvent('error', { roomId, error: error.message }, target);
    handleFirestoreError(error, `메시지 전송 오류 (${roomId})`);
    throw error;
  }
};

/**
 * 실시간 채팅 리스너 설정 (개선된 버전 - 구독 패턴 통합 및 에러 핸들링 강화)
 * @param {string} roomId - 채팅방 ID
 * @param {Object} communityDBManager - CommunityDBManager 인스턴스
 * @param {Object} options - 추가 옵션
 * @param {EventTarget} target - 이벤트를 디스패치할 대상 (필수)
 * @returns {Function} 리스너 해제 함수
 */
export const setupChatListener = async (roomId, communityDBManager, options = {}, target) => {
  // 기본 매개변수 검사
  if (!roomId || !communityDBManager || typeof communityDBManager.notifySubscribers !== 'function') {
    throw new Error('invalid_parameters');
  }
  
  // 중앙화된 유효성 검사 함수 사용
  validateEventTarget(target, 'realtimeChatUtilsFB.setupChatListener');
  
  try {
    const { userId = null, includeDeleted = false, limit = 100, autoMarkAsRead = false } = options;
    if (activeListeners[roomId]) {
      activeListeners[roomId]();
      delete activeListeners[roomId];
    }
    const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
    const queryConstraints = [orderBy("timestamp", "asc")];
    if (!includeDeleted) queryConstraints.push(where("isDeleted", "in", [false, null]));
    if (limit > 0) queryConstraints.push(limit(limit));
    const messagesQuery = query(messagesRef, ...queryConstraints);
    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
      // 한 번에 모든 캡시 무효화
      clearCache('messages', roomId);
      clearCache('chatRooms');
      
      const messages = querySnapshot.docs.map(doc => createMessage({
        id: doc.id,
        ...doc.data(), // Pass all data from Firestore
        senderId: doc.data().userId || null, // userId → senderId
        timestamp: doc.data().timestamp?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || null
      }));
      
      // 메시지 정렬
      messages.sort((a, b) => (a.timestamp && b.timestamp) ? a.timestamp - b.timestamp : 0);
      
      // 자동 읽음 처리 (필요한 경우)
      if (userId && autoMarkAsRead) {
        const unreadIds = messages
          .filter(msg => msg.userId !== userId && !msg.readBy?.includes(userId))
          .map(msg => msg.id);
        if (unreadIds.length > 0) {
          markMessagesAsRead(roomId, unreadIds, userId).catch(error => {
            logError(`자동 읽기 처리 오류`, error);
          });
        }
      }
      
      // 채팅방 상태 업데이트 (필요한 경우)
      let roomUpdatePromise = Promise.resolve();
      if (userId && messages.length > 0) {
        roomUpdatePromise = updateDoc(doc(firebasedb, "chatRooms", roomId), { hasNewMessages: false })
          .catch(error => logError(`채팅방 상태 업데이트 오류`, error));
      }
      
      // 구독자에게 target을 지정하여 알림 전송
      communityDBManager.notifySubscribers('messagesUpdated', { roomId, messages }, target);
    }, (error) => {
      logError(`리스너 오류: ${roomId}`, error);
      communityDBManager.notifySubscribers('error', { roomId, error: error.message }, target);
    });
    activeListeners[roomId] = unsubscribe;
    log(`리스너 설정 완료: ${roomId}`);
    return unsubscribe;
  } catch (error) {
    dispatchCommunityEvent('error', { roomId, error: error.message }, target);
    handleFirestoreError(error, `리스너 설정 오류 (${roomId})`);
    throw error;
  }
};

/**
 * 채팅방 정보 업데이트
 * @param {string} roomId - 채팅방 ID
 * @param {Object} updateData - 업데이트할 데이터
 * @returns {Promise<void>}
 */
export const updateChatRoom = async (roomId, updateData) => {
  try {
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    
    // 업데이트 데이터에 updatedAt 추가
    const dataToUpdate = {
      ...updateData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(roomRef, dataToUpdate);
    
    // 캡시 무효화
    clearCache('chatRooms');
    
    log(`채팅방 업데이트 성공: ${roomId}`);
  } catch (error) {
    handleFirestoreError(error, `채팅방 업데이트 (${roomId})`);
  }
};

/**
 * 메시지에 반응 추가/제거
 * @param {string} roomId - 채팅방 ID
 * @param {string} messageId - 메시지 ID
 * @param {string} reaction - 반응 이모지
 * @param {string} userId - 사용자 ID
 * @param {boolean} add - 추가(true) 또는 제거(false)
 * @returns {Promise<void>}
 */
export const toggleMessageReaction = async (roomId, messageId, reaction, userId, add = true) => {
  try {
    const messageRef = doc(firebasedb, "chatRooms", roomId, "messages", messageId);
    const reactionPath = `reactions.${reaction}`;
    
    if (add) {
      // 반응 추가
      await updateDoc(messageRef, {
        [reactionPath]: arrayUnion(userId)
      });
    } else {
      // 반응 제거
      await updateDoc(messageRef, {
        [reactionPath]: arrayRemove(userId)
      });
    }
    
    // 캡시 무효화
    clearCache('messages', roomId);
    
    log(`메시지 반응 ${add ? '추가' : '제거'} 성공: ${messageId}, ${reaction}`);
  } catch (error) {
    handleFirestoreError(error, `메시지 반응 토글 (${messageId})`);
  }
};

/**
 * 채팅방 참여자 관리 (개선된 버전 - 보안 검사 및 구독 패턴 통합)
 * @param {string} roomId - 채팅방 ID
 * @param {string} userId - 사용자 ID
 * @param {boolean} join - 참여(true) 또는 퇴장(false)
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 채팅방 정보
 */
export const manageChatRoomMember = async (roomId, userId, join = true, options = {}) => {
  try {
    if (!roomId || !userId) {
      throw new Error('invalid_parameters');
    }
    
    const { 
      requesterId = null,         // 요청자 ID (관리자 권한 확인용)
      notifySubscribers = true,  // 구독자에게 변경 알림 여부
      communityDBManager = null  // CommunityDBManager 인스턴스 (구독 패턴용)
    } = options;
    
    // 채팅방 정보 가져오기
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error('chat_room_not_found');
    }
    
    const roomData = roomSnap.data();
    
    // 권한 확인
    if (requesterId && requesterId !== userId) {
      // 요청자가 사용자와 다른 경우 (관리자 권한 필요)
      if (!roomData.admins || !roomData.admins.includes(requesterId)) {
        throw new Error('permission_denied');
      }
    }
    
    // 현재 상태 확인
    const isMember = roomData.members && roomData.members.includes(userId);
    
    // 이미 멤버인데 추가하거나, 멤버가 아닌데 제거하려는 경우 처리
    if ((join && isMember) || (!join && !isMember)) {
      log(`채팅방 참여자 상태 변경 없음: ${roomId}, ${userId}, 현재 멤버 ${isMember ? '맞음' : '아님'}`);
      return {
        id: roomId,
        ...roomData,
        lastMessageTime: roomData.lastMessageTime ? roomData.lastMessageTime.toDate() : null,
        createdAt: roomData.createdAt ? roomData.createdAt.toDate() : null,
        updatedAt: roomData.updatedAt ? roomData.updatedAt.toDate() : null
      };
    }
    
    // 상태 변경 작업
    if (join) {
      // 참여자 추가
      await updateDoc(roomRef, {
        members: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      
      // 새 멤버 참여 알림 메시지 추가 (선택적)
      if (options.addJoinMessage !== false) {
        try {
          const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
          await addDoc(messagesRef, {
            username: 'System',
            userType: 'system',
            message: `${options.username || userId} 님이 채팅방에 참여하셨습니다.`,
            timestamp: serverTimestamp(),
            isBold: false,
            userId: 'system',
            isSystemMessage: true,
            readBy: []
          });
        } catch (messageError) {
          logError(`참여 알림 메시지 추가 오류`, messageError);
          // 알림 메시지 오류는 전체 흐름에 영향을 주지 않음
        }
      }
    } else {
      // 참여자 제거
      await updateDoc(roomRef, {
        members: arrayRemove(userId),
        updatedAt: serverTimestamp()
      });
      
      // 멤버 퇴장 알림 메시지 추가 (선택적)
      if (options.addLeaveMessage !== false) {
        try {
          const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
          await addDoc(messagesRef, {
            username: 'System',
            userType: 'system',
            message: `${options.username || userId} 님이 채팅방에서 나가셨습니다.`,
            timestamp: serverTimestamp(),
            isBold: false,
            userId: 'system',
            isSystemMessage: true,
            readBy: []
          });
        } catch (messageError) {
          logError(`퇴장 알림 메시지 추가 오류`, messageError);
          // 알림 메시지 오류는 전체 흐름에 영향을 주지 않음
        }
      }
      
      // 관리자에서도 제거 (선택적)
      if (options.removeFromAdmins && roomData.admins && roomData.admins.includes(userId)) {
        await updateDoc(roomRef, {
          admins: arrayRemove(userId)
        });
      }
    }
    
    // 업데이트된 채팅방 정보 가져오기
    const updatedRoomSnap = await getDoc(roomRef);
    const updatedRoomData = updatedRoomSnap.data();
    
    // 구독자에게 변경 알림
    if (notifySubscribers && communityDBManager && typeof communityDBManager.notifySubscribers === 'function') {
      try {
        communityDBManager.notifySubscribers('roomMemberChanged', {
          roomId,
          userId,
          action: join ? 'join' : 'leave',
          timestamp: new Date()
        });
      } catch (notifyError) {
        logError(`구독자 알림 오류`, notifyError);
      }
    }
    
    // 캡시 무효화
    clearCache('chatRooms');
    clearCache('messages', roomId);
    
    log(`채팅방 참여자 ${join ? '추가' : '제거'} 성공: ${roomId}, ${userId}`);
    
    // 채팅방 정보 반환 (타임스태프 변환 처리)
    return {
      id: roomId,
      ...updatedRoomData,
      lastMessageTime: updatedRoomData.lastMessageTime ? updatedRoomData.lastMessageTime.toDate() : null,
      createdAt: updatedRoomData.createdAt ? updatedRoomData.createdAt.toDate() : null,
      updatedAt: updatedRoomData.updatedAt ? updatedRoomData.updatedAt.toDate() : null
    };
  } catch (error) {
    handleFirestoreError(error, `채팅방 참여자 관리 (${roomId})`);
  }
};

/**
 * 리스너 정리 (특정 채팅방 또는 모든 리스너)
 * @param {string} roomId - 채팅방 ID (선택적, null이면 모든 리스너 정리)
 */
export const cleanupListeners = (roomId = null) => {
  if (roomId) {
    if (activeListeners[roomId]) {
      activeListeners[roomId]();
      delete activeListeners[roomId];
      log(`채팅방 리스너 정리 완료: ${roomId}`);
    }
  } else {
    Object.keys(activeListeners).forEach(key => {
      activeListeners[key]();
      delete activeListeners[key];
    });
    log('모든 리스너 정리 완료');
  }
};

// markMessageAsRead 함수는 markMessagesAsRead로 통합되었습니다.

/**
 * 첨부 파일 업로드 및 메시지 추가
 * @param {string} roomId - 채팅방 ID
 * @param {Object} messageData - 메시지 데이터
 * @param {File} file - 업로드할 파일
 * @returns {Promise<string>} 생성된 메시지 ID
 */
export const uploadFileAndSendMessage = async (roomId, messageData, file) => {
  try {
    // 메시지 데이터 검증
    if (!file) {
      throw new Error('empty_message');
    }
    
    // 채팅방 접근 권한 확인 (사용자가 채팅방 멤버인지 확인)
    if (messageData.userId) {
      // 공통 함수를 사용하여 권한 확인 (읽기 전용 채팅방 검사 포함)
      await checkRoomPermission(roomId, messageData.userId, true);
    }
    
    // Firebase Storage에 파일 업로드
    const storageRef = ref(firebaseStorage, `chatRooms/${roomId}/files/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // 메시지 컬렉션에 추가
    const messagesRef = collection(firebasedb, "chatRooms", roomId, "messages");
    const newMessage = {
      username: messageData.username,
      userType: messageData.userType || '',
      message: messageData.message || '',
      timestamp: serverTimestamp(),
      userId: messageData.userId || null,
      isBold: messageData.isBold || false,
      attachments: [{ url: downloadURL, name: file.name, type: file.type, size: file.size }],
      reactions: {},
      readBy: [messageData.userId || null].filter(Boolean)
    };
    
    const docRef = await addDoc(messagesRef, newMessage);
    
    // 채팅방 문서 업데이트 (최근 메시지 정보)
    await updateDoc(doc(firebasedb, "chatRooms", roomId), {
      lastMessage: messageData.message || `파일: ${file.name}`,
      lastMessageTime: serverTimestamp(),
      lastSender: messageData.username,
      lastSenderId: messageData.userId || null,
      messageCount: increment(1),
      updatedAt: serverTimestamp()
    });
    
    // 캡시 무효화
    clearCache('messages', roomId);
    clearCache('chatRooms');
    
    log(`파일 업로드 및 메시지 전송 성공: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, `파일 업로드 및 메시지 전송 오류 (${roomId})`);
    return null;
  }
};

// 기타 유틸리티 함수들

/**
 * 채팅방 초대 링크 생성
 * @param {string} roomId - 채팅방 ID
 * @returns {Promise<string>} 초대 링크
 */
export const createInviteLink = async (roomId) => {
  try {
    const inviteRef = collection(firebasedb, "invites");
    const inviteData = {
      roomId,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7일 후 만료
      active: true
    };
    const docRef = await addDoc(inviteRef, inviteData);
    const inviteLink = `${window.location.origin}/invite/${docRef.id}`;
    log(`초대 링크 생성 성공: ${inviteLink}`);
    return inviteLink;
  } catch (error) {
    handleFirestoreError(error, `초대 링크 생성 (${roomId})`);
  }
};

/**
 * 초대 링크로 채팅방 참여
 * @param {string} inviteId - 초대 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string>} 채팅방 ID
 */
export const joinRoomByInvite = async (inviteId, userId) => {
  try {
    const inviteRef = doc(firebasedb, "invites", inviteId);
    const inviteSnap = await getDoc(inviteRef);
    
    if (!inviteSnap.exists()) {
      throw new Error("유효하지 않은 초대링크입니다.");
    }
    
    const inviteData = inviteSnap.data();
    
    if (!inviteData.active) {
      throw new Error("만료되었거나 비활성화된 초대링크입니다.");
    }
    
    const now = new Date();
    if (inviteData.expiresAt.toDate() < now) {
      // 만료된 초대 비활성화
      await updateDoc(inviteRef, { active: false });
      throw new Error("초대 링크가 만료되었습니다.");
    }
    
    const { roomId } = inviteData;
    
    // 채팅방 참여
    await manageChatRoomMember(roomId, userId, true);
    log(`초대 링크로 참여 성공: ${roomId}, ${userId}`);
    
    return roomId;
  } catch (error) {
    handleFirestoreError(error, `초대 링크 참여`);
  }
};

/**
 * 메시지 수정
 * @param {string} roomId - 채팅방 ID
 * @param {string} messageId - 메시지 ID
 * @param {string} newMessage - 새로운 메시지 내용
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export const editMessage = async (roomId, messageId, newMessage, userId) => {
  try {
    // 채팅방 접근 권한 확인
    await checkRoomPermission(roomId, userId, false);
    
    const messageRef = doc(firebasedb, "chatRooms", roomId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) {
      throw new Error("메시지를 찾을 수 없습니다.");
    }
    
    const messageData = messageSnap.data();
    if (messageData.userId !== userId) {
      throw new Error("다른 사용자의 메시지를 수정할 권한이 없습니다.");
    }
    
    await updateDoc(messageRef, {
      message: newMessage,
      updatedAt: serverTimestamp(),
      isEdited: true
    });
    
    // 채팅방의 마지막 메시지였다면 채팅방 정보도 업데이트
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data();
    
    if (roomData.lastSenderId === userId && roomData.lastMessage === messageData.message) {
      await updateDoc(roomRef, {
        lastMessage: newMessage,
        updatedAt: serverTimestamp()
      });
    }
    
    // 캡시 무효화
    clearCache('messages', roomId);
    clearCache('chatRooms');
    
    log(`메시지 수정 성공: ${messageId}`);
  } catch (error) {
    handleFirestoreError(error, `메시지 수정 오류 (${messageId})`);
  }
};

/**
 * 메시지 삭제
 * @param {string} roomId - 채팅방 ID
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export const deleteMessage = async (roomId, messageId, userId) => {
  try {
    // 채팅방 접근 권한 확인
    await checkRoomPermission(roomId, userId, false);
    
    const messageRef = doc(firebasedb, "chatRooms", roomId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) {
      throw new Error("메시지를 찾을 수 없습니다.");
    }
    
    const messageData = messageSnap.data();
    if (messageData.userId !== userId) {
      throw new Error("다른 사용자의 메시지를 삭제할 권한이 없습니다.");
    }
    
    // 메시지 삭제 대신 상태만 변경 (실제 데이터 보존)
    await updateDoc(messageRef, {
      isDeleted: true,
      message: "삭제된 메시지입니다.",
      updatedAt: serverTimestamp()
    });
    
    // 채팅방의 마지막 메시지였다면 채팅방 정보도 업데이트
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data();
    
    if (roomData.lastSenderId === userId && roomData.lastMessage === messageData.message) {
      // 이전 메시지를 찾아서 마지막 메시지로 업데이트
      const messagesQuery = query(
        collection(firebasedb, "chatRooms", roomId, "messages"),
        where("isDeleted", "!=", true),
        orderBy("isDeleted", "asc"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      
      const querySnapshot = await getDocs(messagesQuery);
      if (!querySnapshot.empty) {
        const lastMessage = querySnapshot.docs[0].data();
        await updateDoc(roomRef, {
          lastMessage: lastMessage.message,
          lastMessageTime: lastMessage.timestamp,
          lastSender: lastMessage.username,
          lastSenderId: lastMessage.userId,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(roomRef, {
          lastMessage: "",
          lastSender: "",
          lastSenderId: null,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // 캡시 무효화
    clearCache('messages', roomId);
    clearCache('chatRooms');
    
    log(`메시지 삭제 성공: ${messageId}`);
  } catch (error) {
    handleFirestoreError(error, `메시지 삭제 오류 (${messageId})`);
  }
};

/**
 * 입력 상태 업데이트
 * @param {string} roomId - 채팅방 ID
 * @param {string} userId - 사용자 ID
 * @param {boolean} isTyping - 입력 상태
 * @returns {Promise<void>}
 */
export const updateTypingStatus = async (roomId, userId, isTyping) => {
  try {
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const typingField = `typingUsers.${userId}`;
    
    await updateDoc(roomRef, {
      [typingField]: isTyping,
      updatedAt: serverTimestamp()
    });
    
    // 캡시 무효화
    clearCache('chatRooms');
    
    log(`입력 상태 업데이트 성공: ${roomId}, ${userId}, ${isTyping}`);
  } catch (error) {
    handleFirestoreError(error, `입력 상태 업데이트 (${roomId})`);
  }
};

/**
 * 실시간 입력 상태 리스너
 * @param {string} roomId - 채팅방 ID
 * @param {Function} callback - 입력 상태 변경 콜백
 * @returns {Function} 리스너 해제 함수
 */
export const setupTypingListener = (roomId, callback) => {
  try {
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const typingUsers = doc.data()?.typingUsers || {};
        callback(typingUsers);
      }
    });
    
    // 리스너 저장
    activeListeners[`typing_${roomId}`] = unsubscribe;
    log(`입력 상태 리스너 설정 완료: ${roomId}`);
    
    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, `입력 상태 리스너 오류 (${roomId})`);
    return () => {};
  }
};

// 알림 관련 기능은 notificationUtils.js로 이동되었습니다.
// 이 함수는 호환성을 위해 유지되며 notificationUtils의 함수를 호출합니다.
import { triggerPushNotification as triggerNotification } from './notificationUtils';

/**
 * 푸시 알림 트리거 (Cloud Functions 호출)
 * @param {Object} notificationData - 알림 데이터
 * @param {string} notificationData.roomId - 채팅방 ID
 * @param {string} notificationData.message - 메시지 내용
 * @param {string} notificationData.senderId - 발신자 ID
 * @param {string} notificationData.senderName - 발신자 이름
 * @param {Array} [notificationData.attachments] - 첨부파일 정보 (선택사항)
 * @returns {Promise<string|null>} 생성된 알림 ID 또는 null
 */
export const triggerPushNotification = async (notificationData) => {
  try {
    const { roomId } = notificationData;
    
    // notificationUtils의 함수 호출
    const notificationId = await triggerNotification(roomId, notificationData);
    log(`푸시 알림 트리거 성공: ${roomId}`);
    return notificationId;
  } catch (error) {
    const roomId = notificationData?.roomId || 'unknown';
    handleFirestoreError(error, `푸시 알림 트리거 (${roomId})`);
    return null;
  }
};

/**
 * 알림 읽음 처리
 * @param {string} notificationId - 알림 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notificationRef = doc(firebasedb, "notifications", notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (!notificationSnap.exists()) {
      throw new Error("알림을 찾을 수 없습니다.");
    }
    
    const data = notificationSnap.data();
    
    // 해당 사용자가 수신자인지 확인
    if (!data.recipients.includes(userId)) {
      throw new Error("이 알림의 수신자가 아닙니다.");
    }
    
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
      readBy: arrayUnion(userId)
    });
    
    log(`알림 읽음 처리 성공: ${notificationId}`);
  } catch (error) {
    handleFirestoreError(error, `알림 읽음 처리 (${notificationId})`);
  }
};

/**
 * 사용자의 알림 목록 가져오기
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 옵션 (정렬, 필터링 등)
 * @returns {Promise<Array>} 알림 목록
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limitCount = 20, onlyUnread = false } = options;
    
    let queryConstraints = [
      where("recipients", "array-contains", userId),
      orderBy("timestamp", "desc")
    ];
    
    if (onlyUnread) {
      queryConstraints.push(where("read", "==", false));
    }
    
    if (limitCount > 0) {
      queryConstraints.push(limit(limitCount));
    }
    
    const notificationsQuery = query(
      collection(firebasedb, "notifications"),
      ...queryConstraints
    );
    
    const querySnapshot = await getDocs(notificationsQuery);
    
    const notifications = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        roomId: data.roomId,
        roomName: data.roomName,
        message: data.message,
        senderId: data.senderId,
        senderName: data.senderName,
        timestamp: data.timestamp ? data.timestamp.toDate() : null,
        type: data.type,
        read: data.read || false,
        readAt: data.readAt ? data.readAt.toDate() : null
      });
    });
    
    log(`사용자 알림 조회 성공: ${userId}, ${notifications.length}개`);
    return notifications;
  } catch (error) {
    handleFirestoreError(error, `사용자 알림 조회 오류 (${userId})`);
    return [];
  }
};

// FirestoreBatch 클래스와 createBatch 함수는 chatFirestoreBatch.js로 이동되었습니다.

/**
 * 메시지 처리를 위한 공통 함수 (읽음 처리, 삭제 등)
 * @param {string} roomId - 채팅방 ID
 * @param {string|string[]} messageIds - 메시지 ID 또는 ID 배열
 * @param {string} userId - 사용자 ID
 * @param {string} operation - 수행할 작업 ('read', 'delete')
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 처리 결과
 */
async function processMessages(roomId, messageIds, userId, operation, options = {}) {
  try {
    const messageIdArray = Array.isArray(messageIds) ? messageIds : [messageIds];
    if (!roomId || !messageIdArray.length || !userId) throw new Error('invalid_parameters');
    
    if (options.checkPermission !== false) {
      // 공통 권한 확인 함수 사용
      await checkRoomPermission(roomId, userId, operation === 'delete');
    }
    
    const messagesData = [];
    for (const messageId of messageIdArray) {
      const messageRef = doc(firebasedb, "chatRooms", roomId, "messages", messageId);
      const messageSnap = await getDoc(messageRef);
      if (messageSnap.exists() && (operation !== 'delete' || messageSnap.data().userId === userId)) {
        messagesData.push({ id: messageId, ref: messageRef, data: messageSnap.data() });
      }
    }
    
    if (!messagesData.length) return { success: true, count: 0 };
    
    // createBatch 함수 사용
    const batch = createBatch();
    for (const message of messagesData) {
      if (operation === 'read') {
        batch.update(message.ref, { readBy: arrayUnion(userId), lastReadAt: serverTimestamp() });
      } else if (operation === 'delete') {
        batch.update(message.ref, { isDeleted: true, message: "삭제된 메시지입니다.", updatedAt: serverTimestamp() });
      }
    }
    await batch.commit();
    
    clearCache('messages', roomId);
    clearCache('chatRooms');
    
    return { success: true, count: messagesData.length, messagesData };
  } catch (error) {
    handleFirestoreError(error, `메시지 처리 오류 (${roomId}, ${operation})`);
    return { success: false, count: 0 };
  }
}

/**
 * 메시지를 읽음 상태로 표시 (개선된 버전 - 단일/다중 메시지 모두 처리)
 * @param {string} roomId - 채팅방 ID
 * @param {string|string[]} messageIds - 메시지 ID 또는 ID 배열
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 처리 결과
 */
export const markMessagesAsRead = async (roomId, messageIds, userId, options = {}) => {
  try {
    // 메시지 ID가 단일 문자열이거나 배열인지 확인
    const messageIdArray = Array.isArray(messageIds) ? messageIds : [messageIds];
    
    // 메시지 ID가 하나이고 간단한 처리를 원하는 경우 (이전 markMessageAsRead 호환)
    if (messageIdArray.length === 1 && options.simple === true) {
      const messageId = messageIdArray[0];
      const messageRef = doc(firebasedb, "chatRooms", roomId, "messages", messageId);
      await updateDoc(messageRef, {
        readBy: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      
      // 캡시 무효화
      clearCache('messages', roomId);
      
      log(`메시지 읽음 처리 성공: ${messageId}, ${userId}`);
      return { success: true, count: 1, roomId };
    }
    
    // 다중 메시지 처리
    const result = await processMessages(roomId, messageIdArray, userId, 'read', options);
    if (!result.success) return result;
    
    // 채팅방 상태 업데이트
    if (options.updateRoomStatus !== false) {
      await updateDoc(doc(firebasedb, "chatRooms", roomId), {
        lastReadBy: arrayUnion(userId),
        lastReadAt: serverTimestamp(),
        hasNewMessages: false
      });
    }
    
    // 구독자에게 알림
    if (options.notifySubscribers !== false && options.communityDBManager) {
      options.communityDBManager.notifySubscribers('messagesRead', {
        roomId,
        userId,
        messageIds: messageIdArray,
        timestamp: new Date()
      });
    }
    
    // 캡시 무효화
    clearCache('messages', roomId);
    clearCache('chatRooms');
    
    log(`메시지 읽음 처리 완료: ${roomId}, ${result.count}개`);
    return { success: true, count: result.count, roomId };
  } catch (error) {
    handleFirestoreError(error, `메시지 읽음 처리 오류 (${roomId})`);
    return { success: false, count: 0, roomId };
  }
};

/**
 * 여러 메시지 삭제
 * @param {string} roomId - 채팅방 ID
 * @param {Array<string>} messageIds - 메시지 ID 배열
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export const deleteMessages = async (roomId, messageIds, userId) => {
  try {
    const { success, count, messagesData } = await processMessages(roomId, messageIds, userId, 'delete');
    if (!success) return;
    
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data();
    
    if (messagesData.some(message => roomData.lastSenderId === userId && roomData.lastMessage === message.data.message)) {
      const messagesQuery = query(
        collection(firebasedb, "chatRooms", roomId, "messages"),
        where("isDeleted", "!=", true),
        orderBy("isDeleted", "asc"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(messagesQuery);
      await updateDoc(roomRef, querySnapshot.empty ? {
        lastMessage: "",
        lastSender: "",
        lastSenderId: null,
        updatedAt: serverTimestamp()
      } : {
        lastMessage: querySnapshot.docs[0].data().message,
        lastMessageTime: querySnapshot.docs[0].data().timestamp,
        lastSender: querySnapshot.docs[0].data().username,
        lastSenderId: querySnapshot.docs[0].data().userId,
        updatedAt: serverTimestamp()
      });
    }
    
    log(`[realtimeChatUtilsFB] 메시지 삭제 성공: ${roomId}, ${count}개`);
  } catch (error) {
    handleFirestoreError(error, `메시지 삭제 오류 (${roomId})`);
  }
};

// getChatRoomsAsSection 함수는 getChatRooms 함수에 groupBySection 옵션을 통해 통합되었습니다.

export default {
  createChatRoom,
  getChatRooms,
  getChatMessages,
  sendMessage,
  setupChatListener,
  updateChatRoom,
  toggleMessageReaction,
  manageChatRoomMember,
  cleanupListeners,
  markMessagesAsRead,
  uploadFileAndSendMessage,
  createInviteLink,
  joinRoomByInvite,
  editMessage,
  deleteMessage,
  updateTypingStatus,
  setupTypingListener,
  triggerPushNotification,
  markNotificationAsRead,
  getUserNotifications,
  
  // 추가된 최적화 기능
  clearCache,
  deleteMessages
};