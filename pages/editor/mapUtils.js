// 맵 관련 유틸리티 함수들
import { OVERLAY_COLOR, OVERLAY_ICON, parseCoordinates } from './dataModels';

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
 * @param {import('./dataModels').ShopDataSet} shopItem - 상점 데이터
 * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
 * @param {google.maps.InfoWindow|React.MutableRefObject<google.maps.InfoWindow>} sharedInfoWindow - 공유 인포윈도우 객체 또는 ref
 * @param {google.maps.Marker} [anchor=null] - 인포윈도우를 연결할 마커
 */
export const showInfoWindow = (shopItem, mapInst, sharedInfoWindow, anchor = null) => {
  if (!shopItem) return;
  
  // sharedInfoWindow가 ref 객체인 경우 current 속성 사용
  const infoWindow = sharedInfoWindow?.current || sharedInfoWindow;
  if (!infoWindow) return;
  
  // 인포윈도우 내용 설정
  infoWindow.setContent(createInfoWindowContent(shopItem));
  
  // 위치 설정
  const pinPosition = parseCoordinates(
    shopItem.serverDataset?.pinCoordinates || shopItem.pinCoordinates
  );
  
  if (anchor) {
    // 마커에 연결
    infoWindow.open(mapInst, anchor);
  } else if (pinPosition) {
    // 위치만 설정
    infoWindow.setPosition(pinPosition);
    infoWindow.open(mapInst);
  }
};

/**
 * 마커 생성 함수
 * @param {{lat: number, lng: number}} coordinates - 마커 좌표
 * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
 * @param {import('./dataModels').ShopDataSet} shopItem - 상점 데이터
 * @param {google.maps.MarkerOptions} optionsMarker - 마커 옵션
 * @param {google.maps.InfoWindow|React.MutableRefObject<google.maps.InfoWindow>} sharedInfoWindow - 공유 인포윈도우 객체 또는 ref
 * @param {Function} setSelectedCurShop - 선택된 상점 설정 함수
 * @param {Function} setClickedItem - 클릭된 아이템 설정 함수
 * @returns {google.maps.Marker} 생성된 마커 객체
 */
export const factoryMakers = (coordinates, mapInst, shopItem, optionsMarker, sharedInfoWindow, setSelectedCurShop, setClickedItem) => {
  const _markerOptions = Object.assign({}, optionsMarker, { position: coordinates });
  const _marker = new window.google.maps.Marker(_markerOptions);
  
  // 공유 인포윈도우 초기화 (ref 객체인 경우)
  if (sharedInfoWindow && typeof sharedInfoWindow === 'object' && 'current' in sharedInfoWindow && !sharedInfoWindow.current) {
    sharedInfoWindow.current = new window.google.maps.InfoWindow();
  }
  
  // 인포윈도우 객체 가져오기
  const infoWindow = sharedInfoWindow?.current || sharedInfoWindow;
  
  // 클릭 상태 추적 변수
  let isClicked = false;

  const handleOverlayClick = () => {
    // 클릭 시 해당 상점 선택 (setSelectedCurShop이 함수인 경우에만)
    if (typeof setSelectedCurShop === 'function') {
      setSelectedCurShop(shopItem);
    }
    
    // 클릭 상태 토글
    isClicked = !isClicked;
    
    if (isClicked) {
      // 클릭된 상태로 변경 - 인포윈도우 표시
      if (infoWindow) {
        infoWindow.setContent(createInfoWindowContent(shopItem));
        infoWindow.open(mapInst, _marker);
      }
      
      // 클릭된 아이템 설정 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(shopItem);
      }
    } else {
      // 클릭 해제 - 인포윈도우 닫기
      if (infoWindow) {
        infoWindow.close();
      }
      
      // 클릭된 아이템 초기화 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(null);
      }
    }
  };

  const handleOverlayMouseOver = () => {
    // 클릭되지 않은 상태에서만 마우스 오버 시 인포윈도우 표시
    if (!isClicked && infoWindow) {
      infoWindow.setContent(createInfoWindowContent(shopItem));
      infoWindow.open(mapInst, _marker);
    }
  };
  
  const handleOverlayMouseOut = () => {
    // 클릭되지 않은 상태에서만 마우스 아웃 시 인포윈도우 닫기
    if (!isClicked && infoWindow) {
      infoWindow.close();
    }
  };

  // 오버레이에 이벤트 바인딩 
  window.google.maps.event.addListener(_marker, 'click', handleOverlayClick);
  window.google.maps.event.addListener(_marker, 'mouseover', handleOverlayMouseOver);
  window.google.maps.event.addListener(_marker, 'mouseout', handleOverlayMouseOut);
  
  // 맵 클릭 이벤트 리스너 추가 - 다른 곳 클릭 시 인포윈도우 닫기
  window.google.maps.event.addListener(mapInst, 'click', () => {
    if (isClicked) {
      isClicked = false;
      if (infoWindow) {
        infoWindow.close();
      }
      
      // 클릭된 아이템 초기화 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(null);
      }
    }
  });

  return _marker;
};

