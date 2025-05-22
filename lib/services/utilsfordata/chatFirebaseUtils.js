'use client';

import { doc, getDoc, getDocs as getDocsOriginal } from 'firebase/firestore';
import { firebasedb, firebaseStorage } from '../../firebaseCli';
/**
 * LRU(Least Recently Used) 캐시 구현
 * 최대 크기를 제한하여 메모리 사용량을 관리하는 캐시
 */
class LRUCache {
  /**
   * LRU 캐시 생성
   * @param {number} maxSize - 최대 저장 항목 수
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.lastResults = new Map();
  }

  /**
   * 캐시 항목 추가
   * @param {string} key - 캐시 키
   * @param {any} value - 저장할 값
   */
  set(key, value) {
    // 최대 크기 초과 시 가장 오래된 항목 제거
    if (this.lastResults.size >= this.maxSize) {
      const oldestKey = this.lastResults.keys().next().value;
      this.lastResults.delete(oldestKey);
    }
    
    // 새 항목 추가
    this.lastResults.set(key, value);
    return this;
  }

  /**
   * 캐시 항목 조회
   * @param {string} key - 캐시 키
   * @returns {any} 저장된 값 또는 undefined
   */
  get(key) {
    const value = this.lastResults.get(key);
    
    // LRU 특성 구현: 접근한 항목을 가장 최근으로 이동
    if (value !== undefined) {
      this.lastResults.delete(key);
      this.lastResults.set(key, value);
    }
    
    return value;
  }

  /**
   * 캐시 항목 삭제
   * @param {string} key - 캐시 키
   * @returns {boolean} 삭제 성공 여부
   */
  delete(key) {
    return this.lastResults.delete(key);
  }

  /**
   * 캐시 초기화
   */
  clear() {
    this.lastResults.clear();
  }
}

// 전역 캐시 인스턴스 생성
const cache = new LRUCache(50);

// 캐시 객체와 Firebase 인스턴스 내보내기
export { cache, firebasedb, firebaseStorage };

/**
 * 특정 타입의 캐시 항목 삭제
 * @param {string} type - 캐시 타입
 * @param {string} id - 특정 ID (선택적)
 */
