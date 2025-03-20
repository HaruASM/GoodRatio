import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from './styles.module.css';
import { protoServerDataset, protoShopDataSet, OVERLAY_COLOR, OVERLAY_ICON, parseCoordinates, stringifyCoordinates } from './dataModels';
import mapUtils, { createInfoWindowContent, showInfoWindow } from './mapUtils';
// 서버 유틸리티 함수 가져오기
import { getSectionData } from './serverUtils';
// 오른쪽 사이드바 컴포넌트 가져오기
import RightSidebar from './components/RightSidebar';
// Redux 선택자 가져오기
import {
  togglePanel,
  selectIsPanelVisible,
  selectHasChanges,
  selectEditNewShopDataSet,
  selectModifiedFields,
  selectIsDrawing,
  selectDrawingType,
  endDrawingMode,
  updateCoordinates,
  syncExternalShop,
  updateFormData,
  selectFormData,
  
  
  setIdleState,
  selectIsGsearch,
  compareGooglePlaceData
} from './store/slices/rightSidebarSlice';
import store from './store';
//import { compareShopData } from './store/utils/rightSidebarUtils';

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

/**
 * 인메모리 DB인 sectionsDB를 관리하는 객체. 
 * 섹션별로 데이터를 캐싱해서 제공
 * 로컬,서버관리하는 모듈의 getSectionData 인터페이스 이용 -> sectionDB용 서버데이터셋 로드 -> 클라이언트데이터셋 변환 
 * cache에서 반환시 마커,오버레이 포함 
 */
const SectionsDBManager = {
  // 섹션 데이터 캐시 (Map 객체)
  _cache: new Map(),
  
  /**
   * 섹션 데이터 가져오기 (캐시 -> 로컬 스토리지 -> 서버 순으로 시도)
   * @param {string} sectionName - 가져올 섹션 이름
   * @returns {Promise<Array>} - 변환된 아이템 리스트 (protoShopDataSet 형태)
   */
  getSectionItems: async function(sectionName) {
    // 1. 캐시에서 먼저 확인
    if (this._cache.has(sectionName)) {
      console.log(`SectionsDBManager: 캐시에서 ${sectionName} 데이터 로드 (${this._cache.get(sectionName).length}개 항목)`);
      return this._cache.get(sectionName);
    }
    
    try {
      // 2. 캐시에 없으면 getSectionData 함수 호출 (로컬 스토리지 -> 서버)
      const serverItems = await getSectionData(sectionName);
      
      // 3. 서버 형식(protoServerDataset)에서 클라이언트 형식(protoShopDataSet)으로 변환
      const clientItems = this._transformToClientFormat(serverItems);
      
      // 4. 캐시에 저장
      this._cache.set(sectionName, clientItems);
      
      console.log(`SectionsDBManager: ${sectionName} 데이터 로드 완료 (${clientItems.length}개 항목)`);
      return clientItems;
    } catch (error) {
      console.error(`SectionsDBManager: ${sectionName} 데이터 로드 오류`, error);
      return [];
    }
  },
  
  /**
   * 현재 캐시에 있는 섹션 데이터 가져오기 (비동기 로드 없음)
   * @param {string} sectionName - 가져올 섹션 이름
   * @returns {Array} - 캐시된 아이템 리스트 또는 빈 배열
   */
  getCachedItems: function(sectionName) {
    return this._cache.get(sectionName) || [];
  },
  
  /**
   * 서버 형식에서 클라이언트 형식으로 데이터 변환
   * @param {Array} serverItems - 서버 형식 아이템 리스트 (protoServerDataset 형태)
   * @returns {Array} - 변환된 아이템 리스트 (protoShopDataSet 형태)
   */
  _transformToClientFormat: function(serverItems) {
    return serverItems.map(item => {
      const clientItem = {
        ...protoShopDataSet,
        serverDataset: { ...item }
      };
      
      // 마커와 폴리곤 생성 - 새로운 mapUtils 인터페이스 사용
      try {
        // 새로운 mapUtils.createOverlaysFromItem 사용
        const overlays = mapUtils.createOverlaysFromItem(clientItem);
        clientItem.itemMarker = overlays.marker;
        clientItem.itemPolygon = overlays.polygon;
      } catch (error) {
        console.error('오버레이 생성 중 오류 발생:', error);
      }
      
      return clientItem;
    });
  },
  
  /**
   * 섹션 데이터 업데이트
   * @param {string} sectionName - 업데이트할 섹션 이름
   * @param {Array} items - 업데이트할 아이템 리스트
   */
  updateSection: function(sectionName, items) {
    // 캐시만 업데이트 (로컬 스토리지에는 저장하지 않음)
    this._cache.set(sectionName, items);
    
    console.log(`SectionsDBManager: ${sectionName} 데이터 업데이트 (${items.length}개 항목)`);

  },
  
  /**
   * 캐시 초기화
   */
  clearCache: function() {
    this._cache.clear();
    console.log('SectionsDBManager: 캐시 초기화됨');
  }
};

