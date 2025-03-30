/**
 * API 서버 기본 URL
 * 개발 환경에서는 Next.js 서버의 API 라우트 사용
 * 프로덕션 환경에서는 실제 배포된 API 서버 URL로 대체 가능
 */
export const API_BASE_URL = '/api';

/**
 * 상점 데이터 카테고리 목록
 */
export const SHOP_CATEGORIES = [
  '음식점',
  '카페',
  '술집',
  '쇼핑',
  '서비스',
  '기타'
];

/**
 * 상점 영업 상태 목록
 */
export const SHOP_STATUS = [
  '영업중',
  '임시휴업',
  '폐업',
  '준비중'
];

/**
 * 필터 관련 상수
 */
export const FILTER_OPTIONS = {
  ALL: '전체',
  FOOD: '음식점',
  CAFE: '카페',
  BAR: '술집',
  SHOPPING: '쇼핑',
  SERVICE: '서비스',
  OTHER: '기타'
};

/**
 * 지도 관련 상수
 */
export const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 35.86838, lng: 128.59686 }, // 대구 반월당 기본 좌표
  DEFAULT_ZOOM: 17,
  MARKER_ICON: {
    DEFAULT: '/icons/marker-default.png',
    SELECTED: '/icons/marker-selected.png',
    NEW: '/icons/marker-new.png'
  }
}; 