import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp, onSnapshot, collection } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset, protoShopDataSet } from './dataModels';

// 현재 활성화된 실시간 리스너 관리
let currentListener = null;
let currentSectionName = null;

// 내부 함수: 로컬 스토리지에 섹션 데이터 저장
const _saveToLocalStorage = (sectionName, sectionData) => {
  try {
    // 데이터가 이미 서버 형식이면 그대로 저장
    localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
    localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
    console.log(`로컬 스토리지에 ${sectionName} 데이터 저장 완료 (${sectionData.length}개 항목)`);
  } catch (error) {
    console.error('localStorage 저장 오류:', error);
  }
};

// 내부 함수: Firebase에서 섹션 데이터 가져오기
const _fetchFromFirebase = async (sectionName) => {
  try {
    console.log(`Firebase에서 ${sectionName} 데이터 로드 시도`);
    
    // 현재 섹션 문서 참조
    const sectionRef = doc(firebasedb, "sections", sectionName);
    const docSnap = await getDoc(sectionRef);
    
    if (docSnap.exists()) {
      const serverData = docSnap.data();
      console.log(`Firebase에서 ${sectionName} 데이터 가져옴:`, serverData);
      
      // 아이템 리스트 처리
      const itemList = serverData.itemList || [];
      
      // 로컬 저장소에 원본 데이터 저장
      _saveToLocalStorage(sectionName, itemList);
      
      // 타임스탬프 저장
      if (serverData.lastUpdated) {
        localStorage.setItem(`${sectionName}_timestamp`, serverData.lastUpdated.toMillis().toString());
      } else {
        localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
      }
      
      return itemList;
    } else {
      console.log(`Firebase에 ${sectionName} 데이터가 없음`);
      return [];
    }
  } catch (error) {
    console.error('Firebase 데이터 가져오기 오류:', error);
    return [];
  }
};

// 내부 함수: 실시간 리스너 설정 및 관리
const _setupRealtimeSync = (sectionName) => {
  // 이미 같은 섹션에 리스너가 있으면 재사용
  if (currentSectionName === sectionName && currentListener) {
    console.log(`이미 ${sectionName}에 대한 실시간 리스너가 활성화되어 있음`);
    return;
  }
  
  // 다른 섹션의 리스너가 있으면 정리
  if (currentListener) {
    console.log(`${currentSectionName}의 이전 리스너 정리`);
    currentListener();
    currentListener = null;
    currentSectionName = null;
  }
  
  // 새 리스너 설정
  console.log(`${sectionName}에 대한 실시간 리스너 설정`);
  const sectionRef = doc(firebasedb, "sections", sectionName);
  
  currentListener = onSnapshot(sectionRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const serverData = docSnapshot.data();
      const newItemList = serverData.itemList || [];
      
      // 타임스탬프 또는 데이터 비교로 변경 감지
      const localDataStr = localStorage.getItem(`section_${sectionName}`);
      if (localDataStr) {
        const serverTimestamp = serverData.lastUpdated?.toMillis() || 0;
        const localTimestamp = parseInt(localStorage.getItem(`${sectionName}_timestamp`) || '0');
        
        // 서버 데이터가 더 최신이 아니면 업데이트 스킵
        if (serverTimestamp <= localTimestamp) {
          console.log(`${sectionName} 데이터 변경 없음, 업데이트 스킵`);
          return;
        }
      }
      
      // 변경된 경우만 실행됨
      console.log(`실시간 업데이트: ${sectionName} 데이터 변경 감지`);
      _saveToLocalStorage(sectionName, newItemList);
      
      // 업데이트 이벤트 발생
      document.dispatchEvent(new CustomEvent('section-updated', {
        detail: { sectionName, itemList: newItemList }
      }));
    }
  }, (error) => {
    console.error(`${sectionName} 실시간 동기화 오류:`, error);
  });
  
  currentSectionName = sectionName;
};

/**
 * 섹션 데이터를 가져오는 통합 함수 (로컬 스토리지 -> 서버 순으로 시도)
 * @param {string} sectionName - 가져올 섹션 이름
 * @returns {Promise<Array>} - 서버 형식의 아이템 리스트 (protoServerDataset 형태)
 */
export const getSectionData = async (sectionName) => {
  try {
    console.log(`getSectionData: ${sectionName} 데이터 로드 시도`);
    
    // 실시간 동기화 설정 (한 번에 한 섹션만)
    _setupRealtimeSync(sectionName);
    
    // 1. 로컬 스토리지에서 먼저 시도
    const storedSection = localStorage.getItem(`section_${sectionName}`);
    
    if (storedSection) {
      const parsedSection = JSON.parse(storedSection);
      console.log(`로컬 스토리지에서 ${sectionName} 데이터 로드 성공 (${parsedSection.length}개 항목)`);
      
      // 로컬 스토리지에서 가져온 데이터 반환 (이미 protoServerDataset 형태)
      return parsedSection;
    }
    
    // 2. 로컬 스토리지에 없으면 서버에서 가져오기
    console.log(`로컬 스토리지에 ${sectionName} 데이터가 없어 서버에서 로드 시도`);
    return await _fetchFromFirebase(sectionName);
  } catch (error) {
    console.error(`${sectionName} 데이터 가져오기 오류:`, error);
    // 오류 발생 시 빈 배열 반환
    return [];
  }
};

/**
 * 섹션 실시간 업데이트 이벤트 리스너 등록
 * @param {string} sectionName - 모니터링할 섹션 이름
 * @param {Function} callback - 업데이트 발생 시 호출할 콜백 함수
 * @returns {Function} - 리스너 제거 함수
 */
export const onSectionUpdate = (sectionName, callback) => {
  const handler = (event) => {
    if (event.detail.sectionName === sectionName) {
      callback(event.detail.itemList);
    }
  };
  
  document.addEventListener('section-updated', handler);
  
  // 리스너 제거 함수 반환
  return () => {
    document.removeEventListener('section-updated', handler);
  };
}; 