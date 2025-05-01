/**
 * @fileoverview 맵 아이콘 관리 라이브러리
 * @module lib/components/map/MapIcons
 * 
 * 맵에 표시되는 다양한 아이콘 타입과 디자인을 관리합니다.
 * 개발 중 디자인이 교체될 예정이므로 이 파일에서 일괄 관리합니다.
 */

/**
 * 아이콘 타입 상수 정의
 * @readonly
 * @enum {number}
 */
export const ICON_TYPES = {
  // 음식 관련
  RESTAURANT: 1,     // 레스토랑
  CAFE: 2,           // 카페
  BAR: 3,            // 바/술집
  //BAKERY: 4,         // 베이커리
  
  // 숙박 관련
  HOTEL: 11,          // 호텔
  //GUESTHOUSE: 6,     // 게스트하우스
  
  // 관광 관련
  ATTRACTION: 21,     // 관광지
  //MUSEUM: 8,         // 박물관
  //PARK: 9,           // 공원
  //BEACH: 10,         // 해변
  
  // 교통 관련
  TRANSPORT: 31,     // bus station
  AIRPORT: 32,       // 공항
  
  // 쇼핑 관련
  SHOPPING: 41,      // 쇼핑몰
  MARKET: 42,        // 시장
  CONVENIENCE: 43,   // 편의점

  //
  EXCHANGE  : 51,    // 환전
  ATM       : 52,    // ATM
  
  HOSPITAL  : 61,
  
  // 기타
  DEFAULT: 100        // 기본 아이콘
};

/**
 * 아이콘 타입별 SVG 데이터
 * @private
 * @readonly
 * @type {Object.<number, string>}
 */
