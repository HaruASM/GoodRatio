/**
 * 구글 맵 인스턴스와 DIV를 전역으로 관리하는 모듈
 * 맵 인스턴스를 한 번만 생성하여 과금을 최소화하고, 페이지 간 이동에도 맵 상태를 유지합니다.
 */

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

// 전역 변수로 맵 인스턴스와 DIV 관리
let mapInstance = null;
let mapDiv = null;
let isInitialized = false;

/**
 * 맵 인스턴스 초기화 또는 기존 맵 재사용
 * @param {HTMLElement|string} container 맵을 표시할 컨테이너 요소 또는 ID
 * @param {Object} options 구글 맵 옵션
 * @returns {Promise<Object>} 구글 맵 인스턴스를 포함한 Promise
 */
const initializeMap = async (container, options = {}) => {
  // 컨테이너 요소 확인
  const containerElement = typeof container === 'string' 
    ? document.getElementById(container) 
    : container;
  
  if (!containerElement) {
    console.error('[GoogleMapManager] 컨테이너 요소를 찾을 수 없습니다.');
    return null;
  }

  // 구글 맵 API 로드 확인
  if (!window.google || !window.google.maps) {
    console.error('[GoogleMapManager] 구글 맵 API가 로드되지 않았습니다.');
    return null;
  }

  // 이미 맵 인스턴스가 있는 경우 재사용
  if (mapInstance) {
    console.log('[GoogleMapManager] 기존 맵 인스턴스 재사용');
    
    // 기존 맵 DIV를 새 컨테이너로 이동
    if (mapDiv && mapDiv.parentNode !== containerElement) {
      containerElement.appendChild(mapDiv);
      
      // 맵 리사이즈 이벤트 트리거하여 새 컨테이너에 맞게 조정
      window.google.maps.event.trigger(mapInstance, 'resize');
    }
    
    return mapInstance;
  }

  // 새 맵 인스턴스 생성
  console.log('[GoogleMapManager] 새 맵 인스턴스 생성');
  
  // 맵 DIV 생성
  mapDiv = document.createElement('div');
  mapDiv.style.width = '100%';
  mapDiv.style.height = '100%';
  containerElement.appendChild(mapDiv);
  
  // 기본 맵 옵션
  const defaultOptions = {
    center: { lat: 35.8714, lng: 128.6014 }, // 대구 기본 위치
    zoom: 15,
    mapTypeControl: false,
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: window.google.maps.ControlPosition.LEFT_BOTTOM
    },
    mapId: "2ab3209702dae9cb"
  };
  
  // 맵 인스턴스 생성 (여기서 과금 발생)
  mapInstance = new window.google.maps.Map(mapDiv, { ...defaultOptions, ...options });
  
  // 초기화 완료 플래그 설정
  isInitialized = true;
  
  // 비동기로 맵 로드 완료 기다리기
  return new Promise((resolve) => {
    window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      console.log('[GoogleMapManager] 맵 생성 완료');
      resolve(mapInstance);
    });
  });
};

/**
 * 현재 맵 인스턴스 반환
 * @returns {Object|null} 구글 맵 인스턴스 또는 null
 */
const getMapInstance = () => mapInstance;

/**
 * 맵 인스턴스 직접 설정 (이미 생성된 맵 인스턴스를 전역변수에 설정)
 * @param {Object} instance 설정할 구글 맵 인스턴스
 * @returns {Object} 설정된 맵 인스턴스
 */
const setMapInstance = (instance) => {
  if (!instance) {
    console.error('[GoogleMapManager] 유효하지 않은 맵 인스턴스를 설정하려고 합니다.');
    return null;
  }
  
  console.log('[GoogleMapManager] 맵 인스턴스 직접 설정');
  mapInstance = instance;
  isInitialized = true;
  return mapInstance;
};

/**
 * 맵 DIV 요소 반환
 * @returns {HTMLElement|null} 맵 DIV 요소 또는 null
 */
const getMapDiv = () => mapDiv;

/**
 * 맵 초기화 상태 확인
 * @returns {boolean} 초기화 완료 여부
 */
const isMapInitialized = () => isInitialized;

/**
 * 맵 옵션 업데이트
 * @param {Object} options 업데이트할 맵 옵션
 */
const updateMapOptions = (options) => {
  if (!mapInstance) {
    console.error('[GoogleMapManager] 맵 인스턴스가 초기화되지 않았습니다.');
    return;
  }
  
  mapInstance.setOptions(options);
};

/**
 * 구글 맵 API 스크립트 로드
 * @returns {Promise<boolean>} 로드 성공 여부
 */
const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    // 이미 구글 맵이 로드되어 있는지 확인
    if (window.google && window.google.maps) {
      console.log('[GoogleMapManager] 구글 맵 API가 이미 로드되어 있음');
      resolve(true);
      return;
    }

    // 이미 스크립트가 로드되었는지 확인
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      console.log('[GoogleMapManager] 구글 맵 스크립트가 이미 로드되어 있음');
      
      // 스크립트가 로드되었지만 window.google이 아직 없는 경우 대기
      const checkGoogleInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleInterval);
          console.log('[GoogleMapManager] 구글 맵 API 로드 확인');
          resolve(true);
        }
      }, 100);
      
      // 시간 초과 처리
      setTimeout(() => {
        clearInterval(checkGoogleInterval);
        reject(new Error('구글 맵 API 로드 시간 초과'));
      }, 10000);
      
      return;
    }

    console.log('[GoogleMapManager] 구글 맵 스크립트 로드 시작');
    const googleMapScript = document.createElement('script');
    googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing,marker&loading=async&callback=initMap`;
    googleMapScript.async = true;
    googleMapScript.defer = true;
    
    // 콜백 함수 정의
    window.initMap = () => {
      console.log('[GoogleMapManager] 구글 맵 API 로드 완료 (callback)');
      resolve(true);
    };
    
    // 오류 처리
    googleMapScript.onerror = () => {
      reject(new Error('구글 맵 스크립트 로드 오류'));
    };
    
    document.head.appendChild(googleMapScript);
  });
};

// 페이지 이동시 사용하지 않음(특정 상황 사용예정, 로그아웃 등) 
const clearMap = () => {
  if (mapInstance) {
    // 모든 이벤트 리스너 제거
    google.maps.event.clearInstanceListeners(mapInstance);
    
    // mapDiv가 DOM에서 완전히 제거되도록 처리
    if (mapDiv && mapDiv.parentNode) {
      console.log('[GoogleMapManager] 맵 DIV를 DOM에서 제거');
      mapDiv.parentNode.removeChild(mapDiv);
    }
    
    // 참조 초기화
    mapInstance = null;
    mapDiv = null;
    isInitialized = false;
    
    console.log('[GoogleMapManager] 맵 인스턴스 완전 정리 완료');
  }
};

export {
  initializeMap,
  getMapInstance,
  setMapInstance,
  getMapDiv,
  isMapInitialized,
  updateMapOptions,
  loadGoogleMapsScript,
  clearMap
};
