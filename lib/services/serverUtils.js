import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp, onSnapshot, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset } from '../models/editorModels';

// 현재 활성화된 실시간 리스너를 관리할 객체
const realtimeListeners = {};

// 파이어베이스 요청 제한 관리자
const firebaseRequestManager = {
  // 최근 요청 시간 추적 (섹션별)
  lastRequestTime: {},
  
  // 재시도 카운터 (섹션별)
  retryCount: {},
  
  // 요청 간격 (3초)
  REQUEST_INTERVAL_MS: 3000,
  
  // 최대 재시도 횟수
  MAX_RETRY_COUNT: 3,
  
  // 요청 가능 여부 확인
  canMakeRequest: function(sectionName) {
    const now = Date.now();
    const lastTime = this.lastRequestTime[sectionName] || 0;
    
    // 처음 요청하는 경우 또는 요청 간격이 지난 경우
    if (!lastTime || (now - lastTime >= this.REQUEST_INTERVAL_MS)) {
      this.lastRequestTime[sectionName] = now;
      return true;
    }
    
    return false;
  },
  
  // 재시도 가능 여부 확인
  canRetry: function(sectionName) {
    if (!this.retryCount[sectionName]) {
      this.retryCount[sectionName] = 0;
    }
    
    // 최대 재시도 횟수보다 적게 시도한 경우
    if (this.retryCount[sectionName] < this.MAX_RETRY_COUNT) {
      this.retryCount[sectionName]++;
      return true;
    }
    
    return false;
  },
  
  // 재시도 카운터 초기화
  resetRetryCount: function(sectionName) {
    this.retryCount[sectionName] = 0;
  }
};

/**
 * 기본 타임아웃이 있는 요청 함수
 * @param {Function} fetchFunction - 실행할 비동기 함수
 * @param {number} timeoutMs - 제한 시간 (밀리초)
 * @returns {Promise<any>} 요청 결과
 */
const fetchWithTimeout = async (fetchFunction, timeoutMs = 10000) => {
  try {
    // 타임아웃 Promise 생성
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('요청 시간 초과')), timeoutMs);
    });
    
    // 실제 요청과 타임아웃 경쟁
    return await Promise.race([fetchFunction(), timeoutPromise]);
  } catch (error) {
    console.error('데이터 요청 실패:', error.message);
    throw error;
  }
};

