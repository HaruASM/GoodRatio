/**
 * 커뮤니티 API 모듈
 * 채팅방 목록 및 메시지 관리를 담당하는 함수형 API
 */

import { collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { createChatRoom as createChatRoomModel, createMessage } from '../../models/communityModels.js';
import { firebasedb } from '../../lib/firebaseCli.js';
import * as realtimeChatUtils from '../../lib/services/realtimeChatUtilsFB.js';
import { addChatListener, addTypingListener, cleanup as cleanupListeners } from '../../lib/services/listenerManager.js';

// 인스턴스별 테스트 채팅방 생성 플래그 - Map 사용
// WeakMap은 객체 키만 지원하고 instanceId는 문자열이므로 Map 사용
const testRoomCreationFlags = new Map();

/**
 * 로깅 유틸리티
 * @param {string} message - 로그 메시지
 * @param {string} level - 로그 레벨 (info, warn, error)
 */
function log(message, level = 'info') {
  if (process.env.NODE_ENV !== 'production' || level === 'error') {
    console[level](`[CommunityAPI] ${message}`);
  }
}

/**
 * 초기화 함수 - Redux Thunk에서 호출
 * @param {Object} params - 초기화 파라미터
 * @param {string} params.userId - 사용자 ID
 * @param {string} params.instanceId - 현재 채팅 인스턴스 ID
 * @returns {Promise<Object>} 채팅 데이터 (rooms, messages, roomId)
 */
export async function initializeWithEvents({ userId, instanceId }) {
  try {
    log('초기화 시작');
    // Ensure userId and instanceId are explicitly passed and used
    if (!userId || !instanceId) {
      const errorMessage = `initializeWithEvents: userId and instanceId are required. Received userId: ${userId}, instanceId: ${instanceId}`;
      log(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    const chatData = await loadChatData(null, { 
      messageLimit: 50, 
      userId,     // Use directly
      instanceId  // Use directly
    });
    log('초기화 완료');
    return chatData;
  } catch (error) {
    log(`initializeWithEvents 오류: ${error.message}`, 'error'); 
    throw error; 
  }
}

/**
 * 테스트 채팅방 생성 (내부 함수)
 * @param {string} instanceId - 인스턴스 ID
 * @returns {Promise<string|null>} 생성된 채팅방 ID 또는 null
 */
async function createTestChatRoom(instanceId) {
  // instanceId를 필수 파라미터로 변경 (기본값 제거)
  if (!instanceId) {
    log('createTestChatRoom: instanceId가 필요합니다.', 'error');
    throw new Error('instanceId가 필요합니다.');
  }
  
  // 이미 플래그가 있는지 Map을 통해 확인
  if (testRoomCreationFlags.has(instanceId)) return null;
  testRoomCreationFlags.set(instanceId, true);

  try {
    const testRoomData = {
      name: '테스트 채팅방',
      isPublic: true,
      createdBy: 'system',
      createdAt: serverTimestamp(),
      members: ['user-1'],
      admins: ['user-1'],
      lastMessage: '환영합니다! 이것은 테스트 채팅방입니다.',
      lastMessageTime: serverTimestamp(),
    };

    const roomId = await createChatRoom(testRoomData);
    log(`테스트 채팅방 생성됨: ${roomId}`);

    await sendMessage(roomId, {
      username: '시스템',
      message: '환영합니다! 이것은 테스트 채팅방입니다.',
      timestamp: new Date(),
      senderId: 'system',
    }, 'system');

    return roomId;
  } catch (error) {
    log(`테스트 채팅방 생성 오류: ${error.message}`, 'error');
    return null;
  } finally {
    // Map에서 플래그 제거
    testRoomCreationFlags.delete(instanceId);
  }
}

async function fetchRooms(userId) {
  try {
    // 서버 측 필터링을 위해 userId를 전달
    // realtimeChatUtils.getChatRooms는 { rooms, hasMore, lastVisible } 형태로 반환
    const { rooms } = await realtimeChatUtils.getChatRooms({ 
      userId,           // userId가 있는 경우 Firestore에서 members 배열에 userId가 포함된 방만 필터링
      orderField: 'lastMessageTime',
      orderDirection: 'desc',
      limitCount: 50,  // 적절한 값으로 조정
      useCache: true
    });
    
    log(`채팅방 목록 로드 완료: ${rooms.length}개`);
    return rooms;
  } catch (error) {
    log(`채팅방 목록 로드 오류: ${error.message}`, 'error');
    throw error; // Re-throw to be caught by the caller (loadChatData)
  }
}

async function fetchMessages(roomId, messageLimit = 50) {
  try {
    if (!roomId) {
      log('fetchMessages: roomId가 제공되지 않아 메시지를 로드할 수 없습니다.');
      return []; // No room ID, no messages
    }
    const messages = await getChatMessages(roomId, { messageLimit });
    log(`채팅방 메시지 로드 완료 (${roomId}): ${messages.length} 개`);
    return messages;
  } catch (error) {
    log(`메시지 로드 오류 (${roomId}): ${error.message}`, 'error');
    // Return empty array on error to prevent breaking the entire chat data loading process
    // The error is logged, and the UI can indicate that messages for this room couldn't be loaded.
    return []; 
  }
}

/**
 * 채팅 데이터 로드 (채팅방 목록 및 메시지).
 * 이 함수는 fetchRooms와 fetchMessages를 사용하여 데이터를 가져오고,
 * 필요한 경우 createTestChatRoom을 호출하여 테스트 채팅방을 생성합니다.
 * @param {string} [requestedRoomId=null] - 요청된 채팅방 ID (선택적).
 * @param {Object} options - 추가 옵션.
 * @param {number} [options.messageLimit=50] - 가져올 메시지의 최대 수.
 * @param {string} options.userId - 현재 사용자 ID (방 필터링 및 테스트 방 생성 로직에 사용될 수 있음).
 * @param {string} options.instanceId - 현재 채팅 인스턴스 ID (테스트 방 생성에 필수).
 * @returns {Promise<Object>} 채팅 데이터 객체: { rooms: Array, messages: Array, roomId: string|null }.
 * @throws {Error} instanceId가 제공되지 않은 경우, 또는 fetchRooms에서 오류 발생 시.
 */
export async function loadChatData(requestedRoomId = null, options = {}) {
  const { messageLimit = 50, userId, instanceId } = options;

  try {
    log(`채팅 데이터 로드 시작 (요청된 방 ID: ${requestedRoomId || '없음'}, 사용자 ID: ${userId || '없음'}, 인스턴스 ID: ${instanceId || '없음'})`);
    
    if (!instanceId) {
      const errMsg = 'loadChatData: instanceId가 필요합니다.';
      log(errMsg, 'error');
      throw new Error(errMsg);
    }

    let rooms = await fetchRooms(userId);

    // If no rooms are found for the user (or no rooms exist at all if userId is null),
    // and a userId is provided (implying a user-specific context where test rooms might be relevant),
    // attempt to create a test chat room.
    if (rooms.length === 0 && userId) { 
      log('사용자에게 할당된 채팅방이 없음, 테스트 채팅방 생성 시도');
      try {
        const newRoomId = await createTestChatRoom(instanceId); // createTestChatRoom requires instanceId
        if (newRoomId) {
          log(`테스트 채팅방 생성됨: ${newRoomId}. 채팅방 목록 다시 로드.`);
          rooms = await fetchRooms(userId); // Re-fetch rooms after creation
        }
      } catch (createRoomError) {
        log(`테스트 채팅방 생성 오류: ${createRoomError.message}`, 'error');
        // Continue without a test room if creation fails, rooms will remain empty or as initially fetched.
      }
    }

    // Determine the actual room ID to load messages for.
    // Prioritize requestedRoomId if it's valid and exists in the fetched rooms.
    // Otherwise, default to the first room in the list.
    const validRoomId = requestedRoomId && rooms.some(room => room.id === requestedRoomId)
      ? requestedRoomId
      : rooms[0]?.id || null; // Default to null if no rooms exist

    // Mark the selected room in the list
    const roomsWithSelected = rooms.map(room => ({
      ...room,
      isSelected: room.id === validRoomId,
    }));

    const messages = await fetchMessages(validRoomId, messageLimit);
    
    const chatData = { rooms: roomsWithSelected, messages, roomId: validRoomId };
    log(`채팅 데이터 로드 완료. 방: ${roomsWithSelected.length}개, 메시지: ${messages.length}개, 현재 방 ID: ${validRoomId || '없음'}`);
    return chatData;
  } catch (error) {
    // This will catch errors from fetchRooms or the initial instanceId check.
    log(`loadChatData에서 심각한 오류 발생: ${error.message}`, 'error');
    throw error; // Re-throw for the caller (e.g., initializeWithEvents) to handle.
  }
}

/**
 * 채팅방 목록 가져오기
 * @param {string} [userId] - 사용자 ID (지정된 경우 해당 사용자가 속한 채팅방만 조회)
 * @returns {Promise<Array>} 채팅방 목록
 */
export async function getChatRooms(userId) {
  try {
    // realtimeChatUtilsFB.js의 getChatRooms 함수 활용
    // 서버 측 필터링 적용 (클라이언트 필터링 제거)
    const { rooms } = await realtimeChatUtils.getChatRooms({ 
      userId,           // userId가 있는 경우 Firestore에서 members 배열에 userId가 포함된 방만 필터링
      orderField: 'lastMessageTime',
      orderDirection: 'desc',
      limitCount: 50,  // 적절한 값으로 조정
      useCache: true
    });

    log(`채팅방 목록 로드 완료: ${rooms.length}개`);
    return rooms;
  } catch (error) {
    log(`채팅방 목록 로드 오류: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 특정 채팅방의 메시지 가져오기
 * @param {string} roomId - 채팅방 ID
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Array>} 메시지 배열
 */
export async function getChatMessages(roomId, options = {}) {
  const { messageLimit = 50 } = options;

  try {
    if (!roomId) {
      log('유효하지 않은 채팅방 ID', 'warn');
      return [];
    }

    const messages = await realtimeChatUtils.getChatMessages(roomId, messageLimit);
    const sortedMessages = messages.sort((a, b) => {
      const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return dateA - dateB;
    });

    log(`메시지 로드 완료: ${roomId}, ${sortedMessages.length}개`);
    return sortedMessages;
  } catch (error) {
    log(`메시지 로드 오류 (${roomId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 채팅방 생성하기
 * @param {Object} roomData - 채팅방 데이터
 * @param {Object} options - 옵션
 * @returns {Promise<string>} 생성된 채팅방 ID
 */
export async function createChatRoom(roomData, options = {}) {
  try {
    const standardizedRoomData = {
      ...createChatRoomModel(roomData),
      createdAt: roomData.createdAt || serverTimestamp(),
      lastMessageTime: roomData.lastMessageTime || serverTimestamp(),
    };

    const roomId = await realtimeChatUtils.createChatRoom(standardizedRoomData);
    log(`채팅방 생성 완료: ${roomId}`);
    return roomId;
  } catch (error) {
    log(`채팅방 생성 오류: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 메시지 전송하기
 * @param {string} roomId - 채팅방 ID
 * @param {Object} messageData - 메시지 데이터
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string>} 생성된 메시지 ID
 */
export async function sendMessage(roomId, messageData, userId) {
  try {
    // userId validation removed - now handled by the thunk
    
    // Prepare message data with necessary fields
    const standardizedMessageData = createMessage({
      ...messageData,
      senderId: userId, // Still use userId if provided
      timestamp: messageData.timestamp || new Date(),
    });

    // Call realtimeChatUtils.sendMessage with the standardized data
    const messageId = await realtimeChatUtils.sendMessage(roomId, standardizedMessageData);
    log(`메시지 전송 완료: ${messageId}`);
    return messageId;
  } catch (error) {
    log(`메시지 전송 오류 (${roomId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 메시지 리스너 설정
 * @param {string} instanceId - 인스턴스 ID
 * @param {string} roomId - 채팅방 ID
 * @param {Function} callback - 메시지 변경 시 호출할 콜백 함수
 * @returns {Promise<Function>} 리스너 해제 함수
 */
export async function listenForMessages(instanceId, roomId, callback) {
  try {
    const unsubscribe = await realtimeChatUtils.listenForMessages(roomId, callback);
    addChatListener(instanceId, roomId, unsubscribe);
    log(`메시지 리스너 설정 완료: ${roomId}`);
    return unsubscribe;
  } catch (error) {
    log(`메시지 리스너 설정 오류 (${roomId}): ${error.message}`, 'error');
    return () => {};
  }
}

/**
 * 타이핑 상태 리스너 설정
 * @param {string} instanceId - 인스턴스 ID
 * @param {string} roomId - 채팅방 ID
 * @param {Function} callback - 타이핑 상태 변경 시 호출할 콜백 함수
 * @returns {Promise<Function>} 리스너 해제 함수
 */
export async function listenForTypingStatus(instanceId, roomId, callback) {
  try {
    const unsubscribe = await realtimeChatUtils.setupTypingListener(roomId, callback);
    addTypingListener(instanceId, roomId, unsubscribe);
    log(`타이핑 리스너 설정 완료: ${roomId}`);
    return unsubscribe;
  } catch (error) {
    log(`타이핑 리스너 설정 오류 (${roomId}): ${error.message}`, 'error');
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
export async function updateTypingStatus(roomId, userId, isTyping) {
  try {
    await realtimeChatUtils.updateTypingStatus(roomId, userId, isTyping);
    log(`타이핑 상태 업데이트: ${roomId}, ${userId}, ${isTyping ? '입력중' : '입력중지'}`);
  } catch (error) {
    log(`타이핑 상태 업데이트 오류 (${roomId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 파일 업로드
 * @param {string} roomId - 채팅방 ID
 * @param {File} file - 업로드할 파일
 * @param {Object} userInfo - 사용자 정보
 * @returns {Promise<Object>} 업로드 결과 (url, name)
 */
export async function uploadFile(roomId, file, userInfo) {
  try {
    if (!userInfo?.userId) {
      throw new Error('사용자 정보가 필요합니다.');
    }

    const messageData = {
      message: 'File upload',
      senderId: userInfo.userId,
    };

    const result = await realtimeChatUtils.uploadFileAndSendMessage(roomId, messageData, file);
    log(`파일 업로드 완료: ${roomId}`);
    return { url: result.fileUrl, name: file.name };
  } catch (error) {
    log(`파일 업로드 오류 (${roomId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 메시지 수정
 * @param {string} roomId - 채팅방 ID
 * @param {string} messageId - 메시지 ID
 * @param {string} newText - 새 메시지 내용
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export async function editMessage(roomId, messageId, newText, userId) {
  try {
    // userId validation removed - now handled by the thunk
    
    await realtimeChatUtils.editMessage(roomId, messageId, newText, userId);
    log(`메시지 수정 완료: ${messageId} (by ${userId})`);
  } catch (error) {
    log(`메시지 수정 오류 (${roomId}, ${messageId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 메시지 삭제
 * @param {string} roomId - 채팅방 ID
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<void>}
 */
export async function deleteMessage(roomId, messageId, userId) {
  try {
    // userId validation removed - now handled by the thunk
    
    await realtimeChatUtils.deleteMessage(roomId, messageId, userId);
    log(`메시지 삭제 완료: ${messageId} (by ${userId})`);
  } catch (error) {
    log(`메시지 삭제 오류 (${roomId}, ${messageId}): ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 리스너 정리
 * @param {string} instanceId - 인스턴스 ID
 */
export function cleanup(instanceId) {
  cleanupListeners(instanceId);
  log(`모듈 정리 완료: ${instanceId}`);
}
