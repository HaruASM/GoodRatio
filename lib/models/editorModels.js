// 데이터 모델 정의

/**
 * @typedef {Object} ServerDataset
 * @property {string} sectionName - 지역 분류
 * @property {string} itemName - 가게 이름
 * @property {string} alias - 별칭
 * @property {string} comment - 코멘트
 * @property {string[]} businessHours - 영업 시간
 * @property {string} category - 대분류. shop, landmark, hotspot
 * @property {string} mediumCategory - 중분류. restaurant, hotel, attraction, bar, exchange
 * @property {string} smallCategory - 소분류. koreanRestaurant, japaneseRestaurant, chineseRestaurant, westernRestaurant, cafe 
 * @property {string} address - 주소
 * @property {string} mainImage - 메인 이미지 
 * @property {string[]} mainImages - 메인 이미지 목록 (미사용중)
 * @property {string[]} subImages - 서브 이미지
 * @property {Object{lat: number, lng: number}} pinCoordinates - 핀 좌표객체 
 * @property {Array<{lat: number, lng: number}>} path - 다각형 경로 좌표객체 배열
 * @property {string} streetView - 입구를 보여줄 스트릿 뷰
 * @property {string} iconDesign - 직접 지정하여 사용하는 아이콘
 * @property {string} googleDataId - Google Place API ID
 * @property {string} id - Firestore 문서 ID (UI에 표시되지 않음)
 */

/**
 * 서버 데이터셋 프로토타입
 * @type {ServerDataset}
 */
export const protoServerDataset = {
  sectionName: "",
  itemName: "",
  alias: "",
  businessHours: [""],
  hotHours: "",
  category: "",
  mediumCategory: "",
  smallCategory: "",
  address: "",
  mainImage: "",
  mainImages: [""], // 개별적으로 업로드할 이미지의 서버 구별값을 저장할 배열(아직 미사용)
  subImages: [""], // Google Place API에서 가져온 이미지의 구별값을 저장할 배열. 서버api에 해당 구별값을 전송해서 CORS문제 해결된 이미지 주소값 가져옴
  pinCoordinates: { lat: 0, lng: 0 },
  iconDesign: 0,
  streetView:  { 
    panoid: "", // panoid값이 "" 빈 배열이면 스트릿뷰 값이 없음. 
    heading: 0.0,
    pitch: 0.0,
    fov: 90  // 기본값, 추후 사이즈 지정 기능 추가 예정
  },
  googleDataId: "",
  path: [{ lat: 0, lng: 0 }],
  comment: "", // comment 필드 추가
  id: "", // Firestore 문서 ID 필드 추가
};

/**
 * 데이터 필드와 표시 이름 매핑 정보
 * 우측사이드바 에디터 패널에서 표시되는 것들을 지정
 * @type {Array<{field: string, title: string}>}
 */
export const titlesofDataFoam = [
  { field: 'itemName', title: '장소이름' },
  //{ field: 'storeStyle', title: '상점 스타일' },
  { field: 'alias', title: '별칭' },
  { field: 'comment', title: '코멘트' },
  { field: 'sectionName', title: '위치지역' },
  { field: 'category', title: '대분류' }, // 상점, landmark인지, 번화가
  { field: 'mediumCategory', title: '중분류' }, // 업종 분류, 식당, 마사지, 술집, 호텔
  { field: 'smallCategory', title: '소분류' }, // 업종 상세분류, 한식당, 일식당, 중식당. 
  { field: 'pinCoordinates', title: '핀 좌표' },
  { field: 'path', title: '다각형 경로' },
  { field: 'streetView', title: '스트릿뷰' },
  { field: 'iconDesign', title: '아이콘분류' },
  { field: 'googleDataId', title: '구글데이터ID' },
  
];





/**
 * @typedef {Object} itemdataSet
 * @property {ServerDataset} serverDataset - 서버에 저장되는 데이터
  */

export const protoitemdataSet = {
  serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
};


/**
 * 좌표 객체를 일관된 형식으로 변환 (항상 {lat, lng} 형식 반환)
 * @param {{lat: number, lng: number}|google.maps.LatLng} coordinates - 변환할 좌표 객체
 * @returns {{lat: number, lng: number}|null} 변환된 좌표 객체 또는 null
 */