/**
 * 지연 함수 (Promise 기반)
 * @param {number} ms - 지연 밀리초
 * @returns {Promise} 지연 Promise
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 내부 함수: 로컬 스토리지에 섹션 데이터 저장 (타임스탬프 저장 기능 추가)
const _saveToLocalStorage = (sectionName, sectionData, serverTimestamp = null) => {
  try {
    // 데이터를 JSON으로 직렬화하여 저장
    localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
    
    // 타임스탬프 저장 (서버에서 받은 타임스탬프 또는 현재 시간)
    const timestamp = serverTimestamp || Date.now().toString();
    localStorage.setItem(`${sectionName}_timestamp`, timestamp);
    
    console.log(`로컬 스토리지에 ${sectionName} 데이터 저장 완료 (${sectionData.length}개 항목), 타임스탬프: ${timestamp}`);
  } catch (error) {
    console.error('localStorage 저장 오류:', error);
  }
};

// 내부 함수: Firebase에서 섹션 데이터 가져오기 (타임스탬프 처리 추가)
const _fetchFromFirebase = async (sectionName, attemptCount = 0) => {
  // 요청 가능 여부 확인
  if (!firebaseRequestManager.canMakeRequest(sectionName)) {
    // 이미 최근에 요청했다면 대기 후 재시도
    console.log(`${sectionName} 요청 간격 제한으로 ${firebaseRequestManager.REQUEST_INTERVAL_MS/1000}초 대기 후 재시도합니다...`);
    await delay(firebaseRequestManager.REQUEST_INTERVAL_MS);
    return _fetchFromFirebase(sectionName, attemptCount);
  }
  
  try {
    console.log(`Firebase에서 ${sectionName} 데이터 로드 시도 (시도 ${attemptCount + 1}/${firebaseRequestManager.MAX_RETRY_COUNT})`);
    
    // 섹션 문서 먼저 조회해서 타임스탬프 확인 (5초 타임아웃 적용)
    // 참고: 타임스탬프만 확인하는 이 요청도 Firestore 읽기 비용이 발생합니다.
    // 하지만 전체 문서를 가져오는 것보다 효율적입니다.
    const sectionRef = doc(firebasedb, "sections", sectionName);
    const sectionSnap = await fetchWithTimeout(() => getDoc(sectionRef), 5000);
    let sectionTimestamp = null;
    
    if (sectionSnap.exists()) {
      const sectionData = sectionSnap.data();
      if (sectionData.lastUpdated) {
        // Firestore Timestamp를 밀리초로 변환
        sectionTimestamp = sectionData.lastUpdated.toMillis ? 
          sectionData.lastUpdated.toMillis().toString() : 
          sectionData.lastUpdated.toString();
      }
    }
    
    // 로컬 스토리지에 저장된 타임스탬프 확인
    const localTimestamp = localStorage.getItem(`${sectionName}_timestamp`);
    
    // 타임스탬프가 동일하면 서버 데이터가 변경되지 않았으므로 로컬 데이터 사용
    // (참고: 이 비교 자체는 추가 비용을 발생시키지 않습니다)
    if (sectionTimestamp && localTimestamp && sectionTimestamp === localTimestamp) {
      console.log(`${sectionName} 데이터가 서버와 동일합니다 (타임스탬프: ${sectionTimestamp}), 로컬 데이터 사용`);
      const storedSection = localStorage.getItem(`section_${sectionName}`);
      if (storedSection) {
        // 재시도 카운터 초기화 (성공)
        firebaseRequestManager.resetRetryCount(sectionName);
        return JSON.parse(storedSection);
      }
    }
    
    // 해당 섹션의 items 컬렉션 참조 (15초 타임아웃 적용)
    const itemsCollectionRef = collection(firebasedb, "sections", sectionName, "items");
    const itemsQuery = query(itemsCollectionRef, orderBy("id"));
    const querySnapshot = await fetchWithTimeout(() => getDocs(itemsQuery), 15000);
    
    if (!querySnapshot.empty) {
      // 문서들의 데이터만 추출하여 배열로 변환
      const items = querySnapshot.docs.map(doc => doc.data());
      console.log(`Firebase에서 ${sectionName} 데이터 가져옴: ${items.length}개 상점`);
      
      // 로컬 저장소에 원본 데이터 저장 (섹션 타임스탬프 포함)
      _saveToLocalStorage(sectionName, items, sectionTimestamp);
      
      // 재시도 카운터 초기화 (성공)
      firebaseRequestManager.resetRetryCount(sectionName);
      
      return items;
    } else {
      console.log(`Firebase에 ${sectionName} 데이터가 없음`);
      
      // 재시도 카운터 초기화 (빈 데이터지만 정상적인 응답으로 처리)
      firebaseRequestManager.resetRetryCount(sectionName);
      
      return [];
    }
  } catch (error) {
    console.error(`Firebase 데이터 가져오기 오류 (시도 ${attemptCount + 1}/${firebaseRequestManager.MAX_RETRY_COUNT}):`, error);
    
    // 재시도 가능 여부 확인
    if (firebaseRequestManager.canRetry(sectionName)) {
      console.log(`${sectionName} 데이터 재시도 중... (${firebaseRequestManager.retryCount[sectionName]}/${firebaseRequestManager.MAX_RETRY_COUNT})`);
      await delay(firebaseRequestManager.REQUEST_INTERVAL_MS);
      return _fetchFromFirebase(sectionName, firebaseRequestManager.retryCount[sectionName]);
    }
    
    throw error; // 최대 재시도 횟수 초과시 오류 전파
  }
};

/**
 * Firebase 실시간 리스너 설정 함수
 * 특정 섹션의 데이터 변경을 실시간으로 감지하여 콜백 함수 호출
 * @param {string} sectionName - 리스닝할 섹션 이름
 * @param {Function} callback - 데이터 변경 시 호출할 콜백 함수
 * @returns {Function} 리스너 해제 함수
 */
