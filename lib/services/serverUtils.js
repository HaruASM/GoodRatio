import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp, onSnapshot, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset } from '../models/editorModels';

// 현재 활성화된 실시간 리스너를 관리할 객체
const realtimeListeners = {};

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

// TODO: 지수 백오프 재시도 기능 구현
// 다음 단계에서는 아래와 같은 지수 백오프 재시도 로직을 구현할 예정
// 1. 요청 실패 시 점진적으로 대기 시간을 늘리며 재시도
// 2. 사용자에게 재시도 중임을 알리는 모달 표시
// 3. 최대 재시도 횟수 초과 시 적절한 오류 메시지 표시

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
const _fetchFromFirebase = async (sectionName) => {
  try {
    console.log(`Firebase에서 ${sectionName} 데이터 로드 시도`);
    
    // 섹션 문서 먼저 조회해서 타임스탬프 확인 (5초 타임아웃 적용)
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
    
    // 해당 섹션의 shops 컬렉션 참조 (15초 타임아웃 적용)
    const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
    const shopsQuery = query(shopsCollectionRef, orderBy("id"));
    const querySnapshot = await fetchWithTimeout(() => getDocs(shopsQuery), 15000);
    
    if (!querySnapshot.empty) {
      // 문서들의 데이터만 추출하여 배열로 변환
      const shops = querySnapshot.docs.map(doc => doc.data());
      console.log(`Firebase에서 ${sectionName} 데이터 가져옴: ${shops.length}개 상점`);
      
      // 로컬 저장소에 원본 데이터 저장 (섹션 타임스탬프 포함)
      _saveToLocalStorage(sectionName, shops, sectionTimestamp);
      
      return shops;
    } else {
      console.log(`Firebase에 ${sectionName} 데이터가 없음`);
      return [];
    }
  } catch (error) {
    console.error('Firebase 데이터 가져오기 오류:', error);
    throw error; // 상위 함수에서 처리하도록 오류 전파
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
    
    // 해당 섹션의 shops 컬렉션 참조 // TODO 이루 FB sections의 문서마다 컬렉션을 category마다 추가할 예정임
    const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
    const shopsQuery = query(shopsCollectionRef, orderBy("id"));
    
    // 실시간 리스너 설정onShapShot
    const unsubscribe = onSnapshot(shopsQuery, (querySnapshot) => { //여기가 callback 함수
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
        const allShops = querySnapshot.docs.map(doc => doc.data());
        
        // 콜백 호출 - 전체 데이터와 변경 사항 전달
        callback(allShops, changes);
        
        // 로컬 스토리지 업데이트
        _saveToLocalStorage(sectionName, allShops);
        
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
    if (storedSection) {
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