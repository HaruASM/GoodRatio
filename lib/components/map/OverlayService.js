/**
 * @fileoverview 오버레이 생성, 이벤트 처리를 담당하는 서비스
 * @module lib/components/map/OverlayService
 */

// MapIcons 모듈 임포트
import { ICON_DESIGN, createIconByiconDesign } from './MapIcons';
// 스트리트뷰 임베드 URL 생성 함수 임포트
import { createStreetViewEmbedUrl } from '../../models/editorModels';
// 이미지 관련 유틸리티 임포트
import { createDomImgProps, IMAGE_TEMPLATES } from '../../utils/imageHelpers';

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
   * @returns {Promise<void>}
   */
  toggleVisible() {
    return new Promise((resolve) => {
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
          const oldVisible = this.overlay.getVisible();
          this.overlay.setVisible(!oldVisible);
          break;
      }
      
      // 항상 성공적으로 완료되었다고 가정
      resolve();
    });
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
   * 스트리트뷰 정보를 iframe URL로 변환
   * @param {{panoid: string, heading: number, pitch: number, fov: number}} streetViewInfo - 스트리트뷰 정보
   * @returns {string} iframe에 사용할 수 있는 임베드 URL
   */
  createStreetViewEmbedUrl: function(streetViewInfo) {
    // models/editorModels.js에서 임포트한 함수 사용
    return createStreetViewEmbedUrl(streetViewInfo);
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
      
      // MapIcons.js의 createIconByiconDesign 함수를 사용하여 마커 요소 생성
      const iconDesign = options.iconDesign || ICON_DESIGN.DEFAULT;
      const markerElement = createIconByiconDesign(iconDesign);
      
      // 컨테이너 요소 생성
      const containerElement = document.createElement('div');
      containerElement.appendChild(markerElement);
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
   * 이미지 마커 생성 함수 - 줌 레벨에 따라 크기가 동적으로 변하는 기능 포함
   * @param {Object} mapInstance - 맵 인스턴스
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @param {string} publicId - 이미지 Public ID 또는 직접 URL (테스트 중에는 무시됨)
   * @param {string} title - 마커 제목 (캡션으로 표시됨)
   * @param {number} baseWidth - 기본 너비 (픽셀 단위)
   * @param {number} baseHeight - 기본 높이 (픽셀 단위)
   * @param {Object} options - 추가 옵션 (logoType 등)
   * @returns {Promise<google.maps.marker.AdvancedMarkerElement|null>} 생성된 마커 또는 null
   */
  createImageMarker: async function(mapInstance, coordinates, publicId, title, baseWidth = 120, baseHeight = 80, options = {}) {
    if (!mapInstance) {
      console.error('[OverlayService] 이미지 마커 생성 실패: 맵 인스턴스가 제공되지 않았습니다');
      return null;
    }

    // 인자로 받은 좌표를 그대로 사용
    if (!coordinates || !this.isValidCoords(coordinates)) {
      console.error('[OverlayService] 이미지 마커 생성 실패: 유효한 좌표가 제공되지 않았습니다', coordinates);
      return null;
    }
    
    try {
      // createNextImageProps를 사용하여 이미지 URL 가져오기
      let imageUrl;
      
      if (publicId) {
        try {
          // 폴백 이미지 URL (Unsplash 이미지)
          const fallbackImageUrl = 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop';
          
          // 이미지 URL 가져오기를 imageHelpers.js에 위임
          const imgProps = await createDomImgProps(
            publicId, 
            IMAGE_TEMPLATES.THUMBNAIL,
            null,
            {
              alt: title || "이미지 마커",
              onError: () => {
                console.error(`[OverlayService] 이미지 로드 실패: ${publicId}`);
                imgElement.src = fallbackImageUrl;
              }
            }
          );
          
          if (imgProps && imgProps.src) {
            imageUrl = imgProps.src;
          } else {
            imageUrl = fallbackImageUrl;
          }
        } catch (error) {
          console.error('[OverlayService] 이미지 URL 가져오기 오류:', error);
          imageUrl = 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop';
        }
      } else {
        // publicId가 없는 경우 대체 이미지 사용
        imageUrl = 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop';
      }
      
      // 좌표 생성 (인자로 받은 coordinates 사용)
      const position = new window.google.maps.LatLng(coordinates.lat, coordinates.lng);
      
      // AdvancedMarkerElement 사용 확인
      if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
        console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
        return null;
      }
      
      // 마커 컨테이너 생성 (DIV 기반)
      const markerContainer = document.createElement('div');
      markerContainer.className = 'image-marker';
      markerContainer.style.position = 'relative';
      markerContainer.style.width = `${baseWidth}px`;
      markerContainer.style.height = `${baseHeight}px`;
      markerContainer.style.overflow = 'hidden';
      markerContainer.style.borderRadius = '12px';
      markerContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      markerContainer.style.border = '2px solid #ffffff';
      markerContainer.style.cursor = 'pointer';
      
      // 이미지 요소 생성
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.style.width = '100%';
      imgElement.style.height = '100%';
      imgElement.style.objectFit = 'cover';
      
      // 이미지 로드 에러 처리
      imgElement.onerror = () => {
        // 최종 폴백 이미지 (Unsplash 이미지)
        imgElement.src = 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop';
      };
      
      // 로고 컨테이너 추가
      if (options) {
        const logoContainer = document.createElement('div');
        logoContainer.className = 'logo-container';
        logoContainer.style.position = 'absolute';
        logoContainer.style.top = '8px';
        logoContainer.style.left = '8px';
        logoContainer.style.display = 'flex';  // 수평 배치를 위한 flex 설정
        logoContainer.style.gap = '6px';       // 로고 간격 설정
        
        // 공통 스타일을 함수로 설정
        const createLogoElement = (text, color) => {
          // 로고별 개별 컨테이너 생성
          const logoBox = document.createElement('div');
          logoBox.className = 'logo-box'; // 로고 박스에 클래스 추가
          logoBox.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
          logoBox.style.borderRadius = '4px';
          logoBox.style.padding = '1px 6px';
          logoBox.style.border = '1px solid rgba(0, 0, 0, 0.1)';
          logoBox.style.display = 'flex';
          logoBox.style.alignItems = 'center';
          logoBox.style.justifyContent = 'center';
          logoBox.style.height = '16px'; // 높이 고정
          
          // 로고 텍스트 생성
          const logoText = document.createElement('span');
          logoText.className = 'logo-text'; // 로고 텍스트에 클래스 추가
          logoText.textContent = text;
          
          // 모든 로고에 동일한 폰트 크기 적용
          logoText.style.fontSize = '10px';
          logoText.style.fontWeight = 'bold';
          logoText.style.fontFamily = 'Arial, sans-serif';
          logoText.style.letterSpacing = '0px';
          logoText.style.lineHeight = '1';
          logoText.style.color = color;
          logoText.style.textAlign = 'center';
          logoText.style.display = 'block';
          
          logoBox.appendChild(logoText);
          return logoBox;
        };
        
        // 관광지 로고 생성
        const touristLogo = createLogoElement('관광지', '#4285F4');
        
        // 번화가 로고 생성
        const downtownLogo = createLogoElement('번화가', '#FF5722');
        
        // 컨테이너에 로고 추가
        logoContainer.appendChild(touristLogo);
        logoContainer.appendChild(downtownLogo);
        markerContainer.appendChild(logoContainer);
      }
      
      // 컨테이너에 이미지 추가
      markerContainer.appendChild(imgElement);
      
      // 캡션 요소 생성
      if (title) {
        const captionElement = document.createElement('div');
        captionElement.className = 'caption-text';
        captionElement.textContent = title;
        captionElement.style.position = 'absolute';
        captionElement.style.bottom = '0';
        captionElement.style.left = '0';
        captionElement.style.right = '0';
        captionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        captionElement.style.color = 'white';
        captionElement.style.padding = '4px 8px';
        captionElement.style.fontSize = '12px';
        captionElement.style.textAlign = 'center';
        captionElement.style.fontWeight = 'bold';
        markerContainer.appendChild(captionElement);
      }
      
      // AdvancedMarkerElement 생성
      const imageMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: position,
        content: markerContainer,
        title: title || '',
        map: null  // 맵에 직접 추가하지 않고 나중에 처리
      });
      
      // 이제 다른 마커/폴리곤과 동일하게 구현하기 위해 직접 마커 객체를 반환
      return imageMarker;
      
    } catch (error) {
      console.error('[OverlayService] 이미지 마커 생성 중 오류 발생:', error);
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
   * @param {Array} path - 폴리곤 경로 좌표 배열
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
    
    // 폴리곤에 스트리트뷰 정보창을 위한 속성 추가
    polygon.infoWindow = null;
    
    // 맵 인스턴스 확인
    const mapInstance = options.map || _cache.mapInstance;
    if (!mapInstance) {
      console.warn('[OverlayService] 유효한 맵 인스턴스가 없어 스트리트뷰 기능이 제한됩니다.');
    }
    
    // 마우스 오버 이벤트 - 스트리트뷰 표시
    polygon.addListener('mouseover', function(e) {
      try {
        // 맵 인스턴스 확인
        if (!mapInstance) return;
        
        // 이미 정보창이 열려있는 경우 닫기
        if (polygon.infoWindow) {
          polygon.infoWindow.close();
        }
        
        // item 정보 가져오기
        const itemId = polygonDelegate.itemId;
        const sectionName = polygonDelegate.sectionName;
        
        if (!itemId || !sectionName || !window.SectionsDBManager) return;
        
        // 아이템 데이터 가져오기
        const item = window.SectionsDBManager.getItemByIDandSectionName(itemId, sectionName);
        if (!item || !item.serverDataset) return;
        
        const itemData = item.serverDataset;
        
        // 스트리트뷰 정보가 있는지 확인
        if (!itemData.streetView || !itemData.streetView.panoid) return;
        
        // 스트리트뷰 임베드 URL 생성 - 여기서 itemData.streetView를 그대로 사용하여 fov, heading, pitch 값 전달
        const embedUrl = createStreetViewEmbedUrl(itemData.streetView);
        
        // InfoWindow 생성하여 스트리트뷰 표시
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="max-width:450px; padding:10px;">
                      <h3 style="margin-top:0; color:#1a73e8; font-size:16px;">${itemData.itemName || '장소 이름 없음'}</h3>
                      <p style="margin:5px 0; font-size:13px;"><strong>좌표:</strong> ${itemData.pinCoordinates?.lat}, ${itemData.pinCoordinates?.lng}</p>
                      
                      <!-- 구글 맵스 스트리트뷰 임베드 -->
                      <iframe 
                        src="${embedUrl}" 
                        width="450" 
                        height="350" 
                        style="border:0; display:block; margin:8px 0;" 
                        allow="accelerometer; autoplay; gyroscope; magnetometer" 
                        loading="lazy" 
                        referrerpolicy="no-referrer-when-downgrade">
                      </iframe>
                    </div>`,
          pixelOffset: new window.google.maps.Size(0, -30),
          maxWidth: 450
        });
        
        // 폴리곤의 경계 계산하여 중앙 지점 찾기
        const bounds = new window.google.maps.LatLngBounds();
        polygon.getPath().forEach(coord => bounds.extend(coord));
        const center = bounds.getCenter();
        
        // 정보창 열기
        infoWindow.setPosition(center);
        infoWindow.open({
          map: mapInstance,
          shouldFocus: false
        });
        
        // 정보창 참조 저장
        polygon.infoWindow = infoWindow;
      } catch (error) {
        console.error('[OverlayService] 스트리트뷰 정보창 생성 오류:', error);
      }
    }.bind(this));
    
    // 마우스 아웃 이벤트 - 정보창 닫기
    polygon.addListener('mouseout', function() {
      if (polygon.infoWindow) {
        polygon.infoWindow.close();
        polygon.infoWindow = null;
      }
    });
    
    return polygonDelegate;
  },

  /**
   * 토글 가능한 이미지 마커 생성 함수 
   * @param {Object} mapInstance - 맵 인스턴스
   * @param {Object} coordinates - 좌표 객체
   * @param {string} publicId - 이미지 Public ID
   * @param {string} title - 마커 제목 (캡션으로 표시됨)
   * @param {number} baseWidth - 기본 너비 (픽셀 단위)
   * @param {number} baseHeight - 기본 높이 (픽셀 단위)
   * @param {Object} options - 추가 옵션 (logoType 등)
   * @returns {Promise<OverlayDelegate|null>} 토글 가능한 이미지 마커 델리게이트
   */
  createToggleableImageMarker: async function(mapInstance, coordinates, publicId, title, baseWidth, baseHeight, options = {}) {
    try {
      
      // 맵 인스턴스 확인
      if (!mapInstance) {
        return null;
      }
      
      // 좌표 확인
      if (!coordinates || !this.isValidCoords(coordinates)) {
        console.error('[ERROR][createToggleableImageMarker] 유효하지 않은 좌표:', coordinates);
        return null;
      }
      
      // 기본 이미지 오버레이 생성
      const imageMarker = await this.createImageMarker(mapInstance, coordinates, publicId, title, baseWidth, baseHeight, options);
      
      if (!imageMarker) {
        console.error('[ERROR][createToggleableImageMarker] 이미지 마커 생성 실패');
        return null;
      }
      
      // 다른 토글 가능 오버레이들과 같이 델리게이트로 래핑
      const imageMarkerDelegate = new OverlayDelegate(imageMarker, 'imageMarker');
      
      // 기본 메타데이터 설정 (options가 존재하는 경우에만)
      if (options && options.itemInfo) {
        imageMarkerDelegate.itemId = options.itemInfo.id || null;
        imageMarkerDelegate.category = options.itemInfo.type || 'landmark';
        imageMarkerDelegate.sectionName = options.itemInfo.sectionName || null;
      }
      
      // 오버레이 초기 스타일 설정 (기본적으로 숨김)
      if (!imageMarker.style) imageMarker.style = {};
      imageMarker.style.display = 'none';
      
      // 맵에 추가 (맵 인스턴스가 있는 경우)
      if (mapInstance) {
        imageMarkerDelegate.setMap(mapInstance);
        
        // 맵에 실제로 추가되었는지 확인 (디버깅 목적)
        if (imageMarker.map) {
        } else {
          console.warn(`[WARN][createToggleableImageMarker] 맵 설정이 되지 않았을 수 있음`);
          
          // 강제로 한 번 더 시도
          try {
            imageMarker.map = mapInstance;
          } catch (e) {
            console.error(`[ERROR][createToggleableImageMarker] 맵 설정 실패:`, e);
          }
        }
      } else {
        console.warn(`[WARN][createToggleableImageMarker] 맵 인스턴스가 없어 맵에 추가하지 못함`);
      }

      return imageMarkerDelegate;
    } catch (error) {
      console.error('[ERROR][createToggleableImageMarker] 예외 발생:', error);
      return null;
    }
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

    // 토글 가능 오버레이 생성
    const markerDelegate = this.createToggleableMarker(
      item.pinCoordinates,
      item.name,
      { 
        iconDesign: item.iconDesign || ICON_DESIGN.DEFAULT,
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
   * @returns {Promise<OverlayDelegate|null>} 생성된 이미지 마커 델리게이트
   */
  createOverlayOfLandmarkMarker: async function(mapInstance, item, sectionName) {
    if (!item || !item.pinCoordinates) {
      console.error(`[ERROR] 랜드마크 이미지 마커 생성 실패: 유효하지 않은 아이템 데이터 ${item?.id || '알 수 없음'}`);
      return null;
    }

    const publicId = item.mainImage; //publicId는 이미지의 cloudinary에서의 publicID이다. 
    const title = item.itemName;

    // 토글 가능 이미지 마커 생성 - 필수 itemInfo 데이터 추가
    const imageMarkerDelegate = await this.createToggleableImageMarker(
      mapInstance,
      item.pinCoordinates,
      publicId,
      title,
      120, // 기본 너비
      80,  // 기본 높이
      { 
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
    
    // 메타데이터 설정
    imageMarkerDelegate.itemId = item.id;
    imageMarkerDelegate.category = 'landmark';
    imageMarkerDelegate.sectionName = sectionName;
    imageMarkerDelegate.name = title;
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

  //현재 사용하지 않음. 수정금지. 
  createOverlayOfHotspotMarker: function(mapInstance, item, sectionName) {
    console.log(`[DEBUG][createOverlayOfHotspotMarker] 핫스팟 이미지 마커 생성 시작: ${item.itemName}`);
  //   if (!item || !item.pinCoordinates) {
  //     console.error(`[ERROR] 핫스팟 이미지 마커 생성 실패: 유효하지 않은 아이템 데이터 ${item?.id || '알 수 없음'}`);
  //     return null;
  //   }

  //   try {
  //     // 좌표 생성 - 직접 LatLng 객체 생성
  //     const position = new window.google.maps.LatLng(item.pinCoordinates.lat, item.pinCoordinates.lng);
      
  //     // AdvancedMarkerElement 사용 확인
  //     if (!window.google.maps.marker || !window.google.maps.marker.AdvancedMarkerElement) {
  //       console.error('[OverlayService] AdvancedMarkerElement를 사용할 수 없습니다. marker 라이브러리가 로드되었는지 확인하세요.');
  //       return null;
  //     }
      
  //     // 아이콘 디자인 값이 있는 경우 해당 아이콘 사용 (추후 확장)
  //     if (item.iconDesign && SVG_ICON_DATA && SVG_ICON_DATA[item.iconDesign]) {
  //       // SVG 아이콘 기반 마커 생성 코드 추가 가능
  //       // 지금은 기존 코드를 유지하고 주석만 추가
  //     }
      
  //     // 커스텀 컨테이너 생성
  //     const containerElement = document.createElement('div');
  //     containerElement.style.position = 'relative';
  //     containerElement.style.width = '52px';
  //     containerElement.style.height = '52px';
  //     containerElement.style.clipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'; // 육각형 모양
  //     containerElement.style.backgroundColor = '#ffffff';
  //     containerElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
  //     containerElement.style.borderRadius = '0'; // 육각형 모양을 위해 borderRadius 제거
  //     containerElement.style.overflow = 'hidden';
      
  //     // 이미지 요소 생성
  //     const imgElement = document.createElement('img');
  //     imgElement.src = item.pictureIcon || item.imageUrl;
  //     imgElement.style.width = '100%';
  //     imgElement.style.height = '100%';
  //     imgElement.style.objectFit = 'cover';
      
  //     // 이미지 로드 에러 처리
  //     imgElement.onerror = () => {
  //       console.error(`[OverlayService] 핫스팟 이미지 로드 실패: ${item.pictureIcon || item.imageUrl}`);
  //       imgElement.src = 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop';
  //     };
      
  //     containerElement.appendChild(imgElement);
      
  //     // 메타데이터 속성 추가
  //     containerElement.dataset.itemId = item.id || '';
  //     containerElement.dataset.itemType = 'hotspot';
  //     containerElement.dataset.sectionName = sectionName || '';
  //     // 아이콘 디자인 메타데이터도 추가
  //     if (item.iconDesign) {
  //       containerElement.dataset.iconDesign = item.iconDesign;
  //     }
      
  //     // AdvancedMarkerElement 생성
  //     const imageMarker = new window.google.maps.marker.AdvancedMarkerElement({
  //       position: position,
  //       content: containerElement,
  //       title: item.name || '',
  //       map: null  // 맵에 직접 추가하지 않고 나중에 처리
  //     });
      
  //     // 이미지 마커를 델리게이트로 래핑하여 반환
  //     const delegate = new OverlayDelegate(imageMarker, 'imageMarker');
      
  //     // 메타데이터 설정
  //     delegate.itemId = item.id;
  //     delegate.category = 'hotspot';
  //     delegate.sectionName = sectionName;
  //     delegate.name = item.name || '';
  //     delegate.layerType = 'HOTSPOTS_MARKER';
  //     // iconDesign 메타데이터도 저장
  //     if (item.iconDesign) {
  //       delegate.iconDesign = item.iconDesign;
  //     }
      
  //     // mapInstance가 제공되었으면 맵에 추가
  //     if (mapInstance) {
  //       console.log(`[DEBUG][createOverlayOfHotspotMarker] 맵 인스턴스에 마커 추가`);
  //       delegate.setMap(mapInstance);
  //     }
      
  //     return delegate;
  //   } catch (error) {
  //     console.error('[OverlayService] 핫스팟 이미지 마커 생성 중 오류 발생:', error);
  //     return null;
  //   }
   },
};

export default OverlayService; 