export const setupFirebaseListener = (sectionName, callback) => {
  if (!sectionName || typeof callback !== 'function') {
    console.error('잘못된 파라미터로 Firebase 리스너 설정 시도');
    return () => {}; // 더미 해제 함수 반환
  }

  try {
    // 기존에 해당 섹션에 대한 리스너가 있으면 정리
    if (realtimeListeners[sectionName]) {
      realtimeListeners[sectionName]();
      delete realtimeListeners[sectionName];
    }
    
    // 해당 섹션의 items 컬렉션 참조 // TODO 이루 FB sections의 문서마다 컬렉션을 category마다 추가할 예정임
    const itemsCollectionRef = collection(firebasedb, "sections", sectionName, "items");
    const itemsQuery = query(itemsCollectionRef, orderBy("id"));
    
    // 실시간 리스너 설정onShapShot
    const unsubscribe = onSnapshot(itemsQuery, (querySnapshot) => { //여기가 callback 함수 설정부분
      try {
        // 변경 사항 추적
        const changes = [];
        querySnapshot.docChanges().forEach((change) => {
          changes.push({
            type: change.type, // 'added', 'modified', 'removed'
            id: change.doc.id,
            data: change.doc.data()
          });
        });
        
        //전체 데이터 가져오기 //TODO 이후 'added', 'modified', 'removed'에따른 분기처리 필요
        const allitems = querySnapshot.docs.map(doc => doc.data());
        
        // 콜백 호출 - 전체 데이터와 변경 사항 전달
        callback(allitems, changes);
        
        // 로컬 스토리지 업데이트
        _saveToLocalStorage(sectionName, allitems);
        
        console.log(`Firebase 실시간 업데이트: ${sectionName} (${changes.length}개 변경사항)`);
      } catch (error) {
        console.error('Firebase 리스너 콜백 처리 중 오류:', error);
      }
    }, (error) => {
      console.error(`Firebase 리스너 오류 (${sectionName}):`, error);
    });
    
    // 리스너 해제 함수 저장
    realtimeListeners[sectionName] = unsubscribe;
    
    return unsubscribe;
  } catch (error) {
    console.error(`Firebase 리스너 설정 중 오류 (${sectionName}):`, error);
    return () => {}; // 더미 해제 함수 반환
  }
};

/**
 * 섹션 데이터를 가져오는 통합 함수 (로컬 스토리지 -> 서버 순으로 시도)
 * @param {string} sectionName - 가져올 섹션 이름
 * @returns {Promise<Array>} - 서버 형식의 아이템 리스트 (protoServerDataset 형태)
 */
export const getSectionData = async (sectionName) => {
  try {
    // 1. 로컬 스토리지에서 먼저 시도
    const storedSection = localStorage.getItem(`section_${sectionName}`);
    
    // 로컬 스토리지에 데이터가 있는 경우 JSON으로 파싱하여 사용
    if (storedSection && storedSection.length > 0) {
      const parsedSection = JSON.parse(storedSection);
      console.log(`로컬 스토리지에서 ${sectionName} 데이터 로드 성공 (${parsedSection.length}개 항목)`);
      return parsedSection;
    }
    
    // 2. 로컬 스토리지에 없으면 서버에서 가져오기 시도 (단일 요청)
    console.log(`로컬 스토리지에 ${sectionName} 데이터가 없어 서버에서 로드 시도`);
    
    try {
      // 단일 요청으로 데이터 가져오기 (타임아웃 적용)
      return await fetchWithTimeout(() => _fetchFromFirebase(sectionName), 20000);
    } catch (fetchError) {
      console.error(`${sectionName} 서버 데이터 가져오기 실패:`, fetchError);
      
      // 사용자에게 명확한 피드백 (실제 알림 구현은 애플리케이션에 맞게 조정)
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('데이터를 가져올 수 없습니다. 네트워크 연결을 확인하세요.');
      }
      
      return [];
    }
  } catch (error) {
    console.error(`${sectionName} 데이터 가져오기 오류:`, error);
    return [];
  }
};

/**
 * Firebase 무료 제공 한도와 비용 정보 (2023년 11월 기준)
 * 
 * 1. 무료 제공 한도:
 *    - 일일 읽기 작업: 50,000회
 *    - 일일 쓰기 작업: 20,000회
 *    - 일일 삭제 작업: 20,000회
 *    - 저장 용량: 1GB
 *    - 데이터 다운로드: 10GB/월
 * 
 * 2. 타임스탬프 비교와 비용:
 *    - 문서 전체를 읽는 대신 타임스탬프만 확인하는 작업도 1회의 읽기 작업으로 계산됩니다.
 *    - 하지만 타임스탬프 문서는 일반적으로 크기가 작아 데이터 전송량은 적습니다.
 *    - 타임스탬프 비교 자체는 클라이언트에서 수행되므로 추가 비용이 발생하지 않습니다.
 * 
 * 3. 초과 비용 (미국 멀티 리전 기준):
 *    - 읽기 작업: 100,000회당 $0.06
 *    - 쓰기 작업: 100,000회당 $0.18
 *    - 삭제 작업: 100,000회당 $0.02
 *    - 저장 용량: 1GB당 $0.18/월
 *    - 데이터 다운로드: 1GB당 $0.12
 * 
 * 4. 비용 최적화 전략:
 *    - 클라이언트 캐싱 사용 (로컬 스토리지)
 *    - 타임스탬프 비교로 불필요한 데이터 로드 방지
 *    - 실시간 업데이트 대신 주기적 폴링 사용 (필요한 경우)
 *    - 쿼리 최적화: 필요한 필드만 선택하여 가져오기
 * 
 * 참고: 정확한 최신 요금은 Firebase 공식 가격 페이지에서 확인하세요.
 * https://firebase.google.com/pricing
 */