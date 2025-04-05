/**
 * @fileoverview 오버레이 생성, 이벤트 처리, 인포윈도우 관리를 담당하는 서비스
 * @module lib/components/map/OverlayService
 */

// 변수 선언을 객체로 캡슐화
const _cache = {
  mapInstance: null,
  infoWindows: new Map(), // ID로 인포윈도우 참조 저장
  activeInfoWindowId: null
};

/**
 * 오버레이 서비스 - 마커, 폴리곤, 이미지 오버레이, 인포윈도우 생성 및 관리
 */
const OverlayService = {
  /**
   * 서비스 초기화
   * @param {google.maps.Map} mapInstance - 구글 맵 인스턴스
   */
  initialize: function(mapInstance) {
    if (!mapInstance || !window.google || !window.google.maps) {
      console.error('[OverlayService] 유효하지 않은 맵 인스턴스입니다.');
      return false;
    }
    _cache.mapInstance = mapInstance;
    return true;
  },

  /**
   * 맵 인스턴스 가져오기
   * @returns {google.maps.Map} 맵 인스턴스
   */
  getMapInstance: function() {
    return _cache.mapInstance;
  },

  /**
   * 마커 생성 함수
   * @param {Object|string} coordinates - 좌표 객체 또는 좌표 문자열
   * @param {string} title - 마커 제목
   * @param {Object} options - 마커 옵션
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createMarker: function(coordinates, title = "", options = {}) {
    if (!coordinates) {
      console.error('[OverlayService] 마커 생성 실패: 좌표가 제공되지 않았습니다');
      return null;
    }
    
    try {
      // 좌표 객체 파싱
      const position = this.parseCoordinates(coordinates);
      
      if (!position) {
        console.error('[OverlayService] 마커 생성 실패: 좌표 파싱 실패', coordinates);
        return null;
      }
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // PinElement 사용 확인
      if (!window.google.maps.marker.PinElement) {
        console.error('[OverlayService] PinElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 기본 옵션
      const defaultOptions = {
        background: "#FBBC04",
        scale: 1
      };
      
      // PinElement 옵션 (zIndex 제외)
      const pinOptions = { 
        background: options.background || defaultOptions.background, 
        scale: options.scale || defaultOptions.scale 
      };
      
      // PinElement 생성
      const pin = new window.google.maps.marker.PinElement(pinOptions);
      
      // zIndex 처리를 위한 래퍼 div 생성 (필요한 경우)
      let content = pin.element;
      if (options.zIndex) {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.style.zIndex = options.zIndex;
        wrapperDiv.appendChild(pin.element);
        content = wrapperDiv;
      }
      
      // AdvancedMarkerElement 생성
      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: content,
        title: title,
        map: _cache.mapInstance
      });
      
      return advancedMarker;
    } catch (error) {
      console.error('[OverlayService] 마커 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 폴리곤 생성 함수
   * @param {Array} path - 폴리곤 좌표 배열 [{lat, lng}, ...]
   * @param {Object} options - 폴리곤 옵션
   * @returns {google.maps.Polygon|null} 생성된 폴리곤 또는 null
   */
  createPolygon: function(path, options = {}) {
    if (!path || !Array.isArray(path) || path.length < 3) {
      console.error('[OverlayService] 폴리곤 생성 실패: 유효하지 않은 경로 좌표', path);
      return null;
    }
    
    try {
      // 좌표 배열 파싱
      const parsedPath = path.map(coord => this.parseCoordinates(coord));
      
      // 기본 옵션
      const defaultOptions = {
        strokeColor: '#FF0000', 
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000', 
        fillOpacity: 0.35
      };
      
      // 폴리곤 옵션 설정
      const polygonOptions = {
        paths: parsedPath,
        ...defaultOptions,
        ...options
      };
      
      // 폴리곤 생성
      const polygon = new window.google.maps.Polygon(polygonOptions);
      
      return polygon;
    } catch (error) {
      console.error('[OverlayService] 폴리곤 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 이미지 오버레이 생성 함수
   * @param {Object} coordinates - 이미지를 표시할 좌표
   * @param {string} imageUrl - 이미지 URL
   * @param {number} [width=100] - 이미지 폭(px)
   * @param {number} [height=100] - 이미지 높이(px)
   * @param {Object} [options] - 추가 옵션
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createImageOverlay: function(coordinates, imageUrl, width = 100, height = 100, options = {}) {
    if (!coordinates) {
      console.error('[OverlayService] 이미지 오버레이 생성 실패: 좌표가 제공되지 않았습니다');
      return null;
    }
    
    try {
      // 좌표 객체 파싱
      const position = this.parseCoordinates(coordinates);
      
      if (!position) {
        console.error('[OverlayService] 이미지 오버레이 생성 실패: 좌표 파싱 실패', coordinates);
        return null;
      }
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 이미지 요소 생성
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.width = width;
      imgElement.height = height;
      imgElement.style.borderRadius = options.borderRadius || '8px';
      imgElement.style.boxShadow = options.boxShadow || '0 2px 8px rgba(0, 0, 0, 0.3)';
      imgElement.style.border = options.border || '2px solid white';
      
      // 컨테이너 요소 생성
      const containerElement = document.createElement('div');
      containerElement.appendChild(imgElement);
      containerElement.style.position = 'relative';
      
      // 마커 옵션
      const markerOptions = {
        position: position,
        content: containerElement,
        map: _cache.mapInstance,
        zIndex: options.zIndex || 10 // 다른 마커보다 위에 표시
      };
      
      // AdvancedMarkerElement 생성
      const advancedMarker = new window.google.maps.marker.AdvancedMarkerElement(markerOptions);
      
      return advancedMarker;
    } catch (error) {
      console.error('[OverlayService] 이미지 오버레이 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 인포윈도우 생성 함수
   * @param {Object} content - 인포윈도우에 표시할 콘텐츠 (HTML 문자열 또는 DOM 요소)
   * @param {Object} options - 인포윈도우 옵션
   * @returns {google.maps.InfoWindow|null} 생성된 인포윈도우 또는 null
   */
  createInfoWindow: function(content, options = {}) {
    if (!window.google || !window.google.maps) {
      console.error('[OverlayService] Google Maps API가 로드되지 않았습니다. 인포윈도우 생성 실패');
      return null;
    }
    
    // 기본 옵션
    const defaultOptions = {
      content: content,
      maxWidth: 200,
      disableAutoPan: true,
      pixelOffset: new window.google.maps.Size(0, -5),
      closeOnClick: false,
      backgroundColor: 'transparent',
      boxStyle: {
        border: 'none',
        padding: '0',
        backgroundColor: 'transparent',
        boxShadow: 'none'
      }
    };
    
    // 사용자 옵션 적용
    const infoWindowOptions = { ...defaultOptions, ...options };
    
    try {
      // 인포윈도우 생성
      const infoWindow = new window.google.maps.InfoWindow(infoWindowOptions);
      
      return infoWindow;
    } catch (error) {
      console.error('[OverlayService] 인포윈도우 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 싱글톤 인포윈도우 열기
   * @param {Object} overlay - 인포윈도우를 연결할 오버레이 (마커 또는 폴리곤)
   * @param {Object|string} content - 인포윈도우에 표시할 콘텐츠
   * @param {string} id - 인포윈도우 ID
   * @param {Object} options - 인포윈도우 옵션
   * @returns {google.maps.InfoWindow|null} 생성된 인포윈도우 또는 null
   */
  openInfoWindow: function(overlay, content, id, options = {}) {
    // 기존 인포윈도우 닫기
    this.closeInfoWindow();
    
    // 인포윈도우 생성 및 표시
    const infoWindow = this.createInfoWindow(content, options);
    if (!infoWindow) return null;
    
    // ID 저장
    _cache.activeInfoWindowId = id;
    
    // 인포윈도우 참조 저장
    _cache.infoWindows.set(id, infoWindow);
    
    try {
      // 오버레이 타입에 따라 다른 동작
      if (overlay instanceof window.google.maps.marker.AdvancedMarkerElement) {
        // 마커 위치 기반 설정
        infoWindow.setPosition(overlay.position);
      } else if (overlay instanceof window.google.maps.Polygon) {
        // 폴리곤 중심점 계산
        const bounds = new window.google.maps.LatLngBounds();
        overlay.getPath().forEach(latLng => bounds.extend(latLng));
        infoWindow.setPosition(bounds.getCenter());
      } else if (options.position) {
        // 직접 위치 지정
        infoWindow.setPosition(options.position);
      }
      
      // 맵에 표시
      infoWindow.open(_cache.mapInstance);
      
      return infoWindow;
    } catch (error) {
      console.error('[OverlayService] 인포윈도우 열기 중 오류 발생:', error);
      this.closeInfoWindow();
      return null;
    }
  },
  
  /**
   * 현재 열린 인포윈도우 닫기
   */
  closeInfoWindow: function() {
    const id = _cache.activeInfoWindowId;
    if (id && _cache.infoWindows.has(id)) {
      const infoWindow = _cache.infoWindows.get(id);
      if (infoWindow) {
        infoWindow.close();
      }
      _cache.infoWindows.delete(id);
      _cache.activeInfoWindowId = null;
    }
  },
  
  /**
   * 오버레이에 이벤트 리스너 추가
   * @param {Object} overlay - 이벤트를 추가할 오버레이 (마커 또는 폴리곤)
   * @param {Object} events - 이벤트 객체 {eventName: callback}
   */
  addEventListeners: function(overlay, events) {
    if (!overlay || !events) return;
    
    try {
      const isAdvancedMarker = overlay instanceof window.google.maps.marker.AdvancedMarkerElement;
      
      // 이벤트 타입별 처리
      Object.entries(events).forEach(([eventName, callback]) => {
        if (isAdvancedMarker) {
          // AdvancedMarkerElement는 addEventListener 사용
          // 이벤트 이름 매핑 (일반 -> gmp-)
          const mappedEventName = 
            eventName === 'click' ? 'gmp-click' :
            eventName === 'mouseover' ? 'gmp-pointerenter' :
            eventName === 'mouseout' ? 'gmp-pointerleave' :
            eventName;
          
          overlay.addEventListener(mappedEventName, (e) => callback(overlay, e));
        } else {
          // Polygon 등은 addListener 사용
          overlay.addListener(eventName, (e) => callback(overlay, e));
        }
      });
    } catch (error) {
      console.error('[OverlayService] 이벤트 리스너 추가 중 오류 발생:', error);
    }
  },
  
  /**
   * 오버레이에서 이벤트 리스너 제거
   * @param {Object} overlay - 이벤트를 제거할 오버레이 (마커 또는 폴리곤)
   */
  removeEventListeners: function(overlay) {
    if (!overlay) return;
    
    try {
      if (overlay instanceof window.google.maps.marker.AdvancedMarkerElement) {
        // AdvancedMarkerElement는 content를 복제하여 모든 이벤트 제거
        if (overlay.content) {
          const clone = overlay.content.cloneNode(true);
          if (overlay.content.parentNode) {
            overlay.content.parentNode.replaceChild(clone, overlay.content);
          }
          overlay.content = clone;
        }
      } else {
        // Polygon 등은 clearInstanceListeners 사용
        window.google.maps.event.clearInstanceListeners(overlay);
      }
    } catch (error) {
      console.error('[OverlayService] 이벤트 리스너 제거 중 오류 발생:', error);
    }
  },
  
  /**
   * 오버레이 일괄 등록
   * @param {Array<Object>} itemList - 아이템 데이터 배열
   * @param {Object} options - 등록 옵션
   * @returns {Object} 등록된 오버레이 맵
   */
  registerOverlays: function(itemList, options = {}) {
    const results = {
      markers: new Map(),
      polygons: new Map(),
      infoWindows: new Map()
    };
    
    if (!itemList || !Array.isArray(itemList)) {
      console.error('[OverlayService] 오버레이 일괄 등록 실패: 유효하지 않은 아이템 리스트');
      return results;
    }
    
    itemList.forEach(item => {
      if (!item || !item.id) {
        console.warn('[OverlayService] ID가 없는 아이템은 건너뜁니다');
        return;
      }
      
      const itemId = item.id;
      const itemTitle = item.storeName || '';
      
      // 마커 생성 및 등록
      if (item.pinCoordinates) {
        const marker = this.createMarker(item.pinCoordinates, itemTitle, options.markerOptions);
        
        if (marker) {
          // 마커에 ID와 섹션 이름 메타데이터 저장
          if (marker.content) {
            marker.content.dataset.itemId = itemId;
            marker.content.dataset.sectionName = options.sectionName || '';
          }
          
          // 이벤트 등록
          if (options.events) {
            this.addEventListeners(marker, options.events);
          }
          
          results.markers.set(itemId, marker);
        }
      }
      
      // 폴리곤 생성 및 등록
      if (item.path && Array.isArray(item.path) && item.path.length >= 3) {
        const polygon = this.createPolygon(item.path, options.polygonOptions);
        
        if (polygon) {
          // 폴리곤에 ID와 섹션 이름 메타데이터 저장
          polygon.set('itemId', itemId);
          polygon.set('sectionName', options.sectionName || '');
          
          // 이벤트 등록
          if (options.events) {
            this.addEventListeners(polygon, options.events);
          }
          
          results.polygons.set(itemId, polygon);
        }
      }
    });
    
    return results;
  },
  
  /**
   * 오버레이 가시성 설정
   * @param {Object} overlay - 오버레이 객체 (마커 또는 폴리곤)
   * @param {boolean} visible - 가시성 상태
   */
  setOverlayVisibility: function(overlay, visible) {
    if (!overlay) return;
    
    try {
      if (overlay instanceof window.google.maps.marker.AdvancedMarkerElement) {
        overlay.style.display = visible ? 'block' : 'none';
      } else if (overlay instanceof window.google.maps.Polygon) {
        overlay.setVisible(visible);
      }
    } catch (error) {
      console.error('[OverlayService] 가시성 설정 중 오류 발생:', error);
    }
  },
  
  /**
   * 오버레이 컬렉션의 가시성 설정
   * @param {Map|Object|Array} overlays - 오버레이 컬렉션
   * @param {boolean} visible - 가시성 상태
   */
  setOverlaysVisibility: function(overlays, visible) {
    if (!overlays) return;
    
    try {
      if (overlays instanceof Map) {
        overlays.forEach(overlay => this.setOverlayVisibility(overlay, visible));
      } else if (Array.isArray(overlays)) {
        overlays.forEach(overlay => this.setOverlayVisibility(overlay, visible));
      } else if (typeof overlays === 'object') {
        Object.values(overlays).forEach(overlay => this.setOverlayVisibility(overlay, visible));
      }
    } catch (error) {
      console.error('[OverlayService] 다중 오버레이 가시성 설정 중 오류 발생:', error);
    }
  },
  
  /**
   * 단일 오버레이 정리
   * @param {Object} overlay - 정리할 오버레이
   */
  cleanupOverlay: function(overlay) {
    if (!overlay) return;
    
    try {
      // 이벤트 리스너 제거
      this.removeEventListeners(overlay);
      
      // 오버레이 타입별 정리
      if (overlay instanceof window.google.maps.marker.AdvancedMarkerElement) {
        overlay.map = null;
      } else if (overlay instanceof window.google.maps.Polygon) {
        overlay.setMap(null);
      } else if (overlay instanceof window.google.maps.InfoWindow) {
        overlay.close();
      }
    } catch (error) {
      console.error('[OverlayService] 오버레이 정리 중 오류 발생:', error);
    }
  },
  
  /**
   * 오버레이 컬렉션 정리
   * @param {Map|Object|Array} overlays - 정리할 오버레이 컬렉션
   */
  cleanupOverlays: function(overlays) {
    if (!overlays) return;
    
    try {
      if (overlays instanceof Map) {
        overlays.forEach(overlay => this.cleanupOverlay(overlay));
        overlays.clear();
      } else if (Array.isArray(overlays)) {
        overlays.forEach(overlay => this.cleanupOverlay(overlay));
        overlays.length = 0;
      } else if (typeof overlays === 'object') {
        Object.values(overlays).forEach(overlay => this.cleanupOverlay(overlay));
        for (const key in overlays) delete overlays[key];
      }
    } catch (error) {
      console.error('[OverlayService] 다중 오버레이 정리 중 오류 발생:', error);
    }
  },
  
  /**
   * 좌표 객체를 구글 맵 LatLng 객체로 변환
   * @param {Object|google.maps.LatLng} coordinates - 좌표 객체 ({lat, lng} 형식) 또는 LatLng 객체
   * @returns {google.maps.LatLng|null} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    if (!coordinates) {
      console.error('[OverlayService] 좌표가 null 또는 undefined입니다');
      return null;
    }
    
    try {
      // 이미 LatLng 인스턴스인 경우
      if (coordinates instanceof window.google.maps.LatLng) {
        return coordinates;
      }
      
      // 객체 형태인지 확인
      if (typeof coordinates !== 'object' || coordinates === null) {
        console.error('[OverlayService] 좌표가 객체 형태가 아닙니다:', typeof coordinates);
        return null;
      }
      
      // lat, lng 속성이 있는지 확인
      if (!('lat' in coordinates) || !('lng' in coordinates)) {
        console.error('[OverlayService] 좌표 객체에 lat 또는 lng 속성이 없습니다:', coordinates);
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
        console.error('[OverlayService] 좌표 값이 유효한 숫자가 아닙니다:', lat, lng);
        return null;
      }
      
      // LatLng 객체 생성
      return new window.google.maps.LatLng(parsedLat, parsedLng);
    } catch (error) {
      console.error('[OverlayService] 좌표 변환 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 좌표 배열의 중심점 계산
   * @param {Array} coordinates - 좌표 배열
   * @returns {google.maps.LatLng} 중심점
   */
  calculateCenter: function(coordinates) {
    if (!coordinates || !coordinates.length) return null;
    
    try {
      const bounds = new window.google.maps.LatLngBounds();
      coordinates.forEach(coord => {
        const point = this.parseCoordinates(coord);
        if (point) bounds.extend(point);
      });
      
      return bounds.getCenter();
    } catch (error) {
      console.error('[OverlayService] 중심점 계산 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 경계 상자 계산
   * @param {Array} coordinates - 좌표 배열
   * @returns {google.maps.LatLngBounds} 경계 상자
   */
  calculateBounds: function(coordinates) {
    if (!coordinates || !coordinates.length) return null;
    
    try {
      const bounds = new window.google.maps.LatLngBounds();
      coordinates.forEach(coord => {
        const point = this.parseCoordinates(coord);
        if (point) bounds.extend(point);
      });
      
      return bounds;
    } catch (error) {
      console.error('[OverlayService] 경계 상자 계산 중 오류 발생:', error);
      return null;
    }
  }
};

export default OverlayService; 