/**
 * 상점 에디터 페이지 컴포넌트
 * 구글 맵을 사용하여 상점 위치 표시 및 편집 기능 제공
 * @returns {React.ReactElement} 에디터 UI 컴포넌트
 */
export default function Editor() { // 메인 페이지
  //const [instMap, setInstMap] = useState(null); //구글맵 인스턴스 
  const instMap = useRef(null);
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구의 기본 위치로 저장
  // const [editMarker, setEditMarker] = useState(null);
  // const [myLocMarker, setMyLocMarker] = useState(null);
  //const [drawingManager, setDrawingManager] = useState(null);
  const drawingManagerRef = useRef(null);
  const [overlayEditing, setOverlayEditing] = useState(null); // 에디터에서 작업중인 오버레이. 1개만 운용
  const [overlayMarkerFoamCard, setOverlayMarkerFoamCard] = useState(null);
  const [overlayPolygonFoamCard, setOverlayPolygonFoamCard] = useState(null);

  const searchInputDomRef = useRef(null); // 검색창 참조
  const searchformRef = useRef(null); // form 요소를 위한 ref 추가
  const [selectedButton, setSelectedButton] = useState('인근');

  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // 사이드바 가시성 상태 추가
  const [isSearchFocused, setIsSearchFocused] = useState(false); // 검색창 포커스 상태 추가

  // sectionsDB 참조 제거 (SectionsDBManager로 완전히 대체)
  
  const [curItemListInCurSection, setCurItemListInCurSection] = useState([]);
  // 이전 아이템 리스트를 useRef로 변경
  const prevItemListforRelieveOverlays = useRef([]);
  // 현재 아이템 리스트의 참조를 저장하는 ref - 이벤트 핸들러에서 최신 상태 접근용
  const currentItemListRef = useRef([]);
  // presentMakers 배열은 사용되지 않으므로 제거
  // const presentMakers = []; // 20개만 보여줘도 됨 // localItemlist에 대한 마커 객체 저장

  // 드로잉 오버레이 객체 저장 상태 추가
  const [tempOverlays, setTempOverlays] = useState({
    marker: null,
    polygon: null
  });
  
  // 임시 오버레이 참조용 ref 추가
  const tempOverlaysRef = useRef({
    marker: null,
    polygon: null
  });

  // curSectionName을 상태로 관리 - 초기값을 null로 설정
  const [curSectionName, setCurSectionName] = useState(null);
  
  // 선택된 상점 정보를 저장하는 상태 변수 추가 - 코드 순서 변경
  const [curSelectedShop, setCurSelectedShop] = useState(null);
  
  // 폼 데이터는 이제 Redux에서 관리 (로컬 상태 제거)
  const formData = useSelector(selectFormData);
  
  // 현재 선택된 섹션의 아이템 리스트를 가져오는 함수
  const getCurLocalItemlist = async (sectionName = curSectionName) => { 
    if (!sectionName) {
      console.error('섹션 이름이 지정되지 않았습니다.');
      return [];
    }
    
    
    
    // SectionsDBManager를 통해 데이터 가져오기
    return await SectionsDBManager.getSectionItems(sectionName);
  };

  // 로컬 저장소에서 sectionsDB 저장 함수는 serverUtils.js로 이동했습니다.

  // protoServerDataset과 protoShopDataSet은 dataModels.js로 이동했습니다.
  
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const hasChanges = useSelector(selectHasChanges);
  const editNewShopDataSet = useSelector(selectEditNewShopDataSet);
  const modifiedFields = useSelector(selectModifiedFields);
  // 드로잉 관련 상태 추가
  const isDrawing = useSelector(selectIsDrawing);
  const drawingType = useSelector(selectDrawingType);
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});


  // 임시 오버레이 정리 함수
  const cleanupTempOverlays = () => {
    // 마커 정리
    if (tempOverlaysRef.current.marker) {
      // 등록된 이벤트 리스너 제거
      google.maps.event.clearInstanceListeners(tempOverlaysRef.current.marker);
      // 마커 맵에서 제거
      tempOverlaysRef.current.marker.setMap(null);
      tempOverlaysRef.current.marker = null;
    }
    
    // 폴리곤 정리
    if (tempOverlaysRef.current.polygon) {
      // 등록된 이벤트 리스너 제거 (경로 이벤트 포함)
      if (tempOverlaysRef.current.polygon.getPath) {
        const path = tempOverlaysRef.current.polygon.getPath();
        google.maps.event.clearInstanceListeners(path);
      }
      google.maps.event.clearInstanceListeners(tempOverlaysRef.current.polygon);
      // 폴리곤 맵에서 제거
      tempOverlaysRef.current.polygon.setMap(null);
      tempOverlaysRef.current.polygon = null;
    }
    
    // 상태도 함께 초기화
    setTempOverlays({
      marker: null,
      polygon: null
    });
  };
  

  // 드로잉 매니저 상태 감시 및 제어를 위한 useEffect
  useEffect(() => {
    // 드로잉 매니저가 초기화되지 않았거나 맵이 없으면 무시
    if (!drawingManagerRef.current || !instMap.current) return;
    
    // 드로잉 모드가 활성화되었을 때
    if (isDrawing && drawingType) {
      // 인포윈도우가 열려있으면 닫기
      if (sharedInfoWindow.current) {
        sharedInfoWindow.current.close();
      }
      
      // 드로잉 모드 타입에 따라 설정
      if (drawingType === 'MARKER') {
        drawingManagerRef.current.setOptions({
          drawingControl: true,
          drawingMode: window.google.maps.drawing.OverlayType.MARKER
        });
        
        
      } else if (drawingType === 'POLYGON') {
        drawingManagerRef.current.setOptions({
          drawingControl: true,
          drawingMode: window.google.maps.drawing.OverlayType.POLYGON
        });
        
        
      }
    } else {
      // 드로잉 모드가 비활성화되었을 때
      drawingManagerRef.current.setOptions({
        drawingControl: false,
        drawingMode: null
      });
    }
  }, [isDrawing, drawingType]); // isDrawing과 drawingType이 변경될 때만 실행

  // 편집 상태 및 드로잉 상태 변화 감지 useEffect 추가
  useEffect(() => {
    // 드로잉 매니저가 초기화되지 않았거나 맵이 없으면 무시
    if (!drawingManagerRef.current || !instMap.current) return;
    
    // 드로잉 모드가 활성화되었을 때
    if (isDrawing && drawingType) {
      // 인포윈도우가 열려있으면 닫기
      if (sharedInfoWindow.current) {
        sharedInfoWindow.current.close();
      }
      
      // 드로잉 모드 타입에 따라 설정
      if (drawingType === 'MARKER') {
        drawingManagerRef.current.setOptions({
          drawingControl: true,
          drawingMode: window.google.maps.drawing.OverlayType.MARKER
        });
        
        
      } else if (drawingType === 'POLYGON') {
        drawingManagerRef.current.setOptions({
          drawingControl: true,
          drawingMode: window.google.maps.drawing.OverlayType.POLYGON
        });
        
        
      }
    } else {
      // 드로잉 모드가 비활성화되었을 때
      drawingManagerRef.current.setOptions({
        drawingControl: false,
        drawingMode: null
      });
    }
  }, [isDrawing, drawingType]); // isDrawing과 drawingType이 변경될 때만 실행

  const mapOverlayHandlers = useMemo(() => {
    return {
      cleanupTempOverlays: cleanupTempOverlays
    };
  }, []);

  // 검색창 
  const initSearchInput = (_mapInstance) => {
    const inputDom = searchInputDomRef.current;
    if (!inputDom) {
      console.error("Search input DOM element not found");
      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputDom);
    autocomplete.bindTo('bounds', _mapInstance);

    autocomplete.addListener('place_changed', () => {
      const detailPlace = autocomplete.getPlace();
      if (!detailPlace.geometry || !detailPlace.geometry.location) {
        console.error("구글place 미작동: '" + detailPlace.name + "'");
        return;
      }

      // 검색된 장소 데이터를 Redux로 전송
      dispatch(compareGooglePlaceData(detailPlace));
      console.log('구글 장소 검색: 데이터 전송 완료');

      // 지도 이동은 유지
      if (detailPlace.geometry.viewport) {
        _mapInstance.fitBounds(detailPlace.geometry.viewport);
      } else {
        _mapInstance.setCenter(detailPlace.geometry.location);
        _mapInstance.setZoom(15);
      }
    });

    _mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(searchformRef.current);

    
  } // initSearchInput

  // 마커와 폴리곤 옵션 초기화 함수
  const initMarker = () => { 
     // MapUtils 초기화 (684라인)
     if (!mapUtils.initialize()) {
      console.error('MapUtils 초기화 실패');
      return;
     }
    // 공유 인포윈도우 초기화 (필요한 경우)
    if (!sharedInfoWindow.current && window.google && window.google.maps) {
      sharedInfoWindow.current = new window.google.maps.InfoWindow();
    }
  }
  
  //AT 마커와 폴리곤, 공통 이벤트 바인딩 InitMarker 
  // 공유 인포윈도우 참조
  const sharedInfoWindow = useRef(null);

  // 클릭된 마커/폴리곤 상태 추가
  const [clickedItem, setClickedItem] = useState(null);

  // 클릭된 아이템의 마커에 애니메이션 효과 적용
  useEffect(() => {
    if (!clickedItem || !clickedItem.itemMarker) return;
    
    // 마커에 애니메이션 효과 적용
    clickedItem.itemMarker.setAnimation(window.google.maps.Animation.BOUNCE);
      
    // 2초 후 애니메이션 중지
    const timer = setTimeout(() => {
      if (clickedItem.itemMarker) {
          clickedItem.itemMarker.setAnimation(null);
      }
    }, 2000);
    
    return () => {
      // 타이머 정리 및 애니메이션 중지
      clearTimeout(timer);
      if (clickedItem.itemMarker) {
        clickedItem.itemMarker.setAnimation(null);
      }
    };
  }, [clickedItem]);

  // 지도 클릭 이벤트 처리를 위한 useEffect
  useEffect(() => {
    if (!instMap.current) return;
    
    const mapClickListener = window.google.maps.event.addListener(instMap.current, 'click', () => {
      // 지도 빈 영역 클릭 시 클릭된 아이템 초기화
      setClickedItem(null);
      
      // 인포윈도우 닫기
      if (sharedInfoWindow.current) {
        sharedInfoWindow.current.close();
      }
    });
    
    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      window.google.maps.event.removeListener(mapClickListener);
    };
  }, [instMap.current]);

  // FB와 연동 - 초기화 방식으로 수정
  const initShopList = async (_mapInstance) => { //AT initShoplist 
    if (!curSectionName) {
      setCurSectionName("반월당"); // TODO 앱 초기화면에서  지역명 입력전 처리방법 추가,    
      // curSectionName이 변경되면 useEffect에서 데이터 로드 및 UI 업데이트가 자동으로 처리됨
      return;
    }
  };

  // 드로잉 매니저의 생성이유와 용도는 MyshopData의 pin과 다각형 도형 수정과 출력을 그리기용용
  // 드로잉매니저 초기화 단계에서는 마커의 디자인과 기본 동일한 동작만 세팅 
  // 객체 관리 이벤트 처리는 핸들러에서 처리함. 
  // 이벤트 처리 순서는 overlaycomplete 공통-> polygoncomplete, markercomplete 
  const initDrawingManager = (_mapInstance) => { // 
    var _drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingControl: false,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.MARKER,
          google.maps.drawing.OverlayType.POLYGON,
        ],
      }
    });

    _drawingManager.setOptions({
      drawingControl: true,
      markerOptions: {
        icon: { url: OVERLAY_ICON.MARKER }, // cf. 문 모양으로 
        clickable: true,
        editable: true,
        draggable: true,
        zIndex: 1,
        fillOpacity: 0.35,
      },
      polygonOptions: {
        strokeColor: OVERLAY_COLOR.IDLE, // 빨간색
        fillColor: OVERLAY_COLOR.IDLE,
        fillOpacity: 0.25,
        strokeWeight: 2,
        clickable: true,
        editable: true,
        zIndex: 1,
      },
    }); // _drawingManager.setOptions

    // 오버레이 생성시 공통 이벤트 핸들러
    window.google.maps.event.addListener(_drawingManager, 'overlaycomplete', (eventObj) => {
      // 1. 그리기 모드 초기화
      _drawingManager.setDrawingMode(null);
      _drawingManager.setOptions({ drawingControl: false });
      
      // 2. Redux 액션 디스패치 - 드로잉 모드 종료
      dispatch(endDrawingMode());
    });

    // 마커 완료 이벤트 리스너 추가
    window.google.maps.event.addListener(_drawingManager, 'markercomplete', (marker) => {
      // 마커 위치 가져오기
      const position = marker.getPosition();
      const pinCoordinates = `${position.lat()},${position.lng()}`;
      
      // Redux 액션 디스패치 - 좌표 업데이트
      dispatch(updateCoordinates({ 
        type: 'MARKER', 
        coordinates: pinCoordinates 
      }));
      
      // 기존 임시 마커가 있으면 제거
      if (tempOverlaysRef.current.marker) {
        tempOverlaysRef.current.marker.setMap(null);
      }
      
      // 새 마커를 임시 오버레이로 저장 (ref와 상태 모두 업데이트)
      tempOverlaysRef.current.marker = marker;
      setTempOverlays(prev => ({
        ...prev,
        marker: marker
      }));
      
      // 마커에 drag 이벤트 리스너 추가 - 위치 변경 시 좌표 업데이트
      window.google.maps.event.addListener(marker, 'dragend', () => {
        const newPosition = marker.getPosition();
        const newCoordinates = `${newPosition.lat()},${newPosition.lng()}`;
        
        // Redux 액션 디스패치 - 좌표 업데이트
        dispatch(updateCoordinates({
          type: 'MARKER',
          coordinates: newCoordinates
        }));
      });
    });

    // 폴리곤 완료 이벤트 리스너 추가
    window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', (polygon) => {
      // 폴리곤 경로 가져오기
      const path = polygon.getPath();
      const pathCoordinates = [];
      
      // 폴리곤 경로의 모든 좌표 수집
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        pathCoordinates.push(`${point.lat()},${point.lng()}`);
      }
      
      // 문자열로 변환 (경로 포맷 준수)
      const pathString = pathCoordinates.join('|');
      
      // Redux 액션 디스패치 - 좌표 업데이트
      dispatch(updateCoordinates({ 
        type: 'POLYGON', 
        coordinates: pathString 
      }));
      
      // 기존 임시 폴리곤이 있으면 제거
      if (tempOverlaysRef.current.polygon) {
        tempOverlaysRef.current.polygon.setMap(null);
      }
      
      // 새 폴리곤을 임시 오버레이로 저장 (ref와 상태 모두 업데이트)
      tempOverlaysRef.current.polygon = polygon;
      setTempOverlays(prev => ({
        ...prev,
        polygon: polygon
      }));
      
      // 폴리곤 path 변경 이벤트 리스너 추가
      // 1. 폴리곤 모양 변경 이벤트
      google.maps.event.addListener(polygon.getPath(), 'set_at', () => {
        updatePolygonPath(polygon);
      });
      
      // 2. 폴리곤 포인트 추가 이벤트
      google.maps.event.addListener(polygon.getPath(), 'insert_at', () => {
        updatePolygonPath(polygon);
      });
      
      // 3. 폴리곤 포인트 제거 이벤트
      google.maps.event.addListener(polygon.getPath(), 'remove_at', () => {
        updatePolygonPath(polygon);
      });
    });

    _drawingManager.setOptions({ drawingControl: false });
    _drawingManager.setMap(_mapInstance);
    drawingManagerRef.current = _drawingManager;
  };

  // 폴리곤 경로 업데이트 헬퍼 함수
  const updatePolygonPath = (polygon) => {
    const path = polygon.getPath();
    const pathCoordinates = [];
    
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      pathCoordinates.push(`${point.lat()},${point.lng()}`);
    }
    
    // 경로를 문자열로 변환
    const pathString = pathCoordinates.join('|');
    
    // Redux 액션 디스패치 - 경로 업데이트
    dispatch(updateCoordinates({
      type: 'POLYGON',
      coordinates: pathString
    }));
  };

  const moveToCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          if (instMap.current) {
            instMap.current.setCenter(pos);
            instMap.current.setZoom(18);
          }
          
          setCurrentPosition(pos);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('위치 정보를 가져올 수 없습니다.');
        }
      );
    } else {
      alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
  };

  // 폴리곤 가시성 관리 함수는 mapUtils.js로 이동했습니다.

  // 지도 초기화 함수 수정
  const initGoogleMapPage = () => {
    // 여기는 window.google과 window.google.maps객체가 로딩 확정된 시점에서 실행되는 지점점
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
      },
        (error) => {
          // console.log('geolocation 에러 : ',error);
        });
    } else {
      console.error('geolocation 지원 안되는 중');
    }

    //-- g맵 인스턴스 생성
    let mapDiv = document.getElementById('map');

    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
      zoom: 15, // 초기 줌 레벨을 15로 설정 (폴리곤이 보이는 레벨)
      mapTypeControl: false,
    });
    //-- g맵 인스턴스 생성 끝끝

    //TODO: 모듈화/캡슐화하여 별도 Zoom매너지/지도탐색매니저로 관리. 
    // - 이벤트 핸들러 등록/제거 로직    // - 폴리곤 가시성 제어 로직     // - 기타 줌 레벨에 따른 UI 변경 로직을 캡슐화
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', () => { //AT 지도줌변경 이벤트 바인딩
      // 최신 아이템 리스트를 useRef에서 가져옴 (클로저 문제 해결)
      const itemList = currentItemListRef.current;
      if (!itemList || itemList.length === 0) return;
      
      const hasPolygons = itemList.some(item => item.itemPolygon);
      if (hasPolygons) {
        const currentZoom = _mapInstance.getZoom();
        const shouldShowPolygons = currentZoom >= 17;
        itemList.forEach(item => {
          if (item.itemPolygon) {
            item.itemPolygon.setVisible(shouldShowPolygons);
          }
        });
      }
    });

    // g맵용 로드 완료시 동작 //AT 구글맵Idle바인딩  
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => { 
      // 여기는 구글맵 인스턴스가 확정된 시점
      // ** 아래 순서는 수정 금지
      initDrawingManager(_mapInstance); 
      initSearchInput(_mapInstance);
      initMarker(); 
      initShopList();
    });
    instMap.current = _mapInstance;
  } // initializeGoogleMapPage 마침

  // 모듈로딩을 순차적으로 진행하기위해필수. 구글모듈-맵모듈-맵로딩idle이벤트-mapinst로 애드온모듈 초기화화
  useEffect(() => { 
    let _cnt = 0;
    let _intervalId = setInterval(() => {
      if (window.google) {
        _cnt = 0;
        clearInterval(_intervalId);
        _intervalId = setInterval(() => {
          if (window.google.maps.Map) { // window.google.maps.Marker도 체크 해줘야 하나.. 
            initGoogleMapPage();// 여기는 window.google과 window.google.maps객체가 로딩 확정된 시점이다 
            clearInterval(_intervalId);
          } else {
            if (_cnt++ > 10) { clearInterval(_intervalId); console.error('구글맵 로딩 오류'); }
            console.error('구글맵 로딩 중', _cnt);
          }
        }, 100);
      } else {
        if (_cnt++ > 10) { clearInterval(_intervalId); console.error('구글서비스 로딩 오류'); }
        console.error('구글서비스 로딩 중', _cnt);
      }
    }, 100);
  }, []);

  // 컴포넌트 마운트 시 IDLE 상태 설정
  useEffect(() => { // AT 우측 사이드바 초기화 지점 
    // 초기에 IDLE 상태로 설정
    dispatch(setIdleState(true));
  }, [dispatch]);

  //## selectedCurShop 관련 useEffect를 하나로 통합. 다른 종속성이 추가되면 안됨. 
  //## selectedCurShop 업데이트시, 파생 동작들 일괄적으로 작동되어야 함. 
  useEffect(() => { // AT [curSelectedShop]  
    // 4. 폼 데이터 업데이트 
    // 우측 사이드바 업데이트 여부와 상태 검증은 Redux 액션 내부에서 처리됨
    if (!curSelectedShop) {      // selectedCurShop이 없는 경우 빈 폼 
      dispatch(syncExternalShop({ shopData: null })); // 내부적으로 isIdel일때만 빈폼 초기화 
      if (sharedInfoWindow.current)   
        sharedInfoWindow.current.close();
      return; // 선택된 값이 비어있으면 여기서 종료 
    }
    
    dispatch(syncExternalShop({ shopData: curSelectedShop.serverDataset })); // 우측 사이드바 상태 내부적으로 isIdel일때만 빈폼 초기화 

    // 1. 좌측 사이드바 아이템 하이라이트 효과
    const itemElements = document.querySelectorAll(`.${styles.item}, .${styles.selectedItem}`);
    
    // 모든 아이템을 기본 클래스로 초기화
    itemElements.forEach(item => {
      item.className = styles.item;
    });
    
    // 선택된 아이템 찾기 (storeName으로 비교)
    const itemName = curSelectedShop.serverDataset ? 
      curSelectedShop.serverDataset.storeName : 
      curSelectedShop.storeName;
      
    const selectedItemElement = Array.from(itemElements).find(item => {
      const titleElement = item.querySelector(`.${styles.itemTitle}`);
      return titleElement && titleElement.textContent.includes(itemName);
    });
    
    if (selectedItemElement) {
      // 클래스 교체 (item -> selectedItem)
      selectedItemElement.className = styles.selectedItem;
      // 스크롤 위치 조정
      selectedItemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // 2. 지도 이동 및 마커 정보창 표시
    if (instMap.current) {
      try {
        let position = null;
        
        // 서버 데이터 또는 기존 데이터에서 좌표 가져오기
        if (curSelectedShop.serverDataset && curSelectedShop.serverDataset.pinCoordinates) {
          position = parseCoordinates(curSelectedShop.serverDataset.pinCoordinates);
        } else if (curSelectedShop.pinCoordinates) {
          position = parseCoordinates(curSelectedShop.pinCoordinates);
        }

        if (position) {
          // 지도 중심 이동
          instMap.current.setCenter(position);
          instMap.current.setZoom(18);

          // 3. 인포윈도우 표시 및 애니메이션 적용
          if (sharedInfoWindow.current && curSelectedShop.itemMarker) {
            // 인포윈도우 컨텐츠 생성
            const content = createInfoWindowContent(curSelectedShop);
            
            // 애니메이션이 적용된 컨테이너로 감싸기
            const animatedContent = `
              <div class="info-window-content" 
                   style="animation: fadeInScale 0.3s ease-out; transform-origin: bottom center;">
                ${content}
              </div>
              <style>
                @keyframes fadeInScale {
                  from {
                    opacity: 0;
                    transform: scale(0.8) translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                  }
                }
                .info-window-content {
                  padding: 5px;
                  border-radius: 8px;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                }
              </style>
            `;
            
            // 인포윈도우 설정 및 표시
            sharedInfoWindow.current.setContent(animatedContent);
            sharedInfoWindow.current.open(instMap.current, curSelectedShop.itemMarker);

            // 마커 바운스 애니메이션 적용
            curSelectedShop.itemMarker.setAnimation(window.google.maps.Animation.BOUNCE);
            setTimeout(() => {
              if (curSelectedShop.itemMarker) {
                curSelectedShop.itemMarker.setAnimation(null);
              }
            }, 750); // 바운스 1-2회 후 중지
          }
        }
      } catch (error) {
        console.error('지도 이동 또는 마커 표시 중 오류 발생:', error);
      }
    }
    
  

  }, [curSelectedShop]); //## 추가 종속성 절대 추가 금지. curSelectedShop이 변경될때만 연산되는 useEffect. 

  
  useEffect(() => { // AT [curSectionName] sectionDB에서 해당 아이템List 가져옴 -> curItemListInCurSection에 할당
    if (!curSectionName) return;

    getCurLocalItemlist(curSectionName).then(_sectionItemListfromDB => {
      if (_sectionItemListfromDB.length > 0) {
        // 현재 아이템 리스트를 이전 값으로 저장 (useRef 사용)
        prevItemListforRelieveOverlays.current = curItemListInCurSection;
        // 새 아이템 리스트로 업데이트
        setCurItemListInCurSection(_sectionItemListfromDB);
        // 현재 아이템 리스트 참조 업데이트
        currentItemListRef.current = _sectionItemListfromDB;
      } else console.error('DB에 데이터가 없음'); // 이 경우는 발생 불가. 
    });
  }, [curSectionName]); // 중요: curSectionName만 종속성으로 유지. 추가하지말것것

  useEffect(() => { // AT [curItemListInCurSection] 지역변경으로 리스트 변경될 때 UI 업데이트
    // 현재 아이템 리스트 참조 업데이트
    currentItemListRef.current = curItemListInCurSection;
    
    if(!instMap.current) return;  // 최초 curItemListInCurSection초기화시 1회 이탈

    if (!curItemListInCurSection.length) {
      console.error('아이템 리스트가 비어 있습니다.');
      return; 
    }
    
    
    
    // 이전 오버레이 제거 (useRef.current 사용)
    if (prevItemListforRelieveOverlays.current && prevItemListforRelieveOverlays.current.length > 0) {
      
      
      prevItemListforRelieveOverlays.current.forEach(item => {
        if (item.itemMarker) {
          item.itemMarker.setMap(null);
        }
        if (item.itemPolygon) {
          item.itemPolygon.setMap(null);
        }
      });
    }
    
    // 마커와 폴리곤이 제대로 생성되었는지 확인
    let markerCount = 0;
    let polygonCount = 0;
    
    // 새 오버레이 표시
    curItemListInCurSection.forEach(item => {
      // 마커 처리
      if (item.itemMarker) {
        markerCount++;
        // 마커가 맵에 표시되었는지 확인
        if (item.itemMarker.getMap() !== instMap.current) {
          item.itemMarker.setMap(instMap.current);
        }
      }
      
      // 폴리곤 처리
      if (item.itemPolygon) {
        polygonCount++;
        // 폴리곤이 맵에 표시되었는지 확인
        if (item.itemPolygon.getMap() !== instMap.current) {
          item.itemPolygon.setMap(instMap.current);
        }
      }
    });
    
    // mapUtils를 사용하여 이벤트 등록
    mapUtils.registerAllItemsEvents(
      curItemListInCurSection,
      instMap.current,
      sharedInfoWindow.current,
      {
        onItemSelect: setCurSelectedShop,
        isItemSelected: (item) => item === curSelectedShop,
        keepInfoWindowOpen: true // 선택된 아이템의 InfoWindow를 계속 표시하기 위한 옵션
      }
    );
    
    
    
    // 폴리곤 가시성 업데이트 (폴리곤이 있는 경우에만)
    if (polygonCount > 0) {
      const currentZoom = instMap.current.getZoom();
      const shouldShowPolygons = currentZoom >= 15;
      curItemListInCurSection.forEach(item => {
        if (item.itemPolygon) item.itemPolygon.setVisible(shouldShowPolygons);
      });
      
      
    }
    
    // 좌측 사이드바 아이템 리스트 업데이트
    const itemListContainer = document.querySelector(`.${styles.itemList}`);
    if (!itemListContainer) {
      console.error('Item list container not found');
      return;
    }

    // 기존 아이템 제거
    itemListContainer.innerHTML = '';

    // curItemListInCurSectionName의 아이템을 순회하여 사이드바에 추가
    //TODO 사이드바 모듈 추가 
    curItemListInCurSection.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.className = styles.item;

      const link = document.createElement('a');
      link.href = '#';

      const itemDetails = document.createElement('div');
      itemDetails.className = styles.itemDetails;

      const itemTitle = document.createElement('span');
      itemTitle.className = styles.itemTitle;
      
      // 모든 아이템은 serverDataset을 가지고 있음
      itemTitle.innerHTML = `${item.serverDataset.storeName || '이름 없음'} <small>${item.serverDataset.storeStyle || ''}</small>`;

      const businessHours = document.createElement('p');
      if (item.serverDataset.businessHours && item.serverDataset.businessHours.length > 0) {
        businessHours.textContent = `영업 중 · ${item.serverDataset.businessHours[0]}`;
      } else {
        businessHours.textContent = '영업 중 · 정보 없음';
      }

      const address = document.createElement('p');
      address.innerHTML = `<strong>${item.distance || '정보 없음'}</strong> · ${item.serverDataset.address || '주소 없음'}`;

      const itemImage = document.createElement('img');
      itemImage.src = "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDF8fGZvb2R8ZW58MHx8fHwxNjE5MjY0NzYx&ixlib=rb-1.2.1&q=80&w=400";
      
      itemImage.alt = `${item.serverDataset.storeName || ''} ${item.serverDataset.storeStyle || ''}`;
      
      itemImage.className = styles.itemImage;
      itemImage.width = 100;
      itemImage.height = 100;

      // 클릭 이벤트 추가
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 모든 아이템은 항상 serverDataset 구조를 가짐
        setCurSelectedShop(item);
        
        if (instMap.current) {
          try {
            let position = null;
            if (item.serverDataset.pinCoordinates) {
              position = parseCoordinates(item.serverDataset.pinCoordinates);
            }

            if (position) {
              instMap.current.setCenter(position);
              instMap.current.setZoom(18);
            }
          } catch (error) {
            console.error('지도 이동 중 오류 발생:', error);
          }
        }
      });

      // 요소 조립
      itemDetails.appendChild(itemTitle);
      itemDetails.appendChild(businessHours);
      itemDetails.appendChild(address);
      
      link.appendChild(itemDetails);
      link.appendChild(itemImage);
      
      listItem.appendChild(link);
      itemListContainer.appendChild(listItem);
    });
  }, [curItemListInCurSection]); // 중요: 종속성은curItemListInCurSection만유일, 추가 하지 말것

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible); // 사이드바 가시성 토글
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  

  return (
    <div className={styles.container}>
      <Head>
        <title>Editor</title>
      </Head>
      <div className={`${styles.sidebar} ${isSidebarVisible ? '' : styles.hidden}`}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={toggleSidebar}>←</button>
          <h1>반월당역</h1>
          <button className={styles.iconButton}>⚙️</button>
        </div>
        <div className={styles.menu}>
          <button className={styles.menuButton}>숙소</button>
          <button className={styles.menuButton}>맛집</button>
          <button className={styles.menuButton}>관광</button>
          <button className={styles.menuButton}>환전</button>
        </div>
        <ul className={styles.itemList}>
          <li className={styles.item}>
            <a href="#">
              <div className={styles.itemDetails}>
                <span className={styles.itemTitle}>남산에 <small>일식당</small></span>
                <p>영업 중 · 20:30에 라스트오더</p>
                <p><strong>380m</strong> · 대구 중구 남산동</p>
              </div>
              <Image
                src="https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDF8fGZvb2R8ZW58MHx8fHwxNjE5MjY0NzYx&ixlib=rb-1.2.1&q=80&w=400"
                alt="남산에 일식당"
                className={styles.itemImage}
                width={100}
                height={100}
                priority
              />
            </a>
          </li>
        </ul>
      </div>
      <div className={styles.mapContainer}>
        <div id="map" className={styles.map}></div>
        <div ref={searchformRef} className={styles.searchForm}>
          <div className={styles.searchInputContainer}>
            <input 
              ref={searchInputDomRef}
              type="text" 
              className={styles.searchInput}
              placeholder="장소 검색..."
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              data-testid="place-search-input"
            />
            <button className={styles.searchButton}>
              <span className={styles.searchIcon}>🔍</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* 오른쪽 사이드바 */}
      <RightSidebar
        moveToCurrentLocation={moveToCurrentLocation}
        mapOverlayHandlers={mapOverlayHandlers}
        curSelectedShop={curSelectedShop}
        onShopUpdate={(updatedShop) => {
          if (updatedShop === null) {
            // 상점 선택 초기화
            setCurSelectedShop(null);
          } else if (curSelectedShop) {
            // 원래 객체 구조 유지하면서 serverDataset만 업데이트
            setCurSelectedShop({
              ...curSelectedShop,
              serverDataset: updatedShop
            });
          }
        }}
      />
      
      {/* 구글 맵 스크립트 */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing`}
        strategy="afterInteractive"
      />
    </div>
  );
} 