/**
 * @fileoverview 오버레이 생성, 이벤트 처리를 담당하는 서비스
 * @module lib/components/map/OverlayService
 */

// 변수 선언을 객체로 캡슐화
const _cache = {
  mapInstance: null
};

/**
 * 오버레이 델리게이트 객체
 * 다양한 오버레이 타입(마커, 폴리곤, 이미지마커)에 대한 통일된 최소 인터페이스 제공
 */
class OverlayDelegate {
  /**
   * @param {Object} overlay - 실제 오버레이 객체 (마커, 폴리곤, 이미지마커 등)
   * @param {string} type - 오버레이 타입 ('marker', 'polygon', 'imageMarker')
   */
  constructor(overlay, type) {
    this.overlay = overlay;          // 실제 오버레이 객체 참조
    this.type = type;                // 오버레이 타입
    
    // 직접 접근 가능한 메타데이터 필드들
    this.itemId = null;
    this.sectionName = null;
    this.layerType = null;
    this.category = null;
    this.name = null;
  }

  /**
   * 오버레이 가시성 토글 (모든 오버레이 타입에 동일하게 적용)
   */
  toggleVisible() {
    // 오버레이 타입에 따라 적절한 가시성 메소드 호출
    switch(this.type) {
      case 'marker':
      case 'imageMarker':
        // AdvancedMarkerElement의 경우
        if (!this.overlay.style) this.overlay.style = {};
        this.overlay.style.display = this.overlay.style.display === 'none' ? 'block' : 'none';
        break;
      case 'polygon':
        // Polygon의 경우
        this.overlay.setVisible(!this.overlay.getVisible());
        break;
    }
  }
  
  /**
   * 오버레이 맵에 설정
   * @param {google.maps.Map} map - 구글 맵 인스턴스
   */
  setMap(map) {
    if (this.overlay && typeof this.overlay.setMap === 'function') {
      this.overlay.setMap(map);
    }
  }
  
  /**
   * 오버레이 맵에서 제거
   */
  relieveMap() {
    if (this.overlay) {
      if (typeof this.overlay.setMap === 'function') {
        this.overlay.setMap(null);
      } else if (this.overlay.map) {
        this.overlay.map = null;
      }
    }
  }
}