/**
 * 폴리곤 생성 함수
 * @param {Array<{lat: number, lng: number}>} paths - 폴리곤 경로 좌표 배열
 * @param {google.maps.Map} mapInst - 구글 맵 인스턴스
 * @param {import('./dataModels').ShopDataSet} shopItem - 상점 데이터
 * @param {google.maps.PolygonOptions} optionsPolygon - 폴리곤 옵션
 * @param {google.maps.InfoWindow|React.MutableRefObject<google.maps.InfoWindow>} sharedInfoWindow - 공유 인포윈도우 객체 또는 ref
 * @param {Function} setSelectedCurShop - 선택된 상점 설정 함수
 * @param {Function} setClickedItem - 클릭된 아이템 설정 함수
 * @returns {google.maps.Polygon} 생성된 폴리곤 객체
 */
export const factoryPolygon = (paths, mapInst, shopItem, optionsPolygon, sharedInfoWindow, setSelectedCurShop, setClickedItem) => {
  const _polygonOptions = Object.assign({}, optionsPolygon, { 
    paths: paths,
    strokeColor: OVERLAY_COLOR.IDLE,
    strokeOpacity: 0.8,
    strokeWeight: 2,
    map: null,
  });
  
  const _polygon = new window.google.maps.Polygon(_polygonOptions);
  
  // 공유 인포윈도우 초기화 (ref 객체인 경우)
  if (sharedInfoWindow && typeof sharedInfoWindow === 'object' && 'current' in sharedInfoWindow && !sharedInfoWindow.current) {
    sharedInfoWindow.current = new window.google.maps.InfoWindow();
  }
  
  // 인포윈도우 객체 가져오기
  const infoWindow = sharedInfoWindow?.current || sharedInfoWindow;
  
  // 클릭 상태 추적 변수
  let isClicked = false;
  
  // 폴리곤 중심점 계산 함수
  const getPolygonCenter = () => {
    if (!paths || paths.length === 0) return null;
    
    // 폴리곤 중심점 계산
    const bounds = new window.google.maps.LatLngBounds();
    paths.forEach(point => {
      bounds.extend(point);
    });
    
    return bounds.getCenter();
  };

  const handleOverlayClick = () => {
    // 클릭 시 해당 상점 선택 (setSelectedCurShop이 함수인 경우에만)
    if (typeof setSelectedCurShop === 'function') {
      setSelectedCurShop(shopItem);
    }
    
    // 클릭 상태 토글
    isClicked = !isClicked;
    
    if (isClicked) {
      // 클릭된 상태로 변경 - 인포윈도우 표시
      if (infoWindow) {
        infoWindow.setContent(createInfoWindowContent(shopItem));
        
        // 폴리곤 중심에 인포윈도우 표시
        const center = getPolygonCenter();
        if (center) {
          infoWindow.setPosition(center);
          infoWindow.open(mapInst);
        }
      }
      
      // 폴리곤 색상 변경
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.MOUSEOVER });
      
      // 클릭된 아이템 설정 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(shopItem);
      }
    } else {
      // 클릭 해제 - 인포윈도우 닫기
      if (infoWindow) {
        infoWindow.close();
      }
      
      // 폴리곤 색상 원복
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE });
      
      // 클릭된 아이템 초기화 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(null);
      }
    }
  };

  const handleOverlayMouseOver = () => {
    // 마우스 오버 시 폴리곤 색상 변경
    _polygon.setOptions({ fillColor: OVERLAY_COLOR.MOUSEOVER });
    
    // 클릭되지 않은 상태에서만 마우스 오버 시 인포윈도우 표시
    if (!isClicked && infoWindow) {
      infoWindow.setContent(createInfoWindowContent(shopItem));
      
      // 폴리곤 중심에 인포윈도우 표시
      const center = getPolygonCenter();
      if (center) {
        infoWindow.setPosition(center);
        infoWindow.open(mapInst);
      }
    }
  };
  
  const handleOverlayMouseOut = () => {
    // 클릭되지 않은 상태에서만 마우스 아웃 시 폴리곤 색상 원복
    if (!isClicked) {
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE });
      
      // 인포윈도우 닫기
      if (infoWindow) {
        infoWindow.close();
      }
    }
  };

  // 오버레이에 이벤트 바인딩 
  window.google.maps.event.addListener(_polygon, 'click', handleOverlayClick);
  window.google.maps.event.addListener(_polygon, 'mouseover', handleOverlayMouseOver);
  window.google.maps.event.addListener(_polygon, 'mouseout', handleOverlayMouseOut);
  
  // 맵 클릭 이벤트 리스너 추가 - 다른 곳 클릭 시 인포윈도우 닫기
  window.google.maps.event.addListener(mapInst, 'click', () => {
    if (isClicked) {
      isClicked = false;
      
      // 인포윈도우 닫기
      if (infoWindow) {
        infoWindow.close();
      }
      
      // 폴리곤 색상 원복
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE });
      
      // 클릭된 아이템 초기화 (setClickedItem이 함수인 경우에만)
      if (typeof setClickedItem === 'function') {
        setClickedItem(null);
      }
    }
  });
  
  return _polygon;
};

