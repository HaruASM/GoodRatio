/**
 * 맵 오버레이 관리를 위한 싱글톤 객체
 * 섹션 이름별로 상점 오버레이 객체들을 캐싱하고 ID로 조회합니다.
 * mapUtils.js의 기능도 포함합니다.
 */

const protoOverlayForShop = {
  marker: null,
  polygon: null,
  infoWindow: null,
}

const protoOverlayForLandmark = {
  marker: null,
  polygon: null,
  infoWindow: null,
}

// 모듈 스코프의 private 변수 (클로저를 통해 보호됨)
let _mapInstance = null;
let _isEventListenersAttached = false;
let _infoWindow = null; // 인포윈도우 인스턴스 - 항상 하나만 사용
let _infoWindowInitialized = false; // 인포윈도우 초기화 상태

/**
 * 인포윈도우 상태 변경 시 처리하는 함수 (모듈 스코프)
 * @private
 */
function _handleInfoWindowStateChange(storeState) {
  if (!_infoWindow || !_mapInstance) return;
  
  try {
    // Redux 스토어에서 인포윈도우 상태 가져오기
    const mapEventState = storeState.mapEvent;
    if (!mapEventState) return;
    
    const { isInfoWindowOpen, infoWindowContent } = mapEventState;
    
    if (isInfoWindowOpen && infoWindowContent.content) {
      // 콘텐츠 설정
      _infoWindow.setContent(infoWindowContent.content);
      
      // 위치가 있으면 해당 위치에 표시
      if (infoWindowContent.position) {
        const position = new window.google.maps.LatLng(
          infoWindowContent.position.lat,
          infoWindowContent.position.lng
        );
        _infoWindow.setPosition(position);
        _infoWindow.open(_mapInstance);
      } else if (infoWindowContent.markerId) {
        // TODO: 마커 ID로 마커 참조를 찾아 연결
        // 현재는 직접 마커 참조를 사용하기 때문에 이 부분은 구현되지 않음
        _infoWindow.open(_mapInstance);
      } else {
        // 마커가 없는 경우 맵 중앙에 표시
        _infoWindow.open(_mapInstance);
      }
    } else {
      // 닫기
      _infoWindow.close();
    }
  } catch (error) {
    console.error('[MapOverlayManager] 인포윈도우 상태 업데이트 중 오류:', error);
  }
}

/**
 * 구글 맵 줌 변경 이벤트 핸들러 (모듈 스코프)
 * MapOverlayManager에서 사용하지만 외부에 노출되지 않음
 */
function _handleZoomChanged() {
  if (!_mapInstance) return;
  
  const zoomLevel = _mapInstance.getZoom();
  const isVisible = zoomLevel >= 15; // 줌 레벨 15 이상에서만 폴리곤 표시 (index.js와 동일한 기준으로 수정)
  
  // 1. 모든 섹션의 모든 폴리곤 가시성 업데이트
  MapOverlayManager._overlaysBySection.forEach((sectionMap) => {
    sectionMap.forEach((overlay) => {
      if (overlay.polygon) {
        overlay.polygon.setVisible(isVisible);
      }
    });
  });
  
  // 2. curItemListInCurSection과 호환성을 위해 특별히 처리하는 부분 추가
  // 이 부분은 index.js의 715라인에 있던 로직을 옮겨온 것
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
  
  // 3. Redux 상태 업데이트 (Redux 스토어가 설정된 경우)
  MapOverlayManager._dispatchZoomChange(zoomLevel);
}