export const parseCoordinates = (coordinates) => {
  if (!coordinates) return null;
  
  try {
    // 객체인 경우 (LatLng 또는 일반 객체)
    if (typeof coordinates === 'object' && coordinates !== null) {
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

/**
 * 구글 스트리트 뷰 URL에서 필요한 정보를 추출
 * @param {string} url - 구글 스트리트 뷰 URL
 * @returns {{panoid: string, heading: number, pitch: number, fov: number}|null} 파싱된 스트리트 뷰 정보 또는 null
 */
export const parseStreetViewUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // 기본 결과 객체 초기화 (fov는 기본값 90 사용)
    const result = {
      panoid: "",
      heading: 0,
      pitch: 0,
      fov: 90
    };
    
    // panoid 추출 방법 1: 1s 뒤에 오는 값 (일반적인 구글맵 공유 URL)
    const panoidMatch = url.match(/!1s([^!]+)/);
    if (panoidMatch && panoidMatch[1]) {
      result.panoid = panoidMatch[1];
    } else {
      // 방법 2: panoid 파라미터 (구글맵 API URL)
      const paramPanoidMatch = url.match(/[?&]panoid=([^&]+)/);
      if (paramPanoidMatch && paramPanoidMatch[1]) {
        result.panoid = paramPanoidMatch[1];
      } else {
        // 방법 3: 썸네일 URL의 panoid 파라미터
        const thumbnailPanoidMatch = url.match(/panoid%3D([^%&]+)/);
        if (thumbnailPanoidMatch && thumbnailPanoidMatch[1]) {
          result.panoid = thumbnailPanoidMatch[1];
        }
      }
    }
    
    // heading(yaw) 추출 - 3f 패턴, yaw 파라미터, 또는 yaw% 인코딩된 값 확인
    const headingMatches = [
      url.match(/!3f([^!]+)/),               // 구글맵 공유 URL 패턴
      url.match(/[?&]yaw=([^&]+)/),          // yaw 파라미터 
      url.match(/yaw%3D([^%&]+)/)            // URL 인코딩된 yaw 파라미터
    ].filter(Boolean);
    
    if (headingMatches.length > 0) {
      const headingValue = parseFloat(headingMatches[0][1]);
      if (!isNaN(headingValue)) {
        result.heading = headingValue;
      }
    }
    
    // pitch 추출 - 4f 패턴, pitch 파라미터, 또는 pitch% 인코딩된 값 확인
    const pitchMatches = [
      url.match(/!4f([^!]+)/),               // 구글맵 공유 URL 패턴
      url.match(/[?&]pitch=([^&]+)/),        // pitch 파라미터
      url.match(/pitch%3D([^%&]+)/)          // URL 인코딩된 pitch 파라미터
    ].filter(Boolean);
    
    if (pitchMatches.length > 0) {
      const pitchValue = parseFloat(pitchMatches[0][1]);
      if (!isNaN(pitchValue)) {
        result.pitch = pitchValue;
      }
    }
    
    // fov(필드 오브 뷰) 추출 - 5f 패턴 또는 fov 파라미터 확인
    const fovMatches = [
      url.match(/!5f([^!]+)/),               // 구글맵 공유 URL 패턴 
      url.match(/[?&]fov=([^&]+)/)           // fov 파라미터
    ].filter(Boolean);
    
    if (fovMatches.length > 0) {
      const fovValue = parseFloat(fovMatches[0][1]);
      if (!isNaN(fovValue)) {
        result.fov = fovValue;
      }
    }
    
    // panoid가 빈 문자열이면 파싱 실패로 간주
    return result.panoid ? result : null;
  } catch (error) {
    console.warn('스트리트 뷰 URL 파싱 오류:', error);
    return null;
  }
};

/**
 * 스트리트 뷰 정보를 iframe URL로 변환
 * @param {{panoid: string, heading: number, pitch: number, fov: number}} streetViewInfo - 스트리트 뷰 정보
 * @returns {string} iframe에 사용할 수 있는 임베드 URL
 */
export const createStreetViewEmbedUrl = (streetViewInfo) => {
  if (!streetViewInfo || !streetViewInfo.panoid) return '';
  
  try {
    // Google Maps Embed API 공식 URL 형식 - API 키 추가
    const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
    const embedUrl = `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&pano=${streetViewInfo.panoid}&heading=${streetViewInfo.heading || 0}&pitch=${streetViewInfo.pitch || 0}&fov=${streetViewInfo.fov || 90}`;
    
    console.log('스트릿뷰 임베드 생성:', {
      panoid: streetViewInfo.panoid,
      heading: streetViewInfo.heading || 0,
      pitch: streetViewInfo.pitch || 0,
      fov: streetViewInfo.fov || 90
    });
    
    return embedUrl;
  } catch (error) {
    console.warn('스트리트 뷰 임베드 URL 생성 오류:', error);
    return '';
  }
}; 