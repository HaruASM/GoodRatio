// 데이터 모델 정의

/**
 * @typedef {Object} ServerDataset
 * @property {string} locationMap - 지역 분류
 * @property {string} storeName - 가게 이름
 * @property {string} storeStyle - 가게 스타일
 * @property {string} alias - 별칭
 * @property {string[]} businessHours - 영업 시간
 * @property {string} hotHours - 성수기 시간
 * @property {string} discountHours - 할인 시간
 * @property {string} address - 주소
 * @property {string} mainImage - 메인 이미지 URL
 * @property {string[]} mainImages - 메인 이미지 URL 목록
 * @property {string[]} subImages - 서브 이미지 URL 목록
 * @property {string} pinCoordinates - 핀 좌표 (문자열 형태의 "lat,lng")
 * @property {string} categoryIcon - 카테고리 아이콘
 * @property {string} googleDataId - Google Place API ID
 * @property {Array<{lat: number, lng: number}>} path - 다각형 경로 좌표 배열
 * @property {string} comment - 코멘트
 */

/**
 * 서버 데이터셋 프로토타입
 * @type {ServerDataset}
 */
export const protoServerDataset = {
  locationMap: "",
  storeName: "",
  storeStyle: "",
  alias: "",
  businessHours: [""],
  hotHours: "",
  discountHours: "",
  address: "",
  mainImage: "",
  mainImages: [""],
  subImages: [""], // Google Place API에서 가져온 이미지를 저장할 배열
  pinCoordinates: "",
  categoryIcon: "",
  googleDataId: "",
  path: [""],
  comment: "", // comment 필드 추가
};

/**
 * @typedef {Object} ShopDataSet
 * @property {ServerDataset} serverDataset - 서버에 저장되는 데이터
 * @property {string} distance - 거리 정보
 * @property {google.maps.Marker|null} itemMarker - 구글 맵 마커 객체
 * @property {google.maps.Polygon|null} itemPolygon - 구글 맵 폴리곤 객체
 */

/**
 * 상점 데이터셋 프로토타입
 * @type {ShopDataSet}
 */
export const protoShopDataSet = {
  serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
  distance: "",
  itemMarker: null,
  itemPolygon: null,
};

/**
 * 오버레이 색상 정의
 * @type {{IDLE: string, MOUSEOVER: string}}
 */
export const OVERLAY_COLOR = {
  IDLE: '#FF0000', // 빨간색
  MOUSEOVER: '#00FF00', // 초록색
};

/**
 * 오버레이 아이콘 정의
 * @type {{MARKER_MOUSEOVER: string, MARKER: string}}
 */
export const OVERLAY_ICON = {
  MARKER_MOUSEOVER: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // 파란색
  MARKER: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // 초록색
};

/**
 * 좌표 문자열 또는 객체를 구글맵 LatLng 객체 형태로 변환
 * @param {string|{lat: number, lng: number}|google.maps.LatLng} coordinates - 변환할 좌표
 * @returns {{lat: number, lng: number}|null} 변환된 좌표 객체 또는 null
 */
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

/**
 * 좌표 객체를 문자열로 변환
 * @param {string|{lat: number, lng: number}|google.maps.LatLng} coordinates - 변환할 좌표
 * @returns {string} "위도, 경도" 형식의 문자열
 */
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