import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from './styles.module.css';
import { protoServerDataset, protoitemdataSet } from '../../lib/models/editorModels';
import MapOverlayManager from '../../lib/components/map/MapOverlayManager';
// 서버 유틸리티 함수 가져오기
import { getSectionData, setupFirebaseListener, getSectionCollectionData } from '../../lib/services/serverUtils';
// Place 유틸리티 함수 가져오기
import { parseGooglePlaceData } from '../../lib/utils/googlePlaceUtils';
// 오른쪽 사이드바 컴포넌트 가져오기
import RightSidebar from '../../components/editor/RightSidebar';
import CompareBar from '../../components/editor/CompareBar';
import ExploringSidebar from '../../components/exploringsidebar';
// Redux 선택자 가져오기
import {
  togglePanel,
  selectIsPanelVisible,
  selectHasChanges,
  selectEditNewitemdataSet,
  selectModifiedFields,
  selectIsDrawing,
  selectDrawingType,
  endDrawingMode,
  updateCoordinates,
  selectFormData,
  setRightSidebarIdleState
} from '../../lib/store/slices/rightSidebarSlice';

import store from '../../lib/store';

// CompareBar 관련 액션 임포트
import {
  setCompareBarActive,
  selectIsCompareBarActive,
  setSyncGoogleSearch
} from '../../lib/store/slices/compareBarSlice';

import { wrapper } from '../../lib/store';

