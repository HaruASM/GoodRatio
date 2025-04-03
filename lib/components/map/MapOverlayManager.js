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
// 현재 표시 중인 인포윈도우 정보 저장 (이제 ID만 저장)
let _infoWindowforSingleton = null; 
let _currentActiveSection = null; // 현재 활성화된 섹션
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
    if (!this._overlaysBySection.has(sectionName)) {
      this._overlaysBySection.set(sectionName, new Map());
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    let registeredCount = 0;
    
    // 콜백 함수 확인
    const { onItemSelect, isItemSelected } = callbacks || {};
    
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
          console.log('[MapOverlayManager] 마커 생성 완료', overlayObj.marker);
    
    // 마커 이벤트 등록
          if (overlayObj.marker) {
      // 클릭 이벤트
            overlayObj.marker.addListener('click', () => {
              // 인포윈도우 표시
              this.openSingletonInfoWindow(sectionName, shopData.id);
              
              // 외부 콜백 호출 (있는 경우)
              if (onItemSelect) onItemSelect(shopData);
      });
      
      // 마우스오버 이벤트
            overlayObj.marker.addListener('mouseover', () => {
              // 현재 선택된 아이템이 아닌 경우에만 인포윈도우 표시
              const notSelected = isItemSelected ? !isItemSelected(shopData) : true;
              if (_infoWindowforSingleton !== shopData.id && notSelected) {
                this.openSingletonInfoWindow(sectionName, shopData.id);
                
                // 외부 콜백 호출 (있는 경우)
                if (onItemSelect) onItemSelect(shopData);
        }
      });
    }
        }
        
        // 폴리곤 생성 (path 필요, 최소 3개 이상의 좌표점 필요)
        if (shopData.path && shopData.path.length >= 3) {
          overlayObj.polygon = this.createPolygon(shopData.path);
          console.log('[MapOverlayManager] 폴리곤 생성 완료', overlayObj.polygon);
          
          // 폴리곤 이벤트 등록
          if (overlayObj.polygon) {
            // 클릭 이벤트
            overlayObj.polygon.addListener('click', () => {
              // 인포윈도우 표시
              this.openSingletonInfoWindow(sectionName, shopData.id);
              
              // 외부 콜백 호출 (있는 경우)
              if (onItemSelect) onItemSelect(shopData);
            });
            
            // 마우스오버 이벤트
            overlayObj.polygon.addListener('mouseover', () => {
              // 현재 선택된 아이템이 아닌 경우에만 인포윈도우 표시
              const notSelected = isItemSelected ? !isItemSelected(shopData) : true;
              if (_infoWindowforSingleton !== shopData.id && notSelected) {
                this.openSingletonInfoWindow(sectionName, shopData.id);
                
                // 외부 콜백 호출 (있는 경우)
                if (onItemSelect) onItemSelect(shopData);
        }
      });
    }
        }

        // 인포윈도우 생성 - 섹션명 전달하여 이벤트 바인딩까지 완료
        overlayObj.infoWindow = this.createInfoWindow(shopData, sectionName);

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
   * @param {Object|string} coordinates - 좌표 객체 또는 좌표 문자열
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    if (!coordinates) return null;
    
    try {
      // 이미 객체 형태인 경우 ({lat, lng})
      if (typeof coordinates === 'object' && coordinates !== null) {
        // lat, lng 속성이 있는 객체인 경우
        if ('lat' in coordinates && 'lng' in coordinates) {
          const lat = typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat;
          const lng = typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng;
          return new window.google.maps.LatLng(lat, lng);
        }
        return null;
      }
      
      // 문자열인 경우 (기존 호환성 유지)
      if (typeof coordinates === 'string') {
        const [lat, lng] = coordinates.split(',').map(Number);
        if (isNaN(lat) || isNaN(lng)) return null;
        
        return new window.google.maps.LatLng(lat, lng);
      }
      
      return null;
    } catch (error) {
      console.error('좌표 변환 중 오류 발생:', error);
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
          const prevSectionMap = this._overlaysBySection.get(prevSectionName);
          if (prevSectionMap) {
            const prevOverlay = prevSectionMap.get(_infoWindowforSingleton);
            if (prevOverlay && prevOverlay.infoWindow) {
              prevOverlay.infoWindow.close();
            }
          }
        }
      }
      
      // 2. 새 인포윈도우 표시
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
      
      // 3. 해당 오버레이의 인포윈도우 열기
      if (!overlay.infoWindow) {
        console.error(`[MapOverlayManager] 존재하지 않는 인포윈도우 ID: ${sectionName}/${id}`);
      }
      
      // 4. 인포윈도우 열기
      if (overlay.marker) {
        overlay.infoWindow.open(_mapInstance, overlay.marker);
        
        // 5. 마커 바운스 애니메이션 적용
        overlay.marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => {
          if (overlay.marker) {
            overlay.marker.setAnimation(null);
          }
        }, 750); // 바운스 1-2회 후 중지
      } else {
        overlay.infoWindow.open(_mapInstance);
      }
      
      // 6. 현재 열린 인포윈도우 정보 업데이트 (이제 ID만 저장)
      _infoWindowforSingleton = id;
      
      console.log(`[MapOverlayManager] 싱글톤 인포윈도우 열기 성공: ${sectionName}/${id}`);
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
      const sectionMap = this._overlaysBySection.get(_currentActiveSection);
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
   
    return true;
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
      this.closeSingletonInfoWindow();
      
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
      
      // 8. 인포윈도우 참조 정보 초기화
      _infoWindowforSingleton = null;
      
      console.log('[MapOverlayManager] 리소스 정리 완료');
    } catch (error) {
      console.error('[MapOverlayManager] 리소스 정리 중 오류 발생:', error);
    }
  }
};

export default MapOverlayManager; 