const SVG_ICON_DATA = {
  // 음식 관련
  [ICON_TYPES.RESTAURANT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M368-80q-20 0-33.5-13.5T321-127v-253h-15q-20 0-33.5-13.5T259-427v-173q0-105 72.5-177.5T509-850q105 0 177.5 72.5T759-600v173q0 20-13.5 33.5T712-380h-15v253q0 20-13.5 33.5T650-80h-36q-20 0-33.5-13.5T567-127v-253H393v253q0 20-13.5 33.5T346-80h-26Zm-87-347h398v-173q0-85-56.5-142.5T480-800q-87 0-143 57.5T281-600v173Z"/>
  </svg>`,
  
  [ICON_TYPES.CAFE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M200-160q-33 0-56.5-23.5T120-240v-160h80v-320q0-83 58.5-141.5T400-920h160q83 0 141.5 58.5T760-720v320h80v160q0 33-23.5 56.5T760-160H200Zm200-240h160v-320H400v320Zm-200 160h560v-80H200v80Zm280-160Zm-120 0h240-240Z"/>
  </svg>`,
  
  [ICON_TYPES.BAR]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M200-160v-80h80v-280L80-720v-80h800v80L680-520v280h80v80H200Zm174-360h212L703-640H257l117 120Zm86 200h40v-160h-40v160Z"/>
  </svg>`,
  
  // 숙박 관련
  [ICON_TYPES.HOTEL]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M200-80q-33 0-56.5-23.5T120-160v-400q0-33 23.5-56.5T200-640h560q33 0 56.5 23.5T840-560v400q0 33-23.5 56.5T760-80H200Zm0-520v-200h560v200H200Zm280 280q50 0 85-35t35-85h-80q0 17-11.5 28.5T480-400q-17 0-28.5-11.5T440-440h-80q0 50 35 85t85 35ZM320-440q17 0 28.5-11.5T360-480q0-17-11.5-28.5T320-520q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm320 0q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520q-17 0-28.5 11.5T600-480q0 17 11.5 28.5T640-440Z"/>
  </svg>`,
  
  [ICON_TYPES.GUESTHOUSE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M160-120v-480h80v280h160v-280h240v280h80v-360h80v560H160Zm80-80h160v-120H240v120Zm240 0h160v-120H480v120Zm-320-400v-240l320-160 320 160v240h-80v-189l-240-121-240 121v189h-80Zm240-80q33 0 56.5-23.5T480-760q0-33-23.5-56.5T400-840q-33 0-56.5 23.5T320-760q0 33 23.5 56.5T400-680ZM240-200Zm240 0Z"/>
  </svg>`,
  
  // 관광 관련
  [ICON_TYPES.ATTRACTION]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
  </svg>`,
  
  [ICON_TYPES.MUSEUM]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M160-160v-60h640v60H160Zm115-120v-286q0-15 8-28t22-19l205-93q10-5 20-5t20 5l205 93q14 6 22 19t8 28v286H275Zm60-60h80v-240h-80v240Zm165 0h80v-240h-80v240Zm165 0h80v-240h-80v240ZM190-480v-90q0-55 29.5-101.5T300-740v-70h60v65q19-3 40-3h160q21 0 40 3v-65h60v70q51 17 80.5 63.5T770-570v90H710v-90q0-38-26-64t-64-26H340q-38 0-64 26t-26 64v90h-60Z"/>
  </svg>`,
  
  [ICON_TYPES.PARK]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M160-160v-240H80v-80h80v-160H80v-80h80v-240h80v240h160v-240h80v240h100q17 0 28.5 11.5T620-640v120q0 17-11.5 28.5T580-480H400v240h80v-80h320v80H160Zm80-320h160v-160H240v160Z"/>
  </svg>`,
  
  [ICON_TYPES.BEACH]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M80-100v-60h800v60H80Zm537-398q-61 0-110-34.5T437-627q0-16 3-31.5t9-30.5q-25 9-51 15.5T343-667q42-38 96-62.5T549-754q75 0 143.5 28T814-646q-44 8-85.5 4.5T647-663q-10 45-45 82.5T517-498Zm0-129Z"/>
  </svg>`,
  
  // 교통 관련
  [ICON_TYPES.TRANSPORT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  [ICON_TYPES.PARKING]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M240-80v-800h320q117 0 198.5 81.5T840-600q0 117-81.5 198.5T560-320H360v240h-120Zm120-360h200q66 0 113-47t47-113q0-66-47-113t-113-47H360v320Z"/>
  </svg>`,
  
  // 쇼핑 관련
  [ICON_TYPES.SHOPPING]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM246-720l96 200h280l110-200H246Zm-38-80h590q23 0 35 20.5t1 41.5L692-482q-11 20-29.5 31T622-440H324l-44 80h480v80H280q-45 0-68-39.5t-2-78.5l54-98-144-304H40v-80h130l38 80Zm134 280h280-280Z"/>
  </svg>`,
  
  [ICON_TYPES.MARKET]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  [ICON_TYPES.CONVENIENCE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  // 금융 관련
  [ICON_TYPES.EXCHANGE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M441-120v-86q-53-12-91.5-46T293-348l74-30q15 48 44.5 73t77.5 25q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-84h80v84q50 8 82.5 36.5T651-650l-74 32q-12-32-34-48t-60-16q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v84h-80Z"/>
  </svg>`,
  
  [ICON_TYPES.ATM]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M441-120v-86q-53-12-91.5-46T293-348l74-30q15 48 44.5 73t77.5 25q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-84h80v84q50 8 82.5 36.5T651-650l-74 32q-12-32-34-48t-60-16q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v84h-80Z"/>
  </svg>`,
  
  // 의료 관련
  [ICON_TYPES.HOSPITAL]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v640q0 33-23.5 56.5T800-80H160Zm320-280h80v-120h120v-80H560v-120h-80v120H360v80h120v120Z"/>
  </svg>`,
  
  // 기본 아이콘 - 빨간색 원형 마커로 설정
  [ICON_TYPES.DEFAULT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
    <circle cx="12" cy="12" r="10" fill="#e53935" stroke="#b71c1c" stroke-width="2"/>
  </svg>`
};

/**
 * 아이콘 스타일 정의
 * @readonly
 * @enum {Object}
 */
export const ICON_STYLES = {
  // 기본 스타일 - 빨간색 원형 마커
  DEFAULT: {
    background: '#FF0000',
    iconColor: '#FFFFFF',
    size: '20px',
    containerSize: '20px',
    padding: '0px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
    border: '2px solid white'
  },
  
  // 선택된 아이콘 스타일
  SELECTED: {
    background: '#e0f7fa',
    iconColor: '#0288d1',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgba(0,120,215,0.5)',
    border: '2px solid #0288d1'
  },
  
  // 음식 카테고리 아이콘
  FOOD: {
    background: '#ffebee',
    iconColor: '#d32f2f',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #ffcdd2'
  },
  
  // 숙박 관련
  ACCOMMODATION: {
    background: '#e8f5e9',
    iconColor: '#388e3c',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #c8e6c9'
  },
  
  // 관광 관련
  TOURISM: {
    background: '#e3f2fd',
    iconColor: '#1976d2',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #bbdefb'
  },
  
  // 교통 관련
  TRANSPORT: {
    background: '#ede7f6',
    iconColor: '#5e35b1',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #d1c4e9'
  },
  
  // 쇼핑 관련
  SHOPPING: {
    background: '#fff8e1',
    iconColor: '#ff8f00',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #ffe082'
  },
  
  // 금융 관련
  FINANCE: {
    background: '#e8f5e9',
    iconColor: '#2e7d32',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #a5d6a7'
  },
  
  // 의료 관련
  MEDICAL: {
    background: '#e3f2fd',
    iconColor: '#1565c0',
    size: '24px',
    containerSize: '40px',
    padding: '8px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    border: '2px solid #90caf9'
  },
  
  // 빨간색 마커 스타일 (DEFAULT 아이콘용)
  RED_MARKER: {
    background: '#FF0000',
    iconColor: '#FFFFFF',
    size: '20px',
    containerSize: '20px',
    padding: '0px',
    borderRadius: '50%',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
    border: '2px solid white'
  }
};

/**
 * 아이콘 타입별 스타일 매핑
 * @private
 * @readonly
 * @type {Object.<number, string>}
 */
const ICON_STYLE_MAPPING = {
  // 음식 관련
  [ICON_TYPES.RESTAURANT]: 'FOOD',
  [ICON_TYPES.CAFE]: 'FOOD',
  [ICON_TYPES.BAR]: 'FOOD',
  [ICON_TYPES.BAKERY]: 'FOOD',
  
  // 숙박 관련
  [ICON_TYPES.HOTEL]: 'ACCOMMODATION',
  [ICON_TYPES.GUESTHOUSE]: 'ACCOMMODATION',
  
  // 관광 관련
  [ICON_TYPES.ATTRACTION]: 'TOURISM',
  [ICON_TYPES.MUSEUM]: 'TOURISM',
  [ICON_TYPES.PARK]: 'TOURISM',
  [ICON_TYPES.BEACH]: 'TOURISM',
  
  // 교통 관련
  [ICON_TYPES.TRANSPORT]: 'TRANSPORT',
  [ICON_TYPES.AIRPORT]: 'TRANSPORT',
  
  // 쇼핑 관련
  [ICON_TYPES.SHOPPING]: 'SHOPPING',
  [ICON_TYPES.MARKET]: 'SHOPPING',
  [ICON_TYPES.CONVENIENCE]: 'SHOPPING',
  
  // 금융 관련
  [ICON_TYPES.EXCHANGE]: 'FINANCE',
  [ICON_TYPES.ATM]: 'FINANCE',
  
  // 의료 관련
  [ICON_TYPES.HOSPITAL]: 'MEDICAL',
  
  // 기본
  [ICON_TYPES.DEFAULT]: 'RED_MARKER'
};

/**
 * SVG 아이콘 요소 생성
 * @param {number} iconType - ICON_TYPES 상수
 * @param {boolean} [isSelected=false] - 선택 상태 여부
 * @returns {SVGElement} SVG 아이콘 요소
 */
export function createIconSvg(iconType, isSelected = false) {
  // 기본값으로 설정
  if (!iconType || !SVG_ICON_DATA[iconType]) {
    iconType = ICON_TYPES.DEFAULT;
  }
  
  // SVG 문자열을 DOM 요소로 변환
  const parser = new DOMParser();
  const iconSvgDoc = parser.parseFromString(SVG_ICON_DATA[iconType], "image/svg+xml");
  const iconSvgElement = iconSvgDoc.documentElement;
  
  // 스타일 정보 가져오기
  const styleKey = isSelected ? 'SELECTED' : ICON_STYLE_MAPPING[iconType];
  const style = ICON_STYLES[styleKey];
  
  // SVG 요소 스타일 설정 (DEFAULT 아이콘 제외)
  if (iconType !== ICON_TYPES.DEFAULT) {
    iconSvgElement.setAttribute('fill', style.iconColor);
  }
  
  iconSvgElement.setAttribute('width', style.size);
  iconSvgElement.setAttribute('height', style.size);
  
  return iconSvgElement;
}

/**
 * 아이콘 타입에 따른 마커 컨테이너 생성
 * @param {number} iconType - ICON_TYPES 상수
 * @param {boolean} [isSelected=false] - 선택 상태 여부
 * @returns {HTMLElement} 마커 컨테이너 요소
 */
export function createIconByIconType(iconType, isSelected = false) {
  // DEFAULT 아이콘인 경우 기본 빨간색 원형 마커 생성
  if (!iconType || iconType === ICON_TYPES.DEFAULT) {
    // 빨간색 원형 마커용 DIV 요소 생성
    const container = document.createElement('div');
    container.dataset.iconType = ICON_TYPES.DEFAULT;
    container.dataset.selected = 'false';
    
    // 빨간색 원형 마커 스타일 적용
    const style = ICON_STYLES.RED_MARKER;
    
    container.style.width = style.containerSize;
    container.style.height = style.containerSize;
    container.style.backgroundColor = style.background;
    container.style.borderRadius = style.borderRadius;
    container.style.boxShadow = style.boxShadow;
    container.style.border = style.border;
    
    return container;
  }
  
  // 다른 아이콘 타입의 경우 SVG 기반 마커 생성
  const svgElement = createIconSvg(iconType, isSelected);
  
  // 스타일 정보 가져오기
  const styleKey = isSelected ? 'SELECTED' : ICON_STYLE_MAPPING[iconType];
  const style = ICON_STYLES[styleKey];
  
  // 컨테이너 요소 생성
  const container = document.createElement('div');
  container.dataset.iconType = iconType;
  container.dataset.selected = isSelected ? 'true' : 'false';
  
  // 컨테이너 스타일 설정
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.width = style.containerSize;
  container.style.height = style.containerSize;
  container.style.background = style.background;
  container.style.borderRadius = style.borderRadius;
  container.style.boxShadow = style.boxShadow;
  container.style.border = style.border;
  container.style.padding = style.padding;
  container.style.boxSizing = 'border-box';
  
  // SVG 아이콘 추가
  container.appendChild(svgElement);
  
  return container;
} 