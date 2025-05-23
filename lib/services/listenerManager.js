/**
 * 리스너 관리 모듈
 * 채팅 및 타이핑 상태 리스너 관리를 담당
 */

const chatListeners = {};
const typingListeners = {};

/**
 * 로깅 유틸리티
 * @param {string} message - 로그 메시지
 * @param {string} level - 로그 레벨 (info, warn, error)
 */
function log(message, level = 'info') {
  if (process.env.NODE_ENV !== 'production' || level === 'error') {
    console[level](`[ListenerManager] ${message}`);
  }
}

/**
 * 채팅 메시지 리스너 추가
 * @param {string} instanceId - 인스턴스 ID (예: travelCommunity 인스턴스별 고유 ID)
 * @param {string} roomId - 채팅방 ID
 * @param {Function} unsubscribe - 리스너 해제 함수
 */
export function addChatListener(instanceId, roomId, unsubscribe) {
  const key = `${instanceId}_${roomId}`;
  if (chatListeners[key]) {
    log(`기존 채팅 리스너 제거: ${roomId}`);
    chatListeners[key]();
    delete chatListeners[key];
  }
  chatListeners[key] = unsubscribe;
  log(`채팅 리스너 추가: ${roomId}`);
}

/**
 * 타이핑 상태 리스너 추가
 * @param {string} instanceId - 인스턴스 ID
 * @param {string} roomId - 채팅방 ID
 * @param {Function} unsubscribe - 리스너 해제 함수
 */
export function addTypingListener(instanceId, roomId, unsubscribe) {
  const key = `${instanceId}_${roomId}`;
  if (typingListeners[key]) {
    log(`기존 타이핑 리스너 제거: ${roomId}`);
    typingListeners[key]();
    delete typingListeners[key];
  }
  typingListeners[key] = unsubscribe;
  log(`타이핑 리스너 추가: ${roomId}`);
}

/**
 * 특정 인스턴스의 모든 리스너 정리
 * @param {string} instanceId - 인스턴스 ID
 */
export function cleanup(instanceId) {
  Object.entries(chatListeners).forEach(([key, unsubscribe]) => {
    if (key.startsWith(`${instanceId}_`)) {
      unsubscribe?.();
      delete chatListeners[key];
    }
  });
  Object.entries(typingListeners).forEach(([key, unsubscribe]) => {
    if (key.startsWith(`${instanceId}_`)) {
      unsubscribe?.();
      delete typingListeners[key];
    }
  });
  log(`리스너 정리 완료: ${instanceId}`);
}

/**
 * 특정 채팅방의 리스너 정리
 * @param {string} instanceId - 인스턴스 ID
 * @param {string} roomId - 채팅방 ID
 */
export function cleanupRoom(instanceId, roomId) {
  const key = `${instanceId}_${roomId}`;
  
  if (chatListeners[key]) {
    chatListeners[key]();
    delete chatListeners[key];
    log(`채팅 리스너 제거: ${roomId}`);
  }
  
  if (typingListeners[key]) {
    typingListeners[key]();
    delete typingListeners[key];
    log(`타이핑 리스너 제거: ${roomId}`);
  }
}

/**
 * 디버깅용: 현재 활성 리스너 상태 반환
 * @returns {Object} 활성 리스너 상태
 */
export function getActiveListeners() {
  return {
    chat: Object.keys(chatListeners),
    typing: Object.keys(typingListeners)
  };
}
