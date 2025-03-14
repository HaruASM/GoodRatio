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
import { createInfoWindowContent, showInfoWindow, factoryMakers, factoryPolygon, setProtoOverlays, updatePolygonVisibility } from './mapUtils';
// 서버 유틸리티 함수 가져오기
import { loadFromLocalStorage, saveToLocalStorage, syncWithFirestore, fetchSectionsFromFirebase, updateServerDB } from './serverUtils';
// 오른쪽 사이드바 컴포넌트 가져오기
import RightSidebar from './components/RightSidebar';

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

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

  // sectionsDB를 Map 객체로 관리
  const sectionsDB = useRef(new Map());
  
  // curSectionName을 상태로 관리
  const [curSectionName, setCurSectionName] = useState("반월당");
  
  // 선택된 상점 정보를 저장하는 상태 변수 추가 - 코드 순서 변경
  const [selectedCurShop, setSelectedCurShop] = useState(null);
  
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
  const getCurLocalItemlist = () => {
    return sectionsDB.current.get(curSectionName) || [];
  };

  // 로컬 저장소에서 sectionsDB 로드 함수는 serverUtils.js로 이동했습니다.
  
  // 로컬 저장소에 sectionsDB 저장 함수는 serverUtils.js로 이동했습니다.

  const [curLocalItemlist, setCurLocalItemlist] = useState([]);
  const presentMakers = []; // 20개만 보여줘도 됨 // localItemlist에 대한 마커 객체 저장

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
    const localItemList = getCurLocalItemlist();
    // 서버로 데이터를 보내는 기능은 삭제하고 로그만 출력
    updateServerDB(curSectionName, localItemList);
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
          originalShopData: selectedCurShop, // 원본 데이터 저장
          editNewShopDataSet: selectedCurShop, // 편집할 데이터 설정
        })
      );
    } 
    // 재수정 버튼 클릭 시
    else if (!editState.isEditing && editState.isConfirming) {
      // 원본 데이터는 유지하고 편집 상태로 전환
      dispatch(
        editActions.beginEdit({
          originalShopData: editState.originalShopData, // 원본 데이터 유지
          editNewShopDataSet: selectedCurShop, // 현재 선택된 데이터로 편집 시작
        })
      );
    }
  };

  // 수정 확인 핸들러
  const handleConfirmEdit = () => {
    if (!editNewShopDataSet || !selectedCurShop) return;
    
    // 서버 데이터 업데이트 로직
    console.log('수정 확인:', editNewShopDataSet);
    
    // 현재 선택된 상점 업데이트
    setSelectedCurShop(editNewShopDataSet);
    
    // 상태 초기화
    dispatch(editActions.confirmEdit());
  };

  // 수정 취소 핸들러
  const handleCancelEdit = () => {
    // 원본 데이터로 폼 데이터 복원
    if (selectedCurShop) {
      updateFormDataFromShop(selectedCurShop);
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
      if (selectedCurShop) {
        let processedValue = value;
        
        if (name === 'businessHours') {
          processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
        }
        
        const updatedShop = {
          ...selectedCurShop,
          serverDataset: {
            ...selectedCurShop.serverDataset,
            [name]: processedValue
          }
        };
        
        setSelectedCurShop(updatedShop);
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

  const initMarker = () => { // AT 마커 초기화/공통기능 탑재
    //TODO 이단계에서 마커와 폴리곤들 이벤트 바인딩을 해야할듯
    ({ optionsMarker, optionsPolygon } = setProtoOverlays());  //전역 위치의 포로토타입 마커에 세팅 
  }

  // 공유 인포윈도우 참조
  const sharedInfoWindow = useRef(null);

  // 클릭된 마커/폴리곤의 인포윈도우 상태 추가
  const [clickedItem, setClickedItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);

  // 인포윈도우 내용 생성 함수
  const createInfoWindowContent = (shopItem) => {
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
  const showInfoWindow = (shopItem, mapInst, anchor = null) => {
    if (!sharedInfoWindow.current || !shopItem) return;
    
    // 인포윈도우 내용 설정
    sharedInfoWindow.current.setContent(createInfoWindowContent(shopItem));
    
    // 위치 설정
    const pinPosition = parseCoordinates(
      shopItem.serverDataset?.pinCoordinates || shopItem.pinCoordinates
    );
    
    if (anchor) {
      // 마커에 연결
      sharedInfoWindow.current.open(mapInst, anchor);
    } else if (pinPosition) {
      // 위치만 설정
      sharedInfoWindow.current.setPosition(pinPosition);
      sharedInfoWindow.current.open(mapInst);
    }
  };

  // 인포윈도우 관리를 위한 useEffect. clickedItem, hoveredItem 상태시 동작작
  useEffect(() => {
    if (!instMap.current) return;
    
    // 1. 클릭된 아이템이 있으면 해당 아이템의 인포윈도우 표시
    if (clickedItem) {
      showInfoWindow(clickedItem, instMap.current, sharedInfoWindow, clickedItem.itemMarker);
      
      // 클릭된 마커에 애니메이션 효과 적용
      if (clickedItem.itemMarker) {
        clickedItem.itemMarker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => {
          clickedItem.itemMarker.setAnimation(null);
        }, 2000);
      }
      
      // 인포윈도우 닫기 이벤트 리스너 추가
      if (sharedInfoWindow.current) {
        window.google.maps.event.addListenerOnce(sharedInfoWindow.current, 'closeclick', () => {
          setClickedItem(null);
        });
      }
    } 
    // 2. 클릭된 아이템이 없고 마우스 오버 중인 아이템이 있으면 해당 아이템의 인포윈도우 표시
    else if (hoveredItem) {
      showInfoWindow(hoveredItem, instMap.current, sharedInfoWindow, hoveredItem.itemMarker);
    } 
    // 3. 둘 다 없으면 인포윈도우 닫기
    else if (sharedInfoWindow.current) {
      sharedInfoWindow.current.close();
    }
  }, [clickedItem, hoveredItem]);

  // 지도 클릭 이벤트 처리를 위한 useEffect
  useEffect(() => {
    if (!instMap.current) return;
    
    const mapClickListener = window.google.maps.event.addListener(instMap.current, 'click', () => {
      // 지도 빈 영역 클릭 시 클릭된 아이템 초기화
      setClickedItem(null);
    });
    
    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      window.google.maps.event.removeListener(mapClickListener);
    };
  }, [instMap.current]);

  const factoryMakers = (coordinates, mapInst, shopItem, optionsMarker, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem) => {
    const _markerOptions = Object.assign({}, optionsMarker, { position: coordinates });
    const _marker = new window.google.maps.Marker(_markerOptions);
    
    // 마커를 지도에 표시
    _marker.setMap(mapInst);

    // 공유 인포윈도우 초기화 (아직 생성되지 않은 경우)
    if (!sharedInfoWindow.current && window.google && window.google.maps) {
      sharedInfoWindow.current = new window.google.maps.InfoWindow();
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

  const factoryPolygon = (paths, mapInst, shopItem, optionsPolygon, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem) => {
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
    if (!sharedInfoWindow.current && window.google && window.google.maps) {
      sharedInfoWindow.current = new window.google.maps.InfoWindow();
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



  // Firebase와 데이터 동기화 함수는 serverUtils.js로 이동했습니다.

  // FB와 연동 - 초기화 방식으로 수정
  const initShopList = async (_mapInstance) => { // AT initShoplist 
    // 현재 섹션의 아이템 리스트 가져오기
    let localItemList = getCurLocalItemlist();
    
    // 아이템 리스트가 비어있으면 로컬 저장소에서 로드 시도
    if (!localItemList || localItemList.length === 0) {
      console.log(`initShopList: sectionsDB에 ${curSectionName} 데이터가 없어 로드 시도`);
      localItemList = loadFromLocalStorage(curSectionName);
      
      // 로컬 저장소에서 데이터를 찾았으면 sectionsDB 업데이트
      if (localItemList && localItemList.length > 0) {
        sectionsDB.current.set(curSectionName, localItemList);
      } else {
        // 로컬 저장소에도 데이터가 없으면 서버에서 가져오기
        const updateSectionsDB = (sectionName, itemList) => {
          sectionsDB.current.set(sectionName, itemList);
        };
        
        console.log(`initShopList: Firebase에서 ${curSectionName} 데이터 로드 시도`);
        localItemList = await fetchSectionsFromFirebase(curSectionName, updateSectionsDB);
        localItemList = getCurLocalItemlist();
      }
    } else {
      console.log(`initShopList: sectionsDB에 ${curSectionName} 데이터가 이미 있어 재사용`);
    }
    
    // 기존 마커와 폴리곤 제거
    presentMakers.forEach(marker => {
      if (marker) marker.setMap(null);
    });
    presentMakers.length = 0;
    
    // 아이템 리스트가 있으면 마커와 폴리곤 생성
    if (localItemList && localItemList.length > 0) {
      // 모든 아이템이 올바른 구조를 가지도록 초기화
      const initializedItemList = localItemList.map(shopItem => {
        // 항상 올바른 구조의 객체 생성
        const initializedItem = {
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset, ...(shopItem.serverDataset || {}) },
          distance: shopItem.distance || "",
          itemMarker: null,
          itemPolygon: null
        };
        
        // 이전 데이터 구조에서 serverDataset으로 필드 복사
        if (!shopItem.serverDataset) {
          Object.keys(protoServerDataset).forEach(field => {
            if (shopItem[field] !== undefined) {
              initializedItem.serverDataset[field] = shopItem[field];
            }
          });
        }
        
        return initializedItem;
      });
      
      // 초기화된 아이템 리스트로 업데이트
      localItemList = initializedItemList;
      sectionsDB.current.set(curSectionName, localItemList);
      
      // 마커와 폴리곤 생성
      localItemList.forEach(shopItem => {
        // 마커 생성
        if (shopItem.serverDataset.pinCoordinates) {
          const coordinates = parseCoordinates(shopItem.serverDataset.pinCoordinates);
          if (coordinates) {
            const marker = factoryMakers(coordinates, _mapInstance, shopItem, optionsMarker, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem);
            shopItem.itemMarker = marker;
            presentMakers.push(marker);
          }
        }
        
        // 폴리곤 생성
        if (shopItem.serverDataset.path && shopItem.serverDataset.path.length > 0) {
          const polygon = factoryPolygon(shopItem.serverDataset.path, _mapInstance, shopItem, optionsPolygon, sharedInfoWindow, setSelectedCurShop, setClickedItem, setHoveredItem);
          shopItem.itemPolygon = polygon;
        }
      });
    }
    
    // 현재 아이템 리스트 업데이트
    setCurLocalItemlist(localItemList);
    
    // 폴리곤 가시성 업데이트
    updatePolygonVisibility(_mapInstance, localItemList);
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

  // 지도 클릭 이벤트 처리를 위한 useEffect
  const initPlaceInfo = (_mapInstance) => {
    window.google.maps.event.addListener(_mapInstance, 'click', (clickevent) => {
      // 지도 빈 영역 클릭 시 열려있는 인포윈도우 닫기
      if (clickedItem) {
        setClickedItem(null);
      }
    });
  };

  // 폴리곤 가시성 관리 함수는 mapUtils.js로 이동했습니다.

  // 지도 초기화 함수 수정
  const initGoogleMapPage = () => {
    // console.log('initPage');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        // console.log('현재 위치 : ', latitude, longitude);
      },
        (error) => {
          // console.log('geolocation 에러 : ',error);
        });
    } else {
      console.log('geolocation 지원 안되는 중');
    }

    //-- g맵 인스턴스 생성
    let mapDiv = document.getElementById('map');

    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
      zoom: 16,
      mapTypeControl: false,
    });
    //-- g맵 인스턴스 생성 끝끝

    // 줌 변경 이벤트 리스너 추가
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', () => {
      updatePolygonVisibility(_mapInstance, getCurLocalItemlist());
    });

    // g맵용 로드 완료시 동작 //AT 구글맵Idle바인딩 
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => {
      initDrawingManager(_mapInstance);
      initSearchInput(_mapInstance);
      initPlaceInfo(_mapInstance);
      initMarker();
      initShopList(_mapInstance);
      
      // 초기 폴리곤 가시성 설정
      updatePolygonVisibility(_mapInstance, getCurLocalItemlist());
    });

    instMap.current = _mapInstance;
  } // initializeGoogleMapPage 마침

  // 프로그램 로딩을 순차적으로 진행하기위해 필수 
  useEffect(() => { 
    let _cnt = 0;
    let _intervalId = setInterval(() => {
      if (window.google) {
        _cnt = 0;
        clearInterval(_intervalId);
        _intervalId = setInterval(() => {
          if (window.google.maps.Map) { // window.google.maps.Marker도 체크 해줘야 하나.. 
            initGoogleMapPage();
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

  // selectedCurShop 관련 useEffect를 하나로 통합
  useEffect(() => {
    if (!selectedCurShop) {
      // selectedCurShop이 없는 경우 폼 초기화 (편집 모드나 수정 완료 상태가 아닐 때만)
      if (!isEditing && !isEditCompleted) {
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
      }
      return;
    }
    
    // 1. 좌측 사이드바 아이템 하이라이트 효과
    const itemElements = document.querySelectorAll(`.${styles.item}, .${styles.selectedItem}`);
    
    // 모든 아이템을 기본 클래스로 초기화
    itemElements.forEach(item => {
      item.className = styles.item;
    });
    
    // 선택된 아이템 찾기 (storeName으로 비교)
    const itemName = selectedCurShop.serverDataset ? 
      selectedCurShop.serverDataset.storeName : 
      selectedCurShop.storeName;
      
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
        if (selectedCurShop.serverDataset && selectedCurShop.serverDataset.pinCoordinates) {
          position = parseCoordinates(selectedCurShop.serverDataset.pinCoordinates);
        } else if (selectedCurShop.pinCoordinates) {
          position = parseCoordinates(selectedCurShop.pinCoordinates);
        }

        if (position) {
          // 지도 중심 이동
          instMap.current.setCenter(position);
          instMap.current.setZoom(18);
          
          // 사이드바에서 선택한 경우 클릭된 아이템으로 설정
          // (마커/폴리곤 클릭 시에는 해당 이벤트 핸들러에서 처리)
          if (clickedItem !== selectedCurShop) {
            setClickedItem(selectedCurShop);
          }
        }
      } catch (error) {
        console.error('지도 이동 또는 마커 표시 중 오류 발생:', error);
      }
    }
    
    // 3. 폼 데이터 업데이트 - 편집 모드나 수정 완료 상태에서는 스킵
    if (!isEditing && !isEditCompleted) {
      updateFormDataFromShop(selectedCurShop);
    }
  }, [selectedCurShop, isEditing, isEditCompleted]);

  // 섹션 데이터 로드 useEffect
  useEffect(() => { //AT 지역변경 동작[curSectionName. 
    const loadSectionData = async () => {
      console.log(`섹션 데이터 로드: ${curSectionName}`);
      
      // 즉시 기존 마커와 폴리곤 제거
      presentMakers.forEach(marker => {
        if (marker) marker.setMap(null);
      });
      presentMakers.length = 0;
      
      let dataLoaded = false;
      
      // 이미 sectionsDB에 데이터가 있는지 확인
      if (sectionsDB.current.has(curSectionName)) {
        console.log(`sectionsDB에 ${curSectionName} 데이터가 이미 있음`);
        setCurLocalItemlist(sectionsDB.current.get(curSectionName));
        dataLoaded = true;
      } else {
        // 로컬 스토리지에서 데이터 확인
        try {
          const loadedItems = loadFromLocalStorage(curSectionName);
          if (loadedItems && loadedItems.length > 0) {
            console.log(`localStorage에서 ${curSectionName} 섹션 데이터 찾음`);
            sectionsDB.current.set(curSectionName, loadedItems);
            setCurLocalItemlist(loadedItems);
            dataLoaded = true;
          }
          
          // 데이터가 로드되지 않았으면 서버에서 가져오기
          if (!dataLoaded) {
            // 서버에서 데이터 가져오기
            const updateSectionsDB = (sectionName, itemList) => {
              // TODO 마커, 오버레이 생성후 sectionsDB에 저장
              sectionsDB.current.set(sectionName, itemList);
            };
            
            console.log(`Firebase에서 ${curSectionName} 섹션 데이터 로드 시도`);
            const fetchedItems = await fetchSectionsFromFirebase(curSectionName, updateSectionsDB);
            if (fetchedItems && fetchedItems.length > 0) {
              setCurLocalItemlist(fetchedItems);
              dataLoaded = true;
            } else {
              // 데이터가 없으면 빈 배열 설정
              sectionsDB.current.set(curSectionName, []);
              setCurLocalItemlist([]);
            }
          }
        } catch (error) {
          console.error('섹션 데이터 로드 오류:', error);
          // 오류 발생 시 빈 데이터 생성
          sectionsDB.current.set(curSectionName, []);
          setCurLocalItemlist([]);
        }
      }
      
      // 지도가 초기화되었으면 initShopList 호출하여 마커 생성
      if (instMap.current) {
        // 마커와 폴리곤 생성은 initShopList 함수에서 처리. //FIXHERE  but presnetMakers 초기화는 왜 여기서 하지? 
        initShopList(instMap.current);
      }
    };
    
    loadSectionData();
  }, [curSectionName]);

  useEffect(() => {
    const itemListContainer = document.querySelector(`.${styles.itemList}`);
    if (!itemListContainer) {
      console.error('Item list container not found');
      return;
    }

    // 기존 아이템 제거
    itemListContainer.innerHTML = '';

    // curLocalItemlist의 아이템을 순회하여 사이드바에 추가
    getCurLocalItemlist().forEach((item) => {
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
        
        // 선택된 상점 정보 업데이트
        
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
        
        setSelectedCurShop(item);
        
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
  }, [getCurLocalItemlist]);

  //return () => clearInterval(intervalId); // 컴포넌트 언마운트시
  //}, []);     

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
    if (!shopData) return;
    
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