/**
 * 오버레이 서비스 - 마커, 폴리곤, 이미지 오버레이 생성 및 관리
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
   * 마커 생성 함수
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @param {string} title - 마커 제목
   * @param {Object} options - 마커 옵션
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createMarker: function(coordinates, title, options = {}) {
    if (!coordinates || !this.isValidCoords(coordinates)) {
      console.error('[OverlayService] 마커 생성 실패: 유효한 좌표가 없음', coordinates);
      return null;
    }
    
    try {
      // 좌표 생성
      const position = new window.google.maps.LatLng(coordinates.lat, coordinates.lng);
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 핀 요소 생성
      const pinElement = document.createElement('div');
      pinElement.style.width = '20px';
      pinElement.style.height = '20px';
      pinElement.style.borderRadius = '50%';
      pinElement.style.backgroundColor = options.color || '#1877F2';
      pinElement.style.border = '2px solid white';
      pinElement.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
      
      // 컨테이너 요소 생성
      const containerElement = document.createElement('div');
      containerElement.appendChild(pinElement);
      containerElement.style.position = 'relative';
      
      // 제목 요소 추가 (있는 경우)
      if (title) {
        const titleElement = document.createElement('div');
        titleElement.textContent = title;
        titleElement.style.position = 'absolute';
        titleElement.style.bottom = '-24px';
        titleElement.style.left = '50%';
        titleElement.style.transform = 'translateX(-50%)';
        titleElement.style.whiteSpace = 'nowrap';
        titleElement.style.fontSize = '12px';
        titleElement.style.fontWeight = 'bold';
        titleElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        titleElement.style.padding = '2px 4px';
        titleElement.style.borderRadius = '4px';
        titleElement.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.2)';
        containerElement.appendChild(titleElement);
      }
      
      // 마커 생성
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: containerElement,
        title: title || '',
        map: options.map || null  // 맵을 명시적으로 연결, 없으면 null
      });
      
      // 가시성 초기 설정 (기본적으로 숨김)
      if (!marker.style) marker.style = {};
      marker.style.display = 'none';
      
      return marker;
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
      // 좌표 배열을 LatLng 객체 배열로 직접 변환
      const parsedPath = path.map(coord => 
        coord instanceof window.google.maps.LatLng 
          ? coord 
          : new window.google.maps.LatLng(coord.lat, coord.lng)
      );
      
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
      
      // 가시성 초기 설정 (기본적으로 숨김)
      polygon.setVisible(false);
      
      return polygon;
    } catch (error) {
      console.error('[OverlayService] 폴리곤 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 이미지 오버레이 생성 함수
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
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
      // 이미 LatLng 객체인 경우 그대로 사용, 아닌 경우 변환
      const position = coordinates instanceof window.google.maps.LatLng 
        ? coordinates 
        : new window.google.maps.LatLng(coordinates.lat, coordinates.lng);
      
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
      polygons: new Map()
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
      const itemTitle = item.itemName || '';
      
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
        if (!overlay.style) overlay.style = {};
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
      }
    } catch (error) {
      console.error('[OverlayService] 오버레이 정리 중 오류 발생:', error);
    }
  },
  
  /**
   * 좌표 객체를 구글 맵 LatLng 객체로 단순 변환 (입력은 항상 {lat, lng} 형식)
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @returns {google.maps.LatLng} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    // 이미 LatLng 인스턴스인 경우 그대로 반환
    if (coordinates instanceof window.google.maps.LatLng) {
      return coordinates;
    }
    
    // lat, lng 형식의 객체를 LatLng 객체로 변환
    return new window.google.maps.LatLng(coordinates.lat, coordinates.lng);
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
  },
  
  /**
   * 이미지 마커 생성 함수 - 핫스팟, 랜드마크 등에 사용되는 이미지 기반 마커
   * @param {Object} mapInstance - 맵 인스턴스
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @param {string} imageUrl - 이미지 URL
   * @param {Object} [options] - 마커 옵션
   * @returns {google.maps.marker.AdvancedMarkerElement|null} 생성된 마커 또는 null
   */
  createImageMarker: function(mapInstance, coordinates, imageUrl, options = {}) {
    if (!mapInstance) {
      console.error('[OverlayService] 이미지 마커 생성 실패: 맵 인스턴스가 제공되지 않았습니다');
      return null;
    }

    if (!coordinates || !this.isValidCoords(coordinates)) {
      console.error('[OverlayService] 이미지 마커 생성 실패: 유효한 좌표가 제공되지 않았습니다', coordinates);
      return null;
    }

    if (!imageUrl) {
      console.error('[OverlayService] 이미지 마커 생성 실패: 이미지 URL이 제공되지 않았습니다');
      return null;
    }
    
    try {
      // 좌표 생성 - 직접 LatLng 객체 생성
      const position = new window.google.maps.LatLng(coordinates.lat, coordinates.lng);
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 기본 옵션
      const defaultOptions = {
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '2px solid white',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      };
      
      // 이미지 옵션 병합
      const imageOptions = {
        width: options.width || defaultOptions.width,
        height: options.height || defaultOptions.height,
        borderRadius: options.borderRadius || defaultOptions.borderRadius,
        border: options.border || defaultOptions.border,
        boxShadow: options.boxShadow || defaultOptions.boxShadow
      };
      
      // 이미지 요소 생성
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.width = imageOptions.width;
      imgElement.height = imageOptions.height;
      imgElement.style.borderRadius = imageOptions.borderRadius;
      imgElement.style.boxShadow = imageOptions.boxShadow;
      imgElement.style.border = imageOptions.border;
      
      // 이미지 로드 에러 처리
      imgElement.onerror = () => {
        console.error(`[OverlayService] 이미지 로드 실패: ${imageUrl}`);
        imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmNWY1IiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
      };
      
      // 컨테이너 요소 생성
      const containerElement = document.createElement('div');
      containerElement.appendChild(imgElement);
      containerElement.style.position = 'relative';
      
      // 메타데이터 속성 추가
      if (options.itemInfo) {
        containerElement.dataset.itemId = options.itemInfo.id || '';
        containerElement.dataset.itemType = options.itemInfo.type || '';
        containerElement.dataset.sectionName = options.itemInfo.sectionName || '';
      }
      
      // zIndex 처리
      if (options.zIndex) {
        containerElement.style.zIndex = options.zIndex;
      }
      
      // AdvancedMarkerElement 생성
      const imageMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: containerElement,
        title: options.title || '',
        map: mapInstance  // 맵에 직접 연결
      });
      
      // 가시성 초기 설정 (기본적으로 숨김)
      if (!imageMarker.style) imageMarker.style = {};
      imageMarker.style.display = 'none';
      
      return imageMarker;
    } catch (error) {
      console.error('[OverlayService] 이미지 마커 생성 중 오류 발생:', error);
      return null;
    }
  },
  
  /**
   * 좌표 유효성 검사 - 좌표 값이 유효한 범위에 있는지 확인
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @returns {boolean} 유효한 좌표인지 여부
   */
  isValidCoords: function(coordinates) {
    // 좌표 범위 확인 (위도 -90~90, 경도 -180~180)
    return (
      coordinates.lat >= -90 && coordinates.lat <= 90 && 
      coordinates.lng >= -180 && coordinates.lng <= 180
    );
  },

  /**
   * 토글 가능한 마커 생성 함수
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @param {string} title - 마커 제목
   * @param {Object} options - 마커 옵션
   * @returns {OverlayDelegate} 토글 가능한 마커 델리게이트
   */
  createToggleableMarker: function(coordinates, title, options = {}) {
    // 기본 마커 생성
    const marker = this.createMarker(coordinates, title, options);
    
    if (!marker) return null;
    
    // 마커를 델리게이트로 래핑
    const markerDelegate = new OverlayDelegate(marker, 'marker');
    
    // 기본 메타데이터 설정
    if (options.itemInfo) {
      markerDelegate.itemId = options.itemInfo.id || null;
      markerDelegate.category = options.itemInfo.type || 'shop';
      markerDelegate.sectionName = options.itemInfo.sectionName || null;
    }
    
    // 마커 초기 스타일 설정 (기본적으로 숨김)
    if (!marker.style) marker.style = {};
    marker.style.display = 'none';
    
    return markerDelegate;
  },

  /**
   * 토글 가능한 폴리곤 생성 함수
   * @param {Array} path - 폴리곤 좌표 배열
   * @param {Object} options - 폴리곤 옵션
   * @returns {OverlayDelegate} 토글 가능한 폴리곤 델리게이트
   */
  createToggleablePolygon: function(path, options = {}) {
    // 기본 폴리곤 생성
    const polygon = this.createPolygon(path, options);
    
    if (!polygon) return null;
    
    // 폴리곤을 델리게이트로 래핑
    const polygonDelegate = new OverlayDelegate(polygon, 'polygon');
    
    // 기본 메타데이터 설정
    if (options.itemInfo) {
      polygonDelegate.itemId = options.itemInfo.id || null;
      polygonDelegate.category = options.itemInfo.type || 'shop';
      polygonDelegate.sectionName = options.itemInfo.sectionName || null;
    }
    
    // 폴리곤 초기 가시성 설정 (기본적으로 숨김)
    polygon.setVisible(false);
    
    return polygonDelegate;
  },

  /**
   * 토글 가능한 이미지 마커 생성 함수
   * @param {Object} mapInstance - 맵 인스턴스
   * @param {Object} coordinates - 좌표 객체
   * @param {string} imageUrl - 이미지 URL
   * @param {Object} options - 마커 옵션
   * @returns {OverlayDelegate} 토글 가능한 이미지 마커 델리게이트
   */
  createToggleableImageMarker: function(mapInstance, coordinates, imageUrl, options = {}) {
    // 기본 이미지 마커 생성
    const imageMarker = this.createImageMarker(mapInstance, coordinates, imageUrl, options);
    
    if (!imageMarker) return null;
    
    // 이미지 마커를 델리게이트로 래핑
    const imageMarkerDelegate = new OverlayDelegate(imageMarker, 'imageMarker');
    
    // 기본 메타데이터 설정
    if (options.itemInfo) {
      imageMarkerDelegate.itemId = options.itemInfo.id ;
      imageMarkerDelegate.category = options.itemInfo.type ;
      imageMarkerDelegate.sectionName = options.itemInfo.sectionName;
    }
    
    // 마커 초기 스타일 설정 (기본적으로 숨김)
    if (!imageMarker.style) imageMarker.style = {};
    imageMarker.style.display = 'none';
    
    return imageMarkerDelegate;
  },

  /**
   * 아이템 데이터 기반 상점 마커 생성 함수
   * @param {Object} mapInstance - 구글 맵 인스턴스
   * @param {Object} item - 상점 데이터
   * @param {string} sectionName - 섹션 이름
   * @returns {OverlayDelegate} 생성된 마커 델리게이트
   */
  createOverlayOfShopMarker: function(mapInstance, item, sectionName) {
    if (!item || !item.pinCoordinates) {
      console.error(`[ERROR] 상점 마커 생성 실패: 유효하지 않은 아이템 데이터 ${item?.id || '알 수 없음'}`);
      return null;
    }

    // 토글 가능 마커 생성
    const markerDelegate = this.createToggleableMarker(
      item.pinCoordinates,
      item.name,
      { 
        color: '#FF0000',
        zIndex: 10,
        map: mapInstance,
        itemInfo: {
          id: item.id,
          type: 'shop',
          sectionName: sectionName
        }
      }
    );
    
    if (!markerDelegate) {
      console.error(`[ERROR] 상점 마커 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 추가 메타데이터 설정
    markerDelegate.name = item.name || '';
    markerDelegate.layerType = 'SHOPS_MARKER';
    
    return markerDelegate;
  },

  /**
   * 아이템 데이터 기반 상점 폴리곤 생성 함수
   * @param {Object} mapInstance - 구글 맵 인스턴스
   * @param {Object} item - 상점 데이터
   * @param {string} sectionName - 섹션 이름
   * @returns {OverlayDelegate} 생성된 폴리곤 델리게이트
   */
  createOverlayOfShopPolygon: function(mapInstance, item, sectionName) {
    if (!item || !item.path || item.path.length < 3) {
      console.error(`[ERROR] 상점 폴리곤 생성 실패: 유효하지 않은 경로 데이터 ${item?.id || '알 수 없음'}`);
      return null;
    }

    // 토글 가능 폴리곤 생성
    const polygonDelegate = this.createToggleablePolygon(
      item.path,
      { 
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        zIndex: 5,
        map: mapInstance,
        itemInfo: {
          id: item.id,
          type: 'shop',
          sectionName: sectionName
        }
      }
    );
    
    if (!polygonDelegate) {
      console.error(`[ERROR] 상점 폴리곤 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 추가 메타데이터 설정
    polygonDelegate.name = item.name || '';
    polygonDelegate.layerType = 'SHOPS_POLYGON';
    
    return polygonDelegate;
  },

  /**
   * 아이템 데이터 기반 랜드마크 이미지 마커 생성 함수
   * @param {Object} mapInstance - 구글 맵 인스턴스
   * @param {Object} item - 랜드마크 데이터
   * @param {string} sectionName - 섹션 이름
   * @returns {OverlayDelegate} 생성된 이미지 마커 델리게이트
   */
  createOverlayOfLandmarkMarker: function(mapInstance, item, sectionName) {
    if (!item || !item.pinCoordinates) {
      console.error(`[ERROR] 랜드마크 이미지 마커 생성 실패: 유효하지 않은 아이템 데이터 ${item?.id || '알 수 없음'}`);
      return null;
    }

    // 토글 가능 이미지 마커 생성
    const imageMarkerDelegate = this.createToggleableImageMarker(
      mapInstance,
      item.pinCoordinates,
      item.pictureIcon || item.imageUrl,
      { 
        width: 40, 
        height: 40,
        zIndex: 15,
        title: item.name,
        itemInfo: {
          id: item.id,
          type: 'landmark',
          sectionName: sectionName
        }
      }
    );
    
    if (!imageMarkerDelegate) {
      console.error(`[ERROR] 랜드마크 이미지 마커 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 추가 메타데이터 설정
    imageMarkerDelegate.name = item.name || '';
    imageMarkerDelegate.layerType = 'LANDMARKS_MARKER';
    
    return imageMarkerDelegate;
  },

  /**
   * 아이템 데이터 기반 핫스팟 이미지 마커 생성 함수
   * @param {Object} mapInstance - 구글 맵 인스턴스
   * @param {Object} item - 핫스팟 데이터
   * @param {string} sectionName - 섹션 이름
   * @returns {OverlayDelegate} 생성된 이미지 마커 델리게이트
   */
  createOverlayOfHotspotMarker: function(mapInstance, item, sectionName) {
    if (!item || !item.pinCoordinates) {
      console.error(`[ERROR] 핫스팟 이미지 마커 생성 실패: 유효하지 않은 아이템 데이터 ${item?.id || '알 수 없음'}`);
      return null;
    }

    try {
      // 좌표 생성 - 직접 LatLng 객체 생성
      const position = new window.google.maps.LatLng(item.pinCoordinates.lat, item.pinCoordinates.lng);
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 커스텀 컨테이너 생성
      const containerElement = document.createElement('div');
      containerElement.style.position = 'relative';
      containerElement.style.width = '52px';
      containerElement.style.height = '52px';
      containerElement.style.clipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'; // 육각형 모양
      containerElement.style.backgroundColor = '#ffffff';
      containerElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
      containerElement.style.borderRadius = '0'; // 육각형 모양을 위해 borderRadius 제거
      containerElement.style.overflow = 'hidden';
      
      // 이미지 요소 생성
      const imgElement = document.createElement('img');
      imgElement.src = item.pictureIcon || item.imageUrl;
      imgElement.style.width = '100%';
      imgElement.style.height = '100%';
      imgElement.style.objectFit = 'cover';
      
      // 이미지 로드 에러 처리
      imgElement.onerror = () => {
        console.error(`[OverlayService] 핫스팟 이미지 로드 실패: ${item.pictureIcon || item.imageUrl}`);
        imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjVmNWY1IiAvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
      };
      
      containerElement.appendChild(imgElement);
      
      // 메타데이터 속성 추가
      containerElement.dataset.itemId = item.id || '';
      containerElement.dataset.itemType = 'hotspot';
      containerElement.dataset.sectionName = sectionName || '';
      
      // AdvancedMarkerElement 생성
      const imageMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: containerElement,
        title: item.name || '',
        map: mapInstance  // 맵에 직접 연결
      });
      
      // 가시성 초기 설정 (기본적으로 숨김)
      if (!imageMarker.style) imageMarker.style = {};
      imageMarker.style.display = 'none';
      
      // 이미지 마커를 델리게이트로 래핑
      const imageMarkerDelegate = new OverlayDelegate(imageMarker, 'imageMarker');
      
      // 메타데이터 설정
      imageMarkerDelegate.itemId = item.id;
      imageMarkerDelegate.category = 'hotspot';
      imageMarkerDelegate.sectionName = sectionName;
      imageMarkerDelegate.name = item.name || '';
      imageMarkerDelegate.layerType = 'HOTSPOTS_MARKER';
      
      return imageMarkerDelegate;
    } catch (error) {
      console.error('[OverlayService] 핫스팟 이미지 마커 생성 중 오류 발생:', error);
      return null;
    }
  },
};

export default OverlayService; 