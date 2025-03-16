import React, { useEffect, useState, useReducer, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from './styles.module.css';
import { ActionTypes, initialEditState, editReducer, editActions, editUtils } from './editActions';
import { protoServerDataset, protoShopDataSet, OVERLAY_COLOR, OVERLAY_ICON, parseCoordinates, stringifyCoordinates } from './dataModels';
import mapUtils, { createInfoWindowContent, showInfoWindow } from './mapUtils';
// 서버 유틸리티 함수 가져오기
import { getSectionData } from './serverUtils';
// 오른쪽 사이드바 컴포넌트 가져오기
import RightSidebar from './components/RightSidebar';

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

  // curSectionName을 상태로 관리 - 초기값을 null로 설정
  const [curSectionName, setCurSectionName] = useState(null);
  
  // 선택된 상점 정보를 저장하는 상태 변수 추가 - 코드 순서 변경
  const [curSelectedShop, setCurSelectedShop] = useState(null);
  
  // 폼 데이터를 관리하는 상태 추가
  const [formData, setFormData] = useState({
    storeName: "",
    storeStyle: "",
    alias: "",
    comment: "",
    locationMap: "",
    businessHours: "",
    hotHours: "",
    discountHours: "",
    address: "",
    mainImage: "",
    pinCoordinates: "",
    path: "",
    categoryIcon: "",
    googleDataId: "",
  });
  
  // 현재 선택된 섹션의 아이템 리스트를 가져오는 함수
  const getCurLocalItemlist = async (sectionName = curSectionName) => { 
    if (!sectionName) {
      console.error('섹션 이름이 지정되지 않았습니다.');
      return [];
    }
    
    console.log(`getCurLocalItemlist: ${sectionName} 데이터 로드 시도`);
    
    // SectionsDBManager를 통해 데이터 가져오기
    return await SectionsDBManager.getSectionItems(sectionName);
  };

  // 로컬 저장소에서 sectionsDB 저장 함수는 serverUtils.js로 이동했습니다.

  // protoServerDataset과 protoShopDataSet은 dataModels.js로 이동했습니다.
  
  // 기존 상태들을 useReducer로 대체
  const [editState, dispatch] = useReducer(editReducer, initialEditState);
  
  // 기존 상태 변수들을 editState에서 추출
  const { isPanelVisible, isEditing, isEditCompleted, hasChanges, editNewShopDataSet, modifiedFields } = editState;
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});

  const handleButtonClick = (buttonName) => {
    setSelectedButton(buttonName);
  };


  const handleDetailLoadingClick = (event) => {
    // 이벤트 기본 동작 방지
    if (event) event.preventDefault();
    console.log('디테일 로딩 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };

  // 서버 DB에 데이터 업데이트하는 함수
  const justWriteServerDB = () => {
  
    // 서버로 데이터를 보내는 기능은 삭제하고 로그만 출력
    console.log(`[미구현] 샵데이터 에디터에서 편집 완료한 데이터를 서버로 보내는 기능`);
  };

  // 수정/완료/재수정 버튼 클릭 핸들러
  const handleEditFoamCardButton = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 완료 버튼 클릭 시
    if (editState.isEditing) {
      // 변경 사항이 있는지 확인 (원본 데이터와 비교)
      const hasChanges = editUtils.compareShopData(
        editState.originalShopData, // 원본 데이터와 비교
        editState.editNewShopDataSet
      );

      console.log('변경 사항 확인:', { 
        hasChanges, 
        originalData: editState.originalShopData,
        editData: editState.editNewShopDataSet 
      });

      if (!hasChanges) {
        // 변경 사항이 없으면 편집 취소
        dispatch(editActions.cancelEdit());
        // 폼 데이터 업데이트
        if (editState.originalShopData) {
          const updatedFormData = editActions.updateFormDataFromShop(
            editState.originalShopData
          );
          setFormData(updatedFormData);
        }
      } else {
        // 변경 사항이 있으면 확인 단계로 전환
        dispatch(editActions.completeEdit());
      }
    } 
    // 수정 버튼 클릭 시
    else if (!editState.isEditing && !editState.isConfirming) {
      // 원본 데이터 저장 및 편집 시작
      dispatch(
        editActions.beginEdit({
          originalShopData: curSelectedShop, // 원본 데이터 저장
          editNewShopDataSet: curSelectedShop, // 편집할 데이터 설정
        })
      );
    } 
    // 재수정 버튼 클릭 시
    else if (!editState.isEditing && editState.isConfirming) {
      // 원본 데이터는 유지하고 편집 상태로 전환
      dispatch(
        editActions.beginEdit({
          originalShopData: editState.originalShopData, // 원본 데이터 유지
          editNewShopDataSet: curSelectedShop, // 현재 선택된 데이터로 편집 시작
        })
      );
    }
  };

  // 수정 확인 핸들러
  const handleConfirmEdit = () => {
    if (!editNewShopDataSet || !curSelectedShop) return;
    
    // 서버 데이터 업데이트 로직
    console.log('수정 확인:', editNewShopDataSet);
    
    // 현재 선택된 상점 업데이트
    setCurSelectedShop(editNewShopDataSet);
    
    // 상태 초기화
    dispatch(editActions.confirmEdit());
  };

  // 수정 취소 핸들러
  const handleCancelEdit = () => {
    // 원본 데이터로 폼 데이터 복원
    if (curSelectedShop) {
      updateFormDataFromShop(curSelectedShop);
    }
    
    // 상태 초기화
    dispatch(editActions.cancelEdit());
  };
  
  // 필드 편집 버튼 클릭 핸들러
  const handleFieldEditButtonClick = (event, fieldName) => {
    event.preventDefault();
    
    console.log(`편집 버튼 클릭: ${fieldName}`);
    
    // 해당 필드 편집 가능 상태로 변경
    if (inputRefs.current[fieldName]) {
      // readOnly 속성 해제
      inputRefs.current[fieldName].readOnly = false;
      
      // 포커스 설정
      setTimeout(() => {
        inputRefs.current[fieldName].focus();
        
        // 커서를 텍스트 끝으로 이동
        const length = inputRefs.current[fieldName].value.length;
        inputRefs.current[fieldName].setSelectionRange(length, length);
      }, 0);
    }
    
    // 수정된 필드 추적
    dispatch(editActions.trackFieldChange(fieldName));
  };
  
  // 입력 필드 변경 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 항상 formData 업데이트 (편집 모드와 상관없이)
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (isEditing) {
      // 편집 모드에서는 editNewShopDataSet 업데이트
      let processedValue = value;
      
      // 배열 형태로 저장해야 하는 필드 처리
      if (name === 'businessHours') {
        processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
      }
      
      // 필드 데이터 업데이트
      dispatch(editActions.updateField(name, processedValue));
      
      // 수정된 필드 추적
      dispatch(editActions.trackFieldChange(name));
    } else {
      // 일반 모드에서는 selectedCurShop 업데이트
      if (curSelectedShop) {
        let processedValue = value;
        
        if (name === 'businessHours') {
          processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
        }
        
        const updatedShop = {
          ...curSelectedShop,
          serverDataset: {
            ...curSelectedShop.serverDataset,
            [name]: processedValue
          }
        };
        
        setCurSelectedShop(updatedShop);
      }
    }
  };
  
  const updateDataSet = (updates) => {
    console.log('데이터 업데이트 요청:', updates);
    // 기능 제거 - 차후 추가 예정
  };

  // 폼데이터내 지적도 도형 버튼 클릭시 동작. 다각형에 대한 처리를 위해 사용 
  // 드로잉매니저에 대한 실질적인 이벤트 처리부
  // // 수정버튼 클릭 -> 핸들러 -> DrawManager 동작 
  // // -> 객체 생성 이벤트 발생 ( overlaycomplete, polygoncomplete 2개 cb 동작작 )
  // // -> DataSet에 저장 -> 폼데이터내 Path 필드에 저장 -> 필드 활성화되어있으면 -> 해당 마커 생성 
  // 0 Marker Overlay 객체 생성 삭제를 관리 
  // 1.드로잉매니저 컨트롤러 보여주고, 
  // 2. 이벤트 처리 결과 pin과 다각형을 기존 객체 변수에 저장. 
  // 3. 기존은 삭제 
  
  const handlePathButtonClick = (event) => {
    event.preventDefault();
    console.log('경로 그리기 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };


  let optionsMarker, optionsPolygon;

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

  // 컴포넌트 내부의 factoryMakers 함수 제거 (mapUtils에서 import한 함수로 대체)

  // 컴포넌트 내부의 factoryPolygon 함수 제거 (mapUtils에서 import한 함수로 대체)

  // Firebase와 데이터 동기화 함수는 serverUtils.js로 이동했습니다.

  // FB와 연동 - 초기화 방식으로 수정
  const initShopList = async (_mapInstance) => { //AT initShoplist 
    if (!curSectionName) {
      setCurSectionName("반월당"); // TODO 앱 초기화면에서  지역명 입력전 처리방법 추가,    
      // curSectionName이 변경되면 useEffect에서 데이터 로드 및 UI 업데이트가 자동으로 처리됨
      return;
    }
  };

  // pin 좌표 수정 버튼 클릭시 동작
  const handlePinCoordinatesButtonClick = (event) => {
    event.preventDefault();
    console.log('pin 좌표 수정 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };


  const handlerfunc25 = () => {
    console.log('새로고침 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };

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
      console.log('place_changed');
      const detailPlace = autocomplete.getPlace();
      if (!detailPlace.geometry || !detailPlace.geometry.location) {
        console.log("No details available for input: '" + detailPlace.name + "'");
        return;
      }

      const _newData = {
        storeName: detailPlace.name || '',
        address: detailPlace.formatted_address || '',
        googleDataId: detailPlace.place_id || '',
      };

      // 장소 데이터 업데이트
      dispatch({
        type: ActionTypes.EDIT.DATA.UPDATE_PLACE,
        payload: _newData
      });

      if (detailPlace.geometry.viewport) {
        _mapInstance.fitBounds(detailPlace.geometry.viewport);
      } else {
        _mapInstance.setCenter(detailPlace.geometry.location);
        _mapInstance.setZoom(15);
      }
    });

    _mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(searchformRef.current);

    // console.log('search input initialized');
  }


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

    // 오버레이 생성시 
    window.google.maps.event.addListener(_drawingManager, 'overlaycomplete', (eventObj) => {
      // console.log 제거
      _drawingManager.setDrawingMode(null); // 그리기 모드 초기화
    });

    _drawingManager.setOptions({ drawingControl: false });
    _drawingManager.setMap(_mapInstance);
    drawingManagerRef.current = _drawingManager;
    //setDrawingManager(_drawingManager); // 비동기 이므로 최후반

  } // initializeDrawingManager  

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

    // 줌 변경 이벤트 리스너 추가
    //TODO: 추후 이 부분을 모듈화/캡슐화하여 별도 함수나 훅으로 분리할 것
    // - 이벤트 핸들러 등록/제거 로직
    // - 폴리곤 가시성 제어 로직 
    // - 기타 줌 레벨에 따른 UI 변경 로직을 캡슐화
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
            console.log('구글맵 로딩 중', _cnt);
          }
        }, 100);
      } else {
        if (_cnt++ > 10) { clearInterval(_intervalId); console.error('구글서비스 로딩 오류'); }
        console.log('구글서비스 로딩 중', _cnt);
      }
    }, 100);
  }, []);


  // selectedCurShop 관련 useEffect를 하나로 통합. 다른 종속성이 추가되면 안됨. 
  // selectedCurShop 업데이트시, 파생 동작들 일괄적으로 작동되어야 함. 
  useEffect(() => { // AT [selectedCurShop]  
    if (!curSelectedShop) {
      // selectedCurShop이 없는 경우 폼 초기화 (updateFormDataFromShop 함수 내부에서 처리)
      updateFormDataFromShop(null);
      return;
    }
    
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
          
          // 사이드바에서 선택한 경우 클릭된 아이템으로 설정
          // (마커/폴리곤 클릭 시에는 해당 이벤트 핸들러에서 처리)
          if (clickedItem !== curSelectedShop) {
            setClickedItem(curSelectedShop);
          }
        }
      } catch (error) {
        console.error('지도 이동 또는 마커 표시 중 오류 발생:', error);
      }
    }
    
    // 3. 폼 데이터 업데이트 - updateFormDataFromShop 함수 내부에서 편집 모드 체크
      updateFormDataFromShop(curSelectedShop);

  }, [curSelectedShop]); // 중요: selectedCurShop만 종속성으로 유지. 추가하지말것것

  
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
      console.log('아이템 리스트가 비어 있습니다.');
      return; 
    }
    
    console.log(`아이템 리스트 업데이트: ${curItemListInCurSection.length}개 항목`);
    
    // 이전 오버레이 제거 (useRef.current 사용)
    if (prevItemListforRelieveOverlays.current && prevItemListforRelieveOverlays.current.length > 0) {
      console.log(`이전 오버레이 제거: ${prevItemListforRelieveOverlays.current.length}개`);
      
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
        onItemClick: setClickedItem,
        isItemSelected: (item) => item === clickedItem
      }
    );
    
    console.log(`마커: ${markerCount}개, 폴리곤: ${polygonCount}개 표시됨`);
    
    // 폴리곤 가시성 업데이트 (폴리곤이 있는 경우에만)
    if (polygonCount > 0) {
      const currentZoom = instMap.current.getZoom();
      const shouldShowPolygons = currentZoom >= 15;
      curItemListInCurSection.forEach(item => {
        if (item.itemPolygon) item.itemPolygon.setVisible(shouldShowPolygons);
      });
      
      console.log(`폴리곤 가시성: ${shouldShowPolygons ? '표시' : '숨김'}, 현재 줌: ${currentZoom}`);
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
      
      // serverDataset이 있는지 확인
      if (item.serverDataset) {
        itemTitle.innerHTML = `${item.serverDataset.storeName || '이름 없음'} <small>${item.serverDataset.storeStyle || ''}</small>`;
      } else {
        // 기존 데이터 구조 (serverDataset이 없는 경우)
        itemTitle.innerHTML = `${item.storeName || '이름 없음'} <small>${item.storeStyle || ''}</small>`;
      }

      const businessHours = document.createElement('p');
      if (item.serverDataset && item.serverDataset.businessHours && item.serverDataset.businessHours.length > 0) {
        businessHours.textContent = `영업 중 · ${item.serverDataset.businessHours[0]}`;
      } else if (item.businessHours && item.businessHours.length > 0) {
        businessHours.textContent = `영업 중 · ${item.businessHours[0]}`;
      } else {
        businessHours.textContent = '영업 중 · 정보 없음';
      }

      const address = document.createElement('p');
      if (item.serverDataset) {
        address.innerHTML = `<strong>${item.distance || '정보 없음'}</strong> · ${item.serverDataset.address || '주소 없음'}`;
      } else {
        address.innerHTML = `<strong>${item.distance || '정보 없음'}</strong> · ${item.address || '주소 없음'}`;
      }

      const itemImage = document.createElement('img');
      itemImage.src = "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDF8fGZvb2R8ZW58MHx8fHwxNjE5MjY0NzYx&ixlib=rb-1.2.1&q=80&w=400";
      
      if (item.serverDataset) {
        itemImage.alt = `${item.serverDataset.storeName || ''} ${item.serverDataset.storeStyle || ''}`;
      } else {
        itemImage.alt = `${item.storeName || ''} ${item.storeStyle || ''}`;
      }
      
      itemImage.className = styles.itemImage;
      itemImage.width = 100;
      itemImage.height = 100;

      // 클릭 이벤트 추가
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // serverDataset 확인 및 생성
        if (!item.serverDataset) {
          // serverDataset이 없는 경우 생성
          const newServerDataset = { ...protoServerDataset };
          
          // 기존 필드 복사
          Object.keys(protoServerDataset).forEach(field => {
            if (item[field] !== undefined) {
              newServerDataset[field] = item[field];
            }
          });
          
          // 아이템 업데이트
          item.serverDataset = newServerDataset;
        }
        
        // 두 상태를 동시에 업데이트
        setCurSelectedShop(item);
        setClickedItem(item);
        
        // 지도 중심 이동
        if (instMap.current) {
          try {
            let position = null;
            
            // 서버 데이터 또는 기존 데이터에서 좌표 가져오기
            if (item.serverDataset && item.serverDataset.pinCoordinates) {
              position = parseCoordinates(item.serverDataset.pinCoordinates);
            } else if (item.pinCoordinates) {
              position = parseCoordinates(item.pinCoordinates);
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

  // 별칭 수정 버튼 클릭 핸들러 추가
  const handleCommentButtonClick = (event) => {
    event.preventDefault();
    console.log('코멘트 수정 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };



  // 상점 데이터로부터 폼 데이터 업데이트하는 헬퍼 함수
    const updateFormDataFromShop = (shopData) => {
    // 편집 모드나 수정 완료 상태에서는 폼 데이터 업데이트 스킵
    if (isEditing || isEditCompleted) return;
    
    if (!shopData) {
      // shopData가 없는 경우 폼 초기화
      setFormData({
        storeName: "",
        storeStyle: "",
        alias: "",
        comment: "",
        locationMap: "",
        businessHours: "",
        hotHours: "",
        discountHours: "",
        address: "",
        mainImage: "",
        pinCoordinates: "",
        path: "",
        categoryIcon: "",
        googleDataId: "",
      });
      return;
    }
    
    const updatedFormData = editUtils.updateFormDataFromShop(shopData, formData);
    setFormData(updatedFormData);
  };
  
  // editNewShopDataSet으로부터 폼 데이터 업데이트하는 헬퍼 함수
  const updateFormDataFromEditData = () => {
    if (!editNewShopDataSet) return;
    
    const updatedFormData = editUtils.updateFormDataFromEditData(editNewShopDataSet, formData);
    setFormData(updatedFormData);
  };

  // 컴포넌트 내부, 다른 함수들과 함께 정의
  const addNewShopItem = () => {
    // 상점 추가 로직 구현
    console.log('상점 추가 버튼 클릭됨');
    // 필요한 작업 수행
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
            />
            <button className={styles.searchButton}>
              <span className={styles.searchIcon}>🔍</span>
                </button>
            </div>
            </div>
              </div>
              
      {/* 오른쪽 사이드바 컴포넌트 사용 */}
      <RightSidebar 
        isPanelVisible={isPanelVisible}
        isEditing={isEditing}
        isEditCompleted={isEditCompleted}
        hasChanges={hasChanges}
        editNewShopDataSet={editNewShopDataSet}
        formData={formData}
        modifiedFields={modifiedFields}
        inputRefs={inputRefs}
        handleEditFoamCardButton={handleEditFoamCardButton}
        handleConfirmEdit={handleConfirmEdit}
        handleCancelEdit={handleCancelEdit}
        handleFieldEditButtonClick={handleFieldEditButtonClick}
        handleInputChange={handleInputChange}
        addNewShopItem={addNewShopItem}
        handlePinCoordinatesButtonClick={handlePinCoordinatesButtonClick}
        handlePathButtonClick={handlePathButtonClick}
        handleCommentButtonClick={handleCommentButtonClick}
        moveToCurrentLocation={moveToCurrentLocation}
        handlerfunc25={handlerfunc25}
      />
      
      {/* 플로팅 패널 토글 버튼 */}
      {!isPanelVisible && (
        <button 
          className={styles.floatingPanelToggle}
          onClick={() => dispatch({ type: ActionTypes.EDIT.PANEL.ON })}
          title="패널 표시"
        >
          ≫
        </button>
      )}
      
      {/* 구글 맵 스크립트 */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing`}
        strategy="afterInteractive"
      />
    </div>
  );
} 