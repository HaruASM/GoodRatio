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

let _mapInstance = null;
let _isEventListenersAttached = false;
// 현재 표시 중인 인포윈도우 정보 저장 (이제 ID만 저장)
let _infoWindowforSingleton = null; 
let _currentActiveSection = null; // 현재 활성화된 섹션 //TODO 이부분이 index로 전송되는지 확인 

/**
 * 구글 맵 줌 변경 이벤트 핸들러 (모듈 스코프)
 * MapOverlayManager에서 사용하지만 외부에 노출되지 않음
 */
function _handleZoomChanged() {
  if (!_mapInstance) return;
  
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
     * 현재 줌 레벨 가져오기
     * @returns {number} 현재 줌 레벨
     */
    getCurrentZoomLevel: function() {
      if (!_mapInstance) return 15;
      return _mapInstance.getZoom();
  },
  
  /**
     * 줌 변경 이벤트 처리
     * zoom변경 이벤트의 핸들러는 여기서 일임. 현재 1회 호출후 관련로직을 이 핸들러에서 완료. 
     * 현재 활성화된 섹션에 대한 관리는 overlayVisibleStateManager에서 담당
     */
    handleZoomChanged: function() {
      if (!_mapInstance) return;
      
      // 줌 레벨을 로컬 변수로만 사용
      const currentZoomLevel = this.getCurrentZoomLevel();
      
      console.log(`[ZoomManager] 현재 줌   ( ${currentZoomLevel} )`);
      //AT 각 레이어의 가시성 평가 및 상태 업데이트
      Object.values(OVERLAY_LAYERS).forEach(layer => {
        const shouldBeVisible = currentZoomLevel >= layer.MIN_ZOOM_LEVEL && 
                               currentZoomLevel <= layer.MAX_ZOOM_LEVEL;
        
        // 상태 관리자에 현재 줌 레벨 전달
        MapOverlayManager._overlayVisibleStateManager.setState(layer.NAME, shouldBeVisible, currentZoomLevel);
      });
    }
  },
  
  /**
   * MapOverlayManager 초기화
   * @param {google.maps.Map} mapInstance - 구글 맵 인스턴스
   * @returns {boolean} 초기화 성공 여부
   */
  initialize: function(mapInstance) {
    if (!window.google || !window.google.maps || !mapInstance) {
      console.error('[MapOverlayManager] !window.google || !window.google.maps || !mapInstance ');
      return false;
    }
    
    // 마커 옵션 초기화
    this.markerOptions = {
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#FF0000',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      },
      label: {
        text: 'S',
        color: '#FFFFFF',
        fontSize: '12px',
        fontWeight: 'bold',
      }
    };
    
    // 폴리곤 옵션 초기화
    this.polygonOptions = {
      strokeColor: '#FF0000', 
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000', 
      fillOpacity: 0.35,
    };
    
    // 맵 인스턴스는 확정 생성된 상태로 이 로직이 실행됨
    this.setMap(mapInstance);
    
    // 초기 레이어 구조 설정 //TODO 이후 서버에서 송부 받음 
    const initialStructure = {
      "한국": {
        sections: ["반월당", "부산", "서울"],
        landmarks: {
          "반월당": ["반월당네거리", "서문시장", "김광석거리", "교동"]
        }
      },
      "필리핀": {
        sections: ["앙헬", "세부"]
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
      
      // 통합 레이어 관리 콜백 등록 - 모든 오버레이를 한번에 처리
      this._overlayVisibleStateManager.registerLayerCallback(layer.NAME, (isVisible) => {
        // 레이어에 해당하는 모든 오버레이 가져오기
        const overlays = this._queryLayerOverlays(layer.NAME);
        // 모든 오버레이 가시성 설정
        overlays.forEach(overlay => {
          if (overlay) {
            if (overlay instanceof window.google.maps.marker.AdvancedMarkerElement) {
              // AdvancedMarkerElement의 경우 style.display 속성 사용
              overlay.style.display = isVisible ? 'block' : 'none';
            } else if (overlay instanceof window.google.maps.Polygon) {
              // 폴리곤의 경우 setVisible 메서드 사용
              overlay.setVisible(isVisible);
            }
          }
        });
      });
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
      
      // 이미지 오버레이 생성
      this.createImageOverlay(landmarkPosition, landscapeImageUrl, 150, 100);
      
      console.log('[MapOverlayManager] 샘플 이미지 오버레이가 생성되었습니다.');
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
    
    // 기존 맵이 있을 때만 이벤트 리스너 제거
    if (_mapInstance) {
    this.detachMapListeners();
    }
    
    // 모듈 스코프 private 변수에 맵 인스턴스 저장
    _mapInstance = mapInstance;
    
    // 맵 이벤트 리스너 등록
    this.attachMapListeners();
    
    return true;
  },
  
  /**
   * 맵 인스턴스 가져오기
   * @returns {google.maps.Map|null} 현재 설정된 맵 인스턴스
   */
  getMap: function() {
    return _mapInstance;
  },
  
  /**
   * 맵 이벤트 리스너 등록
   * @private
   */
  attachMapListeners: function() {
    if (!_mapInstance || _isEventListenersAttached) return;
    
    // 줌 변경 이벤트 리스너 등록. 줌 변경에 따른 이벤트 관리는 _handleZoomChanged에서 일임. 
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', _handleZoomChanged);
    
    // 맵 클릭 이벤트 리스너 등록 - 인포윈도우 닫기 처리
    window.google.maps.event.addListener(_mapInstance, 'click', () => {
      try {
        //TODO Redux 액션 사용하여 인포윈도우 닫기는 통지. (우측사이드바 드로잉 매니저 때문인듯)
        if (this._reduxStore) {
          const { closeInfoWindow } = require('../../store/slices/mapEventSlice');
          this._reduxStore.dispatch(closeInfoWindow());
          // 인포윈도우 참조 정보 초기화
          _infoWindowforSingleton = null;
        }
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
    if (!_mapInstance || !_isEventListenersAttached) return;
    
    // 이벤트 리스너 제거
    window.google.maps.event.clearListeners(_mapInstance, 'zoom_changed');
    window.google.maps.event.clearListeners(_mapInstance, 'click');
    
    _isEventListenersAttached = false;
  },
  
  /**
   * 마커 생성 함수
   * @param {Object|string} coordinates - 좌표 객체 또는 좌표 문자열
   * @param {string} title - 마커 제목
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createMarker: function(coordinates, title = "") {
    if (!coordinates) {
      console.error('[MapOverlayManager] 마커 생성 실패: 좌표가 제공되지 않았습니다');
      return null;
    }
    
    try {
      // 좌표 객체 파싱 - parseCoordinates 함수 사용
      const position = this.parseCoordinates(coordinates);
      
      if (!position) {
        console.error('[MapOverlayManager] 마커 생성 실패: 좌표 파싱 실패', coordinates);
        return null;
      }
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[MapOverlayManager] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // PinElement 사용 확인
      if (!window.google.maps.marker.PinElement) {
        console.error('[MapOverlayManager] PinElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
           
      // PinElement 생성
      const pin = new window.google.maps.marker.PinElement({
        background: "#FBBC04",
        scale: 1
      });
      
      // AdvancedMarkerElement 생성
      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: pin.element,
        title: title,
        map: _mapInstance // 맵 인스턴스 바로 설정
      });
      
      // 초기 가시성 설정
      const isVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
      advancedMarker.style.display = isVisible ? 'block' : 'none';
      
      return advancedMarker;
    } catch (error) {
      console.error('[MapOverlayManager] 마커 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 폴리곤 생성 함수
   * @param {Array} path - 폴리곤 좌표 배열 [{lat, lng}, ...]
   * @param {string} [fillColor] - 폴리곤 채우기 색상 (옵션)
   * @returns {google.maps.Polygon|null} 생성된 폴리곤 또는 null
   */
  createPolygon: function(path, fillColor) {
    if (!path || !Array.isArray(path) || path.length < 3) {
      console.error('[MapOverlayManager] 폴리곤 생성 실패: 유효하지 않은 경로 좌표', path);
      return null;
    }
    
    try {
      // 좌표 배열 파싱
      const parsedPath = path.map(coord => this.parseCoordinates(coord));
            
      // 폴리곤 옵션 설정
      const options = {
        paths: parsedPath,
        ...this.polygonOptions
      };
      
      // 선택적 채우기 색상 설정
      if (fillColor) {
        options.fillColor = fillColor;
      }
      
      // 폴리곤 생성 (맵에는 연결하지 않음) - 기존 방식 유지 (AdvancedMarker는 폴리곤에 적용 불가)
      const polygon = new window.google.maps.Polygon(options);
      
      // 초기 가시성 설정
      const isVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
      polygon.setVisible(isVisible);
      
      return polygon;
    } catch (error) {
      console.error('[MapOverlayManager] 폴리곤 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 아이템 목록으로 오버레이 객체(마커, 폴리곤, 인포윈도우) 일괄 생성 및 이벤트 바인딩
   * @param {string} sectionName - 오버레이를 등록할 섹션 이름
   * @param {Array<Object>} itemList - 상점 데이터 배열, 각 항목은 다음 형식을 따라야 함:
   *   {
   *     id: string,             // 필수: 상점 고유 ID
   *     storeName: string,      // 필수: 상점 이름
   *     pinCoordinates: {       // 선택: 마커 생성을 위한 좌표
   *       lat: number,
   *       lng: number
   *     },
   *     path: Array<{lat,lng}>  // 선택: 폴리곤 생성을 위한 경로 좌표 배열 (최소 3개 이상)
   *   }
   * @param {Object} callbacks - 콜백 함수 모음
   * @param {Function} [callbacks.onItemSelect] - 아이템 선택 시 호출할 콜백 함수
   * @param {Function} [callbacks.isItemSelected] - 아이템 선택 상태 확인 콜백 함수
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
    
    let registeredCount = 0;
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected } = callbacks || {};
    
    // 각 아이템에 대해 오버레이 생성 및 등록
    itemList.forEach(item => {
      if (!item || !item.id) {
        console.error('[MapOverlayManager] ID가 없는 상점 데이터는 처리할 수 없습니다');
        return; // ID가 없는 아이템은 건너뜀
      }
      
      const shopId = item.id;
      const storeName = item.storeName || '';
      
      // 마커 생성 (pinCoordinates 필요)
      if (item.pinCoordinates) {
        const marker = this.createMarker(item.pinCoordinates, storeName);
        
        if (marker) {
          // 마커에 ID와 섹션 이름 메타데이터 저장
          if (marker.content) {
            marker.content.dataset.itemId = shopId;
            marker.content.dataset.sectionName = sectionName;
          }
            
          // AdvancedMarkerElement 이벤트 등록
          // 클릭 이벤트 - 'gmp-click' 사용
          marker.addEventListener('gmp-click', () => {
            // Redux 액션 디스패치 (shopItemSelected)
            if (this._reduxStore) {
              try {
                const { shopItemSelected } = require('../../store/slices/mapEventSlice');
                this._reduxStore.dispatch(shopItemSelected({
                  id: shopId,
                  sectionName: sectionName
                }));
              } catch (error) {
                console.error('[MapOverlayManager] 상점 아이템 선택 액션 디스패치 중 오류:', error);
              }
            }
              
            // 외부 콜백 호출 (있는 경우)
            if (onItemSelect) onItemSelect(item);
          });
          
          // 마우스오버 이벤트 (AdvancedMarkerElement는 'gmp-pointerenter' 사용)
          marker.addEventListener('gmp-pointerenter', () => {
            // 인포윈도우 표시
            this.openSingletonInfoWindow(sectionName, shopId);
          });
          
          // 마우스아웃 이벤트 (AdvancedMarkerElement는 'gmp-pointerleave' 사용)
          marker.addEventListener('gmp-pointerleave', () => {
            // 인포윈도우 닫기
            this.closeSingletonInfoWindow();
          });
            
          // 마커를 맵에 저장
          markerMap.set(shopId, marker);
          registeredCount++;
        }
      }
      
      // 폴리곤 생성 (path 필요)
      if (item.path && Array.isArray(item.path) && item.path.length >= 3) {
        const polygon = this.createPolygon(item.path);
        
        if (polygon) {
          // 폴리곤에 ID와 섹션 이름 메타데이터 저장
          polygon.set('itemId', shopId);
          polygon.set('sectionName', sectionName);
            
            // 폴리곤 이벤트 등록
            // 클릭 이벤트
          polygon.addListener('click', () => {
            // Redux 액션 디스패치 (shopItemSelected)
            if (this._reduxStore) {
              try {
                const { shopItemSelected } = require('../../store/slices/mapEventSlice');
                this._reduxStore.dispatch(shopItemSelected({
                  id: shopId,
                  sectionName: sectionName
                }));
              } catch (error) {
                console.error('[MapOverlayManager] 상점 아이템 선택 액션 디스패치 중 오류:', error);
              }
            }
              
            // 외부 콜백 호출 (있는 경우)
            if (onItemSelect) onItemSelect(item);
          });
          
          // 마우스오버 이벤트
          polygon.addListener('mouseover', () => {
            // 인포윈도우 표시
            this.openSingletonInfoWindow(sectionName, shopId);
          });
          
          // 마우스아웃 이벤트
          polygon.addListener('mouseout', () => {
            // 인포윈도우 닫기
            this.closeSingletonInfoWindow();
          });
            
            // 폴리곤을 맵에 저장
          polygonMap.set(shopId, polygon);
          registeredCount++;
        }
      }
    });
    
    console.log(`[MapOverlayManager] ${sectionName} 섹션에 ${registeredCount}개 오버레이 등록 완료`);
  },
  
  /**
   * 좌표 객체를 구글 맵 LatLng 객체로 변환 (객체 형태 좌표만 허용)
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    if (!coordinates) {
      console.error('[MapOverlayManager] 좌표가 null 또는 undefined입니다');
      return null;
    }
    
    try {
      // 객체 형태인지 확인
      if (typeof coordinates !== 'object' || coordinates === null) {
        console.error('[MapOverlayManager] 좌표가 객체 형태가 아닙니다:', typeof coordinates);
        return null;
      }
      
      // lat, lng 속성이 있는지 확인
      if (!('lat' in coordinates) || !('lng' in coordinates)) {
        console.error('[MapOverlayManager] 좌표 객체에 lat 또는 lng 속성이 없습니다:', coordinates);
        return null;
      }
      
      // lat, lng 값 추출
      const lat = typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat;
      const lng = typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng;
      
      // 숫자로 변환
      const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat);
      const parsedLng = typeof lng === 'number' ? lng : parseFloat(lng);
      
      // 유효한 숫자인지 확인
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        console.error('[MapOverlayManager] 좌표 값이 유효한 숫자가 아닙니다:', lat, lng);
        return null;
      }
      
      // LatLng 객체 생성
      return new window.google.maps.LatLng(parsedLat, parsedLng);
    } catch (error) {
      console.error('[MapOverlayManager] 좌표 변환 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 맵 인포윈도우 생성 함수
   * @param {Object} itemData - 인포윈도우에 표시할 아이템 데이터
   * @param {string} itemData.id - 아이템 ID
   * @param {string} itemData.storeName - 상점 이름
   * @param {string} [itemData.storeStyle] - 상점 스타일
   * @param {string} [itemData.address] - 상점 주소
   * @param {string} sectionName - 섹션 이름 (닫기 이벤트에 필요)
   * @returns {google.maps.InfoWindow|null} 생성된 인포윈도우 또는 null
   */
  createInfoWindow: function(itemData, sectionName) {
    if (!window.google || !window.google.maps) {
      console.error('[MapOverlayManager] Google Maps API가 로드되지 않았습니다. 인포윈도우 생성 실패');
      return null;
    }
    
    const name = itemData.storeName || '이름 없음';
    const style = itemData.storeStyle || '';
    const address = itemData.address || '';
      
    // HTML 콘텐츠 생성 - 툴팁 스타일로 간결하게
    const content = `
      <div style="padding: 6px; max-width: 150px; background-color: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        <strong style="font-size: 14px;">${name}</strong>
        ${style ? `<div style="font-size: 12px;">${style}</div>` : ''}
        ${address ? `<div style="font-size: 12px; color: #666;">${address}</div>` : ''}
      </div>
    `;
      
    // 인포윈도우 옵션
    const options = {
      content: content,
      maxWidth: 200,
      disableAutoPan: true, // 자동 패닝 비활성화
      pixelOffset: new window.google.maps.Size(0, -5), // 마커 위에 위치하도록 설정
      closeOnClick: false, // 클릭 시 닫기 비활성화
      backgroundColor: 'transparent', // 투명한 배경
      boxStyle: {
        border: 'none',
        padding: '0',
        backgroundColor: 'transparent',
        boxShadow: 'none'
      }
    };
      
    try {
      // 인포윈도우 생성
      const infoWindow = new window.google.maps.InfoWindow(options);
      
      // 인포윈도우 닫기 이벤트 리스너 등록
      infoWindow.addListener('closeclick', () => {
        // 인포윈도우 참조 정보 초기화
        _infoWindowforSingleton = null;
      });
      
      return infoWindow;
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 생성 중 오류 발생:', error);
      return null;
    }
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
      // 이미 같은 상점의 인포윈도우가 열려있음 (중복 실행 방지)
      return true;
    }
    
    try {
      // 1. 먼저 현재 인포윈도우가 열려있으면 닫기
      this.closeSingletonInfoWindow();
      
      // 2. 해당 섹션에서 상점 ID로 마커 찾기
      const markerMap = this.findMapLayer(
        this._DEFAULT_COUNTRY, 
        sectionName, 
        LAYER_CONSTANTS.CATEGORY.SHOP, 
        LAYER_CONSTANTS.TYPE.MARKER
      );
      
      if (!markerMap) {
        console.error(`[MapOverlayManager] 인포윈도우 열기 실패: ${sectionName} 섹션의 마커 맵을 찾을 수 없습니다`);
        return false;
      }
      
      const marker = markerMap.get(shopId);
      
      // 3. 간단한 상점 데이터로 인포윈도우 생성
      // SectionsDBManager를 사용하지 않고 기본 정보로 인포윈도우 생성
      const shopItem = {
        id: shopId,
        storeName: shopId, // ID를 상점명으로 사용
        storeStyle: '기본', // 기본 스타일
        address: sectionName // 섹션 이름을 주소로 사용
      };
      
      // 4. 인포윈도우 생성 및 표시
      const infoWindow = this.createInfoWindow(shopItem, sectionName);
      
      if (!infoWindow) {
        console.error('[MapOverlayManager] 인포윈도우 열기 실패: 인포윈도우 생성 실패');
        return false;
      }
      
      // 마커 기준으로 인포윈도우 위치 설정
      if (marker) {
        // AdvancedMarkerElement의 position 속성 사용
        const position = marker.position;
        infoWindow.setPosition(position);
      } else {
        // 마커가 없는 경우, 다각형 중심점으로 표시
        const polygonMap = this.findMapLayer(
          this._DEFAULT_COUNTRY, 
          sectionName, 
          LAYER_CONSTANTS.CATEGORY.SHOP, 
          LAYER_CONSTANTS.TYPE.POLYGON
        );
        
        if (polygonMap) {
          const polygon = polygonMap.get(shopId);
          
          if (polygon) {
            // 폴리곤 경계를 계산하여 중심점 찾기
            const bounds = new window.google.maps.LatLngBounds();
            polygon.getPath().forEach(latLng => bounds.extend(latLng));
            
            // 중심점 가져오기
            const center = bounds.getCenter();
            infoWindow.setPosition(center);
          }
        }
      }
      
      // 인포윈도우 열기
      infoWindow.open(_mapInstance);
      
      // 인포윈도우 맵에 저장
      const infoWindowMap = this.getOrCreateMapLayer(
        this._DEFAULT_COUNTRY, 
        sectionName, 
        LAYER_CONSTANTS.CATEGORY.INFO_WINDOW
      );
      
      // 기존에 같은 상점 ID에 대한 인포윈도우가 있으면 제거
      if (infoWindowMap.has(shopId)) {
        const oldInfoWindow = infoWindowMap.get(shopId);
        if (oldInfoWindow) oldInfoWindow.close();
      }
      
      // 새 인포윈도우 등록
      infoWindowMap.set(shopId, infoWindow);
      
      // 싱글톤 인포윈도우 ID 업데이트
      _infoWindowforSingleton = shopId;
      
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
        infoWindow.close();
        }
      }
      
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
    if (!_mapInstance) {
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
            // AdvancedMarkerElement 처리
            marker.map = null;
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
          if (polygon) polygon.setMap(null);
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
          // AdvancedMarkerElement 처리
          marker.map = _mapInstance;
          marker.style.display = isMarkerVisible ? 'block' : 'none';
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
          polygon.setMap(_mapInstance);
          polygon.setVisible(isPolygonVisible);
        }
      });
    }
    
    // 현재 활성 섹션 정보 저장
    _currentActiveSection = sectionNameforNow;
    
    return true;
  },
  
  /**
   * 레이어 구조 초기화
   * @param {Object} data - 구조 정의 객체
   * @param {Array<string>} data.countries - 국가 목록
   * @param {Array<string>} data.sections - 섹션 목록
   * @param {Object} [data.landmarks] - 섹션별 랜드마크 목록 (optional)
   * @returns {boolean} - 성공 여부
   */
  _initializeLayerStructure: function(data) {
    if (!data || typeof data !== 'object') {
      console.error('[MapOverlayManager] 유효하지 않은 구조 정보');
      return false;
    }
    
    // 모든 국가별 데이터 순회
    Object.entries(data).forEach(([country, countryData]) => {
      // 국가 맵 생성
      const countryMap = new Map();
      this._overlayLayersMapDB.set(country, countryMap);
      
      // sections 속성을 가져옴
      const sections = countryData.sections || [];

      // 섹션이 배열인지 확인
      if (!Array.isArray(sections)) {
        console.error(`[MapOverlayManager] ${country}의 섹션 정보가 배열이 아님`);
        return;
      }
      
      // 모든 섹션 초기화
      sections.forEach((section) => {
        // 섹션 맵 생성
        const sectionMap = new Map();
        countryMap.set(section, sectionMap);

        // LANDMARK 초기화 (있는 경우만)
        if (data.landmarks && data.landmarks[section]) {
          const landmarkMap = new Map();
          sectionMap.set(LAYER_CONSTANTS.CATEGORY.LANDMARK, landmarkMap);
          
          // 각 랜드마크에 빈 Map 할당
          data.landmarks[section].forEach((landmark) => {
            landmarkMap.set(landmark, new Map());
          });
        }

        // SHOP 카테고리 초기화
        const shopMap = new Map();
        sectionMap.set(LAYER_CONSTANTS.CATEGORY.SHOP, shopMap);
        
        // SHOP 하위 타입 초기화
        shopMap.set(LAYER_CONSTANTS.TYPE.MARKER, new Map());  // 마커 맵
        shopMap.set(LAYER_CONSTANTS.TYPE.POLYGON, new Map()); // 폴리곤 맵
        
        // 인포윈도우 맵 초기화
        sectionMap.set(LAYER_CONSTANTS.CATEGORY.INFO_WINDOW, new Map());
      });
    });
    
    return true;
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
   * 모든 오버레이 및 이벤트 리스너 정리
   * 컴포넌트 언마운트 시 호출되어야 함
   */
  cleanup: function() {
      // Google Maps API 가용성 확인
      const isGoogleMapsAvailable = window.google && window.google.maps;
      
      // 1. 맵 이벤트 리스너 제거
      this.detachMapListeners();
      
      // 2. 인포윈도우 닫기
      this.closeSingletonInfoWindow();
      
    // 3. 모든 오버레이 제거 - 계층별 순회
    this._overlayLayersMapDB.forEach((countryMap) => {
      countryMap.forEach((sectionMap) => {
        // SHOP 레이어 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.SHOP)) {
          const shopMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.SHOP);
          
          // SHOP_MARKER 정리
          if (shopMap.has(LAYER_CONSTANTS.TYPE.MARKER)) {
            const markerMap = shopMap.get(LAYER_CONSTANTS.TYPE.MARKER);
            markerMap.forEach((marker) => {
              if (marker) {
                // AdvancedMarkerElement 정리
                marker.map = null;
                
                // 모든 이벤트 리스너 제거 (복제 기법 사용)
                if (marker.content) {
                  const clone = marker.content.cloneNode(true);
                  // 부모 노드가 있는 경우에만 교체 시도
                  if (marker.content.parentNode) {
                    marker.content.parentNode.replaceChild(clone, marker.content);
                  }
                  marker.content = clone;
                }
              }
            });
            markerMap.clear();
          }
          
          // SHOP_POLYGON 정리
          if (shopMap.has(LAYER_CONSTANTS.TYPE.POLYGON)) {
            const polygonMap = shopMap.get(LAYER_CONSTANTS.TYPE.POLYGON);
            polygonMap.forEach((polygon) => {
              if (polygon && isGoogleMapsAvailable) {
                window.google.maps.event.clearInstanceListeners(polygon);
                polygon.setMap(null);
              }
            });
            polygonMap.clear();
          }
          
          shopMap.clear();
        }
        
        // LANDMARK 레이어 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.LANDMARK)) {
          const landmarkMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.LANDMARK);
          landmarkMap.forEach((landmark) => {
            if (isGoogleMapsAvailable) {
              if (landmark.marker) {
                // AdvancedMarkerElement 정리
                landmark.marker.map = null;
                
                // 모든 이벤트 리스너 제거 (복제 기법 사용)
                if (landmark.marker.content) {
                  const clone = landmark.marker.content.cloneNode(true);
                  if (landmark.marker.content.parentNode) {
                    landmark.marker.content.parentNode.replaceChild(clone, landmark.marker.content);
                  }
                  landmark.marker.content = clone;
                }
              }
              
              if (landmark.infoWindow) {
                window.google.maps.event.clearInstanceListeners(landmark.infoWindow);
                landmark.infoWindow.close();
              }
            }
            landmark.clear();
          });
          landmarkMap.clear();
        }
        
        // 인포윈도우 정리
        if (sectionMap.has(LAYER_CONSTANTS.CATEGORY.INFO_WINDOW)) {
          const infoWindowMap = sectionMap.get(LAYER_CONSTANTS.CATEGORY.INFO_WINDOW);
          infoWindowMap.forEach((infoWindow) => {
            if (infoWindow && isGoogleMapsAvailable) {
              window.google.maps.event.clearInstanceListeners(infoWindow);
              infoWindow.close();
            }
          });
          infoWindowMap.clear();
        }
        
        sectionMap.clear();
      });
      countryMap.clear();
      });
      
    // 4. 맵 비우기
    this._overlayLayersMapDB.clear();
      
      // 5. 레이어 상태 초기화
      this._layers.activeSection = null;
      this._layers.visibleSections.clear();
      
    // 6. 맵 인스턴스 참조 제거
      _mapInstance = null;
      
    // 7. 인포윈도우 참조 정보 초기화
      _infoWindowforSingleton = null;
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
   * 이미지 오버레이 생성 함수
   * @param {Object} coordinates - 이미지를 표시할 좌표
   * @param {string} imageUrl - 이미지 URL
   * @param {number} [width=100] - 이미지 폭(px)
   * @param {number} [height=100] - 이미지 높이(px)
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createImageOverlay: function(coordinates, imageUrl, width = 100, height = 100) {
    if (!coordinates) {
      console.error('[MapOverlayManager] 이미지 오버레이 생성 실패: 좌표가 제공되지 않았습니다');
      return null;
    }
    
    try {
      // 좌표 객체 파싱 - parseCoordinates 함수 사용
      const position = this.parseCoordinates(coordinates);
      
      if (!position) {
        console.error('[MapOverlayManager] 이미지 오버레이 생성 실패: 좌표 파싱 실패', coordinates);
        return null;
      }
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[MapOverlayManager] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 이미지 요소 생성
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.width = width;
      imgElement.height = height;
      imgElement.style.borderRadius = '8px';
      imgElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      imgElement.style.border = '2px solid white';
      
      // 컨테이너 요소 생성
      const containerElement = document.createElement('div');
      containerElement.appendChild(imgElement);
      containerElement.style.position = 'relative';
      
      // AdvancedMarkerElement 생성
      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: containerElement,
        map: _mapInstance,
        zIndex: 10 // 다른 마커보다 위에 표시
      });
      
      return advancedMarker;
    } catch (error) {
      console.error('[MapOverlayManager] 이미지 오버레이 생성 중 오류 발생:', error);
      return null;
    }
  },
};

export default MapOverlayManager; 