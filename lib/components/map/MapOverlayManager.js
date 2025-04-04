/**
 * 맵 오버레이 관리를 위한 싱글톤 객체
 * 섹션 이름별로 상점 오버레이 객체들을 캐싱하고 ID로 조회합니다.
 * mapUtils.js의 기능도 포함합니다.
 */

// 구글맵 오버레이의 zoom별 가시성 설정을 위한 상수 객체
const OVERLAY_LAYERS = {
   SHOP_POLYGON : {
    NAME : "SHOP_POLYGON",
    MIN_ZOOM_LEVEL: 16,
    MAX_ZOOM_LEVEL: 21,
    SETING_ZOOM_LEVEL: 18,    
  },
  SHOP_MARKER: {
    NAME : "SHOP_MARKER",
    MIN_ZOOM_LEVEL: 15,
    MAX_ZOOM_LEVEL: 17,
    SETING_ZOOM_LEVEL: 16,
  },
  LANDMARK: { // 사용미정
    NAME : "LANDMARK",
    MIN_ZOOM_LEVEL: 12,
    MAX_ZOOM_LEVEL: 15,
    SETING_ZOOM_LEVEL: 15,
    
  },
  SECTION: { // 사용미정
    NAME : "SECTION",
    MIN_ZOOM_LEVEL: 10,
    MAX_ZOOM_LEVEL: 12,
    SETING_ZOOM_LEVEL: 15,
    
  },
  COUNTRY: { // 사용미정
    NAME : "COUNTRY",
    MIN_ZOOM_LEVEL: 3,
    MAX_ZOOM_LEVEL: 10,
    SETING_ZOOM_LEVEL: 15,
    
  }
}

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
let _selectedItem = null; // 현재 선택된 아이템
let _setSelectedItemCallback = null; // 외부에서 주입된 상점 선택 콜백

