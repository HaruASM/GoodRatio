/**
 * @fileoverview 맵 아이콘 관리 라이브러리
 * @module lib/components/map/MapIcons
 * 
 * 맵에 표시되는 다양한 아이콘 타입과 디자인을 관리합니다.
 * 개발 중 디자인이 교체될 예정이므로 이 파일에서 일괄 관리합니다.
 */

/**
 * 아이콘 캐시 객체 - 성능 최적화를 위해 생성된 아이콘 템플릿을 저장
 * @private
 * @type {Object}
 */
const _iconCache = {};

/**
 * 아이콘 타입 상수 정의
 * @readonly
 * @enum {number}
 */

// 아이콘의 형태에 따라 일괄적으로 아이콘 디자인을 정하려는 용도가 아니다. 
// item의 분류와 ICON_DESIGN은 관련이 없으며, ICON_DESIGN은 ICON의 디자인 종류를 구분하기 위함이다. 
export const ICON_DESIGN = {
  // 음식 관련
  RESTAURANT: 1,     // 레스토랑
  CAFE: 2,           // 카페
  BAR: 3,            // 바/술집
  
  // 숙박 관련
  HOTEL: 11,         // 호텔
  
  // 관광 관련
  ATTRACTION: 21,    // 관광지
  
  // 교통 관련
  TRANSPORT: 31,     // bus station
  AIRPORT: 32,       // 공항
  
  // 쇼핑 관련
  SHOPPING: 41,      // 쇼핑몰
  MARKET: 42,        // 시장
  CONVENIENCE: 43,   // 편의점

  // 금융 관련
  EXCHANGE: 51,      // 환전
  ATM: 52,           // ATM
  
  // 의료 관련
  HOSPITAL: 61,      // 병원
  
  // 기타
  DEFAULT: 0,      // 기본 아이콘이나 일괄적으로 적용되지 않는다. 명시적으로 이 아이콘을 사용한다고 명시 되었을때 사용 할것. 
  HEARTRETRO: 201,   // 하트 레트로 아이콘 디자인 아이콘 
};

/**
 * 아이콘 디자인 숫자값을 상수명으로 역매핑하는 테이블
 * // 역매핑 테이블을 별도로 추가 생성하여, item에서 숫자로 저장된 각 ICON_DESIGN 상수를 찾아내도록 하였다. 
 * @readonly
 * @type {Object.<number, string>}
 */
export const ICON_DESIGN_NAMES = (() => {
  const names = {};
  // ICON_DESIGN의 모든 키를 순회하며 역매핑 테이블 생성
  for (const key in ICON_DESIGN) {
    names[ICON_DESIGN[key]] = key;
  }
  return names;
})();

/**
 * 아이콘 타입별 SVG 데이터. 
 * SVG를 인라인으로 사용해서, 디자인 변경편이성 및 외부 의존성 줄임. 
 * @private
 * @readonly
 * @type {Object.<number, string>}
 */
