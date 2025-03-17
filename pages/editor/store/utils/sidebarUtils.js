import { protoServerDataset } from '../../dataModels';

/**
 * 상점 데이터 비교 함수
 * 원본 데이터와 편집된 데이터를 비교하여 변경 사항이 있는지 확인
 * 
 * @param {Object} original - 원본 상점 데이터
 * @param {Object} edited - 편집된 상점 데이터
 * @returns {boolean} 변경 사항 존재 여부
 */
export const compareShopData = (original, edited) => {
  if (!original || !edited) return false;
  
  // serverDataset이 있는 경우
  if (original.serverDataset && edited.serverDataset) {
    const originalData = original.serverDataset;
    const editedData = edited.serverDataset;
    
    // 모든 필드 비교
    for (const key in editedData) {
      // 배열인 경우 (예: businessHours)
      if (Array.isArray(editedData[key])) {
        if (!Array.isArray(originalData[key])) return true;
        if (editedData[key].length !== originalData[key].length) return true;
        
        // 배열 내용 비교
        for (let i = 0; i < editedData[key].length; i++) {
          if (editedData[key][i] !== originalData[key][i]) return true;
        }
      } 
      // 일반 값 비교
      else if (editedData[key] !== originalData[key]) {
        return true;
      }
    }
    
    return false;
  }
  
  // serverDataset이 없는 경우 직접 비교
  for (const key in edited) {
    if (key === 'itemMarker' || key === 'itemPolygon') continue; // 마커와 폴리곤은 제외
    
    if (edited[key] !== original[key]) {
      return true;
    }
  }
  
  return false;
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
  
  return {
    ...currentFormData,
    storeName: data.storeName || "",
    storeStyle: data.storeStyle || "",
    alias: data.alias || "",
    comment: data.comment || "",
    locationMap: data.locationMap || "",
    businessHours: Array.isArray(data.businessHours) ? data.businessHours.join(', ') : data.businessHours || "",
    hotHours: data.hotHours || "",
    discountHours: data.discountHours || "",
    address: data.address || "",
    mainImage: data.mainImage || "",
    pinCoordinates: (data.pinCoordinates && data.pinCoordinates.trim() !== '') ? "등록됨" : "",
    path: (Array.isArray(data.path) && data.path.length > 0) ? "등록됨" : "",
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