// Redux 관련 임포트 추가
import { 
  curSectionChanged,
  selectSelectedItemId,
  selectSelectedSectionName,
  itemSelectedThunk,
  selectMapCenter,
  selectMapZoom,
  setMapView
} from '../../lib/store/slices/mapEventSlice';

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
  
  // 실시간 리스너 관리용 속성 추가
  _currentListener: null,
  _currentSectionName: null,
  
  /**
   * 섹션 데이터 가져오기 (캐시 -> 로컬 스토리지 -> 서버 순으로 시도)
   * @param {string} sectionName - 가져올 섹션 이름
   * @returns {Promise<Array>} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   */
  getSectionItems: async function(sectionName) {
    // 1. 캐시에서 먼저 확인
    if (this._cache.has(sectionName)) {
      if (this._currentSectionName !== sectionName) {
        this._setupRealtimeListener(sectionName);
      }
      
      return this._cache.get(sectionName);
    }
    
    try {
      // 2. 캐시에 없으면 getSectionData 함수 호출 (로컬 스토리지 -> 서버)
      const serverItems = await getSectionData(sectionName);
      
      // 3. 서버 형식(protoServerDataset)에서 클라이언트 형식(protoitemdataSet)으로 변환
      // 서버 아이템이 있는 경우만 변환 및 캐시 저장
      let clientItems = [];
      if (serverItems && serverItems.length > 0) {
        clientItems = this._transformToClientFormat(serverItems, sectionName);
        
        // 4. 캐시에 저장
        this._cache.set(sectionName, clientItems);
      }
      
      // 5. 실시간 리스너 설정 (서버 아이템이 없는 경우에도 리스너는 설정해야 함)
      this._setupRealtimeListener(sectionName);
      
      return clientItems;
    } catch (error) {
       console.error(`SectionsDBManager: ${sectionName} 데이터 로드 오류`, error);
      
      // 오류 발생해도 리스너 설정은 시도
      this._setupRealtimeListener(sectionName);
      
      return [];
    }
  },
  
  /**
   * 실시간 리스너 설정 (내부 메서드)
   * @param {string} sectionName - 실시간 업데이트를 구독할 섹션 이름
   * @private
   */
  _setupRealtimeListener: function(sectionName) { //파이어베이스 onSnapshot 이벤트 리스닝을요청하는 곳
    // 이미 같은 섹션에 리스너가 있으면 재사용
    if (this._currentSectionName === sectionName && this._currentListener) {
      return;
    }
    
    // 다른 섹션의 리스너가 있으면 정리
    if (this._currentListener) {
      this._currentListener();
      this._currentListener = null;
      this._currentSectionName = null;
    }
    
        // 새 리스너 설정, CB설정.  onSnapshot 이벤트 리스닝을 콜백함수
        // sectionName의 필드에서 counterUpdated의 값을 로컬스토리지 counter와 비교
        // 이후 counterCollections자료구조 값을 조회하여 특정 컬렉션 변경 여부 확인
    this._currentListener = setupFirebaseListener(sectionName, (updatedItems, changes) => {
      console.log('[SectionsDBManager] 실시간 리스너 cb 동작', updatedItems, changes);

      // 서버의 counterUpdated 값과 updatedCollections 배열 확인
      const sectionDoc = updatedItems ? updatedItems.sectionDoc : null;
      if (!sectionDoc) {
        console.log('[SectionsDBManager] 섹션 문서 정보가 없습니다.');
        return;
      }

      const serverCounter = sectionDoc.counterUpdated;
      const serverCounterCollections = sectionDoc.counterCollections || {};
      
      // 로컬 스토리지에서 카운터 값과 컬렉션 정보 가져오기
      const localCounter = localStorage.getItem(`${sectionName}_counter`) || "0";
      const localCounterValue = parseInt(localCounter);
      
      let localCollections = {};
      try {
        const savedCollections = localStorage.getItem(`${sectionName}_collections`);
        if (savedCollections) {
          localCollections = JSON.parse(savedCollections);
        }
      } catch (e) {
        console.error('[SectionsDBManager] 로컬 컬렉션 정보 파싱 오류:', e);
        localCollections = {};
      }
      
      // 변경 여부 확인 - 서버 카운터가 로컬보다 큰 경우 업데이트 필요
      const shouldUpdate = serverCounter > localCounterValue;
      
      if (shouldUpdate) {
        console.log(`[SectionsDBManager] ${sectionName} 섹션 업데이트 필요 (카운터: ${localCounterValue} -> ${serverCounter})`);
        
        // 변경된 컬렉션 식별 및 데이터 가져오기
        const updatedCollectionsPromises = [];
        
        // 서버의 컬렉션 정보 순회 (Map 구조 사용)
        Object.entries(serverCounterCollections).forEach(([collectionName, collectionData]) => {
          // 로컬에 해당 컬렉션 정보가 있는지 확인
          const localCollectionData = localCollections[collectionName] || { counter: 0 };
          
          // 컬렉션이 없거나 서버 카운터가 더 큰 경우 업데이트 필요
          if (!localCollectionData || collectionData.counter > localCollectionData.counter) {
            console.log(`[SectionsDBManager] 컬렉션 업데이트 필요: ${collectionName} (${localCollectionData.counter || 0} -> ${collectionData.counter})`);
            
            // 해당 컬렉션의 데이터 가져오기 작업 추가
            updatedCollectionsPromises.push(
              getSectionCollectionData(sectionName, collectionName)
                .then(collectionData => {
                  return {
                    nameCollection: collectionName,
                    counter: collectionData.counter || (serverCounterCollections[collectionName]?.counter || 0),
                    data: collectionData
                  };
                })
            );
          }
        });
        
        // 모든 변경된 컬렉션 데이터 가져오기 완료 대기
        Promise.all(updatedCollectionsPromises)
          .then(collectionsData => {
            // 각 컬렉션 데이터를 처리
            collectionsData.forEach(collection => {
              // 데이터가 items 컬렉션인 경우 특별 처리
              if (collection.nameCollection === 'items' && collection.data.length > 0) {
                // 서버 데이터를 클라이언트 형식으로 변환
                const clientItems = this._transformToClientFormat(collection.data, sectionName);
                
                // 캐시 업데이트
                this._cache.set(sectionName, clientItems);
                
                // 이벤트 발생
                document.dispatchEvent(new CustomEvent('section-items-updated', {
                  detail: { sectionName, items: clientItems }
                }));
              } else if (collection.data.length > 0) {
                // 다른 컬렉션 데이터도 캐시에 저장
                this._cache.set(sectionName, collection.data);
              }
            });
            
            // 로컬 스토리지에 카운터와 컬렉션 정보 업데이트
            localStorage.setItem(`${sectionName}_counter`, serverCounter.toString());
            localStorage.setItem(`${sectionName}_collections`, JSON.stringify(serverCounterCollections));
            
            console.log(`[SectionsDBManager] ${sectionName} 섹션 데이터 업데이트 완료 (카운터: ${serverCounter})`);
          })
          .catch(error => {
            console.error(`[SectionsDBManager] 컬렉션 데이터 가져오기 오류:`, error);
          });
      } else {
        console.log(`[SectionsDBManager] ${sectionName} 섹션에 실제 변경사항 없음, 업데이트 건너뜀 (로컬: ${localCounterValue}, 서버: ${serverCounter})`);
      }
    });
    
    this._currentSectionName = sectionName;
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
   * ID와 섹션 이름으로 특정 아이템 찾기
   * @param {string} sectionName - 섹션 이름
   * @param {string} id - 아이템 ID
   * @returns {Object|null} - 찾은 아이템 또는 null
   */
  getItemByIDandSectionName: function(id, sectionName) {
    // 캐시에서 해당 섹션의 아이템 목록 가져오기
    const items = this._cache.get(sectionName);
    
    // 아이템 목록이 없으면 null 반환
    if (!items || items.length === 0) {
      console.log(`[SectionsDBManager] ${sectionName} 섹션에 아이템이 없습니다`);
      return null;
    }
    
    // ID로 아이템 찾기
    const item = items.find(item => {
      // serverDataset.id 또는 id 속성 확인
      const itemId = item.serverDataset?.id || item.id;
      return itemId === id;
    });
    
    if (!item) {
      console.log(`[SectionsDBManager] ${sectionName} 섹션에서 ID가 ${id}인 아이템을 찾을 수 없습니다`);
    }
    
    return item || null;
  },
  
  /**
   * 서버 형식에서 클라이언트 형식으로 데이터 변환 - 오버레이 생성(등록)도 포함
   * @param {Array} serverItems - 서버 형식 아이템 리스트 (protoServerDataset 형태)
   * @returns {Array} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   */
  _transformToClientFormat: function(serverItems, sectionName) {
    // 오버레이 등록 처리
    if (!sectionName) {
      console.error('[SectionsDBManager] 섹션 이름이 제공되지 않았습니다.');
      return [];
    }

    // serverItems가 없거나 빈 배열이면 빈 배열 반환
    if (!serverItems || !Array.isArray(serverItems) || serverItems.length === 0) {
      console.log(`[SectionsDBManager] ${sectionName} 섹션에 대한 서버 아이템이 없습니다.`);
      return [];
    }

    // MapOverlayManager에 전체 아이템 리스트 등록 (일괄 처리)
    MapOverlayManager.registerOverlaysByItemlist(
      sectionName, 
      serverItems  // protoServerDataset데이터 배열 (각 항목에는 id, pinCoordinates, path 등 포함)
    );

    return serverItems.map(item => {
      const clientItems = {
        ...protoitemdataSet,
        serverDataset: { ...item }
      };
      
      //AT 클라이언트에서 사용할 객체 속성의 생성 부분 
      
      return clientItems;
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
    
  },
  
  /**
   * 캐시 초기화
   */
  clearCache: function() {
    this._cache.clear();
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
  const overlayMarkerFoamCard = useRef(null);
  const overlayPolygonFoamCard = useRef(null);

  const searchInputDomRef = useRef(null);
  const searchformRef = useRef(null);
  //const mapSearchInputRef = useRef(null);  // 검색 입력 필드 참조 추가
  //const [selectedButton, setSelectedButton] = useState('인근');

  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // 사이드바 가시성 상태 추가
  const [isSearchFocused, setIsSearchFocused] = useState(false); // 검색창 포커스 상태 추가

  // 임시 오버레이(마커, 다각형) 관리 - 하나의 상태로 통합
  const [tempOverlays, setTempOverlays] = useState({ marker: null, polygon: null });
  
  // sectionsDB 참조 제거 (SectionsDBManager로 완전히 대체)
  
  const [curItemListInCurSection, setCurItemListInCurSection] = useState([]);
  // 이전 아이템 리스트를 useRef로 변경
  const prevItemListforRelieveOverlays = useRef([]);
  // 내부 처리용 참조 - MapOverlayManager로 관리권한 이전
    
  // curSectionName을 상태로 관리 - 초기값을 null로 설정
  const [curSectionName, setCurSectionName] = useState(null);
  
  // 선택된 상점 정보를 저장하는 상태 변수 더이상 사용 안함. id와 sectionName만 저장. 
  //const [curSelectedShop, setCurSelectedShop] = useState(null);
  
  // 폼 데이터는 이제 Redux에서 관리 (로컬 상태 제거)
  //const formData = useSelector(selectFormData);
  
    
  // CompareBar 활성화 상태 가져오기
  const isActiveCompareBar = useSelector(selectIsCompareBarActive);
  

  // 로컬 저장소에서 sectionsDB 저장 함수는 serverUtils.js로 이동했습니다.

  // protoServerDataset과 protoitemdataSet은 dataModels.js로 이동했습니다.
  
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const hasChanges = useSelector(selectHasChanges);
  const editNewitemdataSet = useSelector(selectEditNewitemdataSet);
  const modifiedFields = useSelector(selectModifiedFields);
  // 드로잉 관련 상태 추가
  const isDrawing = useSelector(selectIsDrawing);
  const drawingType = useSelector(selectDrawingType);
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});

  // mapEventSlice 상태 선택자 추가
  const selectedItemId = useSelector(selectSelectedItemId);
  const selectedSectionName = useSelector(selectSelectedSectionName);
  const mapCenter = useSelector(selectMapCenter);
  const mapZoom = useSelector(selectMapZoom);
  
  // 드로잉 매니저 상태 감시 및 제어를 위한 useEffect
  useEffect(() => {
    // 드로잉 매니저가 초기화되지 않았거나 맵이 없으면 무시
    if (!drawingManagerRef.current || !instMap.current) return;
    
    // 드로잉 모드가 활성화되었을 때
    if (isDrawing && drawingType) {
      // 인포윈도우가 열려있으면 닫기
      
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
  }, [isDrawing, drawingType]);

  const mapOverlayHandlers = useMemo(() => {
    return {
      cleanupTempOverlays: () => {
        // 마커가 있으면 제거
        if (tempOverlays.marker) {
          tempOverlays.marker.setMap(null);
        }
        // 폴리곤이 있으면 제거
        if (tempOverlays.polygon) {
          tempOverlays.polygon.setMap(null);
        }
        // 상태 초기화
        setTempOverlays({ marker: null, polygon: null });
      }
    };
  }, [tempOverlays]);

  // 마커와 폴리곤 옵션 초기화 함수
  const initMarker = (_mapInstance) => { 
     // MapOverlayManager 초기화
     MapOverlayManager.initialize(_mapInstance);
     console.log('[DEBUG] MapOverlayManager 초기화 성공');
  }
  
  // 검색창 초기화 함수
  const initSearchInput = (_mapInstance) => {
    const inputDom = searchInputDomRef.current;
    if (!inputDom) {
      // console.error("Search input DOM element not found");
      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputDom, {
      fields: [
        'name', 'formatted_address', 'place_id', 'geometry', 'photos', 
        //'formatted_phone_number', 'website', 'rating', 'price_level',
        'opening_hours.weekday_text' // utc_offset 대신 weekday_text만 요청
      ]
    });
    autocomplete.bindTo('bounds', _mapInstance);

    autocomplete.addListener('place_changed', () => {
      const detailPlace = autocomplete.getPlace();
      if (!detailPlace.geometry || !detailPlace.geometry.location) {
        console.error(`구글place 미작동: '${detailPlace.name}'`);
        return;
      }
      console.log('[DEBUG] 구글 장소 검색 결과 객체:', detailPlace);
      try {
        // 최신 compareBar 상태 가져오기
        const reduxState = store.getState();
        const compareBarState = reduxState.compareBar;
                  
        // 유틸리티 함수를 사용하여 구글 장소 데이터를 앱 형식인 protoServerDataset으로 변환
        const convertedGoogleData = parseGooglePlaceData(detailPlace, myAPIkeyforMap);
        
        // isSyncGoogleSearchCompareBar 값이 true일 때 CompareBar 업데이트
        if (compareBarState.isSyncGoogleSearchCompareBar) {
          // 변환된 데이터로 CompareBar 활성화

           // Redux에서 설정한 플래그 초기화 (한 번만 사용)
          dispatch(setSyncGoogleSearch(false));
          
          // 변환된 데이터로 CompareBar 활성화
          dispatch(setCompareBarActive(convertedGoogleData));
                   
        }
        
        // 지도 이동 로직은 항상 실행 // setMapView 사용시 Redux용 개체 직렬화 문제가 있으므로, setMapview액션 대신 직접 지도 중심과 줌 레벨 설정. 
        if (detailPlace.geometry.viewport) {
          // 뷰포트가 있는 경우 지도 경계에 맞추기
          _mapInstance.fitBounds(detailPlace.geometry.viewport);
        } else {
          // 뷰포트가 없는 경우 직접 지도 중심과 줌 레벨 설정
          _mapInstance.setCenter(detailPlace.geometry.location);
          _mapInstance.setZoom(15);
        }
        
        // 검색 완료 후 인풋창 비우기
        if (searchInputDomRef.current) {
          searchInputDomRef.current.value = '';
        }
      } catch (error) {
        console.error('[place_changed] 오류 발생:', error);
      }
    });

    _mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(searchformRef.current);
  } // initSearchInput
  
  

  // FB와 연동 - 초기화 방식으로 수정
  const initShopList = async (_mapInstance) => { //AT initShoplist 
    if (!curSectionName) {
      // TODO 앱 초기화면에서  지역명 입력전 처리방법 추가. 초기화 지역 근처의 section을 자동으로 찾아서 초기 section으로 배정하는 로직 추가
      setCurSectionName("반월당"); 
      // curSectionName이 변경되면 useEffect에서 데이터 로드 및 UI 업데이트가 자동으로 처리됨
      return;
    }
  };

  const changeSection = async (newSectionName) => {
    if (newSectionName !== curSectionName) {
      setCurSectionName(newSectionName);
      // curSectionName이 변경되면 useEffect에서 데이터 로드 및 UI 업데이트가 자동으로 처리됨
      }

  }

  // 드로잉 매니저의 생성이유와 용도는 Myitemdata의 pin과 다각형 도형 수정과 출력을 그리기용용
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


  /**
 * 오버레이매니저에서 마커와 폴리곤 오버레이 생성시 사용되는 임시 오버레이용 디자인 
 * TODO MapIcons.js로 아이콘 디자인을 통합할지 고민
  */
     const OVERLAY_COLOR = {
      IDLE: '#FF0000', // 빨간색
      MOUSEOVER: '#00FF00', // 초록색
    };
    
     const OVERLAY_ICON = {
      MARKER_MOUSEOVER: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // 파란색
      MARKER: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // 초록색
    };
    
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

    // DarwingManager 오버레이 생성시 공통 이벤트 핸들러
    window.google.maps.event.addListener(_drawingManager, 'overlaycomplete', (eventObj) => {
      // 1. 그리기 모드 초기화
      _drawingManager.setDrawingMode(null);
      _drawingManager.setOptions({ drawingControl: false });
      
      // 2. Redux 액션 디스패치 - 드로잉 모드 종료
      dispatch(endDrawingMode());
    });

    // DarwingManager 마커 완료 이벤트 리스너 추가
    window.google.maps.event.addListener(_drawingManager, 'markercomplete', (marker) => {
      // 마커 위치 가져오기
      const position = marker.getPosition();
      // 객체 형태로 좌표 저장
      const pinCoordinates = {
        lat: position.lat(),
        lng: position.lng()
      };
      
      // Redux 액션 디스패치 - 좌표 업데이트
      dispatch(updateCoordinates({ 
        type: 'MARKER', 
        coordinates: pinCoordinates 
      }));
      
      // 기존 임시 마커가 있으면 제거
      if (tempOverlays.marker) {
        tempOverlays.marker.setMap(null);
      }
      
      // 새 마커를 임시 오버레이로 저장
      setTempOverlays(prev => ({
        ...prev,
        marker: marker
      }));
      
      // DarwingManager 마커에 drag 이벤트 리스너 추가 - 위치 변경 시 좌표 업데이트
      window.google.maps.event.addListener(marker, 'dragend', () => {
        const newPosition = marker.getPosition();
        const newCoordinates = {
          lat: newPosition.lat(),
          lng: newPosition.lng()
        };
        
        // Redux 액션 디스패치 - 좌표 업데이트
        dispatch(updateCoordinates({
          type: 'MARKER',
          coordinates: newCoordinates
        }));
      });
    });

    //DarwingManager 폴리곤 완료 이벤트 리스너 추가
    window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', (polygon) => {
      // 폴리곤 경로 가져오기
      const path = polygon.getPath();
      const pathCoordinates = [];
      
      // 폴리곤 경로의 모든 좌표를 객체 배열로 수집
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        pathCoordinates.push({
          lat: point.lat(),
          lng: point.lng()
        });
      }
      
      // Redux 액션 디스패치 - 좌표 업데이트 (객체 배열 형태로 전달)
      dispatch(updateCoordinates({ 
        type: 'POLYGON', 
        coordinates: pathCoordinates 
      }));
      
      // 기존 임시 폴리곤이 있으면 제거
      if (tempOverlays.polygon) {
        tempOverlays.polygon.setMap(null);
      }
      
      // 새 폴리곤을 임시 오버레이로 저장 (ref와 상태 모두 업데이트)
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
    
    // 폴리곤 경로의 모든 좌표를 객체 배열로 수집
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      pathCoordinates.push({
        lat: point.lat(),
        lng: point.lng()
      });
    }
    
    // Redux 액션 디스패치 - 경로 업데이트 (객체 배열 형태로 전달)
    dispatch(updateCoordinates({
      type: 'POLYGON',
      coordinates: pathCoordinates
    }));
  };

  // 지도 초기화 함수 수정
  const initGoogleMapPage = () => { // 이 함수의 초기화 단계를 수정할시 수정을 했다고 표시할것
    // 여기는 window.google과 window.google.maps객체가 로딩 확정된 시점에서 실행되는 지점점
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
      },
        (error) => {
          console.error('geolocation 에러 : ',error);
        });
    } else {
      // console.error('geolocation 지원 안되는 중');
    }

    //-- g맵 인스턴스 생성
    let mapDiv = document.getElementById('map');
    
    // mapDiv가 null인 경우 초기화를 중단하고 다음에 다시 시도
    if (!mapDiv) {
      console.error('맵 DOM 요소를 찾을 수 없습니다. 지도 초기화를 중단합니다.');
      return;
    }

    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
      zoom: 15, // 초기 줌 레벨을 15로 설정 (폴리곤이 보이는 레벨)
      mapTypeControl: false,
      fullscreenControl: true, // 전체화면 버튼 활성화
      fullscreenControlOptions: {
        position: window.google.maps.ControlPosition.LEFT_BOTTOM // 전체화면 버튼 위치를 왼쪽 하단으로 설정
      },
      mapId: "2ab3209702dae9cb"//process.env.NEXT_PUBLIC_MAP_ID 
    });
    //-- g맵 인스턴스 생성 끝끝

    // g맵용 로드 완료시 동작 //AT 구글맵Idle바인딩  
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => { 
      // 여기는 구글맵 인스턴스가 확정된 시점
      // ** 아래 순서는 수정 금지
      initDrawingManager(_mapInstance); 
      initSearchInput(_mapInstance);
      initMarker(_mapInstance);  // MapOverlayManager 세팅
      initShopList(); // exploringSidebar 세팅, 드로잉 매니저 내부 세팅 (에디터전용)
    });
    instMap.current = _mapInstance;
  
  } // initializeGoogleMapPage 마침

  // 모듈로딩을 순차적으로 진행하기위해필수. 구글모듈-맵모듈-맵로딩idle이벤트-mapinst로 애드온모듈 초기화화
  useEffect(() => { 
    // 프로그램 마운트시 필요한 코드
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
            if (_cnt++ > 10) { 
              clearInterval(_intervalId); 
              // console.error('구글맵 로딩 오류'); 
            }
            // console.error('구글맵 로딩 중', _cnt);
          }
        }, 100);
      } else {
        if (_cnt++ > 10) { 
          clearInterval(_intervalId); 
          // console.error('구글서비스 로딩 오류'); 
        }
        // console.error('구글서비스 로딩 중', _cnt);
      }
    }, 100);

    // 프로그램 언마운트시 필요한 코드
    return () => {
      // MapOverlayManager에서 모든 오버레이를 내부적으로 정리하도록 호출
      MapOverlayManager.cleanup();
    }; // return
  }, []);

  // 컴포넌트 마운트 시 IDLE 상태 설정
  useEffect(() => { // AT 우측 사이드바 초기화 지점 
    // 초기에 IDLE 상태로 설정
    dispatch(setRightSidebarIdleState(true));
    
  }, [dispatch]);

  
  // itemSelectedThunk 사용으로 curSelectedShop 사용 중단
  // useEffect(() => { // AT [curSelectedShop] 
  //   // 4. 폼 데이터 업데이트 
  //   // 우측 사이드바 업데이트 여부와 상태 검증은 Redux 액션 내부에서 처리됨
  //   if (!curSelectedShop) {      // selectedCurShop이 없는 경우 빈 폼 
  //     // syncExternalShop 대신 itemSelectedThunk 사용
  //     dispatch(itemSelectedThunk({ id: null, sectionName: null }));
      
  //     return; // 선택된 값이 비어있으면 여기서 종료 
  //   }
    
  //   // syncExternalShop 대신 itemSelectedThunk 사용
  //   const itemId = curSelectedShop.serverDataset?.id;
  //   if (itemId && curSectionName) {
  //     dispatch(itemSelectedThunk({ id: itemId, sectionName: curSectionName }));
  //   }
    
  //   // 지도 이동 코드 제거 - 이제 mapEventSlice에서 처리
  // }, [curSelectedShop]); //## 추가 종속성 절대 추가 금지. curSelectedShop이 변경될때만 연산되는 useEffect.

  
  useEffect(() => { // AT [curSectionName] sectionDB에서 해당 아이템List 가져옴 -> curItemListInCurSection에 할당
    // 1회 읽어오고, 그 뒤 FB서버에 리스닝 구독
    
    if (!curSectionName) return;
    //TODO sectionDBManager의 컴포넌트로 이식 + 리덕스 환경으로 전환 차후에 진행. 
    SectionsDBManager.getSectionItems(curSectionName).then(_sectionItemListfromDB => {
      if (_sectionItemListfromDB.length > 0) {
        // 현재 아이템 리스트를 이전 값으로 저장 (useRef 사용)
        
        // 새 아이템 리스트로 업데이트
        setCurItemListInCurSection( (prev)=>{
          prevItemListforRelieveOverlays.current = prev;
          return _sectionItemListfromDB;
        });

        
        // 이시점에 오버레이 교체가 호출되어야 함. 
        // _sectionItemListfromDB( curItemListInCurSection )이 생성되어야 오버레이도 MapOverlayManager등록되어있음. 
        dispatch(curSectionChanged({ sectionName: curSectionName }));
        
      } else {
        console.error('서버및로컬DB에 데이터를 가져오지못함'); // 이 경우는 발생 불가.
      }
    });

  
    // 비직렬화 데이터 포함된 업데이트 이벤트 리스너 
    // 파이어베이스 서버로부터 onShapShot 업데이트시, curSectionName에 대한 useEffect, setCurSectionName을 대신함.  
    const handleSectionUpdate = (event) => {
      const { sectionName, items } = event.detail;
      if (sectionName === curSectionName) { 
        // lastUpdated 정보 확인
        const serverLastUpdated = items && items.length > 0 && 
          items[0].serverDataset?.lastUpdated ? items[0].serverDataset.lastUpdated : null;
        
        // 로컬 스토리지에서 이 섹션의 마지막 업데이트 타임스탬프 가져오기
        const localStorageKey = `section_ui_${sectionName}_lastUpdated`;
        const localLastUpdated = localStorage.getItem(localStorageKey);
        
        // 변경 여부 확인 - 서버 타임스탬프가 로컬보다 최신이거나 로컬에 없는 경우에만 업데이트
        const shouldUpdate = !localLastUpdated || 
          !serverLastUpdated || 
          new Date(serverLastUpdated).getTime() > new Date(localLastUpdated).getTime();
        
        if (shouldUpdate) {
          //동일한 sectionNAme이면, 이것은 현재 section에 대한 업데이트 이므로, 현재 아이템 리스트 업데이트 필요. 
          // sectionName이 변경될때만 Itemlist가 교체되므로, 이에대한 처리가 필요함. 
          // UI 업데이트 (마커, 폴리곤 포함된 완전한 객체)
          setCurItemListInCurSection((prev) => {
            prevItemListforRelieveOverlays.current = prev;
            return items;
          });
          
          // 로컬 스토리지에 마지막 업데이트 타임스탬프 저장
          if (serverLastUpdated) {
            localStorage.setItem(localStorageKey, serverLastUpdated);
          }
        } else {
          console.log(`[Editor] ${sectionName} 섹션에 실제 변경사항 없음, UI 업데이트 건너뜀`);
        }
      }

      //TODO 서버로부터 업데이트된 sectionName이 !== curSEction과 다르면? 
      //FIXME 서버로부터 업데이트된 sectionName이 다를경우가 있나? onSnap부분에서 구별해서 customEvent로 전달해야할지 미정이다. 
      // 서버에서 sectionName이 다른 snapshot이 업데이트 되었다면, setCurentItemlist는 호출하지 않고, sectionDB만 해당 sectionName으로 업데이트 시키면 됨. 
      //서버로부터 업데이트된 sectionName이 다를경우는 문제가 있음. 왜냐하면, 필요할때 sectionDB를 통해 서버로 호출을 하는 방식이기 때문
    };
    
    document.addEventListener('section-items-updated', handleSectionUpdate);
    
    return () => {
      document.removeEventListener('section-items-updated', handleSectionUpdate);
    };

  }, [curSectionName]); // 중요: curSectionName만 종속성으로 유지. 추가하지말것것

  

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible); // 사이드바 가시성 토글
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  // 컴포넌트 언마운트 시 임시 오버레이 정리
  useEffect(() => {
    return () => {
      // 마커가 있으면 제거
      if (tempOverlays.marker) {
        tempOverlays.marker.setMap(null);
      }
      // 폴리곤이 있으면 제거
      if (tempOverlays.polygon) {
        tempOverlays.polygon.setMap(null);
      }
    };
  }, [tempOverlays]);

  
  useEffect(() => { //[mapCenter, mapZoom] 지도의 좌표이동만을 위한 상태변수와 useEffect. 좌표이동 지시는 리덕스 액션으로 통합. 
    // 지도 인스턴스와 중심 좌표가 있을 때만 처리
    if (instMap.current && mapCenter) {
      try {
        // mapCenter가 이미 구글 LatLng 객체인지 확인하고, 아니라면 변환
        const center = mapCenter instanceof google.maps.LatLng 
          ? mapCenter 
          : new google.maps.LatLng(mapCenter.lat, mapCenter.lng);
        
        // 지도 중심 이동
        instMap.current.setCenter(center);
        
        // 줌 레벨이 있을 때만 설정
        if (mapZoom) {
          instMap.current.setZoom(mapZoom);
        }
      } catch (error) {
        console.error('지도 이동 중 오류 발생:', error);
      }
    }
  }, [mapCenter, mapZoom]);

 
  // 마지막에 추가 - SectionsDBManager를 전역 객체로 등록
  if (typeof window !== 'undefined') {
    window.SectionsDBManager = SectionsDBManager;
  }

  return (
    <div className={styles.editorContainer}>
      <Head>
        <title>Editor</title>
      </Head>
      
      {/* ExploringSidebar 컴포넌트 사용 */}
      <ExploringSidebar 
        curSectionName={curSectionName}
        curItemListInCurSection={curItemListInCurSection}
      />
      
      {/* 지도 영역 */}
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
              
      {/* CompareBar - 조건부 렌더링 적용 */}
      {isActiveCompareBar && <CompareBar />}
      
      {/* 오른쪽 사이드바 */}
      <RightSidebar
        mapOverlayHandlers={mapOverlayHandlers}
      />
      
      {/* 구글 맵 스크립트 */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing,marker`}
        strategy="afterInteractive"
      />
    </div>
  );
}

// 서버 사이드 프롭스 추가
export const getServerSideProps = wrapper.getServerSideProps(
  (store) => async (context) => {
    // 서버에서 필요한 초기 데이터를 로드할 수 있음
    // 예: await store.dispatch(someAsyncAction());
    
    return {
      props: {}
    };
  }
); 