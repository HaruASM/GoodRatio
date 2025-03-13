// 맵 관련 유틸리티 함수들
import { OVERLAY_COLOR, OVERLAY_ICON, parseCoordinates } from './dataModels';

// 인포윈도우 내용 생성 함수
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

// 인포윈도우 표시 함수
export const showInfoWindow = (shopItem, mapInst, sharedInfoWindow, anchor = null) => {
  if (!sharedInfoWindow || !shopItem) return;
  
  // 인포윈도우 내용 설정
  sharedInfoWindow.setContent(createInfoWindowContent(shopItem));
  
  // 위치 설정
  const pinPosition = parseCoordinates(
    shopItem.serverDataset?.pinCoordinates || shopItem.pinCoordinates
  );
  
  if (anchor) {
    // 마커에 연결
    sharedInfoWindow.open(mapInst, anchor);
  } else if (pinPosition) {
    // 위치만 설정
    sharedInfoWindow.setPosition(pinPosition);
    sharedInfoWindow.open(mapInst);
  }
};

// 마커 생성 함수
export const factoryMakers = (coordinates, mapInst, shopItem, optionsMarker, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem) => {
  const _markerOptions = Object.assign({}, optionsMarker, { position: coordinates });
  const _marker = new window.google.maps.Marker(_markerOptions);
  
  // 마커를 지도에 표시
  _marker.setMap(mapInst);

  // 공유 인포윈도우 초기화 (아직 생성되지 않은 경우)
  if (!sharedInfoWindow && window.google && window.google.maps) {
    sharedInfoWindow = new window.google.maps.InfoWindow();
  }

  const handleOverlayClick = () => {
    // 클릭 시 해당 상점 선택
    setSelectedCurShop(shopItem);
    
    // 이미 클릭된 아이템이면 클릭 해제, 아니면 클릭 설정
    setClickedItem(prevItem => prevItem === shopItem ? null : shopItem);
  };

  const handleOverlayMouseOver = () => {
    // 마우스 오버 상태 설정
    setHoveredItem(shopItem);
  };
  
  const handleOverlayMouseOut = () => {
    // 마우스 아웃 상태 설정
    setHoveredItem(null);
  };

  // 오버레이에 이벤트 바인딩 
  window.google.maps.event.addListener(_marker, 'click', handleOverlayClick);
  window.google.maps.event.addListener(_marker, 'mouseover', handleOverlayMouseOver);
  window.google.maps.event.addListener(_marker, 'mouseout', handleOverlayMouseOut);

  return _marker;
};

// 폴리곤 생성 함수
export const factoryPolygon = (paths, mapInst, shopItem, optionsPolygon, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem) => {
  const _polygonOptions = Object.assign({}, optionsPolygon, { 
    paths: paths,
    strokeColor: OVERLAY_COLOR.IDLE,
    strokeOpacity: 0.8,
    strokeWeight: 2,
    map: null,
  });
  
  const _polygon = new window.google.maps.Polygon(_polygonOptions);
  
  // 폴리곤을 지도에 표시
  _polygon.setMap(mapInst);

  // 공유 인포윈도우 초기화 (아직 생성되지 않은 경우)
  if (!sharedInfoWindow && window.google && window.google.maps) {
    sharedInfoWindow = new window.google.maps.InfoWindow();
  }

  const handleOverlayClick = () => {
    // 클릭 시 해당 상점 선택
    setSelectedCurShop(shopItem);
    
    // 이미 클릭된 아이템이면 클릭 해제, 아니면 클릭 설정
    setClickedItem(prevItem => prevItem === shopItem ? null : shopItem);
  };

  const handleOverlayMouseOver = () => {
    // 마우스 오버 시 폴리곤 색상 변경
    _polygon.setOptions({ fillColor: OVERLAY_COLOR.MOUSEOVER });
    
    // 마우스 오버 상태 설정
    setHoveredItem(shopItem);
  };
  
  const handleOverlayMouseOut = () => {
    // 마우스 아웃 시 폴리곤 색상 원복
    _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE });
    
    // 마우스 아웃 상태 설정
    setHoveredItem(null);
  };

  // 오버레이에 이벤트 바인딩 
  window.google.maps.event.addListener(_polygon, 'click', handleOverlayClick);
  window.google.maps.event.addListener(_polygon, 'mouseover', handleOverlayMouseOver);
  window.google.maps.event.addListener(_polygon, 'mouseout', handleOverlayMouseOut);
  
  return _polygon;
};

// 프로토타입 오버레이 설정 함수
export const setProtoOverlays = () => {
  const _optionsMarker = {
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
    },
    position: null,
    map: null,
    title: null,
  };

  const _optionsPolygon = {
    paths: [],
    strokeColor: OVERLAY_COLOR.IDLE,
    strokeOpacity: 0.8,
    strokeWeight: 2,
    map: null,
  };
  return { optionsMarker: _optionsMarker, optionsPolygon: _optionsPolygon };
};

// 폴리곤 가시성 업데이트 함수
export const updatePolygonVisibility = (map, currentItems) => {
  if (!map) return;
  
  const zoomLevel = map.getZoom();
  const isVisible = zoomLevel >= 17;
  
  // 현재 섹션의 모든 아이템을 순회하며 폴리곤 가시성 업데이트
  if (currentItems && currentItems.length > 0) {
    currentItems.forEach(item => {
      if (item.itemPolygon) {
        item.itemPolygon.setVisible(isVisible);
      }
    });
  }
}; 