const MapOverlayManager = {
  // 섹션별 오버레이 데이터 저장소 (sectionName -> Map of overlays)
  _overlaysBySection: new Map(),
  
  // 마커 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  markerOptions: {},
  
  // 폴리곤 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  polygonOptions: {},
  
  // Redux 스토어 참조
  _reduxStore: null,
  
  // 선택된 인포윈도우 참조 - 하나만 유지
  _activeInfoWindow: null,
  
  /**
   * MapOverlayManager 초기화 함수 - 구글 맵이 완전히 로드된 후에 호출되어야 함
   * window.google.maps.SymbolPath.CIRCLE,같은 부분때문에
   * @param {google.maps.Map} [mapInstance] - 구글 맵 인스턴스 (선택적)
   * @returns {boolean} 초기화 성공 여부
   */
  initialize: function(mapInstance = null) {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API가 로드되지 않았습니다. MapOverlayManager 초기화 실패');
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
      strokeColor: '#FF0000', // OVERLAY_COLOR.IDLE을 직접 값으로 대체
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000', // OVERLAY_COLOR.IDLE을 직접 값으로 대체
      fillOpacity: 0.35,
    };
    
    // 맵 인스턴스가 제공된 경우 설정
    if (mapInstance) {
      this.setMap(mapInstance);
    }
    
    // 인포윈도우 초기화
    this.initInfoWindow();
    
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
    
    console.log('[MapOverlayManager] 맵 인스턴스 설정 완료');
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
    
    // 줌 변경 이벤트 리스너 등록
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', _handleZoomChanged);
    
    _isEventListenersAttached = true;
    
  },
  
  /**
   * 맵 이벤트 리스너 제거
   * @private
   */
  detachMapListeners: function() {
    if (!_mapInstance || !_isEventListenersAttached) return;
    
    // 이벤트 리스너 제거
    google.maps.event.clearListeners(_mapInstance, 'zoom_changed');
    
    _isEventListenersAttached = false;
    console.log('[MapOverlayManager] 맵 이벤트 리스너 제거 완료');
  },
  
  /**
   * 인포윈도우 내용 생성 함수
   * @param {Object} shopItem - 상점 데이터
   * @returns {string} HTML 형식의 인포윈도우 내용
   */
  createInfoWindowContent: function(shopItem) {
    const name = shopItem.serverDataset?.storeName || shopItem.storeName || '이름 없음';
    const style = shopItem.serverDataset?.storeStyle || shopItem.storeStyle || '';
    const address = shopItem.serverDataset?.address || shopItem.address || '';
    
    return `
      <div style="padding: 10px; max-width: 200px;">
        <strong>${name}</strong><br>
        ${style}<br>
        ${address}
      </div>
    `;
  },
  
  /**
   * 인포윈도우 표시 함수
   * @param {google.maps.InfoWindow|React.MutableRefObject<google.maps.InfoWindow>} infoWindow - 인포윈도우 객체 또는 ref
   * @param {google.maps.Marker} anchor - 인포윈도우를 연결할 마커
   * @param {string} content - 인포윈도우에 표시할 HTML 내용
   */
  showInfoWindow: function(infoWindow, anchor, content) {
    // 내부 인포윈도우를 우선 사용 - 모든 인포윈도우 관리를 중앙화
    if (_infoWindow && _infoWindowInitialized) {
      _infoWindow.setContent(content);
      
      if (anchor) {
        _infoWindow.open(anchor.getMap(), anchor);
      } else {
        _infoWindow.open(_mapInstance);
      }
      return;
    }
    
    // 내부 인포윈도우가 없는 경우에만 기존 방식 사용 (하위 호환성)
    if (!infoWindow || !content) return;
    
    // infoWindow가 ref 객체인 경우 current 속성 사용
    const infoWindowInst = infoWindow?.current || infoWindow;
    if (!infoWindowInst) return;
    
    // 인포윈도우 내용 설정
    infoWindowInst.setContent(content);
    
    if (anchor) {
      // 마커에 연결
      infoWindowInst.open(anchor.getMap(), anchor);
    } else {
      // 단순히 열기
      infoWindowInst.open();
    }
  },
  
  /**
   * 마커 생성 함수
   * @param {Object|string} coordinates - 좌표 객체 또는 좌표 문자열
   * @param {string} title - 마커 제목
   * @returns {google.maps.Marker|null} 생성된 마커 또는 null
   */
  createMarker: function(coordinates, title = "") {
    if (!coordinates) return null;
    
    try {
      // 좌표가 문자열로 전달된 경우 파싱
      const position = typeof coordinates === 'string' ? 
        this.parseCoordinates(coordinates) : coordinates;
      
      if (!position) return null;
      
      // 마커 옵션 설정
      const options = {
        position: position,
        title: title,
        ...this.markerOptions
      };
      
      // 마커 생성 (맵에는 연결하지 않음)
      return new window.google.maps.Marker(options);
    } catch (error) {
      console.error('마커 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 폴리곤 생성 함수
   * @param {Array<Object>} paths - 폴리곤 경로 좌표 배열
   * @returns {google.maps.Polygon|null} 생성된 폴리곤 또는 null
   */
  createPolygon: function(paths) {
    if (!paths || !Array.isArray(paths) || paths.length < 3) return null;
    
    try {
      // 폴리곤 옵션 설정
      const options = {
        paths: paths,
        ...this.polygonOptions
      };
      
      // 폴리곤 생성 (맵에는 연결하지 않음)
      return new window.google.maps.Polygon(options);
    } catch (error) {
      console.error('폴리곤 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 상점 아이템에서 마커와 폴리곤 생성
   * @param {Object} item - 상점 아이템 데이터
   * @returns {Object} 생성된 마커와 폴리곤 객체
   */
  createOverlaysFromItem: function(item) {
    if (!item || !item.serverDataset) {
      return { marker: null, polygon: null };
    }
    
    const result = { marker: null, polygon: null };

    // 마커 생성
    if (item.serverDataset.pinCoordinates) {
      const title = item.serverDataset.storeName || '';
      result.marker = this.createMarker(item.serverDataset.pinCoordinates, title);
    }

    // 폴리곤 생성
    if (item.serverDataset.path && item.serverDataset.path.length >= 3) {
      result.polygon = this.createPolygon(item.serverDataset.path);
    }

    return result;
  },

  /**
   * 개별 아이템에 이벤트 등록 (마커, 폴리곤)
   * @param {Object} item - 상점 아이템 데이터
   * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
   * @param {google.maps.InfoWindow} infoWindow - 인포윈도우 객체
   * @param {Object} callbacks - 콜백 함수 모음
   */
  registerItemEvents: function(item, mapInst, infoWindow, callbacks) {
    if (!item || !mapInst || !infoWindow) return;
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected, keepInfoWindowOpen } = callbacks || {};
    
    // 인포윈도우 표시 함수 (내부용)
    const showInfo = (target) => {
      const content = this.createInfoWindowContent(item);
      infoWindow.setContent(content);
      infoWindow.open(mapInst, target);
    };
    
    // 마커 이벤트 등록
    if (item.itemMarker) {
      // 클릭 이벤트
      item.itemMarker.addListener('click', () => {
        if (onItemSelect) onItemSelect(item);
        showInfo(item.itemMarker);
      });
      
      // 마우스오버 이벤트
      item.itemMarker.addListener('mouseover', () => {
        // 선택된 아이템이 아닐 때만 인포윈도우 표시
        if (!isItemSelected || !isItemSelected(item)) {
          showInfo(item.itemMarker);
        }
      });
      
      // 마우스아웃 이벤트
      item.itemMarker.addListener('mouseout', () => {
        // 선택된 아이템이 아닐 때만 인포윈도우 닫기
        if (!isItemSelected || !isItemSelected(item)) {
          infoWindow.close();
        }
      });
    }
    
    // 폴리곤 이벤트 등록 (마커와 유사)
    if (item.itemPolygon) {
      item.itemPolygon.addListener('click', () => {
        if (onItemSelect) onItemSelect(item);
        showInfo(item.itemMarker || null);
      });
      
      item.itemPolygon.addListener('mouseover', () => {
        // 선택된 아이템이 아닐 때만 인포윈도우 표시
        if (!isItemSelected || !isItemSelected(item)) {
          showInfo(item.itemMarker || null);
        }
      });
      
      item.itemPolygon.addListener('mouseout', () => {
        // 선택된 아이템이 아닐 때만 인포윈도우 닫기
        if (!isItemSelected || !isItemSelected(item)) {
          infoWindow.close();
        }
      });
    }

    // 선택된 아이템이면 인포윈도우 표시
    if (isItemSelected && isItemSelected(item) && keepInfoWindowOpen) {
      showInfo(item.itemMarker || null);
    }

  },

  /**
   * 모든 아이템의 이벤트를 한번에 등록하는 함수
   * @param {Array} items - 아이템 배열
   * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
   * @param {google.maps.InfoWindow} infoWindow - 인포윈도우 객체
   * @param {Object} callbacks - 콜백 함수 모음
   */
  registerAllItemsEvents: function(items, mapInst, infoWindow, callbacks) {
    if (!items || !Array.isArray(items)) return;
    
    items.forEach(item => {
      this.registerItemEvents(item, mapInst, infoWindow, callbacks);
    });
  },

  /**
   * 줌 레벨에 따라 폴리곤 가시성을 업데이트하는 함수
   * @param {Object} map - 구글 맵 인스턴스
   * @param {Array} currentItems - 현재 아이템 리스트
   * @deprecated setMap() 메서드를 사용하여 맵을 설정하면 자동으로 관리됩니다
   */
  updatePolygonVisibility: function(map, currentItems) {
    console.warn('[MapOverlayManager] updatePolygonVisibility는 더 이상 사용되지 않습니다. setMap() 메서드를 사용하세요.');
    
    if (!map || !currentItems || !Array.isArray(currentItems)) return;
    
    const zoomLevel = map.getZoom();
    const isVisible = zoomLevel >= 15; // 줌 레벨 15 이상에서만 폴리곤 표시
    
    currentItems.forEach(item => {
      if (item.itemPolygon) {
        item.itemPolygon.setVisible(isVisible);
      }
    });
  },
  
  /**
   * 좌표 문자열을 구글 맵 LatLng 객체로 변환
   * @param {string} coordStr - "위도,경도" 형식의 문자열
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordStr) {
    if (!coordStr || typeof coordStr !== 'string') return null;
    
    try {
      const [lat, lng] = coordStr.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;
      
      return new google.maps.LatLng(lat, lng);
    } catch (error) {
      console.error('좌표 변환 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 좌표 객체를 문자열로 변환
   * @param {google.maps.LatLng|Object} coord - 변환할 좌표 객체
   * @returns {string} "위도,경도" 형식의 문자열
   */
  stringifyCoordinates: function(coord) {
    if (!coord) return '';
    
    try {
      const lat = typeof coord.lat === 'function' ? coord.lat() : coord.lat;
      const lng = typeof coord.lng === 'function' ? coord.lng() : coord.lng;
      
      return `${lat},${lng}`;
    } catch (error) {
      console.error('좌표 문자열 변환 중 오류 발생:', error);
      return '';
    }
  },
  
  /**
   * 여러 아이템의 오버레이를 일괄 등록
   * @param {string} sectionName - 섹션 이름 (예: '반월당')
   * @param {Array} itemList - 상점 데이터 배열 (각 항목은 id, pinCoordinates, path 속성 필요)
   */
  registerOverlaysByItemlist(sectionName, itemList) {
    if (!sectionName || !itemList || !Array.isArray(itemList)) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 오버레이 일괄 등록 시도');
      return;
    }
    
    // 해당 섹션의 오버레이 맵이 없으면 생성
    if (!this._overlaysBySection.has(sectionName)) {
      this._overlaysBySection.set(sectionName, new Map());
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    let registeredCount = 0;
    
    // 각 아이템에 대해 오버레이 생성 및 등록
    itemList.forEach(shopData => {
      if (!shopData || !shopData.id) {
        return; // 유효하지 않은 아이템은 건너뜀
      }
      
      // protoOverlayForShop 객체를 복제하여 새 오버레이 객체 생성
      const overlayObj = { ...protoOverlayForShop };
      
      // shopData로부터 직접 마커와 폴리곤 생성
      try {
        // 마커 생성 (pinCoordinates 필요)
        if (shopData.pinCoordinates) {
          const title = shopData.storeName || '';
          overlayObj.marker = this.createMarker(shopData.pinCoordinates, title);
        }
        
        // 폴리곤 생성 (path 필요, 최소 3개 이상의 좌표점 필요)
        if (shopData.path && shopData.path.length >= 3) {
          overlayObj.polygon = this.createPolygon(shopData.path);
        }
        
        // 오버레이 객체 저장
        sectionMap.set(shopData.id, overlayObj);
        registeredCount++;
      } catch (error) {
        console.error(`[MapOverlayManager] 아이템 ID ${shopData.id}의 오버레이 생성 중 오류 발생:`, error);
      }
    });
    
    console.log(`[MapOverlayManager] ${sectionName} 섹션에 ${registeredCount}개의 오버레이 등록 완료`);
  },
  
  /**
   * 오버레이 객체 등록 (단일 아이템)
   * @param {string} sectionName - 섹션 이름 (예: '반월당')
   * @param {string} id - 상점 고유 ID
   * @param {Object} shopData - 상점 데이터 (pinCoordinates, path 속성 필요)
   * @deprecated registerOverlaysByItemlist를 사용하세요
   */
  registerOverlay(sectionName, id, shopData) {
    console.warn('[MapOverlayManager] registerOverlay는 더 이상 사용되지 않습니다. registerOverlaysByItemlist를 사용하세요.');
    
    if (!sectionName || !id || !shopData) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 오버레이 등록 시도');
      return;
    }
    
    // 해당 섹션의 오버레이 맵이 없으면 생성
    if (!this._overlaysBySection.has(sectionName)) {
      this._overlaysBySection.set(sectionName, new Map());
    }
    
    // protoOverlayForShop 객체를 복제하여 새 오버레이 객체 생성
    const overlayObj = { ...protoOverlayForShop };
    
    // shopData로부터 직접 마커와 폴리곤 생성
    try {
      // 마커 생성 (pinCoordinates 필요)
      if (shopData.pinCoordinates) {
        const title = shopData.storeName || '';
        overlayObj.marker = this.createMarker(shopData.pinCoordinates, title);
      }
      
      // 폴리곤 생성 (path 필요, 최소 3개 이상의 좌표점 필요)
      if (shopData.path && shopData.path.length >= 3) {
        overlayObj.polygon = this.createPolygon(shopData.path);
      }
    } catch (error) {
      console.error('[MapOverlayManager] 오버레이 생성 중 오류 발생:', error);
    }
    
    // 오버레이 객체 저장
    const sectionMap = this._overlaysBySection.get(sectionName);
    sectionMap.set(id, overlayObj);
    
    console.log(`[MapOverlayManager] 오버레이 등록 완료: ${sectionName} - ${id}`);
  },
  
  /**
   * 오버레이 객체 조회
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 상점 고유 ID
   * @returns {Object|null} - 오버레이 객체 또는 null
   */
  getOverlay(sectionName, id) {
    if (!sectionName || !id) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 오버레이 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return null;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    
    // 해당 ID의 오버레이가 없는 경우
    if (!sectionMap.has(id)) {
      console.error(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName} - ${id}`);
      return null;
    }
    
    return sectionMap.get(id);
  },
  
  /**
   * 섹션의 모든 오버레이 객체 조회
   * @param {string} sectionName - 섹션 이름
   * @returns {Array|null} - 오버레이 객체 배열 또는 null
   */
  getSectionOverlays(sectionName) {
    if (!sectionName) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return null;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    return Array.from(sectionMap.values());
  },
  
  /**
   * 섹션 이름으로 모든 오버레이 객체 조회 (getSectionOverlays의 별칭)
   * @param {string} sectionName - 섹션 이름 (예: '반월당')
   * @returns {Array|null} - 오버레이 객체 배열 또는 null
   */
  getOverlaysBySectionName(sectionName) {
    return this.getSectionOverlays(sectionName);
  },
  
  /**
   * 섹션의 모든 오버레이 ID 조회
   * @param {string} sectionName - 섹션 이름
   * @returns {Array|null} - 오버레이 ID 배열 또는 null
   */
  getSectionOverlayIds(sectionName) {
    if (!sectionName) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 ID 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return null;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    return Array.from(sectionMap.keys());
  },
  
  /**
   * 오버레이 객체 제거
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 상점 고유 ID
   * @returns {boolean} - 제거 성공 여부
   */
  removeOverlay(sectionName, id) {
    if (!sectionName || !id) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 오버레이 제거 시도');
      return false;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return false;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    
    // 해당 ID의 오버레이가 없는 경우
    if (!sectionMap.has(id)) {
      console.error(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName} - ${id}`);
      return false;
    }
    
    // 오버레이 제거
    sectionMap.delete(id);
    
    return true;
  },
  
  /**
   * 섹션의 모든 오버레이 제거
   * @param {string} sectionName - 섹션 이름
   * @returns {boolean} - 제거 성공 여부
   */
  clearSectionOverlays(sectionName) {
    if (!sectionName) {
      console.error('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 제거 시도');
      return false;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return false;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    const count = sectionMap.size;
    
    // 섹션 맵 초기화
    sectionMap.clear();
   
    return true;
  },
  
  /**
   * 모든 오버레이 제거
   */
  clearAllOverlays() {
    const sectionCount = this._overlaysBySection.size;
    
    // 모든 섹션 맵 초기화
    this._overlaysBySection.clear();
  },
  
  /**
   * 모든 섹션 이름 조회
   * @returns {Array} - 섹션 이름 배열
   */
  getAllSectionNames() {
    return Array.from(this._overlaysBySection.keys());
  },
  
  /**
   * 섹션 존재 여부 확인
   * @param {string} sectionName - 섹션 이름
   * @returns {boolean} - 존재 여부
   */
  hasSection(sectionName) {
    return this._overlaysBySection.has(sectionName);
  },
  
  /**
   * 오버레이 존재 여부 확인
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 상점 고유 ID
   * @returns {boolean} - 존재 여부
   */
  hasOverlay(sectionName, id) {
    if (!sectionName || !id) return false;
    
    if (!this._overlaysBySection.has(sectionName)) return false;
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    return sectionMap.has(id);
  },
  
  /**
   * 통계 정보 출력
   */
  printStats() {
 
    
    let totalOverlays = 0;
    
    for (const [sectionName, sectionMap] of this._overlaysBySection.entries()) {
      const count = sectionMap.size;
      totalOverlays += count;
    }
  
  },
  
  /**
   * 오버레이 객체 맵에서 제거 (맵에서도 분리)
   * @param {Object} overlay - 오버레이 객체 (marker, polygon 등 포함)
   */
  removeOverlayFromMap(overlay) {
    if (!overlay) return;
    
    // 마커가 있는 경우 맵에서 제거
    if (overlay.marker) {
      overlay.marker.setMap(null);
    }
    
    // 폴리곤이 있는 경우 맵에서 제거
    if (overlay.polygon) {
      overlay.polygon.setMap(null);
    }
    
    // 인포윈도우가 있는 경우 닫기
    if (overlay.infoWindow) {
      overlay.infoWindow.close();
    }
  },
  
  /**
   * 섹션의 모든 오버레이를 맵에서 제거
   * @param {string} sectionName - 섹션 이름
   */
  removeSectionOverlaysFromMap(sectionName) {
    if (!sectionName || !this._overlaysBySection.has(sectionName)) return;
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    
    // 모든 오버레이 객체 순회하며 맵에서 제거
    for (const overlay of sectionMap.values()) {
      this.removeOverlayFromMap(overlay);
    }
  },
  
  /**
   * 모든 오버레이를 맵에서 제거하고 메모리 해제
   * 컴포넌트 언마운트나 프로그램 종료 시 호출
   * @param {Object} options - 옵션 객체
   * @param {Object} options.infoWindow - 닫을 인포윈도우 객체 (선택적)
   */
  cleanup: function(options = {}) {
    try {
      let cleanedCount = 0;
      const { infoWindow } = options;
      
      // 1. 인포윈도우 닫기 (제공된 경우)
      if (infoWindow) {
        if (infoWindow.current) {
          infoWindow.current.close();
        } else if (typeof infoWindow.close === 'function') {
          infoWindow.close();
        }
      }
      
      // 내부 인포윈도우 정리
      this.cleanupInfoWindow();
      
      // 2. 맵 이벤트 리스너 제거
      this.detachMapListeners();
      
      // 3. 내부 저장소의 모든 오버레이 제거
      for (const [sectionName, sectionMap] of this._overlaysBySection.entries()) {
        // 각 섹션의 모든 오버레이 객체 순회
        for (const [id, overlay] of sectionMap.entries()) {
          // 오버레이 맵에서 제거
          this.removeOverlayFromMap(overlay);
          cleanedCount++;
        }
        
        // 섹션 맵 비우기
        sectionMap.clear();
      }
      
      // 4. 전체 오버레이 저장소 비우기
      this._overlaysBySection.clear();
      
      // 5. 맵 인스턴스 참조 제거
      _mapInstance = null;
      
      // 6. 정리 결과 로깅
      console.log(`[MapOverlayManager] ${cleanedCount}개의 오버레이가 성공적으로 정리되었습니다.`);
    } catch (error) {
      console.error('[MapOverlayManager] 오버레이 정리 중 오류 발생:', error);
    }
  },
  
  /**
   * 특정 아이템 목록의 오버레이만 정리
   * @param {Array} items - 정리할 아이템 배열 (itemMarker, itemPolygon 속성 포함)
   * @param {boolean} closeInfoWindow - 인포윈도우 닫기 여부
   * @param {object} infoWindow - 닫을 인포윈도우 객체 (선택적)
   */
  cleanupItems(items, closeInfoWindow = false, infoWindow = null) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.warn('[MapOverlayManager] 정리할 아이템이 없습니다.');
      return;
    }

    try {
      let cleanedCount = 0;
      
      // 각 아이템의 마커와 폴리곤 제거
      items.forEach(item => {
        if (item.itemMarker) {
          item.itemMarker.setMap(null);
          cleanedCount++;
        }
        
        if (item.itemPolygon) {
          item.itemPolygon.setMap(null);
          cleanedCount++;
        }
      });
      
      // 인포윈도우 닫기 (필요한 경우)
      if (closeInfoWindow && infoWindow) {
        if (infoWindow.current) {
          infoWindow.current.close();
        } else if (typeof infoWindow.close === 'function') {
          infoWindow.close();
        }
      }
      
      console.log(`[MapOverlayManager] ${cleanedCount}개의 오버레이가 정리되었습니다.`);
    } catch (error) {
      console.error('[MapOverlayManager] 아이템 오버레이 정리 중 오류 발생:', error);
    }
  },
  
  /**
   * currentItemListRef를 설정하는 함수 (index.js와의 통합을 위한 메서드)
   * @param {React.MutableRefObject} currentItemListRef - 현재 아이템 리스트에 대한 ref 객체
   */
  setCurrentItemListRef: function(currentItemListRef) {
    if (!currentItemListRef) {
      console.error('[MapOverlayManager] 유효하지 않은 currentItemListRef');
      return false;
    }
    
    try {
      // window 객체에 currentItemListRef 저장 (모듈 스코프의 _handleZoomChanged에서 접근 가능하도록)
      window.currentItemListRef = currentItemListRef;
      console.log('[MapOverlayManager] currentItemListRef 설정 완료');
      return true;
    } catch (error) {
      console.error('[MapOverlayManager] currentItemListRef 설정 중 오류 발생:', error);
      return false;
    }
  },
  
  /**
   * Redux 스토어 설정
   * @param {Object} store - Redux 스토어
   */
  setReduxStore: function(store) {
    if (!store || typeof store.dispatch !== 'function' || typeof store.getState !== 'function') {
      console.error('[MapOverlayManager] 유효하지 않은 Redux 스토어입니다.');
      return false;
    }
    
    this._reduxStore = store;
    
    // 스토어를 구독하여 인포윈도우 상태 변화 감지
    this._reduxStore.subscribe(() => {
      _handleInfoWindowStateChange(this._reduxStore.getState());
    });
    
    console.log('[MapOverlayManager] Redux 스토어 설정 완료');
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
   * Redux 통합 인포윈도우 표시
   * @param {Object} item - 상점 데이터
   * @param {google.maps.Marker} marker - 연결할 마커 (선택적)
   * @param {Object} options - 추가 옵션
   */
  showInfoWindowWithRedux: function(item, marker = null, options = {}) {
    if (!this._reduxStore || !item) return;
    
    try {
      // 인포윈도우 콘텐츠 생성
      const content = this.createInfoWindowContent(item);
      
      // 위치 정보 준비
      const position = marker ? marker.getPosition() : 
                      (item.pinCoordinates ? this.parseCoordinates(item.pinCoordinates) : null);
      
      // openInfoWindow 액션 디스패치
      const { openInfoWindow } = require('../../store/slices/mapEventSlice');
      this._reduxStore.dispatch(openInfoWindow({
        content,
        position: position ? { lat: position.lat(), lng: position.lng() } : null,
        markerId: marker ? marker.id : null,
        shopId: item.id || null,
        sectionName: item.locationMap || item.sectionName || null
      }));
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 표시 디스패치 중 오류:', error);
    }
  },
  
  /**
   * 인포윈도우 직접 표시 (Redux 사용하지 않음)
   * 기존과의 호환성을 위해 유지
   * @param {Object} item - 상점 데이터
   * @param {google.maps.Marker} marker - 연결할 마커 (선택적)
   */
  showInfoWindowDirect: function(item, marker = null) {
    if (!_infoWindow || !_mapInstance) {
      // 인포윈도우 또는 맵이 초기화되지 않은 경우 초기화 시도
      if (!_infoWindowInitialized) {
        this.initInfoWindow();
      }
      
      if (!_infoWindow) {
        console.error('[MapOverlayManager] 인포윈도우가 초기화되지 않았습니다.');
        return;
      }
    }
    
    try {
      // customContent가 있으면 그것을 사용, 없으면 생성
      const content = item.customContent || this.createInfoWindowContent(item);
      _infoWindow.setContent(content);
      
      // 마커가 있는 경우 해당 마커에 연결, 아니면 맵 중앙에 표시
      if (marker) {
        _infoWindow.open(_mapInstance, marker);
      } else if (item.itemMarker) {
        _infoWindow.open(_mapInstance, item.itemMarker);
      } else {
        _infoWindow.open(_mapInstance);
      }
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 직접 표시 중 오류:', error);
    }
  },
  
  /**
   * 인포윈도우 초기화
   * 한 번만 호출되어야 합니다.
   * @returns {boolean} 초기화 성공 여부
   */
  initInfoWindow: function() {
    if (_infoWindowInitialized) {
      console.log('[MapOverlayManager] 인포윈도우가 이미 초기화되었습니다.');
      return true;
    }
    
    if (!window.google || !window.google.maps) {
      console.error('[MapOverlayManager] Google Maps API가 로드되지 않았습니다. 인포윈도우 초기화 실패');
      return false;
    }
    
    try {
      // InfoWindow 인스턴스 생성
      _infoWindow = new window.google.maps.InfoWindow({
        maxWidth: 300
      });
      
      // 닫기 이벤트 리스너
      if (this._reduxStore) {
        _infoWindow.addListener('closeclick', () => {
          try {
            const { closeInfoWindow } = require('../../store/slices/mapEventSlice');
            this._reduxStore.dispatch(closeInfoWindow());
          } catch (error) {
            console.error('[MapOverlayManager] 인포윈도우 닫기 이벤트 처리 중 오류:', error);
          }
        });
      }
      
      _infoWindowInitialized = true;
      console.log('[MapOverlayManager] 인포윈도우 초기화 완료');
      return true;
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 초기화 중 오류:', error);
      return false;
    }
  },
  
  /**
   * 인포윈도우 정리
   * MapOverlayManager.cleanup() 전에 호출할 수 있습니다.
   */
  cleanupInfoWindow: function() {
    if (!_infoWindow) return;
    
    try {
      // 이벤트 리스너 제거
      window.google.maps.event.clearInstanceListeners(_infoWindow);
      
      // 닫기
      _infoWindow.close();
      
      // 참조 정리
      _infoWindow = null;
      _infoWindowInitialized = false;
      
      console.log('[MapOverlayManager] 인포윈도우 정리 완료');
    } catch (error) {
      console.error('[MapOverlayManager] 인포윈도우 정리 중 오류:', error);
    }
  },
  
  /**
   * 인포윈도우 가져오기
   * @returns {google.maps.InfoWindow|null} 인포윈도우 인스턴스
   */
  getInfoWindow: function() {
    return _infoWindow;
  },
};

export default MapOverlayManager; 