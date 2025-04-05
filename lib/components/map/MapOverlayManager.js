/**
 * Google Map 오버레이 관리자
 * 
 * ## 데이터 구조
 * 
 * 오버레이 객체는 중첩된 Map 구조로 관리됩니다:
 * 
 * this._overlayLayersMapDB: Map
 * ├── "한국": Map (국가)
 * │   ├── "반월당": Map (섹션)
 * │   │   ├── "SHOP": Map (카테고리)
 * │   │   │   ├── "SHOP_MARKER": Map (오버레이 타입)
 * │   │   │   │   ├── "shop_id_1": google.maps.Marker (마커 객체)
 * │   │   │   │   └── "shop_id_2": google.maps.Marker
 * │   │   │   │
 * │   │   │   └── "SHOP_POLYGON": Map (오버레이 타입)
 * │   │   │       ├── "shop_id_1": google.maps.Polygon (폴리곤 객체)
 * │   │   │       └── "shop_id_2": google.maps.Polygon
 * │   │   │
 * │   │   ├── "LANDMARK": Map (카테고리)
 * │   │   │   ├── "landmark_1": Map
 * │   │   │   └── "landmark_2": Map
 * │   │   │
 * │   │   └── "infoWindow": Map (인포윈도우 저장소)
 * │   │       ├── "shop_id_1": google.maps.InfoWindow
 * │   │       └── "shop_id_2": google.maps.InfoWindow
 * │   │
 * │   └── "부산": Map (다른 섹션)
 * │       └── ...
 * │
 * └── "필리핀": Map (다른 국가)
 *     └── ...
 * 
 * ## 데이터 접근 규칙
 * 
 * 1. 항상 국가 -> 섹션 -> 카테고리 -> 타입 순서로 접근
 * 2. 중간 계층이 없으면 생성 후 접근
 * 3. 각 계층에서 항상 Map.has()로 확인 후 Map.get() 사용
 */

/**
 * 맵 오버레이 관리를 위한 싱글톤 객체
 * 섹션 이름별로 상점 오버레이 객체들을 캐싱하고 ID로 조회합니다.
 * mapUtils.js의 기능도 포함합니다.
 */

// 오버레이 서비스 import
import OverlayService from './OverlayService';

/**
 * 레이어 관련 상수 정의
 * 명확한 참조를 위해 사용됨
 */
const LAYER_CONSTANTS = {
  // 국가
  COUNTRY: {
    KOREA: '한국',
    PHILIPPINES: '필리핀',
    VIETNAM: '베트남'
  },
  
  // 카테고리
  CATEGORY: {
    SHOP: 'SHOP',
    LANDMARK: 'LANDMARK',
    INFO_WINDOW: 'infoWindow'
  },
  
  // 오버레이 타입
  TYPE: {
    MARKER: 'SHOP_MARKER',
    POLYGON: 'SHOP_POLYGON'
  }
};

/**
 * 오버레이 레이어 정의
 * 줌 레벨에 따른 가시성 설정 포함
 */
const OVERLAY_LAYERS = {
  SHOP_MARKER: {
    NAME: 'SHOP_MARKER',
    MIN_ZOOM_LEVEL: 12,
    MAX_ZOOM_LEVEL: 22
  },
  SHOP_POLYGON: {
    NAME: 'SHOP_POLYGON',
    MIN_ZOOM_LEVEL: 15,  // 기존 17에서 15로 변경함
    MAX_ZOOM_LEVEL: 22
  },
  LANDMARK: {
    NAME: 'LANDMARK',
    MIN_ZOOM_LEVEL: 13,
    MAX_ZOOM_LEVEL: 22
  }
};

// 모듈 스코프의 private 변수 (클로저를 통해 보호됨)
const protoOverlayForShop = {
  marker: null,
  polygon: null,
  infoWindow: null,
};

let _isEventListenersAttached = false;
// 현재 표시 중인 인포윈도우 정보 저장 (이제 ID만 저장)
let _infoWindowforSingleton = null; 
let _currentActiveSection = null; // 현재 활성화된 섹션 //TODO 이부분이 index로 전송되는지 확인 

/**
 * 구글 맵 줌 변경 이벤트 핸들러 (모듈 스코프)
 * MapOverlayManager에서 사용하지만 외부에 노출되지 않음
 */
function _handleZoomChanged() {
  // 맵 인스턴스를 OverlayService에서 가져오기
  const mapInstance = OverlayService.getMapInstance();
  if (!mapInstance) return;
  
  // ZoomManager를 통해 줌 이벤트 처리
  MapOverlayManager.ZoomManager.handleZoomChanged();
}

/**
 * 오버레이 가시성 상태 관리자
 */
class OverlayVisibleStateManager {
  constructor() {
    this._states = new Map();
    this._observers = new Map();
    this._layerCallbacks = new Map();
  }

  setState(layerName, isVisible, currentState) {
    // 이전 상태와 다른 경우에만 상태 변경 및 알림
    const prevState = this.getState(layerName);
    
    if (prevState !== isVisible) {
      this._states.set(layerName, { isVisible });
      
      //AT 레이어별 콜백 실행부분 
      if (this._layerCallbacks.has(layerName)) {
        this._layerCallbacks.get(layerName).forEach(callback => {
          callback(isVisible, currentState);
        });
      }
      
      // 일반 옵저버 알림
      this._notifyObservers(layerName);
    }
  }

  getState(layerName) {
    return this._states.get(layerName)?.isVisible ?? false;
  }

  // 일반 옵저버 등록 - 모든 레이어 변경시 호출됨
  addObserver(callback) {
    this._observers.set(callback, callback);
  }

  // 레이어별 콜백 등록
  registerLayerCallback(layerName, callback) {
    if (!this._layerCallbacks.has(layerName)) {
      this._layerCallbacks.set(layerName, new Set());
    }
    this._layerCallbacks.get(layerName).add(callback);
  }

  // 옵저버 알림
  _notifyObservers(layerName) {
    this._observers.forEach(callback => callback(layerName));
  }

