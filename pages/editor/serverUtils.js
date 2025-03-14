import { doc, getDoc, setDoc, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { protoServerDataset, protoShopDataSet } from './dataModels';

/**
 * Firebase에서 섹션 데이터 가져오기 함수
 * @param {string} sectionName - 가져올 섹션 이름
 * @param {function} updateCallback - 데이터 업데이트 콜백 함수 (선택적) 서버->로컬스토리지만 
 * @returns {Promise<Array>} - 변환된 아이템 리스트
 */
export const fetchSectionsFromFirebase = async (sectionName, updateCallback = null) => {
  try {
    // 로그 출력은 index.js에서 처리
    
    // 현재 섹션 문서 참조
    const sectionRef = doc(firebasedb, "sections", sectionName);
    const docSnap = await getDoc(sectionRef);
    
    if (docSnap.exists()) {
      const serverData = docSnap.data();
      console.log(`Firebase에서 ${sectionName} 데이터 가져옴:`, serverData);
      
      // 아이템 리스트 처리
      const itemList = serverData.itemList || [];
      
      // 서버 데이터를 올바른 구조로 변환
      const transformedItemList = itemList.map(item => {
        return {
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset, ...item },
          distance: item.distance || "",
          itemMarker: null,
          itemPolygon: null
        };
      });
      
      // 콜백이 제공된 경우 실행
      if (updateCallback) {
        updateCallback(sectionName, transformedItemList);
      }
      
      // 로컬 저장소에 저장
      saveToLocalStorage(sectionName, transformedItemList);
      
      // 타임스탬프 저장
      if (serverData.lastUpdated) {
        localStorage.setItem(`${sectionName}_timestamp`, serverData.lastUpdated.toMillis().toString());
      } else {
        localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
      }
      
      return transformedItemList;
    } else {
      console.log(`Firebase에 ${sectionName} 데이터가 없음`);
      // 데이터가 없으면 빈 배열 반환
      if (updateCallback) {
        updateCallback(sectionName, []);
      }
      return [];
    }
  } catch (error) {
    console.error('Firebase 데이터 가져오기 오류:', error);
    // 오류 발생 시 빈 배열 반환
    if (updateCallback) {
      updateCallback(sectionName, []);
    }
    return [];
  }
};

/**
 * 로컬 스토리지에 섹션 데이터 저장
 * @param {string|Map} sectionNameOrMap - 저장할 섹션 이름 또는 전체 sectionsDB Map
 * @param {Array} [sectionData] - 저장할 섹션 데이터 (sectionNameOrMap이 문자열인 경우)
 */
export const saveToLocalStorage = (sectionNameOrMap, sectionData = null) => {
  try {
    // 전체 sectionsDB 저장 (Map 객체가 전달된 경우)
    if (sectionNameOrMap instanceof Map) {
      // Google Maps 객체 제거 등 직렬화 가능한 형태로 변환
      const cleanSectionsDB = Array.from(sectionNameOrMap.entries()).map(([key, value]) => ({
        name: key,
        list: value.map(item => {
          // serverDataset 속성만 추출하여 사용
          const serverData = { ...item.serverDataset };
          
          // distance 속성은 serverDataset 외부에 있으므로 추가
          if (item.distance) {
            serverData.distance = item.distance;
          }
          
          return serverData;
        })
      }));
      
      localStorage.setItem('sectionsDB', JSON.stringify(cleanSectionsDB));
    }
    // 특정 섹션만 저장 (섹션 이름과 데이터가 전달된 경우)
    else if (typeof sectionNameOrMap === 'string' && sectionData) {
      const sectionName = sectionNameOrMap;
      
      // Google Maps 객체 제거 등 직렬화 가능한 형태로 변환
      const cleanSectionData = sectionData.map(item => {
        // serverDataset 속성만 추출하여 사용
        const serverData = { ...item.serverDataset };
        
        // distance 속성은 serverDataset 외부에 있으므로 추가
        if (item.distance) {
          serverData.distance = item.distance;
        }
        
        return serverData;
      });
      
      localStorage.setItem(`section_${sectionName}`, JSON.stringify(cleanSectionData));
      localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
    } else {
      console.error('잘못된 형식의 데이터:', sectionNameOrMap);
    }
  } catch (error) {
    console.error('localStorage 저장 오류:', error);
  }
};

/**
 * 로컬 스토리지에서 섹션 데이터 로드
 * @param {string} sectionName - 로드할 섹션 이름
 * @returns {Array|null} - 로드된 섹션 데이터 또는 null
 */
export const loadFromLocalStorage = (sectionName) => {
  try {
    // 로그 출력 제거 (index.js에서 이미 출력)
    const storedSection = localStorage.getItem(`section_${sectionName}`);
    
    if (storedSection) {
      const parsedSection = JSON.parse(storedSection);
      
      // 아이템을 올바른 구조로 변환
      return parsedSection.map(item => {
        return {
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset, ...(item.serverDataset || item) },
          distance: item.distance || "",
          itemMarker: null,
          itemPolygon: null
        };
      });
    }
    
    return null;
  } catch (error) {
    console.error('localStorage 로드 오류:', error);
    return null;
  }
};

/**
 * Firebase와 데이터 동기화 함수 (구현 안 함)
 * @param {string} sectionName - 동기화할 섹션 이름
 * @param {Array} itemList - 동기화할 아이템 리스트
 * @returns {Promise<Array>} - 원본 아이템 리스트
 */
export const syncWithFirestore = async (sectionName, itemList) => {
  // 서버로 데이터를 보내는 기능은 삭제하고 로그만 출력
  console.log(`[미구현] ${sectionName} 데이터를 Firebase와 동기화 시도`);
  return itemList; // 원본 데이터 그대로 반환
};

/**
 * 서버 DB에 데이터 업데이트 (구현 안 함)
 * @param {string} sectionName - 업데이트할 섹션 이름
 * @param {Array} localItemList - 업데이트할 아이템 리스트
 */
export const updateServerDB = (sectionName, localItemList) => {
  // 서버로 데이터를 보내는 기능은 삭제하고 로그만 출력
  console.log(`[미구현] ${sectionName} 데이터를 서버 DB에 업데이트`);
}; 