export const clearCache = (type, id = null) => {
  if (!type) return;
  
  // 특정 ID가 있는 경우 해당 항목만 삭제
  if (id) {
    const key = `${type}:${id}`;
    cache.delete(key);
    log(`캐시 삭제: ${key}`);
  } 
  // 타입으로 시작하는 모든 캐시 항목 삭제
  else {
    const keysToDelete = [];
    cache.lastResults.forEach((value, key) => {
      if (key.startsWith(type)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      cache.delete(key);
    });
    
    log(`캐시 삭제: ${type} 타입 ${keysToDelete.length}개`);
  }
};

/**
 * 캐시에 결과 저장
 * @param {string} cacheKey - 캐시 키
 * @param {any} data - 저장할 데이터
 */
export const setCacheResult = (cacheKey, data) => {
  if (!cacheKey) return;
  cache.lastResults.set(cacheKey, data);
  log(`캐시 저장: ${cacheKey}`);
};

/**
 * 캐시에서 커서 저장
 * @param {string} cacheKey - 캐시 키
 * @param {any} cursor - 저장할 커서
 */
export const setCacheCursor = (cacheKey, cursor) => {
  if (!cacheKey || !cursor) return;
  if (!cache.lastCursor) cache.lastCursor = new Map();
  cache.lastCursor.set(cacheKey, cursor);
};

/**
 * 캐시에서 커서 삭제
 * @param {string} cacheKey - 캐시 키
 */
export const deleteCacheCursor = (cacheKey) => {
  if (!cacheKey || !cache.lastCursor) return;
  cache.lastCursor.delete(cacheKey);
};

/**
 * 공통 로깅 함수
 * @param {string} message - 로그 메시지
 * @param {boolean} debug - 디버그 모드 여부
 */
export function log(message, debug = false) {
  if (debug || process.env.NODE_ENV !== 'production') {
    console.log(`[ChatFirebaseUtils] ${message}`);
  }
}

/**
 * 공통 에러 로깅 함수
 * @param {string} message - 에러 메시지
 * @param {Error} error - 에러 객체
 */
export function logError(message, error) {
  console.error(`[ChatFirebaseUtils] ${message}:`, error);
}

/**
 * 공통 에러 처리 함수
 * @param {Error} error - 발생한 오류 객체
 * @param {string} context - 오류 발생 컨텍스트 설명
 * @throws {Error} 사용자 친화적 오류 메시지
 */
export function handleFirestoreError(error, context) {
  logError(context, error);
  
  if (error.message === 'empty_message') {
    throw new Error('메시지 내용이 비어있습니다.');
  } else if (error.message === 'chat_room_not_found') {
    throw new Error('채팅방을 찾을 수 없습니다.');
  } else if (error.message === 'permission_denied' || error.code === 'permission-denied') {
    throw new Error('권한이 없습니다.');
  } else if (error.message === 'read_only_room') {
    throw new Error('읽기 전용 채팅방입니다.');
  } else if (error.code === 'resource-exhausted') {
    throw new Error('요청 한도를 초과했습니다. 나중에 다시 시도해주세요.');
  } else if (error.message === 'invalid_parameters') {
    throw new Error('잘못된 파라미터가 전달되었습니다.');
  }
  
  throw new Error(`${context} 실패`);
}

/**
 * 채팅방 권한 확인 공통 함수
 * @param {string} roomId - 채팅방 ID
 * @param {string} userId - 사용자 ID
 * @param {boolean} checkReadOnly - 읽기 전용 채팅방 검사 여부
 * @returns {Promise<Object>} 채팅방 데이터
 * @throws {Error} 권한 없음 또는 채팅방 없음 오류
 */
export async function checkRoomPermission(roomId, userId, checkReadOnly = false) {
  if (!roomId || !userId) {
    throw new Error('invalid_parameters');
  }
  
  const roomRef = doc(firebasedb, "chatRooms", roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error('chat_room_not_found');
  }
  
  const roomData = roomSnap.data();
  
  // 채팅방 접근 권한 확인
  if (!roomData.isPublic && Array.isArray(roomData.members) && userId && !roomData.members.includes(userId)) {
    throw new Error('permission_denied');
  }
  
  // members가 없는 경우 (default 채팅방 등) 접근 허용
  if (!roomData.isPublic && !Array.isArray(roomData.members)) {
    console.log(`[ChatFirebaseUtils] 채팅방 ${roomData.id || 'unknown'}에 members 배열이 없습니다. 공개 채팅방으로 간주합니다.`);
  }
  
  // 읽기 전용 채팅방 검사
  if (checkReadOnly && roomData.readOnly && Array.isArray(roomData.admins) && userId && !roomData.admins.includes(userId)) {
    throw new Error('read_only_room');
  }
  
  return roomData;
}

/**
 * 캡슐화된 getDocs 함수 (캐싱 기능 추가 및 유효성 검사)
 * @param {Query} query - Firestore 쿼리
 * @param {string} cacheKey - 캐시 키
 * @param {boolean} useCache - 캐시 사용 여부
 * @returns {Promise<QuerySnapshot>}
 */
export const getDocsWithCache = async (query, cacheKey = null, useCache = true) => {
  // 캐시 키가 없거나 캐시를 사용하지 않는 경우 기본 함수 호출
  if (!cacheKey || !useCache) {
    return getDocsOriginal(query);
  }
  
  // 캐싱된 결과가 있는지 확인
  if (cache.lastResults.has(cacheKey)) {
    const cachedResult = cache.lastResults.get(cacheKey);
    
    // 캐시 데이터 유효성 검사 - 간소화된 버전
    if (cachedResult && Array.isArray(cachedResult)) {
      log(`캐시된 결과 사용: ${cacheKey}, 항목 수: ${cachedResult.length}`);
      return cachedResult;
    }
    
    // 유효하지 않은 캐시는 삭제
    log(`유효하지 않은 캐시 삭제: ${cacheKey}`);
    cache.lastResults.delete(cacheKey);
  }
  
  // 캐싱된 결과가 없으면 실제 쿼리 실행
  const result = await getDocsOriginal(query);
  
  // 결과 캐싱
  if (result && typeof result === 'object') {
    cache.lastResults.set(cacheKey, result);
    log(`쿼리 결과 캐싱: ${cacheKey}`);
  }
  
  return result;
};

/**
* 이벤트 대상 유효성 검사 함수
* @param {EventTarget} target - 검사할 이벤트 대상
* @param {string} context - 오류 메시지에 포함할 컨텍스트 정보
* @returns {EventTarget} 유효한 대상인 경우 대상 그대로 반환
* @throws {Error} 유효하지 않은 대상인 경우 예외 발생
*/
export const validateEventTarget = (target, context = '') => {
if (!target) {
  throw new Error(`[${context}] 이벤트 대상이 필요합니다`);
}
if (typeof target.dispatchEvent !== 'function') {
  throw new Error(`[${context}] 유효한 이벤트 대상이 아닙니다`);
}
return target;
};

/**
* 특정 클래스를 가진 DOM 요소인지 확인하는 함수
* @param {EventTarget} target - 검사할 이벤트 대상
* @param {string} className - 필요한 클래스 이름
* @param {string} context - 오류 메시지에 포함할 컨텍스트 정보
* @returns {EventTarget} 유효한 대상인 경우 대상 그대로 반환
* @throws {Error} 유효하지 않은 대상인 경우 예외 발생
*/
export const validateTargetClass = (target, className, context = '') => {
// 기본 유효성 검사 먼저 수행
validateEventTarget(target, context);
  
// DOM 요소인지 확인
if (!(target instanceof Element)) {
  throw new Error(`[${context}] 이벤트 대상은 DOM 요소여야 합니다`);
}
  
// 특정 클래스를 가지고 있는지 확인
if (!target.matches(`.${className}`)) {
  throw new Error(`[${context}] 이벤트 대상은 '${className}' 클래스를 가져야 합니다`);
}
  
return target;
};