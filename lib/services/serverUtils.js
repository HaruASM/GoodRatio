import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp, onSnapshot, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset } from '../models/editorModels';

// 현재 활성화된 실시간 리스너를 관리할 객체
const realtimeListeners = {};

// 내부 함수: 로컬 스토리지에 섹션 데이터 저장 (타임스탬프 저장 기능 추가)
const _saveToLocalStorage = (sectionName, sectionData, serverTimestamp = null) => {
  try {
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
    
    // 섹션 문서 먼저 조회해서 타임스탬프 확인
    const sectionRef = doc(firebasedb, "sections", sectionName);
    const sectionSnap = await getDoc(sectionRef);
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
    
    // 해당 섹션의 shops 컬렉션 참조
    const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
    const shopsQuery = query(shopsCollectionRef, orderBy("id"));
    const querySnapshot = await getDocs(shopsQuery);
    
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
    return [];
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
    
    // 로컬 스토리지에 데이터가 있는 경우
    if (storedSection) {
      const parsedSection = JSON.parse(storedSection);
      console.log(`로컬 스토리지에서 ${sectionName} 데이터 로드 성공 (${parsedSection.length}개 항목)`);
      return parsedSection;
    }
    
    // 2. 로컬 스토리지에 없으면 서버에서 가져오기 시도
    console.log(`로컬 스토리지에 ${sectionName} 데이터가 없어 서버에서 로드 시도`);
    
    try {
      // 서버에서 데이터 가져오기
      const serverData = await _fetchFromFirebase(sectionName);
      return serverData;
    } catch (fetchError) {
      console.error(`${sectionName} 서버 데이터 가져오기 실패:`, fetchError);
      return [];
    }
  } catch (error) {
    console.error(`${sectionName} 데이터 가져오기 오류:`, error);
    return [];
  }
};

/**
 * Firebase 실시간 리스너 설정 (타임스탬프 기준 쿼리 적용)
 * @param {string} sectionName - 구독할 섹션 이름
 * @param {Function} callback - 데이터 변경 시 호출될 콜백
 * @returns {Function} 리스너 해제 함수
 */
export const setupFirebaseListener = (sectionName, callback) => {
  // 이미 같은 섹션에 대한 리스너가 있으면 제거
  if (realtimeListeners[sectionName]) {
    console.log(`기존 ${sectionName} 리스너 제거`);
    realtimeListeners[sectionName]();
    delete realtimeListeners[sectionName];
  }
  
  console.log(`${sectionName} 실시간 리스너 설정`);
  
  // 섹션 문서에 대한 리스너 설정
  const sectionRef = doc(firebasedb, "sections", sectionName);
  const unsubscribe = onSnapshot(sectionRef, async (sectionSnapshot) => {
    if (sectionSnapshot.exists()) {
      const sectionData = sectionSnapshot.data();
      
      // 섹션 타임스탬프 확인
      if (sectionData.lastUpdated) {
        // 타임스탬프를 밀리초로 변환
        const serverTimestamp = sectionData.lastUpdated.toMillis ? 
          sectionData.lastUpdated.toMillis().toString() : 
          sectionData.lastUpdated.toString();
        
        console.log(`${sectionName} 섹션 변경 감지, 타임스탬프: ${serverTimestamp}`);
        
        // shops 컬렉션의 모든 데이터 가져오기
        const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
        const querySnapshot = await getDocs(query(shopsCollectionRef));
        
        if (!querySnapshot.empty) {
          const allItems = querySnapshot.docs.map(doc => doc.data());
          
          // 변경 정보 생성 (전체 새로고침으로 간주)
          const changes = [{
            type: 'refresh',
            count: allItems.length
          }];
          
          // 로컬 스토리지 업데이트 (섹션 타임스탬프 포함)
          _saveToLocalStorage(sectionName, allItems, serverTimestamp);
          
          // 콜백 실행
          callback(allItems, changes);
        }
      }
    }
  });
  
  // 리스너 저장 및 해제 함수 반환
  realtimeListeners[sectionName] = unsubscribe;
  return unsubscribe;
}; 