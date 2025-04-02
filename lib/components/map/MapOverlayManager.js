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
let _currentActiveSection = null; // 현재 활성화된 섹션
let _selectedItem = null; // 현재 선택된 아이템
let _setSelectedItemCallback = null; // 외부에서 주입된 상점 선택 콜백

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
    
    const { isSingletonInfoWindowOpen, singletonInfoWindowContent } = mapEventState;
    
    // 열려있는 인포윈도우 닫기
    if (!isSingletonInfoWindowOpen) {
      _infoWindow.close();
      console.log('[MapOverlayManager] 인포윈도우가 닫혔습니다.');
      return;
    }
    
    // 인포윈도우 열기
    if (isSingletonInfoWindowOpen && singletonInfoWindowContent) {
      // 기존에 열려 있으면 먼저 닫기
      _infoWindow.close();
      
      // 콘텐츠 설정
      if (singletonInfoWindowContent.content) {
        _infoWindow.setContent(singletonInfoWindowContent.content);
      } else if (singletonInfoWindowContent.shopId && singletonInfoWindowContent.sectionName) {
        // content가 없지만 shopId와 sectionName이 있는 경우
        // 여기서 필요한 데이터를 가져와 콘텐츠 생성 (예: API 호출 등)
        // 혹은 기본 콘텐츠 설정
        const shopId = singletonInfoWindowContent.shopId;
        const sectionName = singletonInfoWindowContent.sectionName;
        
        _infoWindow.setContent(`
          <div style="padding: 10px; max-width: 200px;">
            <strong>ID: ${shopId}</strong><br>
            섹션: ${sectionName}<br>
          </div>
        `);
      }
      
      // 위치가 있으면 해당 위치에 표시
      if (singletonInfoWindowContent.position) {
        const position = new window.google.maps.LatLng(
          singletonInfoWindowContent.position.lat,
          singletonInfoWindowContent.position.lng
        );
        _infoWindow.setPosition(position);
        _infoWindow.open(_mapInstance);
        console.log('[MapOverlayManager] 인포윈도우를 위치에 표시:', position);
      } else if (singletonInfoWindowContent.markerId) {
        // TODO: 마커 ID로 마커 참조를 찾아 연결
        // 현재는 직접 마커 참조를 사용하기 때문에 이 부분은 구현되지 않음
        _infoWindow.open(_mapInstance);
        console.log('[MapOverlayManager] 인포윈도우를 마커에 표시:', singletonInfoWindowContent.markerId);
      } else {
        // 마커가 없는 경우 맵 중앙에 표시
        _infoWindow.open(_mapInstance);
        console.log('[MapOverlayManager] 인포윈도우를 맵 중앙에 표시');
      }
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
      strokeColor: '#FF0000', 
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000', 
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
    window.google.maps.event.clearListeners(_mapInstance, 'zoom_changed');
    
    _isEventListenersAttached = false;
    console.log('[MapOverlayManager] 맵 이벤트 리스너 제거 완료');
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

        // 인포윈도우 생성
        overlayObj.infoWindow = this.createInfoWindow(shopData);

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
   * 좌표 문자열을 구글 맵 LatLng 객체로 변환
   * @param {string} coordStr - "위도,경도" 형식의 문자열
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordStr) {
    if (!coordStr || typeof coordStr !== 'string') return null;
    
    try {
      const [lat, lng] = coordStr.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;
      
      return new window.google.maps.LatLng(lat, lng);
    } catch (error) {
      console.error('좌표 변환 중 오류 발생:', error);
      return null;
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
        _infoWindow.addListener('closeclick', () => {  // 인포창의 닫기 X 버튼 이벤트 바인딩 
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
   * 맵 인포윈도우 생성 함수
   * @param {Object} shopData - 상점 데이터
   * @returns {google.maps.InfoWindow|null} 생성된 인포윈도우 또는 null
   */
  createInfoWindow: function(shopData) {
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
      return new window.google.maps.InfoWindow(options);
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
      // 1. 기존에 열린 인포윈도우가 있으면 닫기
      if (_infoWindow) {
        _infoWindow.close();
      }
      
      // 2. 오버레이 객체 조회 - 내부 DB에서 검색
    const sectionMap = this._overlaysBySection.get(sectionName);
      if (!sectionMap) {
        console.error(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
        return false;
      }
      
      const overlay = sectionMap.get(id);
      if (!overlay) {
        console.error(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName}/${id}`);
        return false;
      }
      
      // 3. 인포윈도우 초기화 확인
      if (!_infoWindowInitialized) {
        this.initInfoWindow();
      }
      
      if (!_infoWindow) {
        console.error('[MapOverlayManager] 인포윈도우 초기화 실패');
      return false;
    }
    
      // 4. 오버레이 객체의 인포윈도우 사용
      if (overlay.infoWindow) {
        // 이미 생성된 인포윈도우 콘텐츠 가져오기
        try {
          const content = overlay.infoWindow.getContent();
          _infoWindow.setContent(content);
        } catch (e) {
          // 콘텐츠를 가져올 수 없는 경우 기본 콘텐츠 생성
          const name = overlay.marker?.getTitle() || `ID: ${id}`;
          const content = `
            <div style="padding: 10px; max-width: 200px;">
              <strong>${name}</strong><br>
              섹션: ${sectionName}<br>
            </div>
          `;
          _infoWindow.setContent(content);
        }
      } else {
        // 인포윈도우가 없는 경우 기본 콘텐츠 생성
        const name = overlay.marker?.getTitle() || `ID: ${id}`;
        const content = `
          <div style="padding: 10px; max-width: 200px;">
            <strong>${name}</strong><br>
            섹션: ${sectionName}<br>
          </div>
        `;
        _infoWindow.setContent(content);
      }
      
      // 5. 인포윈도우 열기
      if (overlay.marker) {
        _infoWindow.open(_mapInstance, overlay.marker);
        
        // 6. 마커 바운스 애니메이션 적용
        overlay.marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => {
          if (overlay.marker) {
            overlay.marker.setAnimation(null);
          }
        }, 750); // 바운스 1-2회 후 중지
      } else {
        _infoWindow.open(_mapInstance);
      }
      
      console.log(`[MapOverlayManager] 싱글톤 인포윈도우 열기 성공: ${sectionName}/${id}`);
    return true;
    } catch (error) {
      console.error('[MapOverlayManager] 싱글톤 인포윈도우 표시 중 오류:', error);
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
    
    // 이전 활성 섹션이 있으면 오버레이 숨기기
    if (this._layers.activeSection && this._layers.activeSection !== sectionNameforNow) {
      const ovelaysPrevSection = this._overlaysBySection.get(this._layers.activeSection);
      if (ovelaysPrevSection) {
        console.log(`[MapOverlayManager] 이전 섹션 "${this._layers.activeSection}"의 오버레이를 숨깁니다.`);
        
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
    const sectionMap = this._overlaysBySection.get(sectionNameforNow);
    if (sectionMap) {
      console.log(`[MapOverlayManager] 새 섹션 "${sectionNameforNow}"의 오버레이를 표시합니다.`);
      
      sectionMap.forEach((overlay, id) => {
        if (overlay.marker) {
          overlay.marker.setMap(_mapInstance);
        }
        if (overlay.polygon) {
          const currentZoom = _mapInstance.getZoom();
          const isVisible = currentZoom >= 15;
          overlay.polygon.setMap(_mapInstance);
          overlay.polygon.setVisible(isVisible);
        }
      });
    } else {
      console.warn(`[MapOverlayManager] 섹션 "${sectionNameforNow}"의 오버레이가 등록되지 않았습니다.`);
    }
    
    _currentActiveSection = sectionNameforNow;
    return true;
  },

  /**
   * 개별 아이템에 이벤트 등록 (마커, 폴리곤)
   * @param {Object} item - 상점 아이템 데이터
   * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
   * @param {null} _ - 더 이상 사용하지 않음 (호환성 유지)
   * @param {Object} callbacks - 콜백 함수 모음
   */
  registerItemEvents: function(item, mapInst, _, callbacks) {
    if (!item || !mapInst) return;
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected } = callbacks || {};
    
    // 마커 이벤트 등록
    if (item.itemMarker) {
      // 클릭 이벤트
      item.itemMarker.addListener('click', () => {
        if (onItemSelect) onItemSelect(item);
      });
      
      // 마우스오버 이벤트
      item.itemMarker.addListener('mouseover', () => {
        // 선택된 아이템이 아닐 때만 처리
        if (!isItemSelected || !isItemSelected(item)) {
          if (onItemSelect) onItemSelect(item);
        }
      });
    }
    
    // 폴리곤 이벤트 등록 (마커와 유사)
    if (item.itemPolygon) {
      item.itemPolygon.addListener('click', () => {
        if (onItemSelect) onItemSelect(item);
      });
      
      item.itemPolygon.addListener('mouseover', () => {
        // 선택된 아이템이 아닐 때만 처리
        if (!isItemSelected || !isItemSelected(item)) {
          if (onItemSelect) onItemSelect(item);
        }
      });
    }
  },

  /**
   * 모든 아이템의 이벤트를 한번에 등록하는 함수
   * @param {Array} items - 아이템 배열
   * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
   * @param {null} _ - 더 이상 사용하지 않음 (호환성 유지)
   * @param {Object} callbacks - 콜백 함수 모음
   */
  registerAllItemsEvents: function(items, mapInst, _, callbacks) {
    if (!items || !Array.isArray(items)) return;
    
    items.forEach(item => {
      this.registerItemEvents(item, mapInst, null, callbacks);
    });
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
    
    // 아이템에서 오버레이 생성 및 등록
    this.registerOverlaysByItemlist(sectionName, items);
    
    // 활성 섹션인 경우에만 지도에 표시
    if (this._layers.activeSection === sectionName) {
      const sectionMap = this._overlaysBySection.get(sectionName);
      if (sectionMap) {
        sectionMap.forEach((overlay, id) => {
          if (overlay.marker) {
            overlay.marker.setMap(_mapInstance);
          }
          if (overlay.polygon) {
            const zoomLevel = _mapInstance.getZoom();
            const isVisible = zoomLevel >= 15;
            overlay.polygon.setMap(_mapInstance);
            overlay.polygon.setVisible(isVisible);
          }
        });
      }
    }
    
    // 아이템 이벤트 바인딩 (내부에서 처리)
    this._bindSectionItemsEvents(sectionName, onSelectCallback);
    
    return true;
  },
  
  /**
   * 섹션 아이템에 이벤트 바인딩 (내부 함수)
   * @private
   * @param {string} sectionName - 섹션 이름
   * @param {Function} onSelectCallback - 선택 콜백
   */
  _bindSectionItemsEvents: function(sectionName, onSelectCallback) {
    if (!sectionName || !this._overlaysBySection.has(sectionName)) return;
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    let selectedItemId = null;
    
    sectionMap.forEach((overlay, id) => {
      const item = { id: id, sectionName: sectionName };
      
      // 마커 이벤트
      if (overlay.marker) {
        // 클릭 이벤트
        overlay.marker.addListener('click', () => {
          selectedItemId = id;
          if (onSelectCallback) onSelectCallback(id, sectionName, overlay);
          
          // 인포윈도우 표시
          this.openSingletonInfoWindow(sectionName, id);
        });
        
        // 마우스오버 이벤트
        overlay.marker.addListener('mouseover', () => {
          if (selectedItemId !== id) {
            this.openSingletonInfoWindow(sectionName, id);
          }
        });
      }
      
      // 폴리곤 이벤트
      if (overlay.polygon) {
        // 클릭 이벤트
        overlay.polygon.addListener('click', () => {
          selectedItemId = id;
          if (onSelectCallback) onSelectCallback(id, sectionName, overlay);
          
          // 인포윈도우 표시
          this.openSingletonInfoWindow(sectionName, id);
        });
        
        // 마우스오버 이벤트
        overlay.polygon.addListener('mouseover', () => {
          if (selectedItemId !== id) {
            this.openSingletonInfoWindow(sectionName, id);
          }
        });
      }
    });
  },
  
  /**
   * 모든 오버레이 및 이벤트 리스너 정리
   * 컴포넌트 언마운트 시 호출되어야 함
   */
  cleanup: function() {
    try {
      console.log('[MapOverlayManager] 리소스 정리 시작');
      
      // Google Maps API 가용성 확인
      const isGoogleMapsAvailable = window.google && window.google.maps;
      
      // 1. 맵 이벤트 리스너 제거
      this.detachMapListeners();
      
      // 2. 인포윈도우 닫기
      if (_infoWindow) {
        _infoWindow.close();
        _infoWindow = null;
        _infoWindowInitialized = false;
      }
      
      // 3. 모든 섹션의 모든 오버레이 제거
      this._overlaysBySection.forEach((sectionMap, sectionName) => {
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
      this._overlaysBySection.clear();
      
      // 5. 레이어 상태 초기화
      this._layers.activeSection = null;
      this._layers.visibleSections.clear();
      
      // 6. 현재 선택된 아이템 초기화
      _selectedItem = null;
      _setSelectedItemCallback = null;
      
      // 7. 맵 인스턴스 참조 제거
      _mapInstance = null;
      
      console.log('[MapOverlayManager] 리소스 정리 완료');
    } catch (error) {
      console.error('[MapOverlayManager] 리소스 정리 중 오류 발생:', error);
    }
  }
};

export default MapOverlayManager; 