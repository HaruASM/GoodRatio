/**
 * 맵 오버레이 관리를 위한 싱글톤 객체
 * 섹션 이름별로 상점 오버레이 객체들을 캐싱하고 ID로 조회합니다.
 * mapUtils.js의 기능도 포함합니다.
 */
const MapOverlayManager = {
  // 섹션별 오버레이 데이터 저장소 (sectionName -> Map of overlays)
  _overlaysBySection: new Map(),
  
  // 마커 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  markerOptions: {},
  
  // 폴리곤 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  polygonOptions: {},
  
  /**
   * MapOverlayManager 초기화 함수 - 구글 맵이 완전히 로드된 후에 호출되어야 함
   * window.google.maps.SymbolPath.CIRCLE,같은 부분때문에
   */
  initialize: function() {
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
    
    return true;
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
   */
  updatePolygonVisibility: function(map, currentItems) {
    if (!map || !currentItems || !Array.isArray(currentItems)) return;
    
    const zoomLevel = map.getZoom();
    const isVisible = zoomLevel >= 16; // 줌 레벨 16 이상에서만 폴리곤 표시
    
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
   * 오버레이 객체 등록
   * @param {string} sectionName - 섹션 이름 (예: '반월당')
   * @param {string} id - 상점 고유 ID
   * @param {Object} overlayObj - 오버레이 객체 (marker, polygon 등 포함)
   */
  registerOverlay(sectionName, id, overlayObj) {
    if (!sectionName || !id || !overlayObj) {
      console.log('[MapOverlayManager] 잘못된 파라미터로 오버레이 등록 시도');
      return;
    }
    
    // 해당 섹션의 오버레이 맵이 없으면 생성
    if (!this._overlaysBySection.has(sectionName)) {
      this._overlaysBySection.set(sectionName, new Map());
    }
    
    // 오버레이 객체 저장
    const sectionMap = this._overlaysBySection.get(sectionName);
    sectionMap.set(id, overlayObj);
    
    console.log(`[MapOverlayManager] 오버레이 등록: ${sectionName} - ${id}`);
  },
  
  /**
   * 오버레이 객체 조회
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 상점 고유 ID
   * @returns {Object|null} - 오버레이 객체 또는 null
   */
  getOverlay(sectionName, id) {
    if (!sectionName || !id) {
      console.log('[MapOverlayManager] 잘못된 파라미터로 오버레이 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.log(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return null;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    
    // 해당 ID의 오버레이가 없는 경우
    if (!sectionMap.has(id)) {
      console.log(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName} - ${id}`);
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
      console.log('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.log(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
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
      console.log('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 ID 조회 시도');
      return null;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.log(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
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
      console.log('[MapOverlayManager] 잘못된 파라미터로 오버레이 제거 시도');
      return false;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.log(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return false;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    
    // 해당 ID의 오버레이가 없는 경우
    if (!sectionMap.has(id)) {
      console.log(`[MapOverlayManager] 존재하지 않는 오버레이 ID: ${sectionName} - ${id}`);
      return false;
    }
    
    // 오버레이 제거
    sectionMap.delete(id);
    console.log(`[MapOverlayManager] 오버레이 제거: ${sectionName} - ${id}`);
    
    return true;
  },
  
  /**
   * 섹션의 모든 오버레이 제거
   * @param {string} sectionName - 섹션 이름
   * @returns {boolean} - 제거 성공 여부
   */
  clearSectionOverlays(sectionName) {
    if (!sectionName) {
      console.log('[MapOverlayManager] 잘못된 파라미터로 섹션 오버레이 제거 시도');
      return false;
    }
    
    // 해당 섹션이 없는 경우
    if (!this._overlaysBySection.has(sectionName)) {
      console.log(`[MapOverlayManager] 존재하지 않는 섹션: ${sectionName}`);
      return false;
    }
    
    const sectionMap = this._overlaysBySection.get(sectionName);
    const count = sectionMap.size;
    
    // 섹션 맵 초기화
    sectionMap.clear();
    console.log(`[MapOverlayManager] 섹션 오버레이 전체 제거: ${sectionName} (${count}개)`);
    
    return true;
  },
  
  /**
   * 모든 오버레이 제거
   */
  clearAllOverlays() {
    const sectionCount = this._overlaysBySection.size;
    
    // 모든 섹션 맵 초기화
    this._overlaysBySection.clear();
    console.log(`[MapOverlayManager] 모든 섹션 오버레이 제거 (${sectionCount}개 섹션)`);
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
    console.log('====== MapOverlayManager 통계 ======');
    console.log(`전체 섹션 수: ${this._overlaysBySection.size}`);
    
    let totalOverlays = 0;
    
    for (const [sectionName, sectionMap] of this._overlaysBySection.entries()) {
      const count = sectionMap.size;
      totalOverlays += count;
      console.log(`- ${sectionName}: ${count}개 오버레이`);
    }
    
    console.log(`전체 오버레이 수: ${totalOverlays}`);
    console.log('================================');
  }
};

export default MapOverlayManager; 