/**
 * 프로토타입 오버레이 설정 함수
 * @returns {{ optionsMarker: google.maps.MarkerOptions, optionsPolygon: google.maps.PolygonOptions }} 마커와 폴리곤 옵션
 */
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

/**
 * 폴리곤 가시성 업데이트 함수
 * @param {google.maps.Map} map - 구글 맵 인스턴스
 * @param {Array<import('./dataModels').ShopDataSet>} currentItems - 현재 섹션의 아이템 목록
 */
export const updatePolygonVisibility = (map, currentItems) => {
  // 맵 인스턴스가 없는 경우만 체크 (구글맵 API는 이미 로드되었다고 가정)
  if (!map) {
    console.log('맵 인스턴스가 없습니다. 폴리곤 가시성 업데이트를 건너뜁니다.');
    return;
  }
  
  const zoomLevel = map.getZoom();
    const isVisible = zoomLevel >= 16;
  
  // 아이템이 없는 경우 종료
  if (!currentItems || currentItems.length === 0) return;
  
  let visibleCount = 0;
  
  // 현재 섹션의 모든 아이템을 순회하며 폴리곤 가시성 업데이트
  currentItems.forEach(item => {
    // 폴리곤이 존재하는 경우에만 가시성 설정
    if (item.itemPolygon) {
      item.itemPolygon.setVisible(isVisible);
      visibleCount++;
    }
  });
  
  // 디버깅용 로그는 폴리곤 개수가 있을 때만 출력
  if (visibleCount > 0) {
    console.log(`폴리곤 가시성 업데이트: 줌 레벨 ${zoomLevel}, 가시성 ${isVisible}, ${visibleCount}개 처리됨`);
  }
}; 