const SVG_ICON_DATA = {
  // 음식 관련 
  [ICON_DESIGN.RESTAURANT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#EA3323"><path d="M240-80v-366q-54-14-87-57t-33-97v-280h80v240h40v-240h80v240h40v-240h80v280q0 54-33 97t-87 57v366h-80Zm400 0v-381q-54-18-87-75.5T520-667q0-89 47-151t113-62q66 0 113 62.5T840-666q0 73-33 130t-87 75v381h-80Z"/></svg>`,
  
  [ICON_DESIGN.CAFE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M200-160q-33 0-56.5-23.5T120-240v-160h80v-320q0-83 58.5-141.5T400-920h160q83 0 141.5 58.5T760-720v320h80v160q0 33-23.5 56.5T760-160H200Zm200-240h160v-320H400v320Zm-200 160h560v-80H200v80Zm280-160Zm-120 0h240-240Z"/>
  </svg>`,
  
  [ICON_DESIGN.BAR]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M200-160v-80h80v-280L80-720v-80h800v80L680-520v280h80v80H200Zm174-360h212L703-640H257l117 120Zm86 200h40v-160h-40v160Z"/>
  </svg>`,
  
  // 숙박 관련
  [ICON_DESIGN.HOTEL]: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#EA3323"><path d="M40-200v-600h80v400h320v-320h320q66 0 113 47t47 113v360h-80v-120H120v120H40Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 40h320v-160q0-33-23.5-56.5T760-640H520v240ZM280-520q17 0 28.5-11.5T320-560q0-17-11.5-28.5T280-600q-17 0-28.5 11.5T240-560q0 17 11.5 28.5T280-520Zm0-40Zm240-80v240-240Z"/></svg>`,
  
  // 관광 관련
  [ICON_DESIGN.ATTRACTION]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
  </svg>`,
  
  // 교통 관련
  [ICON_DESIGN.TRANSPORT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  [ICON_DESIGN.AIRPORT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M480-120 360-240H200q-33 0-56.5-23.5T120-320v-320q0-33 23.5-56.5T200-720h160l120-120 40 40-80 80h240l-80-80 40-40 120 120 80 80v320l-80 80H520L400-280l40-40h376v-320H144v320h216l120-120v120l-120 120-40 40Z"/>
  </svg>`,
  
  // 쇼핑 관련
  [ICON_DESIGN.SHOPPING]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM246-720l96 200h280l110-200H246Zm-38-80h590q23 0 35 20.5t1 41.5L692-482q-11 20-29.5 31T622-440H324l-44 80h480v80H280q-45 0-68-39.5t-2-78.5l54-98-144-304H40v-80h130l38 80Zm134 280h280-280Z"/>
  </svg>`,
  
  [ICON_DESIGN.MARKET]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  [ICON_DESIGN.CONVENIENCE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M221-120q-27 0-48-16.5T144-179L42-549q-5-19 6.5-35T80-600h190l176-262q5-8 14-13t19-5q10 0 19 5t14 13l176 262h192q20 0 31.5 16t6.5 35L816-179q-8 26-29 42.5T739-120H221Zm-1-80h520l88-320H132l88 320Zm260-80q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM367-600h225L479-768 367-600Zm113 240Z"/>
  </svg>`,
  
  // 금융 관련
  [ICON_DESIGN.EXCHANGE]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M441-120v-86q-53-12-91.5-46T293-348l74-30q15 48 44.5 73t77.5 25q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-84h80v84q50 8 82.5 36.5T651-650l-74 32q-12-32-34-48t-60-16q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v84h-80Z"/>
  </svg>`,
  
  [ICON_DESIGN.ATM]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M441-120v-86q-53-12-91.5-46T293-348l74-30q15 48 44.5 73t77.5 25q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-84h80v84q50 8 82.5 36.5T651-650l-74 32q-12-32-34-48t-60-16q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v84h-80Z"/>
  </svg>`,
  
  // 의료 관련
  [ICON_DESIGN.HOSPITAL]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
    <path d="M160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v640q0 33-23.5 56.5T800-80H160Zm320-280h80v-120h120v-80H560v-120h-80v120H360v80h120v120Z"/>
  </svg>`,
  
  // 기본 아이콘 - 빨간색 원형 마커로 설정
  [ICON_DESIGN.DEFAULT]: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
    <circle cx="12" cy="12" r="10" fill="#e53935" stroke="#b71c1c" stroke-width="2"/>
  </svg>`,
  
  // HEARTRETRO 아이콘 - 보라색 원형 SVG 아이콘 디자인
  [ICON_DESIGN.HEARTRETRO]: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none">
    <rect width="56" height="56" rx="28" fill="#7837FF"></rect>
    <path d="M46.0675 22.1319L44.0601 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M11.9402 33.2201L9.93262 33.8723" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M27.9999 47.0046V44.8933" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M27.9999 9V11.1113" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M39.1583 43.3597L37.9186 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M16.8419 12.6442L18.0816 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M9.93262 22.1319L11.9402 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M46.0676 33.8724L44.0601 33.2201" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M39.1583 12.6442L37.9186 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M16.8419 43.3597L18.0816 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M28 39L26.8725 37.9904C24.9292 36.226 23.325 34.7026 22.06 33.4202C20.795 32.1378 19.7867 30.9918 19.035 29.9823C18.2833 28.9727 17.7562 28.0587 17.4537 27.2401C17.1512 26.4216 17 25.5939 17 24.7572C17 23.1201 17.5546 21.7513 18.6638 20.6508C19.7729 19.5502 21.1433 19 22.775 19C23.82 19 24.7871 19.2456 25.6762 19.7367C26.5654 20.2278 27.34 20.9372 28 21.8649C28.77 20.8827 29.5858 20.1596 30.4475 19.6958C31.3092 19.2319 32.235 19 33.225 19C34.8567 19 36.2271 19.5502 37.3362 20.6508C38.4454 21.7513 39 23.1201 39 24.7572C39 25.5939 38.8488 26.4216 38.5463 27.2401C38.2438 28.0587 37.7167 28.9727 36.965 29.9823C36.2133 30.9918 35.205 32.1378 33.94 33.4202C32.675 34.7026 31.0708 36.226 29.1275 37.9904L28 39Z" fill="#FF7878"></path>
  </svg>`
};

/**
 * 아이콘 크기 정의
 * @private
 * @readonly
 * @type {Object.<number, Object>}
 */
const ICON_SIZES = {
  // 기본 아이콘 크기
  [ICON_DESIGN.DEFAULT]: {
    size: '24px',
  },
  
  // 음식 관련
  [ICON_DESIGN.RESTAURANT]: {
    size: '24px',
  },
  
  [ICON_DESIGN.CAFE]: {
    size: '24px',
  },
  
  [ICON_DESIGN.BAR]: {
    size: '24px',
  },
  
  // 숙박 관련
  [ICON_DESIGN.HOTEL]: {
    size: '24px',
  },
  
  // 관광 관련
  [ICON_DESIGN.ATTRACTION]: {
    size: '24px',
  },
  
  // 교통 관련
  [ICON_DESIGN.TRANSPORT]: {
    size: '24px',
  },
  
  [ICON_DESIGN.AIRPORT]: {
    size: '24px',
  },
  
  // 쇼핑 관련
  [ICON_DESIGN.SHOPPING]: {
    size: '24px',
  },
  
  [ICON_DESIGN.MARKET]: {
    size: '24px',
  },
  
  [ICON_DESIGN.CONVENIENCE]: {
    size: '24px',
  },
  
  // 금융 관련
  [ICON_DESIGN.EXCHANGE]: {
    size: '24px',
  },
  
  [ICON_DESIGN.ATM]: {
    size: '24px',
  },
  
  // 의료 관련
  [ICON_DESIGN.HOSPITAL]: {
    size: '24px',
  },
  
  // 하트 레트로 아이콘
  [ICON_DESIGN.HEARTRETRO]: {
    size: '32px',
  }
};

/**
 * DOM 요소 복제 함수
 * @private
 * @param {Element} element - 복제할 DOM 요소
 * @returns {Element} 복제된 DOM 요소
 */
function _cloneElement(element) {
  if (!element) return null;
  return element.cloneNode(true);
}

/**
 * SVG 아이콘 요소 생성 - 캐싱 기능 적용
 * @param {number} iconDesign - ICON_DESIGN 상수
 * @returns {SVGElement} SVG 아이콘 요소
 */
export function createIconSvg(iconDesign) {
  // 숫자값이 아닌 경우 오류 처리
  if (typeof iconDesign !== 'number') {
    console.error(`[ERROR] 유효하지 않은 아이콘 타입 형식: ${iconDesign}, 숫자여야 합니다`);
    iconDesign = ICON_DESIGN.DEFAULT; // 폴백으로 DEFAULT 사용
  }
  
  // SVG_ICON_DATA에 해당 아이콘 타입이 없으면 오류 발생
  if (!SVG_ICON_DATA[iconDesign]) {
    const iconName = ICON_DESIGN_NAMES[iconDesign] || '알 수 없음';
    console.error(`[ERROR] 지원되지 않는 아이콘 타입: ${iconDesign} (${iconName})`);
    iconDesign = ICON_DESIGN.DEFAULT; // 폴백으로 DEFAULT 사용
  }
  
  // 캐시에 있는 경우 복제하여 반환
  if (_iconCache[iconDesign]) {
    return _cloneElement(_iconCache[iconDesign]);
  }
  
  // 캐시에 없는 경우 새로 생성
  const parser = new DOMParser();
  const iconSvgDoc = parser.parseFromString(SVG_ICON_DATA[iconDesign], "image/svg+xml");
  const iconSvgElement = iconSvgDoc.documentElement;
  
  // 아이콘 크기 설정
  const iconSize = ICON_SIZES[iconDesign];
  iconSvgElement.setAttribute('width', iconSize.size);
  iconSvgElement.setAttribute('height', iconSize.size);
  
  // 데이터 속성 추가
  iconSvgElement.dataset.iconDesign = iconDesign;
  if (ICON_DESIGN_NAMES[iconDesign]) {
    iconSvgElement.dataset.iconName = ICON_DESIGN_NAMES[iconDesign];
  }
  
  // 생성된 아이콘 요소 캐싱
  _iconCache[iconDesign] = iconSvgElement;
  
  // 복제본 반환
  return _cloneElement(iconSvgElement);
}

/**
 * 아이콘 생성 함수 - 간편한 접근을 위한 별칭
 * @param {number} iconDesign - ICON_DESIGN 상수 또는 해당 숫자값 (예: ICON_DESIGN.RESTAURANT 또는 1)
 * @returns {SVGElement} 아이콘 SVG 요소
 */
export function createIconByiconDesign(iconDesign) {
  return createIconSvg(iconDesign);
}

/**
 * 아이콘 복제 함수 - 간편한 접근을 위한 별칭
 * @param {number} iconDesign - ICON_DESIGN 상수
 * @returns {SVGElement} 복제된 아이콘 요소
 */
export function cloneIcon(iconDesign) {
  return createIconSvg(iconDesign);
}

/**
 * 캐시 초기화 함수 - 메모리 관리 목적
 */
export function clearIconCache() {
  for (const key in _iconCache) {
    delete _iconCache[key];
  }
}

/**
 * 모든 아이콘 디자인을 배열로 리턴하는 함수
 * @returns {Array<{numberOfIconDesign: number, iconDiv: SVGElement}>} 아이콘 디자인 번호와 아이콘 SVG 요소의 배열
 */
export function getAllIconDesignsForIconSelector() {
  const iconDesigns = [];
  
  // ICON_DESIGN의 모든 상수를 순회
  for (const designKey in ICON_DESIGN) {
    const designNumber = ICON_DESIGN[designKey];
    const iconDiv = createIconSvg(designNumber);
    
    iconDesigns.push({
      numberOfIconDesign: designNumber,
      iconDiv: iconDiv
    });
  }
  
  return iconDesigns;
}

/**
 * 아이콘 디자인 이름(상수명)으로 숫자값을 가져오는 함수
 * @param {string} name - 아이콘 디자인 이름 (예: 'RESTAURANT')
 * @returns {number|null} 아이콘 디자인 숫자값, 없으면 null
 */
export function getIconDesignNumber(name) {
  if (!name || typeof name !== 'string') return null;
  return ICON_DESIGN[name] || null;
}

/**
 * 아이콘 디자인 숫자값으로 이름(상수명)을 가져오는 함수
 * @param {number} number - 아이콘 디자인 숫자값
 * @returns {string|null} 아이콘 디자인 이름, 없으면 null
 */
export function getIconDesignName(number) {
  if (typeof number !== 'number') return null;
  return ICON_DESIGN_NAMES[number] || null;
} 