  // 특정 레이어의 모든 콜백 실행
  executeLayerCallbacks(layerName, currentState) {
    if (this._layerCallbacks.has(layerName)) {
      const isVisible = this.getState(layerName);
      this._layerCallbacks.get(layerName).forEach(callback => {
        callback(isVisible, currentState);
      });
    }
  }
}

const MapOverlayManager = {
  // 레이어 관리 - 활성화된 섹션만 지도에 표시하기 위한 자료구조
  _layers: {
    activeSection: null,
    visibleSections: new Set()
  },
  
  // 마커 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  markerOptions: {},
  
  // 폴리곤 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  polygonOptions: {},
  
  // Redux 스토어 참조
  _reduxStore: null,
  
  // 오버레이 가시성 상태 관리자
  _overlayVisibleStateManager: new OverlayVisibleStateManager(),
  
  // 오버레이 객체를 저장하는 Map구조
  _overlayLayersMapDB: new Map(),
  
  // 국가명을 상수로 정의 (향후 국가 관리 확장 시 수정)
  _DEFAULT_COUNTRY: LAYER_CONSTANTS.COUNTRY.KOREA,
  
  /**
   * 줌 이벤트 관리를 위한 내부 객체
   */
  ZoomManager: {
    /**
     * 줌 변경 이벤트 핸들러
     * 현재 줌 레벨에 따라 레이어 가시성 업데이트
     */
    handleZoomChanged: function() {
      const mapInstance = OverlayService.getMapInstance();
      if (!mapInstance) return;
      
      // 현재 줌 레벨 가져오기
      const currentZoom = mapInstance.getZoom();
      
      // Redux 상태 업데이트
      MapOverlayManager._dispatchZoomChange(currentZoom);
      
      // 각 레이어 가시성 업데이트
      Object.values(OVERLAY_LAYERS).forEach(layer => {
        const isVisible = 
          currentZoom >= layer.MIN_ZOOM_LEVEL && 
          currentZoom <= layer.MAX_ZOOM_LEVEL;
        
        // 가시성 상태 업데이트
        MapOverlayManager._overlayVisibleStateManager.setState(layer.NAME, isVisible, currentZoom);
      });
  },
  
  /**
     * 지정된 줌 레벨에서 레이어가 보이는지 확인
     * @param {string} layerName - 레이어 이름
     * @param {number} zoomLevel - 줌 레벨
     * @returns {boolean} 보이는지 여부
     */
    isLayerVisibleAtZoom: function(layerName, zoomLevel) {
      const layer = Object.values(OVERLAY_LAYERS).find(l => l.NAME === layerName);
      if (!layer) return false;
      
      return zoomLevel >= layer.MIN_ZOOM_LEVEL && zoomLevel <= layer.MAX_ZOOM_LEVEL;
  },
  
  /**
     * 레이어의 최소/최대 줌 레벨 설정
     * @param {string} layerName - 레이어 이름
     * @param {number} minZoom - 최소 줌 레벨
     * @param {number} maxZoom - 최대 줌 레벨
     * @returns {boolean} 설정 성공 여부
     */
    setLayerZoomRange: function(layerName, minZoom, maxZoom) {
      const layer = Object.values(OVERLAY_LAYERS).find(l => l.NAME === layerName);
      if (!layer) return false;
      
      layer.MIN_ZOOM_LEVEL = minZoom;
      layer.MAX_ZOOM_LEVEL = maxZoom;
      
      // 줌 이벤트 다시 처리하여 가시성 업데이트
      this.handleZoomChanged();
      
      return true;
    }
  },
  
  /**
   * MapOverlayManager 초기화
   * @param {google.maps.Map} mapInstance - 구글 맵 인스턴스
   * @param {Object} options - 초기화 옵션
   * @returns {boolean} 초기화 성공 여부
   */
  initialize: function(mapInstance, options = {}) {
    if (!mapInstance || !window.google || !window.google.maps) {
      console.error('[MapOverlayManager] 유효하지 않은 맵 인스턴스입니다.');
      return false;
    }
    
    // OverlayService에 맵 인스턴스 설정
    OverlayService.initialize(mapInstance);
    
    // 이벤트 리스너 등록
    this.attachMapListeners();
    
    // 오버레이 가시성 상태 관리자 생성
    this._overlayVisibleStateManager = new OverlayVisibleStateManager();
    
    // 오버레이 레이어 맵 생성 (중첩 맵 구조)
    this._overlayLayersMapDB = new Map();
    
    // 기본 국가 설정
    this._DEFAULT_COUNTRY = LAYER_CONSTANTS.COUNTRY.KOREA;
    
    // 마커 옵션 설정
    this.markerOptions = {
      background: "#FBBC04",
      scale: 1
    };
    
    // 폴리곤 옵션 설정
    this.polygonOptions = {
      strokeColor: '#FF0000', 
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000', 
      fillOpacity: 0.35
    };
    
    // 리덕스 스토어 설정 (있는 경우)
    if (options.store) {
      this.setReduxStore(options.store);
    }
    
    // 초기 레이어 구조 설정
    const initialStructure = {
      "한국": {
        sections: ["반월당", "중앙로", "동성로", "범어", "수성못", "산격", "칠곡"]
      },
      "필리핀": {
        sections: ["세부", "마닐라", "보라카이", "팔라완"]
      },
      "베트남": {
        sections: ["호치민", "다낭", "나트랑", "하노이"]
      }
    };
    
    // 레이어 초기화 및 테스트용 콜백 등록
    Object.values(OVERLAY_LAYERS).forEach(layer => {
      // 초기 상태 설정 (모두 비가시성으로 시작)
      this._overlayVisibleStateManager.setState(layer.NAME, false);
      
      // 테스트용 레이어별 콜백 등록
      this._overlayVisibleStateManager.registerLayerCallback(layer.NAME, (isVisible, zoomLevel) => {
        console.log(`[테스트] ${layer.NAME} 레이어 가시성 변경: ${isVisible ? 'ON' : 'OFF'}, 줌 레벨: ${zoomLevel}`);
      });
      
      // 레이어별 특화된 가시성 콜백 등록
      if (layer.NAME === OVERLAY_LAYERS.SHOP_MARKER.NAME) {
        this._overlayVisibleStateManager.registerLayerCallback(layer.NAME, this._handleShopMarkerVisibilityChange.bind(this));
      } else if (layer.NAME === OVERLAY_LAYERS.SHOP_POLYGON.NAME) {
        this._overlayVisibleStateManager.registerLayerCallback(layer.NAME, this._handleShopPolygonVisibilityChange.bind(this));
      } else if (layer.NAME === OVERLAY_LAYERS.LANDMARK.NAME) {
        this._overlayVisibleStateManager.registerLayerCallback(layer.NAME, this._handleLandmarkVisibilityChange.bind(this));
      }
    });
      
    // 테스트용 일반 옵저버 등록
    this._overlayVisibleStateManager.addObserver((layerName) => {
      console.log(`[테스트] 옵저버 알림: ${layerName} 레이어 상태 변경됨`);
    });
    
    // 레이어 구조 초기화
    this._initializeLayerStructure(initialStructure);
    
    // 초기 줌 레벨에 따라 레이어 가시성 업데이트
    this.ZoomManager.handleZoomChanged();
    
    // 맵의 현재 중심 좌표 가져오기
    const center = mapInstance.getCenter();
    if (center) {
      // 샘플 이미지 오버레이 생성 (현재 위치)
      const landmarkPosition = {
        lat: center.lat(),
        lng: center.lng()
      };
      
      // 무료 CDN 풍경 사진 URL (Unsplash에서 무료로 제공)
      const landscapeImageUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80";
      
      // 이미지 오버레이 생성 (직접 OverlayService 사용)
      OverlayService.createImageOverlay(landmarkPosition, landscapeImageUrl, 150, 100, {
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        border: '2px solid white',
        zIndex: 10
      });
      
      console.log('[MapOverlayManager] 샘플 이미지 오버레이가 생성되었습니다.');
      
      // 샘플 랜드마크 생성 (중심 주변 4개)
      const sampleLandmarks = [
        {
          id: 'landmark-1',
          title: '랜드마크 1',
          coordinates: {
            lat: center.lat() + 0.002,
            lng: center.lng() + 0.002
          }
        },
        {
          id: 'landmark-2',
          title: '랜드마크 2',
          coordinates: {
            lat: center.lat() + 0.002,
            lng: center.lng() - 0.002
          }
        },
        {
          id: 'landmark-3',
          title: '랜드마크 3',
          coordinates: {
            lat: center.lat() - 0.002,
            lng: center.lng() + 0.002
          }
        },
        {
          id: 'landmark-4',
          title: '랜드마크 4',
          coordinates: {
            lat: center.lat() - 0.002,
            lng: center.lng() - 0.002
          }
        }
      ];
      
      // 랜드마크 등록 (반월당 섹션에)
      const registeredCount = this.registerLandmarks('반월당', sampleLandmarks);
      console.log(`[MapOverlayManager] 샘플 랜드마크 ${registeredCount}개가 등록되었습니다.`);
    }
    
    return true;
  },
  
  /**
   * 맵 인스턴스 설정 및 이벤트 리스너 등록
   * @param {google.maps.Map} mapInstance - 구글 맵 인스턴스
   * @returns {boolean} 설정 성공 여부
   */
  setMap: function(mapInstance) {
    if (!mapInstance || !window.google || !window.google.maps) {
      console.error('유효하지 않은 맵 인스턴스입니다.');
      return false;
    }
    
    // 기존 이벤트 리스너 제거
    this.detachMapListeners();
    
    // OverlayService에 맵 인스턴스 설정
    OverlayService.initialize(mapInstance);
    
    // 맵 이벤트 리스너 등록
    this.attachMapListeners();
    
    return true;
  },
  
  /**
   * 맵 인스턴스 가져오기
   * @returns {google.maps.Map|null} 현재 설정된 맵 인스턴스
   */
  getMap: function() {
    return OverlayService.getMapInstance();
  },
  
  /**
   * 맵 이벤트 리스너 등록
   * @private
   */
  attachMapListeners: function() {
    if (_isEventListenersAttached) return;
    
    const mapInstance = OverlayService.getMapInstance();
    if (!mapInstance) return;
    
    // 줌 변경 이벤트 리스너 등록
    window.google.maps.event.addListener(mapInstance, 'zoom_changed', _handleZoomChanged);
    
    // 맵 클릭 이벤트 리스너 등록 - 인포윈도우 닫기 처리
    window.google.maps.event.addListener(mapInstance, 'click', () => {
      try {
        //TODO Redux 액션 사용하여 인포윈도우 닫기는 통지. (우측사이드바 드로잉 매니저 때문인듯)
        if (this._reduxStore) {
          const { closeInfoWindow } = require('../../store/slices/mapEventSlice');
          this._reduxStore.dispatch(closeInfoWindow());
        }
        
        // OverlayService를 통해 인포윈도우 닫기
        OverlayService.closeInfoWindow();
        
          // 인포윈도우 참조 정보 초기화
          _infoWindowforSingleton = null;
      } catch (error) {
        console.error('[MapOverlayManager] 맵 클릭 이벤트 처리 중 오류 발생:', error);
      }
    });
    
    _isEventListenersAttached = true;
  },
  
  /**
   * 맵 이벤트 리스너 제거
   * @private
   */
  detachMapListeners: function() {
    if (!_isEventListenersAttached) return;
    
    const mapInstance = OverlayService.getMapInstance();
    if (!mapInstance) return;
    
    // 이벤트 리스너 제거
    window.google.maps.event.clearListeners(mapInstance, 'zoom_changed');
    window.google.maps.event.clearListeners(mapInstance, 'click');
    
    _isEventListenersAttached = false;
  },
  
  /**
   * 좌표 객체를 구글 맵 LatLng 객체로 변환 (객체 형태 좌표만 허용)
   * 외부 호환성을 위해 유지됨 - 실제 구현은 OverlayService에 위임
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    // OverlayService를 사용하여 좌표 변환
    return OverlayService.parseCoordinates(coordinates);
  },
  
  /**
   * 싱글톤 인포윈도우 열기 - 마커 또는 폴리곤 정보 표시
   * @param {string} sectionName - 섹션 이름
   * @param {string} shopId - 상점 ID
   * @returns {boolean} 성공 여부
   */
  openSingletonInfoWindow: function(sectionName, shopId) {
    if (!sectionName || !shopId) {
      console.error('[MapOverlayManager] 인포윈도우 열기 실패: 섹션 이름 또는 상점 ID가 제공되지 않았습니다');
      return false;
    }
    
    // 인포윈도우 중복 열기 방지
    if (_infoWindowforSingleton === shopId) {
      // 이미 같은 상점의 인포윈도우가 열려있음
      return true;
    }
    
    try {
      // 1. 해당 섹션에서 상점 ID로 마커 또는 폴리곤 찾기
      let overlay = null;
      
      // 먼저 마커 맵에서 검색
      const markerMap = this.findMapLayer(
        this._DEFAULT_COUNTRY, 
        sectionName, 
        LAYER_CONSTANTS.CATEGORY.SHOP, 
        LAYER_CONSTANTS.TYPE.MARKER
      );
      
      if (markerMap && markerMap.has(shopId)) {
        overlay = markerMap.get(shopId);
      } else {
        // 마커가 없는 경우, 폴리곤 맵에서 검색
        const polygonMap = this.findMapLayer(
          this._DEFAULT_COUNTRY, 
          sectionName, 
          LAYER_CONSTANTS.CATEGORY.SHOP, 
          LAYER_CONSTANTS.TYPE.POLYGON
        );
        
        if (polygonMap && polygonMap.has(shopId)) {
          overlay = polygonMap.get(shopId);
        }
      }
      
      if (!overlay) {
        console.error(`[MapOverlayManager] 인포윈도우 열기 실패: ${sectionName} 섹션에서 ID ${shopId}인 오버레이를 찾을 수 없습니다`);
        return false;
      }
      
      // 2. 간단한 상점 데이터로 인포윈도우 콘텐츠 생성
      // 기본 정보로 인포윈도우 생성
      const shopItem = {
        id: shopId,
        storeName: shopId, // ID를 상점명으로 사용
        storeStyle: '기본', // 기본 스타일
        address: sectionName // 섹션 이름을 주소로 사용
      };
      
      // HTML 콘텐츠 생성
      const content = `
        <div style="padding: 6px; max-width: 150px; background-color: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          <strong style="font-size: 14px;">${shopItem.storeName}</strong>
          ${shopItem.storeStyle ? `<div style="font-size: 12px;">${shopItem.storeStyle}</div>` : ''}
          ${shopItem.address ? `<div style="font-size: 12px; color: #666;">${shopItem.address}</div>` : ''}
        </div>
      `;
      
      // 3. OverlayService를 통해 인포윈도우 열기
      const infoWindow = OverlayService.openInfoWindow(overlay, content, shopId, {
        maxWidth: 200,
        disableAutoPan: true,
        closeOnClick: false
      });
      
      if (!infoWindow) {
        return false;
      }
      
      // 4. 인포윈도우 맵에 저장
      const infoWindowMap = this.getOrCreateMapLayer(
        this._DEFAULT_COUNTRY, 
        sectionName, 
        LAYER_CONSTANTS.CATEGORY.INFO_WINDOW
      );
      
      // 기존에 같은 상점 ID에 대한 인포윈도우가 있으면 제거
      if (infoWindowMap.has(shopId)) {
        const oldInfoWindow = infoWindowMap.get(shopId);
        if (oldInfoWindow) {
          OverlayService.cleanupOverlay(oldInfoWindow);
        }
      }
      
      // 새 인포윈도우 등록
      infoWindowMap.set(shopId, infoWindow);
      
      // 싱글톤 인포윈도우 ID 업데이트
      _infoWindowforSingleton = shopId;
      _currentActiveSection = sectionName;
      
      return true;
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 열기 중 오류 발생:', error);
      return false;
    }
  },
  
  /**
   * 인포윈도우 닫기
   * 현재 열려있는 싱글톤 인포윈도우를 닫습니다.
   */
  closeSingletonInfoWindow: function() {
    if (!_infoWindowforSingleton || !_currentActiveSection) {
      return; // 열린 인포윈도우가 없으면 아무 것도 하지 않음
    }
    
    // 인포윈도우 맵 찾기
    const infoWindowMap = this.findMapLayer(
      this._DEFAULT_COUNTRY, 
      _currentActiveSection, 
      LAYER_CONSTANTS.CATEGORY.INFO_WINDOW
    );
    
    // 맵과 인포윈도우 존재 확인 후 닫기
    if (infoWindowMap && infoWindowMap.has(_infoWindowforSingleton)) {
      const infoWindow = infoWindowMap.get(_infoWindowforSingleton);
      if (infoWindow) {
        OverlayService.cleanupOverlay(infoWindow);
        infoWindowMap.delete(_infoWindowforSingleton);
      }
    }
    
    // OverlayService의 인포윈도우도 닫기
    OverlayService.closeInfoWindow();
      
      // 인포윈도우 참조 정보 초기화
      _infoWindowforSingleton = null;
  },
  
  /**
   * Redux 스토어 설정
   * @param {Object} store - Redux 스토어
   * @returns {boolean} 성공 여부
   */
  setReduxStore: function(store) {
    if (!store || typeof store.dispatch !== 'function' || typeof store.getState !== 'function') {
      console.error('[MapOverlayManager] 유효하지 않은 Redux 스토어');
      return false;
    }
    
    this._reduxStore = store;
    return true;
  },
  
  /**
   * 지도 줌 변경 시 Redux 상태 업데이트
   * @private
   */
  _dispatchZoomChange: function(zoomLevel) {
    if (!this._reduxStore) return;
    
    try {
      // updateZoomLevel 액션 디스패치
      const { updateZoomLevel } = require('../../store/slices/mapEventSlice');
      this._reduxStore.dispatch(updateZoomLevel({ zoomLevel }));
    } catch (error) {
      console.error('[MapOverlayManager] 줌 레벨 업데이트 디스패치 중 오류:', error);
    }
  },
  
  /**
   * 특정 섹션의 오버레이 표시 변경하기
   * 이전 섹션의 오버레이를 숨기고 새 섹션의 오버레이를 표시함
   * @param {string} sectionNameforNow - 활성화할 섹션 이름
   * @returns {boolean} - 성공 여부
   */
  changeOverlaysOfCursection: function(sectionNameforNow) {
    const mapInstance = OverlayService.getMapInstance();
    if (!mapInstance) {
      console.error('[MapOverlayManager] 맵 인스턴스가 설정되지 않았습니다.');
      return false;
    }
    
    // 이전 활성 섹션의 오버레이 숨기기
    if (this._layers.activeSection && this._layers.activeSection !== sectionNameforNow) {
      const prevSectionName = this._layers.activeSection;
      
      // 이전 섹션의 마커 숨기기
      const prevMarkerMap = this.findMapLayer(
        this._DEFAULT_COUNTRY, 
        prevSectionName, 
        LAYER_CONSTANTS.CATEGORY.SHOP, 
        LAYER_CONSTANTS.TYPE.MARKER
      );
      if (prevMarkerMap) {
        prevMarkerMap.forEach((marker) => {
          if (marker) {
            OverlayService.setOverlayVisibility(marker, false);
          }
        });
      }
      
      // 이전 섹션의 폴리곤 숨기기
      const prevPolygonMap = this.findMapLayer(
        this._DEFAULT_COUNTRY, 
        prevSectionName, 
        LAYER_CONSTANTS.CATEGORY.SHOP, 
        LAYER_CONSTANTS.TYPE.POLYGON
      );
      if (prevPolygonMap) {
        prevPolygonMap.forEach((polygon) => {
          if (polygon) {
            OverlayService.setOverlayVisibility(polygon, false);
          }
        });
      }
    }
    
    // 새 섹션 활성화
    this._layers.activeSection = sectionNameforNow;
    this._layers.visibleSections.add(sectionNameforNow);
    
    // 현재 줌 레벨에 따른 가시성 상태 확인
    const isPolygonVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
    const isMarkerVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
    
    // 새 섹션의 마커 표시
    const markerMap = this.findMapLayer(
      this._DEFAULT_COUNTRY, 
      sectionNameforNow, 
      LAYER_CONSTANTS.CATEGORY.SHOP, 
      LAYER_CONSTANTS.TYPE.MARKER
    );
    if (markerMap) {
      markerMap.forEach((marker) => {
        if (marker) {
          // OverlayService 사용하여 마커 가시성 설정
          marker.map = mapInstance;
          OverlayService.setOverlayVisibility(marker, isMarkerVisible);
        }
      });
    }
    
    // 새 섹션의 폴리곤 표시
    const polygonMap = this.findMapLayer(
      this._DEFAULT_COUNTRY, 
      sectionNameforNow, 
      LAYER_CONSTANTS.CATEGORY.SHOP, 
      LAYER_CONSTANTS.TYPE.POLYGON
    );
    if (polygonMap) {
      polygonMap.forEach((polygon) => {
        if (polygon) {
          polygon.setMap(mapInstance);
          OverlayService.setOverlayVisibility(polygon, isPolygonVisible);
        }
      });
    }
    
    // 현재 활성 섹션 정보 저장
    _currentActiveSection = sectionNameforNow;
    
    return true;
  },
  
  /**
   * 레이어 구조 초기화
   * @param {Object} structure - 초기화할 구조 {country: {sections: [section1, section2, ...]}}
   * @private
   */
  _initializeLayerStructure: function(structure) {
    if (!structure) return;
    
    // 모든 국가 및 섹션 초기화
    Object.entries(structure).forEach(([country, data]) => {
      // 각 섹션 초기화
      data.sections.forEach(section => {
        // SHOP 카테고리 초기화 (마커 및 폴리곤 맵 생성)
        this.getOrCreateMapLayer(country, section, LAYER_CONSTANTS.CATEGORY.SHOP, LAYER_CONSTANTS.TYPE.MARKER);
        this.getOrCreateMapLayer(country, section, LAYER_CONSTANTS.CATEGORY.SHOP, LAYER_CONSTANTS.TYPE.POLYGON);
        
        // LANDMARK 카테고리 초기화 (이전에 누락되었을 수 있음)
        this.getOrCreateMapLayer(country, section, LAYER_CONSTANTS.CATEGORY.LANDMARK);
        
        // INFO_WINDOW 카테고리 초기화
        this.getOrCreateMapLayer(country, section, LAYER_CONSTANTS.CATEGORY.INFO_WINDOW);
      });
    });
    
    console.log('[MapOverlayManager] 레이어 구조 초기화 완료');
  },
  
  /**
   * 가시성 상태 변경 옵저버 등록
   */
  addVisibilityObserver: function(callback) {
    this._overlayVisibleStateManager.addObserver(callback);
  },
  
  /**
   * 레이어에 해당하는 모든 오버레이 객체 쿼리
   * @param {string} layerName - 레이어 이름 (e.g., 'SHOP_MARKER', 'SHOP_POLYGON')
   * @returns {Array} - 해당 레이어의 모든 오버레이 객체 배열
   * @private
   */
  _queryLayerOverlays: function(layerName) {
    const results = [];
    
    // 국가 Map 순회
    this._overlayLayersMapDB.forEach((countryMap) => {
      // 모든 섹션 Map 순회
      countryMap.forEach((sectionMap) => {
        if (layerName === OVERLAY_LAYERS.SHOP_MARKER.NAME) {
          // SHOP 카테고리 맵 확인
          const shopMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.SHOP);
          if (shopMap && shopMap.has(LAYER_CONSTANTS.TYPE.MARKER)) {
            const markerMap = shopMap.get(LAYER_CONSTANTS.TYPE.MARKER);
            markerMap.forEach((marker) => {
              if (marker) results.push(marker);
            });
          }
        } else if (layerName === OVERLAY_LAYERS.SHOP_POLYGON.NAME) {
          // SHOP 카테고리 맵 확인
          const shopMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.SHOP);
          if (shopMap && shopMap.has(LAYER_CONSTANTS.TYPE.POLYGON)) {
            const polygonMap = shopMap.get(LAYER_CONSTANTS.TYPE.POLYGON);
            polygonMap.forEach((polygon) => {
              if (polygon) results.push(polygon);
            });
          }
        } else if (layerName === OVERLAY_LAYERS.LANDMARK.NAME) {
          // LANDMARK 카테고리 맵 확인
          const landmarkMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.LANDMARK);
          if (landmarkMap) {
            landmarkMap.forEach((landmarkOverlays) => {
              landmarkOverlays.forEach((overlay) => {
                if (overlay && overlay.marker) results.push(overlay.marker);
              });
            });
          }
        }
      });
    });
    
    return results;
  },
  
  /**
   * 지정된 경로에 맞는 Map 객체 가져오기 (없으면 생성)
   * @param {string} country - 국가명
   * @param {string} section - 섹션명
   * @param {string} [category] - 카테고리명 (optional)
   * @param {string} [type] - 타입명 (optional)
   * @returns {Map} 해당 경로의 Map 객체
   */
  getOrCreateMapLayer: function(country, section, category = null, type = null) {
    // 1. 국가 맵 확인/생성
    if (!this._overlayLayersMapDB.has(country)) {
      this._overlayLayersMapDB.set(country, new Map());
    }
    const countryMap = this._overlayLayersMapDB.get(country);
    
    // 2. 섹션 맵 확인/생성
    if (!countryMap.has(section)) {
      countryMap.set(section, new Map());
    }
    const sectionMap = countryMap.get(section);
    
    // 카테고리 인자가 없으면 섹션 맵 반환
    if (category === null) {
      return sectionMap;
    }
    
    // 3. 카테고리 맵 확인/생성
    if (!sectionMap.has(category)) {
      sectionMap.set(category, new Map());
    }
    const categoryMap = sectionMap.get(category);
    
    // 타입 인자가 없으면 카테고리 맵 반환
    if (type === null) {
      return categoryMap;
    }
    
    // 4. 타입 맵 확인/생성
    if (!categoryMap.has(type)) {
      categoryMap.set(type, new Map());
    }
    
    // 최종 맵 반환
    return categoryMap.get(type);
  },
  
  /**
   * 지정된 경로에 맞는 Map 객체 찾기 (생성하지 않음)
   * @param {string} country - 국가명
   * @param {string} section - 섹션명
   * @param {string} [category] - 카테고리명 (optional)
   * @param {string} [type] - 타입명 (optional)
   * @returns {Map|null} 해당 경로의 Map 객체 또는 null
   */
  findMapLayer: function(country, section, category = null, type = null) {
    // 1. 국가 맵 확인
    if (!this._overlayLayersMapDB.has(country)) {
      return null;
    }
    const countryMap = this._overlayLayersMapDB.get(country);
    
    // 2. 섹션 맵 확인
    if (!countryMap.has(section)) {
      return null;
    }
    const sectionMap = countryMap.get(section);
    
    // 카테고리 인자가 없으면 섹션 맵 반환
    if (category === null) {
      return sectionMap;
    }
    
    // 3. 카테고리 맵 확인
    if (!sectionMap.has(category)) {
      return null;
    }
    const categoryMap = sectionMap.get(category);
    
    // 타입 인자가 없으면 카테고리 맵 반환
    if (type === null) {
      return categoryMap;
    }
    
    // 4. 타입 맵 확인
    if (!categoryMap.has(type)) {
      return null;
    }
    
    // 최종 맵 반환
    return categoryMap.get(type);
  },
  
  /**
   * 모든 오버레이 및 이벤트 리스너 정리
   * 컴포넌트 언마운트 시 호출되어야 함
   */
  cleanup: function() {
      // 1. 맵 이벤트 리스너 제거
      this.detachMapListeners();
      
    // 2. 인포윈도우 닫기 (OverlayService 사용)
    OverlayService.closeInfoWindow();
    
    // 3. 모든 오버레이 제거 - 계층별 순회하여 OverlayService를 통해 정리
    this._overlayLayersMapDB.forEach((countryMap) => {
      countryMap.forEach((sectionMap) => {
        // SHOP 카테고리 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.SHOP)) {
          const shopMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.SHOP);
          
          // SHOP_MARKER 정리
          if (shopMap.has(LAYER_CONSTANTS.TYPE.MARKER)) {
            const markerMap = shopMap.get(LAYER_CONSTANTS.TYPE.MARKER);
            // OverlayService를 사용하여 모든 마커 정리
            OverlayService.cleanupOverlays(markerMap);
          }
          
          // SHOP_POLYGON 정리
          if (shopMap.has(LAYER_CONSTANTS.TYPE.POLYGON)) {
            const polygonMap = shopMap.get(LAYER_CONSTANTS.TYPE.POLYGON);
            // OverlayService를 사용하여 모든 폴리곤 정리
            OverlayService.cleanupOverlays(polygonMap);
          }
          
          shopMap.clear();
        }
        
        // LANDMARK 카테고리 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.LANDMARK)) {
          const landmarkMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.LANDMARK);
          landmarkMap.forEach((landmarkOverlays) => {
            // OverlayService를 사용하여 모든 랜드마크 오버레이 정리
            OverlayService.cleanupOverlays(landmarkOverlays);
          });
          landmarkMap.clear();
        }
        
        // 인포윈도우 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.INFO_WINDOW)) {
          const infoWindowMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.INFO_WINDOW);
          // OverlayService를 사용하여 모든 인포윈도우 정리
          OverlayService.cleanupOverlays(infoWindowMap);
          infoWindowMap.clear();
        }
        
        sectionMap.clear();
      });
      countryMap.clear();
      });
      
    // 4. 맵 데이터 구조 초기화
    this._overlayLayersMapDB.clear();
      
      // 5. 레이어 상태 초기화
      this._layers.activeSection = null;
      this._layers.visibleSections.clear();
      
    // 6. 인포윈도우 참조 정보 초기화
    _infoWindowforSingleton = null;
    _currentActiveSection = null;
    
    // 7. 가시성 상태 관리자 초기화 (리셋)
    if (this._overlayVisibleStateManager) {
      // 상태는 유지하되, 콜백만 제거하는 방식
      Object.values(OVERLAY_LAYERS).forEach(layer => {
        this._overlayVisibleStateManager.setState(layer.NAME, false);
      });
    }
    
    console.log('[MapOverlayManager] 모든 오버레이 및 리소스 정리 완료');
  },
  
  /**
   * 아이템 목록으로 오버레이 객체(마커, 폴리곤, 인포윈도우) 일괄 생성 및 이벤트 바인딩
   * @param {string} sectionName - 오버레이를 등록할 섹션 이름
   * @param {Array<Object>} itemList - 상점 데이터 배열
   * @param {Object} callbacks - 콜백 함수 모음
   */
  registerOverlaysByItemlist: function(sectionName, itemList, callbacks) {
    if (!sectionName || !itemList || !Array.isArray(itemList)) {
      console.error('[MapOverlayManager] 오버레이 일괄 등록 실패: 잘못된 파라미터');
      return;
    }
    
    // 마커와 폴리곤 맵 가져오기
    const markerMap = this.getOrCreateMapLayer(
      this._DEFAULT_COUNTRY, 
      sectionName, 
      LAYER_CONSTANTS.CATEGORY.SHOP, 
      LAYER_CONSTANTS.TYPE.MARKER
    );
    
    const polygonMap = this.getOrCreateMapLayer(
      this._DEFAULT_COUNTRY, 
      sectionName, 
      LAYER_CONSTANTS.CATEGORY.SHOP, 
      LAYER_CONSTANTS.TYPE.POLYGON
    );
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected } = callbacks || {};
    
    // Redux 및 인포윈도우 관련 이벤트 핸들러
    const handleClick = (itemId) => {
      // Redux 액션 디스패치 (shopItemSelected)
      if (this._reduxStore) {
        try {
          const { shopItemSelected } = require('../../store/slices/mapEventSlice');
          this._reduxStore.dispatch(shopItemSelected({
            id: itemId,
            sectionName: sectionName
          }));
        } catch (error) {
          console.error('[MapOverlayManager] 상점 아이템 선택 액션 디스패치 중 오류:', error);
        }
      }
      
      // 외부 콜백 호출 (있는 경우)
      if (onItemSelect) {
        const item = itemList.find(item => item.id === itemId);
        if (item) onItemSelect(item);
      }
    };
    
    const handleMouseOver = (itemId) => {
      this.openSingletonInfoWindow(sectionName, itemId);
    };
    
    const handleMouseOut = () => {
      this.closeSingletonInfoWindow();
    };
    
    // 이벤트 옵션 정의
    const eventOptions = {
      // 마커 이벤트
      marker: {
        'gmp-click': (marker) => {
          if (marker.content && marker.content.dataset.itemId) {
            handleClick(marker.content.dataset.itemId);
          }
        },
        'gmp-pointerenter': (marker) => {
          if (marker.content && marker.content.dataset.itemId) {
            handleMouseOver(marker.content.dataset.itemId);
          }
        },
        'gmp-pointerleave': () => {
          handleMouseOut();
        }
      },
      // 폴리곤 이벤트
      polygon: {
        'click': (polygon) => {
          const itemId = polygon.get('itemId');
          if (itemId) handleClick(itemId);
        },
        'mouseover': (polygon) => {
          const itemId = polygon.get('itemId');
          if (itemId) handleMouseOver(itemId);
        },
        'mouseout': () => {
          handleMouseOut();
        }
      }
    };
    
    // 가시성 상태 가져오기
    const markerVisibility = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
    const polygonVisibility = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
    
    // 각 아이템에 대해 오버레이 생성 및 등록
    let registeredCount = 0;
    
    itemList.forEach(item => {
      if (!item || !item.id) {
        console.error('[MapOverlayManager] ID가 없는 상점 데이터는 처리할 수 없습니다');
            return;
          }
          
      const shopId = item.id;
      const storeName = item.storeName || '';
      
      // 마커 생성 및 등록
      if (item.pinCoordinates) {
        const marker = OverlayService.createMarker(item.pinCoordinates, storeName, this.markerOptions);
        
        if (marker) {
          // 마커에 ID와 섹션 이름 메타데이터 저장
          if (marker.content) {
            marker.content.dataset.itemId = shopId;
            marker.content.dataset.sectionName = sectionName;
          }
          
          // 이벤트 등록
          OverlayService.addEventListeners(marker, eventOptions.marker);
          
          // 가시성 설정
          OverlayService.setOverlayVisibility(marker, markerVisibility);
          
          // 마커를 맵에 저장
          markerMap.set(shopId, marker);
          registeredCount++;
        }
      }
      
      // 폴리곤 생성 및 등록
      if (item.path && Array.isArray(item.path) && item.path.length >= 3) {
        const polygon = OverlayService.createPolygon(item.path, this.polygonOptions);
        
        if (polygon) {
          // 폴리곤에 ID와 섹션 이름 메타데이터 저장
          polygon.set('itemId', shopId);
          polygon.set('sectionName', sectionName);
          
          // 이벤트 등록
          OverlayService.addEventListeners(polygon, eventOptions.polygon);
          
          // 가시성 설정
          OverlayService.setOverlayVisibility(polygon, polygonVisibility);
          
          // 폴리곤을 맵에 저장
          polygonMap.set(shopId, polygon);
          registeredCount++;
        }
      }
    });
    
    console.log(`[MapOverlayManager] ${sectionName} 섹션에 ${registeredCount}개 오버레이 등록 완료`);
  },
  
  /**
   * 상점 마커 레이어의 가시성 변경 처리
   * @param {boolean} isVisible - 가시성 상태
   * @private
   */
  _handleShopMarkerVisibilityChange: function(isVisible) {
    console.log(`[디버깅] 상점 마커 가시성 변경 처리: ${isVisible}`);
    
    // 상점 마커 오버레이 가져오기
    const markerOverlays = this._queryLayerOverlays(OVERLAY_LAYERS.SHOP_MARKER.NAME);
    console.log(`[디버깅] 상점 마커 오버레이 수: ${markerOverlays.length}`);
    
    // 각 마커에 가시성 설정
    markerOverlays.forEach((marker, index) => {
      if (marker && marker instanceof window.google.maps.marker.AdvancedMarkerElement) {
        console.log(`[디버깅] 마커 #${index + 1} 가시성 설정: ${isVisible}`);
        
        // 마커 가시성 설정 (AdvancedMarkerElement 전용 방식)
        marker.style.display = isVisible ? 'block' : 'none';
        
        console.log(`[디버깅] 마커 가시성 결과: display=${marker.style.display}`);
      }
    });
  },
  
  /**
   * 상점 폴리곤 레이어의 가시성 변경 처리
   * @param {boolean} isVisible - 가시성 상태
   * @private
   */
  _handleShopPolygonVisibilityChange: function(isVisible) {
    console.log(`[디버깅] 상점 폴리곤 가시성 변경 처리: ${isVisible}`);
    
    // 상점 폴리곤 오버레이 가져오기
    const polygonOverlays = this._queryLayerOverlays(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
    console.log(`[디버깅] 상점 폴리곤 오버레이 수: ${polygonOverlays.length}`);
    
    // 각 폴리곤에 가시성 설정
    polygonOverlays.forEach((polygon, index) => {
      if (polygon && polygon instanceof window.google.maps.Polygon) {
        console.log(`[디버깅] 폴리곤 #${index + 1} 가시성 설정: ${isVisible}`);
        
        // 폴리곤 가시성 설정 (Polygon 전용 방식)
        polygon.setVisible(isVisible);
        
        console.log(`[디버깅] 폴리곤 가시성 결과: visible=${polygon.getVisible()}`);
      }
    });
  },
  
  /**
   * 랜드마크 레이어의 가시성 변경 처리
   * @param {boolean} isVisible - 가시성 상태
   * @private
   */
  _handleLandmarkVisibilityChange: function(isVisible) {
    console.log(`[디버깅] 랜드마크 가시성 변경 처리: ${isVisible}`);
    
    // 랜드마크 오버레이 가져오기
    const landmarkOverlays = this._queryLayerOverlays(OVERLAY_LAYERS.LANDMARK.NAME);
    console.log(`[디버깅] 랜드마크 오버레이 수: ${landmarkOverlays.length}`);
    
    // 각 랜드마크에 가시성 설정
    landmarkOverlays.forEach((marker, index) => {
      if (marker && marker instanceof window.google.maps.marker.AdvancedMarkerElement) {
        console.log(`[디버깅] 랜드마크 #${index + 1} 가시성 설정: ${isVisible}`);
        
        // 랜드마크 마커 가시성 설정 (AdvancedMarkerElement 전용 방식)
        marker.style.display = isVisible ? 'block' : 'none';
        
        console.log(`[디버깅] 랜드마크 가시성 결과: display=${marker.style.display}`);
      }
    });
  },
  
  /**
   * 랜드마크 등록 함수
   * @param {string} sectionName - 섹션 이름
   * @param {Array} landmarkList - 랜드마크 목록
   * @returns {number} 등록된 랜드마크 수
   */
  registerLandmarks: function(sectionName, landmarkList) {
    console.log(`[디버깅] registerLandmarks 호출: 섹션=${sectionName}, 랜드마크 수=${landmarkList?.length || 0}`);
    
    if (!sectionName || !landmarkList || !Array.isArray(landmarkList)) {
      console.error('[MapOverlayManager] 랜드마크 등록 실패: 유효하지 않은 인자');
      return 0;
    }
    
    // 랜드마크 맵 가져오기 (없으면 생성)
    const landmarkMap = this.getOrCreateMapLayer(
      this._DEFAULT_COUNTRY, 
      sectionName, 
      LAYER_CONSTANTS.CATEGORY.LANDMARK
    );
    
    // 현재 레이어 가시성 상태 가져오기
    const landmarkVisibility = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.LANDMARK.NAME);
    console.log(`[디버깅] 현재 랜드마크 가시성 상태: ${landmarkVisibility}`);
    
    // 등록 카운터
    let registeredCount = 0;
    
    // 각 랜드마크 등록
    landmarkList.forEach(landmark => {
      if (!landmark || !landmark.id || !landmark.coordinates) {
        console.error('[MapOverlayManager] 유효하지 않은 랜드마크 데이터:', landmark);
        return;
      }
      
      const landmarkId = landmark.id;
      const landmarkTitle = landmark.title || '';
      const landmarkItems = new Map();
      
      // 랜드마크 마커 생성
      console.log(`[디버깅] 랜드마크 마커 생성: ID=${landmarkId}, 제목=${landmarkTitle}`);
      
      const markerOptions = {
        background: '#4285F4', // 랜드마크용 색상
        scale: 1.2,
        zIndex: 5  // 수정된 createMarker 함수는 zIndex를 적절히 처리함
      };
      
      const marker = OverlayService.createMarker(landmark.coordinates, landmarkTitle, markerOptions);
      
      if (marker) {
        // 가시성 설정
        marker.style.display = landmarkVisibility ? 'block' : 'none';
        
        // 마커를 랜드마크 항목에 추가
        landmarkItems.set('marker', marker);
        
        // 랜드마크 맵에 등록
        landmarkMap.set(landmarkId, landmarkItems);
        registeredCount++;
      }
    });
    
    console.log(`[디버깅] 랜드마크 등록 완료: 섹션=${sectionName}, 등록된 랜드마크=${registeredCount}개`);
    return registeredCount;
  },
};

export default MapOverlayManager; 
