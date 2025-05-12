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

// 내부 함수: 로컬 스토리지에 섹션 데이터 저장 (counterUpdated 저장 기능으로 변경)
const _saveToLocalStorage = (sectionName, sectionData, counterUpdated = null, collectionsData = null) => {
  try {
    // 데이터를 JSON으로 직렬화하여 저장
    localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
    
    // counterUpdated 저장 (서버에서 받은 카운터 또는 기본값 0)
    const counter = counterUpdated !== null ? counterUpdated : 0;
    localStorage.setItem(`${sectionName}_counter`, counter.toString());
    
    // 컬렉션 정보 저장 - Map 구조로 저장
    if (collectionsData) {
      localStorage.setItem(`${sectionName}_collections`, JSON.stringify(collectionsData));
    }
    
    console.log(`로컬 스토리지에 ${sectionName} 데이터 저장 완료 (${sectionData.length}개 항목), 카운터: ${counter}`);
  } catch (error) {
    console.error('localStorage 저장 오류:', error);
  }
};

// 내부 함수: Firebase에서 섹션 데이터 가져오기 (counterUpdated 처리로 변경) 
// 현재 이 함수 사용하지 않음. - onSnapshot 이벤트 리스너 동작으로 변경
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
    
    // 섹션 문서 먼저 조회해서 counterUpdated 확인 (5초 타임아웃 적용)
    const sectionRef = doc(firebasedb, "sections", sectionName);
    const sectionSnap = await fetchWithTimeout(() => getDoc(sectionRef), 5000);
    let serverCounter = null;
    
    if (sectionSnap.exists()) {
      const sectionData = sectionSnap.data();
      if (sectionData.counterUpdated !== undefined) {
        // counterUpdated 값을 가져옴
        serverCounter = sectionData.counterUpdated;
      }
    }
    
    // 로컬 스토리지에 저장된 카운터 확인
    const localCounter = localStorage.getItem(`${sectionName}_counter`);
    
    // 카운터가 동일하면 서버 데이터가 변경되지 않았으므로 로컬 데이터 사용
    if (serverCounter !== null && localCounter && parseInt(localCounter) === serverCounter) {
      console.log(`${sectionName} 데이터가 서버와 동일합니다 (카운터: ${serverCounter}), 로컬 데이터 사용`);
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
      
      // 로컬 저장소에 원본 데이터 저장 (섹션 카운터 포함)
      _saveToLocalStorage(sectionName, items, serverCounter);
      
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
 * 특정 섹션의 특정 컬렉션 데이터 가져오기
 * @param {string} sectionName - 섹션 이름
 * @param {string} collectionName - 컬렉션 이름 (예: 'items', 'summaries')
 * @returns {Promise<Array>} - 컬렉션 데이터 배열
 */
export const getSectionCollectionData = async (sectionName, collectionName) => {
  try {
    console.log(`Firebase에서 ${sectionName}/${collectionName} 컬렉션 데이터 로드 시도`);
    
    // 컬렉션 참조 생성
    const collectionRef = collection(firebasedb, "sections", sectionName, collectionName);
    const collectionQuery = query(collectionRef, orderBy("id"));
    
    // 데이터 가져오기
    const querySnapshot = await fetchWithTimeout(() => getDocs(collectionQuery), 15000);
    
    if (!querySnapshot.empty) {
      // 문서들의 데이터만 추출하여 배열로 변환
      const items = querySnapshot.docs.map(doc => doc.data());
      console.log(`Firebase에서 ${sectionName}/${collectionName} 데이터 가져옴: ${items.length}개 항목`);
      return items;
    } else {
      console.log(`Firebase에 ${sectionName}/${collectionName} 데이터가 없음`);
      return [];
    }
  } catch (error) {
    console.error(`${sectionName}/${collectionName} 데이터 가져오기 오류:`, error);
    return [];
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
    
    // 섹션 문서 참조 (섹션 문서 자체를 감시)
    const sectionRef = doc(firebasedb, "sections", sectionName);
    
    // 실시간 리스너 설정
    const unsubscribe = onSnapshot(sectionRef, async (docSnapshot) => {
      try {
        if (!docSnapshot.exists()) {
          console.warn(`섹션 문서 없음: ${sectionName}`);
          return;
        }
        
        const sectionData = docSnapshot.data();
        const serverCounter = sectionData.counterUpdated;
        // Map 구조로 가져오기 (빈 객체를 기본값으로 설정)
        const serverCounterCollections = sectionData.counterCollections || {};
        
        // 로컬 스토리지의 카운터와 비교
        const localCounter = localStorage.getItem(`${sectionName}_counter`);
        const localCounterValue = localCounter ? parseInt(localCounter) : -1;
        
        // 로컬 스토리지에서 컬렉션 정보 가져오기 (Map 구조로)
        let localCollections = {};
        try {
          const savedCollections = localStorage.getItem(`${sectionName}_collections`);
          if (savedCollections) {
            localCollections = JSON.parse(savedCollections);
          }
        } catch (e) {
          console.error('[sectionsDBManagerOfEditorOfEditor] 로컬 컬렉션 정보 파싱 오류:', e);
          localCollections = {};
        }
        
        // 서버 카운터가 더 크면 데이터 업데이트 필요
        if (serverCounter > localCounterValue) {
          console.log(`${sectionName} 섹션 업데이트 감지 (카운터: ${localCounterValue} -> ${serverCounter})`);
          
          // items 컬렉션 데이터 가져오기
          const itemsCollectionRef = collection(firebasedb, "sections", sectionName, "items");
          const itemsQuery = query(itemsCollectionRef, orderBy("id"));
          const querySnapshot = await getDocs(itemsQuery);
          
          // 문서들의 데이터만 추출하여 배열로 변환
          const allItems = querySnapshot.docs.map(doc => doc.data());
          
          // 섹션 문서 정보도 포함하여 콜백 호출
          callback({
            items: allItems,
            sectionDoc: sectionData  // 섹션 문서 정보 전달
          }, []);
          
          // 로컬 스토리지 업데이트 (컬렉션 정보 포함) //TODO 켈렉션 items, summaries를 동일하게 처리중. summaries 문서 추가시 동작 분기 필요
          _saveToLocalStorage(sectionName, allItems, serverCounter, serverCounterCollections);
          
          console.log(`Firebase 실시간 업데이트: ${sectionName} (카운터: ${serverCounter})`);
        } else {
          console.log(`${sectionName} 섹션 업데이트 불필요 (로컬: ${localCounterValue}, 서버: ${serverCounter})`);
        }
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
    
    // 2. 로컬 스토리지에 없으면 빈 배열 반환
    // onSnapshot 리스너가 설정되면 자동으로 데이터를 로드할 것입니다.
    console.log(`로컬 스토리지에 ${sectionName} 데이터가 없습니다. onSnapshot 리스너가 설정되면 자동으로 데이터를 로드합니다.`);
    return [];
  } catch (error) {
    console.error(`${sectionName} 데이터 가져오기 오류:`, error);
    return [];
  }
};
