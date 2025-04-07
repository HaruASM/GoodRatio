// 데이터 모델 정의

/**
 * @typedef {Object} ServerDataset
 * @property {string} locationMap - 지역 분류
 * @property {string} itemName - 가게 이름
 * @property {string} storeStyle - 가게 스타일
 * @property {string} alias - 별칭
 * @property {string[]} businessHours - 영업 시간
 * @property {string} hotHours - 성수기 시간
 * @property {string} address - 주소
 * @property {string} mainImage - 메인 이미지 (현재 구글place 사진의 ID)
 * @property {string[]} mainImages - 메인 이미지 URL 목록
 * @property {string[]} subImages - 서브 이미지: 구글place 사진의 ID목록
 * @property {Object{lat: number, lng: number}} pinCoordinates - 핀 좌표객체 
 * @property {Array<{lat: number, lng: number}>} path - 다각형 경로 좌표객체 배열
 * @property {string} categoryIcon - 카테고리 아이콘
 * @property {string} googleDataId - Google Place API ID
 * @property {string} comment - 코멘트
 * @property {string} id - Firestore 문서 ID
 */

/**
 * 서버 데이터셋 프로토타입
 * @type {ServerDataset}
 */
export const protoServerDataset = {
  locationMap: "",
  itemName: "",
  storeStyle: "",
  alias: "",
  businessHours: [""],
  hotHours: "",
  category: "",
  address: "",
  mainImage: "",
  mainImages: [""], // 개별적으로 업로드할 이미지의 서버 구별값을 저장할 배열(아직 미사용)
  subImages: [""], // Google Place API에서 가져온 이미지의 구별값을 저장할 배열. 서버api에 해당 구별값을 전송해서 CORS문제 해결된 이미지 주소값 가져옴
  pinCoordinates: { lat: 0, lng: 0 },
  categoryIcon: "",
  googleDataId: "",
  pictureIcon:"",
  path: [{ lat: 0, lng: 0 }],
  comment: "", // comment 필드 추가
  id: "", // Firestore 문서 ID 필드 추가
};

/**
 * 데이터 필드와 표시 이름 매핑 정보
 * @type {Array<{field: string, title: string}>}
 */
export const titlesofDataFoam = [
  { field: 'itemName', title: '장소이름' },
  //{ field: 'storeStyle', title: '상점 스타일' },
  { field: 'alias', title: '별칭' },
  { field: 'comment', title: '코멘트' },
  { field: 'locationMap', title: '위치지역' },
  { field: 'businessHours', title: '영업시간' },
  //{ field: 'hotHours', title: 'hot시간' },
  { field: 'category', title: '분류' },
  { field: 'address', title: '주소' },
  { field: 'pinCoordinates', title: '핀 좌표' },
  { field: 'path', title: '다각형 경로' },
  { field: 'categoryIcon', title: '아이콘분류' },
  { field: 'pictureIcon', title: '사진아이콘' },
  { field: 'googleDataId', title: '구글데이터ID' },
  
];

/**
 * @typedef {Object} ShopDataSet
 * @property {ServerDataset} serverDataset - 서버에 저장되는 데이터
 * @property {string} distance - 거리 정보
  */

/**
 * 상점 데이터셋 프로토타입
 * @type {ShopDataSet}
 */
export const protoShopDataSet = {
  serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
  distance: "",
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