// 데이터 모델 정의

// 서버 데이터셋 프로토타입
export const protoServerDataset = {
  locationMap: "",
  storeName: "",
  storeStyle: "",
  alias: "",
  businessHours: [],
  hotHours: "",
  discountHours: "",
  address: "",
  mainImage: "",
  mainImages: [],
  subImages: [], // Google Place API에서 가져온 이미지를 저장할 배열
  pinCoordinates: "",
  categoryIcon: "",
  googleDataId: "",
  path: [],
  comment: "", // comment 필드 추가
};

// 상점 데이터셋 프로토타입
export const protoShopDataSet = {
  serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
  distance: "",
  itemMarker: null,
  itemPolygon: null,
};

// 맵 관련 상수
export const OVERLAY_COLOR = {
  IDLE: '#FF0000', // 빨간색
  MOUSEOVER: '#00FF00', // 초록색
};

export const OVERLAY_ICON = {
  MARKER_MOUSEOVER: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // 파란색
  MARKER: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // 초록색
};

// 좌표 변환 유틸리티 함수
export const parseCoordinates = (coordinates) => {
  if (!coordinates) return null;
  
  try {
    if (typeof coordinates === 'string') {
      const [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    } else if (typeof coordinates === 'object' && coordinates !== null) {
      return {
        lat: typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat,
        lng: typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng
      };
    }
  } catch (error) {
    console.warn('좌표 변환 오류:', error);
  }
  
  return null;
};

// 좌표를 문자열로 변환하는 함수
export const stringifyCoordinates = (coordinates) => {
  if (!coordinates) return '';
  
  try {
    if (typeof coordinates === 'string') {
      return coordinates;
    } else if (typeof coordinates === 'object' && coordinates !== null) {
      const lat = typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat;
      const lng = typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng;
      return `${lat}, ${lng}`;
    }
  } catch (error) {
    console.warn('좌표 문자열 변환 오류:', error);
  }
  
  return '';
}; 