/**
 * 인포윈도우 상태 변경 시 처리하는 함수 (모듈 스코프)
 * @private
 */


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
      
      // 레이어별 콜백 실행
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
  // 섹션별 오버레이 데이터 저장소 (sectionName -> Map of overlays)
  _overlaysBySection: new Map(),
  
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
      // 각 레이어의 가시성 평가 및 상태 업데이트
      Object.values(OVERLAY_LAYERS).forEach(layer => {
        const shouldBeVisible = currentZoomLevel >= layer.MIN_ZOOM_LEVEL && 
                               currentZoomLevel <= layer.MAX_ZOOM_LEVEL;
        
        // 상태 관리자에 현재 줌 레벨 전달
        MapOverlayManager._overlayVisibleStateManager.setState(layer.NAME, shouldBeVisible, currentZoomLevel);
      });
      
      // 외부 폴리곤 업데이트 (window.currentItemListRef)
      const isPolygonVisible = MapOverlayManager._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
      this.updateExternalPolygonsVisibility(isPolygonVisible);
    },
    
    /**
     * 외부 관리 폴리곤(window.currentItemListRef)의 가시성 업데이트
     * @param {boolean} isVisible - 표시 여부
     */
    updateExternalPolygonsVisibility: function(isVisible) {
      try {
        // window 객체에 저장된 currentItemListRef가 있는지 확인
        const currentItemList = window.currentItemListRef?.current;
        
        if (currentItemList && Array.isArray(currentItemList) && currentItemList.length > 0) {
          // index.js에서 사용하던 방식으로 폴리곤 가시성 업데이트
          currentItemList.forEach(item => {
            if (item.itemPolygon) {
              item.itemPolygon.setVisible(isVisible);
            }
          });
        }
      } catch (error) {
        console.error('[MapOverlayManager] 외부 아이템 폴리곤 가시성 업데이트 중 오류 발생:', error);
      }
    }
  },
  
  /**
   * 선택된 아이템 설정 콜백 함수 등록
   * @param {Function} setSelectedItemCallback - 아이템 선택 시 호출할 콜백 함수
   */
  setSelectedItemCallback: function(setSelectedItemCallback) {
    if (typeof setSelectedItemCallback !== 'function') {
      console.error('[MapOverlayManager] 유효하지 않은 setSelectedItemCallback');
      return false;
    }
    
    _setSelectedItemCallback = setSelectedItemCallback;
    return true;
  },
  
  /**
   * 현재 선택된 아이템 설정
   * @param {Object} item - 선택할 아이템
   */
  setSelectedItem: function(item) {
    _selectedItem = item;
    
    if (_setSelectedItemCallback) {
      _setSelectedItemCallback(item);
    }
    
    // 인포윈도우 표시 (필요 시)
    if (item && item.id && item.sectionName) {
      this.openSingletonInfoWindow(item.sectionName, item.id);
    }
  },
  
  /**
   * 현재 선택된 아이템 확인
   * @param {Object} item - 확인할 아이템
   * @returns {boolean} 선택 여부
   */
  isItemSelected: function(item) {
    return _selectedItem === item;
  },
  
  /**
   * MapOverlayManager 초기화 함수 - 구글 맵이 완전히 로드된 후에 호출되어야 함
   * window.google.maps.SymbolPath.CIRCLE,같은 부분때문에
   * @param {google.maps.Map} [mapInstance] - 구글 맵 인스턴스 (선택적)
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
    
    // 초기 레이어 구조 설정
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
    });
    
    // 테스트용 일반 옵저버 등록
    this._overlayVisibleStateManager.addObserver((layerName) => {
      console.log(`[테스트] 옵저버 알림: ${layerName} 레이어 상태 변경됨`);
    });

    // 레이어 구조 초기화
    this._initializeLayerStructure(initialStructure);
    
    // 초기 줌 레벨에 따라 레이어 가시성 업데이트
    this.ZoomManager.handleZoomChanged();

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
    
    // 기존 맵이 있다면 이벤트 리스너 제거
    this.detachMapListeners();
    
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
    
    // 줌 변경 이벤트 리스너 등록 //TODO 줌 변경 관리를 일원화 예정. 
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', _handleZoomChanged);
    
    // 맵 클릭 이벤트 리스너 등록 - 인포윈도우 닫기 처리
    window.google.maps.event.addListener(_mapInstance, 'click', () => {
      try {
        // Redux 액션 사용하여 인포윈도우 닫기
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
   * @returns {google.maps.Marker|null} 생성된 마커 또는 null
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
      
      // 마커 옵션 설정 - minZoom/maxZoom 속성 제거
      const options = {
        position: position,
        title: title,
        ...this.markerOptions
      };
      
      // 마커 생성 (맵에는 연결하지 않음)
      const marker = new window.google.maps.Marker(options);
      
      // 가시성 상태 관리자에 콜백 등록
      this._overlayVisibleStateManager.registerLayerCallback(OVERLAY_LAYERS.SHOP_MARKER.NAME, (isVisible) => {
        marker.setVisible(isVisible);
      });
      
      // 초기 가시성 설정
      const isVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
      marker.setVisible(isVisible);
      
      return marker;
    } catch (error) {
      console.error('[MapOverlayManager] 마커 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 폴리곤 생성 함수
   * @param {Array<Object>} paths - 폴리곤 경로 좌표 배열
   * @returns {google.maps.Polygon|null} 생성된 폴리곤 또는 null
   */
  createPolygon: function(paths) {
    if (!paths) {
      console.error('[MapOverlayManager] 폴리곤 생성 실패: 경로가 제공되지 않았습니다');
      return null;
    }
    
    if (!Array.isArray(paths)) {
      console.error('[MapOverlayManager] 폴리곤 생성 실패: 경로가 배열이 아닙니다', typeof paths, paths);
      return null;
    }
    
    if (paths.length < 3) {
      console.error('[MapOverlayManager] 폴리곤 생성 실패: 좌표점이 3개 미만입니다', paths.length);
      return null;
    }
    
    try {
      
      // 경로의 각 좌표를 구글 맵 LatLng 객체로 변환
      const processedPaths = paths.map((coord, index) => {
        // 이미 LatLng 객체인 경우 그대로 반환
        if (coord instanceof window.google.maps.LatLng) {
          return coord;
        }
        
        try {
          return this.parseCoordinates(coord);
        } catch (error) {
          console.error(`[MapOverlayManager] 경로의 ${index}번째 좌표 변환 실패:`, coord, error);
          // 오류 발생 시 기본 좌표 생성 (실패 방지용)
          if (typeof coord === 'object' && coord !== null && 'lat' in coord && 'lng' in coord) {
            // 직접 LatLng 객체 생성 시도
            return new window.google.maps.LatLng(
              parseFloat(coord.lat), 
              parseFloat(coord.lng)
            );
          }
          throw error; // 처리할 수 없는 경우 오류 다시 던지기
        }
      }).filter(coord => coord !== null);
      
            
      // 폴리곤 옵션 설정 - minZoom/maxZoom 속성 제거
      const options = {
        paths: processedPaths,
        ...this.polygonOptions
      };
      
      // 폴리곤 생성 (맵에는 연결하지 않음)
      const polygon = new window.google.maps.Polygon(options);
      
      // 가시성 상태 관리자에 콜백 등록
      this._overlayVisibleStateManager.registerLayerCallback(OVERLAY_LAYERS.SHOP_POLYGON.NAME, (isVisible) => {
        polygon.setVisible(isVisible);
      });
      
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
   * @param {Array} itemList - 상점 데이터 배열 (각 항목은 id, pinCoordinates, path 속성 필요)
   * @param {Object} callbacks - 콜백 함수 모음 { onItemSelect, isItemSelected }
   */
  registerOverlaysByItemlist: function(sectionName, itemList, callbacks) {
    if (!sectionName || !itemList || !Array.isArray(itemList)) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 오버레이 일괄 등록 시도');
      return;
    }
    
    
    // 해당 섹션의 오버레이 맵이 없으면 생성
    if (!this._overlayLayersMapDB.has(sectionName)) {
      this._overlayLayersMapDB.set(sectionName, new Map());
    }
    
    const sectionMap = this._overlayLayersMapDB.get(sectionName);
    let registeredCount = 0;
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected } = callbacks || {};
    
    // 각 아이템에 대해 오버레이 생성 및 등록
    itemList.forEach(shopData => {
      if (!shopData) {
        return; // 유효하지 않은 아이템은 건너뜀
      }
      
      // ID 확인 및 로그 출력
      const shopId = shopData.id || (shopData.serverDataset && shopData.serverDataset.id);
      if (!shopId) {
        return; // ID가 없는 아이템은 건너뜀
      }
      
      
      // pinCoordinates와 path 찾기 (직접 속성 또는 serverDataset 내부)
      const pinCoordinates = shopData.pinCoordinates || 
                          (shopData.serverDataset && shopData.serverDataset.pinCoordinates);
      
      const path = shopData.path || 
                 (shopData.serverDataset && shopData.serverDataset.path);
      
      // 상점 이름 (직접 속성 또는 serverDataset 내부)
      const storeName = shopData.storeName || 
                      (shopData.serverDataset && shopData.serverDataset.storeName) || 
                      '';
      
          
      // protoOverlayForShop 객체를 복제하여 새 오버레이 객체 생성
      const overlayObj = { ...protoOverlayForShop };
      
      // shopData로부터 직접 마커와 폴리곤 생성
      try {
        // 마커 생성 (pinCoordinates 필요)
        if (pinCoordinates) {
          overlayObj.marker = this.createMarker(pinCoordinates, storeName);
          
          if (overlayObj.marker) {
            
            // 마커 이벤트 등록
            // 클릭 이벤트
            overlayObj.marker.addListener('click', () => {
              // 인포윈도우 표시
              this.openSingletonInfoWindow(sectionName, shopId);
              
              // 외부 콜백 호출 (있는 경우)
              if (onItemSelect) onItemSelect(shopData);
            });
            
            // 마우스오버 이벤트
            overlayObj.marker.addListener('mouseover', () => {
              // 현재 선택된 아이템이 아닌 경우에만 인포윈도우 표시
              const notSelected = isItemSelected ? !isItemSelected(shopData) : true;
              if (_infoWindowforSingleton !== shopId && notSelected) {
                this.openSingletonInfoWindow(sectionName, shopId);
                
                // 외부 콜백 호출 (있는 경우)
                if (onItemSelect) onItemSelect(shopData);
              }
            });
          } else {
            console.error(`[MapOverlayManager] "${storeName}" 마커 생성 실패`);
          }
        } else {
          console.error(`[MapOverlayManager] "${storeName}" 마커 생성 안함 (pinCoordinates 없음)`);
        }
        
        // 폴리곤 생성 (path 필요, 최소 3개 이상의 좌표점 필요)
        if (path && Array.isArray(path) && path.length >= 3) {
          overlayObj.polygon = this.createPolygon(path);
          
          if (overlayObj.polygon) {
            
            // 폴리곤 이벤트 등록
            // 클릭 이벤트
            overlayObj.polygon.addListener('click', () => {
              // 인포윈도우 표시
              this.openSingletonInfoWindow(sectionName, shopId);
              
              // 외부 콜백 호출 (있는 경우)
              if (onItemSelect) onItemSelect(shopData);
            });
            
            // 마우스오버 이벤트
            overlayObj.polygon.addListener('mouseover', () => {
              // 현재 선택된 아이템이 아닌 경우에만 인포윈도우 표시
              const notSelected = isItemSelected ? !isItemSelected(shopData) : true;
              if (_infoWindowforSingleton !== shopId && notSelected) {
                this.openSingletonInfoWindow(sectionName, shopId);
                
                // 외부 콜백 호출 (있는 경우)
                if (onItemSelect) onItemSelect(shopData);
              }
            });
          } else {
            console.error(`[MapOverlayManager] "${storeName}" 폴리곤 생성 실패`);
          }
        } 

        // 인포윈도우 생성 - 섹션명 전달하여 이벤트 바인딩까지 완료
        overlayObj.infoWindow = this.createInfoWindow(shopData, sectionName);

        // 오버레이 객체 저장 (마커 또는 폴리곤이 있는 경우에만)
        if (overlayObj.marker || overlayObj.polygon) {
          sectionMap.set(shopId, overlayObj);
          registeredCount++;
        } else {
          // 마커 또는 폴리곤이 없는 경우 오버레이 객체 저장 안함
          console.error(`[MapOverlayManager] "${storeName}" 오버레이 객체 저장 안함 (마커/폴리곤 모두 없음)`);
        }
      } catch (error) {
        console.error(`[MapOverlayManager] 아이템 ID ${shopId}의 오버레이 생성 중 오류 발생:`, error);
      }
    });
    
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
   * @param {Object} shopData - 상점 데이터
   * @param {string} sectionName - 섹션 이름 (닫기 이벤트에 필요)
   * @returns {google.maps.InfoWindow|null} 생성된 인포윈도우 또는 null
   */
  createInfoWindow: function(shopData, sectionName) {
    if (!window.google || !window.google.maps) {
      console.error('[MapOverlayManager] Google Maps API가 로드되지 않았습니다. 인포윈도우 생성 실패');
      return null;
    }
    
    try {
      // 인포윈도우 컨텐츠를 직접 생성
      // 상점 데이터에서 필요한 정보 추출
      const name = shopData.serverDataset?.storeName || shopData.storeName || '이름 없음';
      const style = shopData.serverDataset?.storeStyle || shopData.storeStyle || '';
      const address = shopData.serverDataset?.address || shopData.address || '';
      
      // HTML 콘텐츠 생성
      const content = `
        <div style="padding: 10px; max-width: 200px;">
          <strong>${name}</strong><br>
          ${style}<br>
          ${address}
        </div>
      `;
      
      // 인포윈도우 옵션 설정
      const options = {
        content: content,
        maxWidth: 250,
        disableAutoPan: false
      };
      
      // 인포윈도우 생성
      const infoWindow = new window.google.maps.InfoWindow(options);
      
      // 닫기 이벤트 핸들러 설정
      if (this._reduxStore && sectionName && shopData.id) {
        infoWindow.addListener('closeclick', () => {
          try {
            const { closeInfoWindow } = require('../../store/slices/mapEventSlice');
            this._reduxStore.dispatch(closeInfoWindow());
            // 인포윈도우 참조 정보 초기화
            _infoWindowforSingleton = null;
          } catch (error) {
            console.error('[MapOverlayManager] 인포윈도우 닫기 이벤트 처리 중 오류:', error);
          }
        });
      }
      
      return infoWindow;
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 싱글톤 인포윈도우 열기 - sectionName과 id(shopId가 아님)만으로 작동
   * 내부 DB에서 오버레이 객체를 찾아 해당 인포윈도우를 표시
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 오버레이 객체의 ID (shopId가 아님)
   * @returns {boolean} - 인포윈도우 표시 성공 여부
   */
  openSingletonInfoWindow: function(sectionName, id) {
    
    if (!sectionName || !id) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 싱글톤 인포윈도우 표시 시도');
      return false;
    }
    
    if (!_mapInstance) {
      console.error('[MapOverlayManager] 맵 인스턴스가 설정되지 않았습니다.');
      return false;
    }
    
    try {
      // 1. 현재 열려있는 인포윈도우가 있으면 닫기
      if (_infoWindowforSingleton) {
        // 이전 인포윈도우의 섹션 맵 찾기
        const prevSectionName = _currentActiveSection;
        
        if (prevSectionName) {
          const prevSectionMap = this._overlayLayersMapDB.get(prevSectionName);
          if (prevSectionMap) {
            const prevOverlay = prevSectionMap.get(_infoWindowforSingleton);
            if (prevOverlay && prevOverlay.infoWindow) {
              prevOverlay.infoWindow.close();
            }
          }
        }
      }
      
      // 2. 새 인포윈도우 표시
      const sectionMap = this._overlayLayersMapDB.get(sectionName);
      if (!sectionMap) {
        console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
        
        // 첫 번째 섹션에서 시도해보기
        if (this._overlayLayersMapDB.size > 0) {
          const firstSection = [...this._overlayLayersMapDB.keys()][0];
          const firstSectionMap = this._overlayLayersMapDB.get(firstSection);
          if (firstSectionMap && firstSectionMap.has(id)) {
            return this.openSingletonInfoWindow(firstSection, id);
          }
        }
        
        return false;
      }
      
      const overlay = sectionMap.get(id);
      if (!overlay) {
        console.error(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName}/${id}`);
        return false;
      }
      
      // 3. 해당 오버레이의 인포윈도우 열기
      if (!overlay.infoWindow) {
        console.error(`[MapOverlayManager] 존재하지 않는 인포윈도우 ID: ${sectionName}/${id}`);
        return false; // 인포윈도우가 없으면 함수 실행 중단
      }
      
      // 4. 인포윈도우 열기
      if (overlay.marker) {
        
        // 마커를 맵에 표시 확인 (없으면 추가)
        if (overlay.marker.getMap() !== _mapInstance) {
          overlay.marker.setMap(_mapInstance);
        }
        
        overlay.infoWindow.open(_mapInstance, overlay.marker);
        
        // 5. 마커 바운스 애니메이션 적용
        overlay.marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => {
          if (overlay.marker) {
            overlay.marker.setAnimation(null);
          }
        }, 750); // 바운스 1-2회 후 중지
      } else {
        
        // 폴리곤이 있으면 맵에 표시 확인
        if (overlay.polygon && overlay.polygon.getMap() !== _mapInstance) {
          overlay.polygon.setMap(_mapInstance);
        }
        
        // 맵 중앙에 인포윈도우 표시
        overlay.infoWindow.open(_mapInstance);
      }
      
      // 현재 섹션 활성화 (오버레이 표시 상태 변경)
      if (_currentActiveSection !== sectionName) {
        this.changeOverlaysOfCursection(sectionName);
      }
      
      // 6. 현재 열린 인포윈도우 정보 업데이트 (이제 ID만 저장)
      _infoWindowforSingleton = id;
      
      return true;
    } catch (error) {
      console.error('[MapOverlayManager] 싱글톤 인포윈도우 표시 중 오류:', error);
      return false;
    }
  },
  
  /**
   * 인포윈도우 닫기
   * 현재 열려있는 싱글톤 인포윈도우를 닫습니다.
   */
  closeSingletonInfoWindow: function() {
    if (_infoWindowforSingleton && _currentActiveSection) {
      const sectionMap = this._overlayLayersMapDB.get(_currentActiveSection);
      if (sectionMap) {
        const overlay = sectionMap.get(_infoWindowforSingleton);
        if (overlay && overlay.infoWindow) {
          overlay.infoWindow.close();
        }
      }
      
      // 인포윈도우 참조 정보 초기화
      _infoWindowforSingleton = null;
    }
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

   //TODO 바뀐 오버레이 관리 구조에 따라 내부구현 간소화 필요. 
   // 현재는 section이 바뀌면, 관련 오버레이 등록, 삭제가 일어남. 리덕스에서 호출됨. 
  changeOverlaysOfCursection: function(sectionNameforNow) {
    if (!_mapInstance) {
      console.error('[MapOverlayManager] 맵 인스턴스가 설정되지 않았습니다.');
      return false;
    }
    
    // 이전 활성 섹션이 있으면 오버레이 숨기기
    if (this._layers.activeSection && this._layers.activeSection !== sectionNameforNow) {
      const ovelaysPrevSection = this._overlayLayersMapDB.get(this._layers.activeSection);
      if (ovelaysPrevSection) {
        
        ovelaysPrevSection.forEach((overlay, id) => {
          if (overlay.marker) {
            overlay.marker.setMap(null);
          }
          if (overlay.polygon) {
            overlay.polygon.setMap(null);
          }
        });
      }
    }
    
    // 새 섹션 활성화 //TODO layers는 각 줌단계별 보여야하는 오버레이들이고, 한개의 오버레이만 선택되는 기능을 차후 추가
    this._layers.activeSection = sectionNameforNow;
    this._layers.visibleSections.add(sectionNameforNow);
    
    // 새 섹션의 오버레이 표시
    const sectionMap = this._overlayLayersMapDB.get(sectionNameforNow);
    if (sectionMap) {
      // 현재 줌 레벨에 따른 가시성 상태 확인
      const isPolygonVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
      const isMarkerVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
      
      sectionMap.forEach((overlay, id) => {
        if (overlay.marker) {
          overlay.marker.setMap(_mapInstance);
          overlay.marker.setVisible(isMarkerVisible);
        }
        if (overlay.polygon) {
          overlay.polygon.setMap(_mapInstance);
          overlay.polygon.setVisible(isPolygonVisible);
        }
      });
    } else {
      console.error(`[MapOverlayManager] 섹션 "${sectionNameforNow}"의 오버레이가 등록되지 않았습니다.`);
    }
    
    _currentActiveSection = sectionNameforNow;
    return true;
  },
  
  /**
   * 섹션 아이템 일괄 등록 및 이벤트 바인딩
   * @param {string} sectionName - 섹션 이름
   * @param {Array} items - 아이템 배열
   * @param {Function} onSelectCallback - 아이템 선택 시 호출할 콜백
   * @returns {boolean} - 등록 성공 여부
   */
  registerSectionItems: function(sectionName, items, onSelectCallback) {
    if (!sectionName || !items || !Array.isArray(items) || !_mapInstance) {
      console.error('[MapOverlayManager] 섹션 아이템 등록 실패: 잘못된 파라미터');
      return false;
    }
    
    // 아이템에서 오버레이 생성 및 등록 (이벤트 바인딩 포함)
    // onSelectCallback이 있으면 콜백 객체 형태로 전달
    const callbacks = onSelectCallback ? { 
      onItemSelect: onSelectCallback,
      isItemSelected: null
    } : null;
    
    this.registerOverlaysByItemlist(sectionName, items, callbacks);
    
    // 활성 섹션인 경우에만 지도에 표시
    if (this._layers.activeSection === sectionName) {
      const sectionMap = this._overlayLayersMapDB.get(sectionName);
      if (sectionMap) {
        // 현재 줌 레벨에 따른 가시성 상태 확인
        const isPolygonVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_POLYGON.NAME);
        const isMarkerVisible = this._overlayVisibleStateManager.getState(OVERLAY_LAYERS.SHOP_MARKER.NAME);
        
        sectionMap.forEach((overlay, id) => {
          if (overlay.marker) {
            overlay.marker.setMap(_mapInstance);
            overlay.marker.setVisible(isMarkerVisible);
          }
          if (overlay.polygon) {
            overlay.polygon.setMap(_mapInstance);
            overlay.polygon.setVisible(isPolygonVisible);
          }
        });
      }
    }
   
    return true;
  },
  
  /**
   * 레이어 구조 초기화
   * @private
   */
  _initializeLayerStructure: function(structure) {
    Object.entries(structure).forEach(([country, data]) => {
      const countryMap = new Map();
      this._overlayLayersMapDB.set(country, countryMap);

      data.sections.forEach(section => {
        const sectionMap = new Map();
        countryMap.set(section, sectionMap);

        // LANDMARK 초기화
        if (data.landmarks && data.landmarks[section]) {
          const landmarkMap = new Map();
          sectionMap.set('LANDMARK', landmarkMap);
          
          data.landmarks[section].forEach(landmark => {
            landmarkMap.set(landmark, new Map());
          });
        }

        // SHOP 초기화
        const shopMap = new Map();
        sectionMap.set('SHOP', shopMap);
        shopMap.set('SHOP_MARKER', new Map());
        shopMap.set('SHOP_POLYGON', new Map());
      });
    });
  },

  /**
   * 가시성 상태 변경 옵저버 등록
   */
  addVisibilityObserver: function(callback) {
    this._overlayVisibleStateManager.addObserver(callback);
  },
  
  /**
   * 상태 관리자 테스트 - 수동으로 레이어 상태 변경
   * @param {string} layerName - 레이어 이름
   * @param {boolean} isVisible - 설정할 가시성 상태
   */
  testLayerVisibility: function(layerName, isVisible) {
    console.log(`[테스트] 레이어 상태 수동 변경: ${layerName} -> ${isVisible ? 'ON' : 'OFF'}`);
    this._overlayVisibleStateManager.setState(layerName, isVisible, 999);
    return this._overlayVisibleStateManager.getState(layerName);
  },
  
  /**
   * 모든 오버레이 및 이벤트 리스너 정리
   * 컴포넌트 언마운트 시 호출되어야 함
   */
  cleanup: function() {
    try {
      
      // Google Maps API 가용성 확인
      const isGoogleMapsAvailable = window.google && window.google.maps;
      
      // 1. 맵 이벤트 리스너 제거
      this.detachMapListeners();
      
      // 2. 인포윈도우 닫기
      this.closeSingletonInfoWindow();
      
      // 3. 모든 섹션의 모든 오버레이 제거
      this._overlayLayersMapDB.forEach((sectionMap, sectionName) => {
        sectionMap.forEach((overlay, id) => {
          // Google Maps API가 로드되어 있는지 확인
          if (!isGoogleMapsAvailable) {
            console.warn('[MapOverlayManager] Google Maps API가 로드되지 않아 이벤트 리스너를 제거할 수 없습니다.');
            return;
          }
          
          if (overlay.marker) {
            // 마커에 연결된 이벤트 리스너 제거
            window.google.maps.event.clearInstanceListeners(overlay.marker);
            // 마커 제거
            overlay.marker.setMap(null);
          }
          
          if (overlay.polygon) {
            // 폴리곤에 연결된 이벤트 리스너 제거
            window.google.maps.event.clearInstanceListeners(overlay.polygon);
            // 폴리곤 제거
            overlay.polygon.setMap(null);
          }
          
          if (overlay.infoWindow) {
            // 인포윈도우에 연결된 이벤트 리스너 제거
            window.google.maps.event.clearInstanceListeners(overlay.infoWindow);
            // 인포윈도우 닫기
            overlay.infoWindow.close();
          }
        });
        
        // 섹션 맵 비우기
        sectionMap.clear();
      });
      
      // 4. 섹션 맵 비우기
      this._overlayLayersMapDB.clear();
      
      // 5. 레이어 상태 초기화
      this._layers.activeSection = null;
      this._layers.visibleSections.clear();
      
      // 6. 현재 선택된 아이템 초기화
      _selectedItem = null;
      _setSelectedItemCallback = null;
      
      // 7. 맵 인스턴스 참조 제거
      _mapInstance = null;
      
      // 8. 인포윈도우 참조 정보 초기화
      _infoWindowforSingleton = null;
      
    } catch (error) {
      console.error('[MapOverlayManager] 리소스 정리 중 오류 발생:', error);
    }
  }
};

export default MapOverlayManager; 