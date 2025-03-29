import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp, onSnapshot, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset } from './dataModels';

// 현재 활성화된 실시간 리스너를 관리할 객체
const realtimeListeners = {};

// 내부 함수: 로컬 스토리지에 섹션 데이터 저장
const _saveToLocalStorage = (sectionName, sectionData) => {
  try {
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
    
    // 해당 섹션의 shops 컬렉션 참조
    const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
    const shopsQuery = query(shopsCollectionRef, orderBy("id"));
    const querySnapshot = await getDocs(shopsQuery);
    
    if (!querySnapshot.empty) {
      // 문서들의 데이터만 추출하여 배열로 변환
      const shops = querySnapshot.docs.map(doc => doc.data());
      console.log(`Firebase에서 ${sectionName} 데이터 가져옴: ${shops.length}개 상점`);
      
      // 로컬 저장소에 원본 데이터 저장
      _saveToLocalStorage(sectionName, shops);
      
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
 * Firebase 실시간 리스너 설정
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
  
  // shops 컬렉션 참조
  const shopsCollectionRef = collection(firebasedb, "sections", sectionName, "shops");
  
  // 리스너 설정
  const unsubscribe = onSnapshot(
    shopsCollectionRef,
    (querySnapshot) => {
      // 변경된 문서만 추적
      const changes = [];
      querySnapshot.docChanges().forEach((change) => {
        changes.push({
          type: change.type, // 'added', 'modified', 'removed'
          id: change.doc.id,
          data: change.doc.data()
        });
      });
      
      // 변경사항이 있을 경우에만 콜백 호출
      if (changes.length > 0) {
        console.log(`Firebase 변경 감지: ${sectionName} 섹션, ${changes.length}개 변경사항`);
        changes.forEach(change => {
          console.log(`- ${change.type}: ${change.id} (${change.data.storeName || 'noname'})`);
        });
        
        // 전체 데이터를 콜백으로 전달
        const allItems = querySnapshot.docs.map(doc => doc.data());
        
        // 로컬 스토리지 업데이트
        _saveToLocalStorage(sectionName, allItems);
        
        // 콜백 실행
        callback(allItems, changes);
      }
    },
    (error) => {
      console.error(`${sectionName} 실시간 리스너 오류:`, error);
    }
  );
  
  // 리스너 저장 및 해제 함수 반환
  realtimeListeners[sectionName] = unsubscribe;
  return unsubscribe;
}; 