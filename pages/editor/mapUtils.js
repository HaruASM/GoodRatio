// 맵 관련 유틸리티 함수들
import { OVERLAY_COLOR, parseCoordinates } from './dataModels';

/**
 * 인포윈도우 내용 생성 함수
 * @param {import('./dataModels').ShopDataSet} shopItem - 상점 데이터
 * @returns {string} HTML 형식의 인포윈도우 내용
 */
export const createInfoWindowContent = (shopItem) => {
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
};

/**
 * 인포윈도우 표시 함수
 * @param {google.maps.InfoWindow|React.MutableRefObject<google.maps.InfoWindow>} infoWindow - 인포윈도우 객체 또는 ref
 * @param {google.maps.Marker} anchor - 인포윈도우를 연결할 마커
 * @param {string} content - 인포윈도우에 표시할 HTML 내용
 */
export const showInfoWindow = (infoWindow, anchor, content) => {
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
};

/**
 * 마커와 폴리곤 생성 유틸리티
 */
const mapUtils = {
  // 마커 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  markerOptions: {},
  
  // 폴리곤 디자인 옵션 - 초기값은 비어있음 (initialize에서 설정)
  polygonOptions: {},
  
  /**
   * MapUtils 초기화 함수 - 구글 맵이 완전히 로드된 후에 호출되어야 함
   * window.google.maps.SymbolPath.CIRCLE,같은 부분때문에
   */
  initialize: function() {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API가 로드되지 않았습니다. MapUtils 초기화 실패');
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
      strokeColor: OVERLAY_COLOR.IDLE || '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
      fillColor: OVERLAY_COLOR.IDLE || '#FF0000',
      fillOpacity: 0.35,
    };
    
    
    return true;
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
        parseCoordinates(coordinates) : coordinates;
      
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
      const content = createInfoWindowContent(item);
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
  }
};

export default mapUtils; 