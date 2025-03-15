import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset, protoShopDataSet } from './dataModels';

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

/**
 * 섹션 데이터를 가져오는 통합 함수 (로컬 스토리지 -> 서버 순으로 시도)
 * @param {string} sectionName - 가져올 섹션 이름
 * @returns {Promise<Array>} - 서버 형식의 아이템 리스트 (protoServerDataset 형태)
 */
export const getSectionData = async (sectionName) => {
  try {
    console.log(`getSectionData: ${sectionName} 데이터 로드 시도`);
    
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