import { protoServerDataset } from '../../dataModels';

/**
 * 값 비교를 위한 유틸리티 함수 - 기본 타입과 배열, 객체 등을 안전하게 비교
 * @param {any} val1 - 비교할 첫 번째 값
 * @param {any} val2 - 비교할 두 번째 값
 * @returns {boolean} 두 값이 같으면 true, 다르면 false
 */
const isEqual = (val1, val2) => {
  // 값이 같으면 (기본 비교)
  if (val1 === val2) return true;
  
  // null/undefined 비교
  if (val1 == null && val2 == null) return true;
  if (val1 == null || val2 == null) return false;
  
  // 타입이 다르면 false
  if (typeof val1 !== typeof val2) return false;
  
  // 배열 비교
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    
    // 빈 배열 또는 [""] 형태 특수 처리
    if (val1.length === 0 && val2.length === 0) return true;
    if (val1.length === 1 && val2.length === 1 && 
        (val1[0] === "" && val2[0] === "")) return true;
    
    // 배열 내용 비교
    for (let i = 0; i < val1.length; i++) {
      if (!isEqual(val1[i], val2[i])) return false;
    }
    return true;
  }
  
  // 객체 비교 (날짜, 정규식 등 특수 객체는 제외)
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    const keys1 = Object.keys(val1);
    const keys2 = Object.keys(val2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!isEqual(val1[key], val2[key])) return false;
    }
    return true;
  }
  
  // 숫자 비교 (NaN 처리)
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    // NaN === NaN은 false이므로 명시적 처리
    if (Number.isNaN(val1) && Number.isNaN(val2)) return true;
  }
  
  // 문자열 비교 (빈 문자열과 공백만 있는 문자열 처리)
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    const trimmed1 = val1.trim();
    const trimmed2 = val2.trim();
    if (trimmed1 === "" && trimmed2 === "") return true;
  }
  
  return false;
};

/**
 * 상점 데이터 비교 함수
 * 원본 데이터와 편집된 데이터를 비교하여 변경 사항이 있는지 확인
 * 
 * @param {Object} original - 원본 상점 데이터
 * @param {Object} edited - 편집된 상점 데이터
 * @returns {boolean} 변경 사항 존재 여부
 */
export const compareShopData = (original, edited) => {
  // null 또는 undefined 체크를 명확히 함
  if (!original || !edited) {
    console.log('compareShopData: 원본 또는 편집 데이터가 없음', { original, edited });
    return false;
  }
  
  // 변경사항 존재 여부
  let hasChanges = false;
  
  // serverDataset이 있는 경우
  if (original.serverDataset && edited.serverDataset) {
    const originalData = original.serverDataset;
    const editedData = edited.serverDataset;
    
    // 로깅 추가
    if (process.env.NODE_ENV !== 'production') {
      console.log('compareShopData: serverDataset 비교 시작');
    }
    
    // 모든 필드 비교
    for (const key in editedData) {
      // 특수 필드 무시 (itemMarker, itemPolygon 등)
      if (key === 'itemMarker' || key === 'itemPolygon') continue;
      
      // 일반 값 비교 - 개선된 isEqual 함수 사용
      if (!isEqual(editedData[key], originalData[key])) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`필드 ${key}: 값 다름`);
          console.log('  원본:', originalData[key]);
          console.log('  편집:', editedData[key]);
        }
        hasChanges = true;
        break; // 하나라도 변경사항이 있으면 즉시 종료
      }
    }
    
    if (!hasChanges && process.env.NODE_ENV !== 'production') {
      console.log('compareShopData: 변경사항 없음');
    }
    return hasChanges;
  }
  
  // serverDataset이 없는 경우 직접 비교
  for (const key in edited) {
    // 특수 필드 무시
    if (key === 'itemMarker' || key === 'itemPolygon') continue;
    
    // 일반 값 비교 - 개선된 isEqual 함수 사용
    if (!isEqual(edited[key], original[key])) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`필드 ${key}: 값 다름`);
        console.log('  원본:', original[key]);
        console.log('  편집:', edited[key]);
      }
      hasChanges = true;
      break; // 하나라도 변경사항이 있으면 즉시 종료
    }
  }
  
  if (!hasChanges && process.env.NODE_ENV !== 'production') {
    console.log('compareShopData: 변경사항 없음');
  }
  return hasChanges;
};

/**
 * 상점 데이터에서 폼 데이터 업데이트 함수
 * 상점 데이터를 폼에 표시할 수 있는 형식으로 변환
 * 
 * @param {Object} shopData - 상점 데이터
 * @param {Object} currentFormData - 현재 폼 데이터
 * @returns {Object} 업데이트된 폼 데이터
 */
export const updateFormDataFromShop = (shopData, currentFormData = {}) => {
  if (!shopData) {
    return {
      storeName: "",
      storeStyle: "",
      alias: "",
      comment: "",
      locationMap: "",
      businessHours: "",
      hotHours: "",
      discountHours: "",
      address: "",
      mainImage: "",
      pinCoordinates: "",
      path: "",
      categoryIcon: "",
      googleDataId: "",
    };
  }
  
  // serverDataset이 있는 경우
  const data = shopData.serverDataset || shopData;
  
  // businessHours 특수 처리 - 빈 배열이거나 [""] 패턴인 경우도 빈 문자열로 표시
  let businessHoursValue = "";
  if (Array.isArray(data.businessHours)) {
    if (data.businessHours.length > 0 && !(data.businessHours.length === 1 && data.businessHours[0] === "")) {
      businessHoursValue = data.businessHours.join(', ');
    }
  } else if (data.businessHours) {
    businessHoursValue = data.businessHours;
  }
  
  return {
    ...currentFormData,
    storeName: data.storeName || "",
    storeStyle: data.storeStyle || "",
    alias: data.alias || "",
    comment: data.comment || "",
    locationMap: data.locationMap || "",
    businessHours: businessHoursValue,
    hotHours: data.hotHours || "",
    discountHours: data.discountHours || "",
    address: data.address || "",
    mainImage: data.mainImage || "",
    pinCoordinates: (data.pinCoordinates && data.pinCoordinates.trim() !== '') ? "등록됨" : "",
    path: (Array.isArray(data.path) && data.path.length > 0 && !(data.path.length === 1 && data.path[0] === "")) ? "등록됨" : "",
    categoryIcon: data.categoryIcon || "",
    googleDataId: data.googleDataId || "",
  };
};

/**
 * 기본 폼 데이터 생성 함수
 * 
 * @returns {Object} 기본 폼 데이터
 */
export const getDefaultFormData = () => {
  return {
    storeName: "",
    storeStyle: "",
    alias: "",
    comment: "",
    locationMap: "",
    businessHours: "",
    hotHours: "",
    discountHours: "",
    address: "",
    mainImage: "",
    pinCoordinates: "",
    path: "",
    categoryIcon: "",
    googleDataId: "",
  };
};

/**
 * 기본 상점 데이터 생성 함수
 * 
 * @returns {Object} 기본 상점 데이터
 */
export const getDefaultShopData = () => {
  return { ...protoServerDataset };
}; 