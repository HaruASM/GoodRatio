import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from './styles.module.css';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { firebasedb } from '../../firebase'; // 상대 경로 주의

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;
const OVERLAY_COLOR = {
  IDLE: '#FF0000', // 빨간색
  MOUSEOVER: '#00FF00', // 초록색
};
const OVERLAY_ICON = {
  MARKER_MOUSEOVER: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // 파란색
  MARKER: "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // 초록색
};

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

  // 좌표 변환 유틸리티 함수
  const parseCoordinates = (coordinates) => {
    if (!coordinates) return null;
    
    try {
      if (typeof coordinates === 'string') {
        const [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      } else if (typeof coordinates === 'object' && coordinates !== null) {
        return {
          lat: typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat,
          lng: typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng
        };
      }
    } catch (error) {
      console.warn('좌표 변환 오류:', error);
    }
    
    return null;
  };

  // 좌표를 문자열로 변환하는 함수
  const stringifyCoordinates = (coordinates) => {
    if (!coordinates) return '';
    
    try {
      if (typeof coordinates === 'string') {
        return coordinates;
      } else if (typeof coordinates === 'object' && coordinates !== null) {
        const lat = typeof coordinates.lat === 'function' ? coordinates.lat() : coordinates.lat;
        const lng = typeof coordinates.lng === 'function' ? coordinates.lng() : coordinates.lng;
        return `${lat}, ${lng}`;
      }
    } catch (error) {
      console.warn('좌표 문자열 변환 오류:', error);
    }
    
    return '';
  };

  // 로컬 저장소에서 데이터 로드 함수 수정
  const loadFromLocalStorage = () => {
    try {
      // localStorage에서 sectionsDB 가져오기
      const storedSectionsDB = localStorage.getItem('sectionsDB');
      if (storedSectionsDB) {
        const parsedSectionsDB = JSON.parse(storedSectionsDB);
        
        // 현재 섹션 찾기
        const currentSection = parsedSectionsDB.find(section => section.name === curSectionName);
        if (currentSection) {
          console.log(`localStorage에서 ${curSectionName} 섹션 데이터 찾음`);
          
          // 로컬 스토리지 데이터를 serverDataset 구조로 변환
          const transformedList = currentSection.list.map(item => {
            // 항상 올바른 구조의 객체 생성
            return {
              ...protoShopDataSet,
              serverDataset: { ...protoServerDataset, ...item.serverDataset || item },
              distance: item.distance || "",
              itemMarker: null,
              itemPolygon: null
            };
          });
          
          return transformedList;
        }
      }
      return null; // 로컬에 데이터가 없거나 현재 섹션이 없는 경우
    } catch (error) {
      console.error('localStorage 로드 오류:', error);
      return null;
    }
  };

  // 로컬 저장소에 sectionsDB 저장
  const saveToLocalStorage = (sectionsToSave) => {
    try {
      // Google Maps 객체 제거 등 직렬화 가능한 형태로 변환
      const cleanSectionsDB = Array.from(sectionsToSave.entries()).map(([key, value]) => ({
        name: key,
        list: value.map(item => {
          // serverDataset 속성만 추출하여 사용
          const serverData = { ...item.serverDataset };
          
          // distance 속성은 serverDataset 외부에 있으므로 추가
          if (item.distance) {
            serverData.distance = item.distance;
          }
          
          return serverData;
        })
      }));
      
      localStorage.setItem('sectionsDB', JSON.stringify(cleanSectionsDB));
      console.log('sectionsDB를 localStorage에 저장함');
    } catch (error) {
      console.error('localStorage 저장 오류:', error);
    }
  };

  const [curLocalItemlist, setCurLocalItemlist] = useState([]);
  const presentMakers = []; // 20개만 보여줘도 됨 // localItemlist에 대한 마커 객체 저장

  const protoServerDataset = { // AT 데이터셋 자료형형 선언부
    locationMap: "",
    storeName: "",
    storeStyle: "",
    alias: "",
    businessHours: [],
    hotHours: "",
    discountHours: "",
    address: "",
    mainImage: "",
    mainImages: [],
    subImages: [], // Google Place API에서 가져온 이미지를 저장할 배열
    pinCoordinates: "",
    categoryIcon: "",
    googleDataId: "",
    path: [],
    comment: "", // comment 필드 추가
  }

  const protoShopDataSet = {
    serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
    distance: "",
    itemMarker: null,
    itemPolygon: null,
  };


  
  // 편집 모드 상태 추가
  const [isEditing, setIsEditing] = useState(false);
  
  // 수정 완료 상태 추가
  const [isEditCompleted, setIsEditCompleted] = useState(false);
  
  // 수정 시작 시점의 원본 데이터 저장
  const [originalShopData, setOriginalShopData] = useState(null);
  
  // 수정 여부 상태 추가
  const [hasChanges, setHasChanges] = useState(false);
  
  // editNewShopDataSet 상태 초기화 (깊은 복사로 별도 객체 생성)
  const [editNewShopDataSet, setEditNewShopDataSet] = useState({
    serverDataset: {...protoServerDataset},
    distance: "",
    itemMarker: null,
    itemPolygon: null,
  });

  const locationMapRef = useRef(null); // 반월당역 관광지도 영역에 대한 참조 레퍼런스

  const inputRefs = {
    storeName: useRef(null),
    alias: useRef(null),
    comment: useRef(null),
    locationMap: useRef(null),
    businessHours: useRef(null),
    hotHours: useRef(null),
    discountHours: useRef(null),
    distance: useRef(null),
    address: useRef(null),
    mainImage: useRef(null),
    subImages: useRef(null),
    pinCoordinates: useRef(null),
    path: useRef(null),
    categoryIcon: useRef(null),
    googleDataId: useRef(null),
  };

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
    console.log('서버 DB에 데이터 업데이트:', editNewShopDataSet);
    // 여기서는 콘솔 출력만 수행
  };

  // 수정 버튼 클릭 핸들러 수정
  const handleEditFoamCardButton = () => {
    if (isEditing) {
      // 편집 모드 종료 (완료 버튼 클릭)
      // justWriteServerDB(); // 확인 단계에서 호출하도록 이동
      setIsEditing(false);
      
      // 원본 데이터와 현재 데이터 비교하여 변경 여부 확인
      const hasAnyChanges = compareShopData(originalShopData, editNewShopDataSet);
      setHasChanges(hasAnyChanges);
      
      setIsEditCompleted(true); // 수정 완료 상태로 변경
      setModifiedFields({}); // 수정된 필드 초기화
      
      // 편집 모드 종료 후 폼 데이터 업데이트 (editNewShopDataSet 값으로)
      updateFormDataFromEditData();
    } else {
      // 편집 모드 시작 (수정 버튼 클릭)
      // selectedCurShop이 있는 경우 해당 데이터로 editNewShopDataSet 초기화
      if (selectedCurShop) {
        // 현재 선택된 상점 데이터를 원본으로 저장 (깊은 복사)
        setOriginalShopData({
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset, ...JSON.parse(JSON.stringify(selectedCurShop.serverDataset)) },
          distance: selectedCurShop.distance || "",
          itemMarker: selectedCurShop.itemMarker,
          itemPolygon: selectedCurShop.itemPolygon
        });
        
        // 항상 올바른 구조의 객체 생성
        setEditNewShopDataSet({
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset, ...selectedCurShop.serverDataset },
          distance: selectedCurShop.distance || "",
          itemMarker: selectedCurShop.itemMarker,
          itemPolygon: selectedCurShop.itemPolygon
        });
      } else {
        // selectedCurShop이 없는 경우 기본값으로 초기화
        setOriginalShopData(null);
        setEditNewShopDataSet({
          ...protoShopDataSet,
          serverDataset: { ...protoServerDataset },
          distance: "",
          itemMarker: null,
          itemPolygon: null
        });
      }
      setModifiedFields({}); // 수정된 필드 초기화
      setIsEditing(true);
    }
  };

  // 데이터 비교 함수 수정 - 객체 키를 직접 순회하는 방식으로 변경
  const compareShopData = (original, current) => {
    if (!original) return true; // 원본이 없으면 변경된 것으로 간주
    
    // serverDataset 객체 비교
    const originalData = original.serverDataset || {};
    const currentData = current.serverDataset || {};
    
    // 모든 키를 순회하며 비교
    for (const key in originalData) {
      // 배열인 경우 문자열로 변환하여 비교
      if (Array.isArray(originalData[key]) && Array.isArray(currentData[key])) {
        if (originalData[key].join(',') !== currentData[key].join(',')) {
          return true; // 변경됨
        }
      } 
      // 일반 값 비교
      else if (originalData[key] !== currentData[key]) {
        return true; // 변경됨
      }
    }
    
    // 새로 추가된 키가 있는지 확인
    for (const key in currentData) {
      if (originalData[key] === undefined) {
        return true; // 새로운 키가 추가됨
      }
    }
    
    return false; // 변경 없음
  };

  // 수정 확인 핸들러
  const handleConfirmEdit = () => {
    // 서버에 데이터 업데이트
    justWriteServerDB();
    
    // 수정된 데이터를 selectedCurShop에 반영
    if (selectedCurShop) {
      // 깊은 복사로 새 객체 생성
      const updatedShop = {
        ...selectedCurShop,
        serverDataset: { ...selectedCurShop.serverDataset }
      };
      
      // editNewShopDataSet의 값으로 업데이트
      Object.keys(editNewShopDataSet.serverDataset).forEach(key => {
        updatedShop.serverDataset[key] = editNewShopDataSet.serverDataset[key];
      });
      
      // 거리 정보 업데이트
      if (editNewShopDataSet.distance) {
        updatedShop.distance = editNewShopDataSet.distance;
      }
      
      // selectedCurShop 업데이트
      setSelectedCurShop(updatedShop);
      
      // 폼 데이터 업데이트
      updateFormDataFromShop(updatedShop);
    }
    
    // 상태 초기화
    setIsEditCompleted(false);
    setOriginalShopData(null);
    setHasChanges(false);
  };

  // 수정 취소 핸들러
  const handleCancelEdit = () => {
    // 원본 데이터로 되돌리기
    if (originalShopData && selectedCurShop) {
      // 폼 데이터 업데이트
      updateFormDataFromShop(selectedCurShop);
    }
    
    // 상태 초기화
    setIsEditCompleted(false);
    setOriginalShopData(null);
    setHasChanges(false);
  };
  
  // 상점 데이터로부터 폼 데이터 업데이트하는 헬퍼 함수
  const updateFormDataFromShop = (shopData) => {
    if (!shopData) return;
    
    const newFormData = {};
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = shopData.serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(shopData.serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = shopData.serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    // 폼 데이터 상태 업데이트
    setFormData(newFormData);
  };
  
  // editNewShopDataSet으로부터 폼 데이터 업데이트하는 헬퍼 함수
  const updateFormDataFromEditData = () => {
    if (!editNewShopDataSet) return;
    
    const newFormData = {};
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = editNewShopDataSet.serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(editNewShopDataSet.serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = editNewShopDataSet.serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    // 폼 데이터 상태 업데이트
    setFormData(newFormData);
  };

  // 입력 필드 변경 핸들러 추가
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (isEditing) {
      // 편집 모드에서는 editNewShopDataSet 업데이트
      let processedValue = value;
      
      // 배열 형태로 저장해야 하는 필드 처리
      if (name === 'businessHours') {
        processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
      }
      
      // 원래 값과 다른 경우에만 수정된 필드로 표시
      const originalValue = originalShopData?.serverDataset[name];
      const isModified = originalValue !== processedValue;
      
      // 수정된 필드 상태 업데이트
      setModifiedFields(prev => ({
        ...prev,
        [name]: isModified
      }));
      
      setEditNewShopDataSet(prev => ({
        ...prev,
        serverDataset: {
          ...prev.serverDataset,
          [name]: processedValue
        }
      }));
    } else {
      // 일반 모드에서는 기존 로직 유지
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      
      if (selectedCurShop && selectedCurShop.serverDataset) {
        let processedValue = value;
        
        if (name === 'businessHours') {
          processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
        }
        
        setSelectedCurShop({
          ...selectedCurShop,
          serverDataset: {
            ...selectedCurShop.serverDataset,
            [name]: processedValue
          }
        });
      }
    }
  };

  // 개별 필드 편집 버튼 클릭 핸들러
  const handleFieldEditButtonClick = (fieldName) => {
    // 해당 필드의 input 요소 찾기
    const inputElement = inputRefs[fieldName]?.current;
    if (inputElement) {
      // readonly 속성 제거하고 포커스 설정
      inputElement.readOnly = false;
      
      // 클래스 변경 (필요한 경우)
      if (inputElement.classList.contains(styles.filledInput)) {
        inputElement.classList.remove(styles.filledInput);
        inputElement.classList.add(styles.emptyInput);
      }
      
      // 포커스 설정
      inputElement.focus();
      
      // 커서를 텍스트 끝으로 이동
      const length = inputElement.value.length;
      inputElement.setSelectionRange(length, length);
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

  const setProtoOverlays = () => {
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
  }


  const initMarker = () => {

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

  // 인포윈도우 관리를 위한 useEffect
  useEffect(() => {
    if (!instMap.current) return;
    
    // 1. 클릭된 아이템이 있으면 해당 아이템의 인포윈도우 표시
    if (clickedItem) {
      showInfoWindow(clickedItem, instMap.current, clickedItem.itemMarker);
      
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
      showInfoWindow(hoveredItem, instMap.current, hoveredItem.itemMarker);
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

  const factoryMakers = (coordinates, mapInst, shopItem) => {
    console.log('마커 생성:', shopItem);
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

  const factoryPolygon = (paths, mapInst, shopItem) => {
    console.log('폴리곤 생성:', shopItem);
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



  // Firebase와 데이터 동기화 함수 수정
  const syncWithFirestore = async (sectionName, itemList) => {
    try {
      // Firestore에 저장 가능한 형태로 데이터 변환
      const cleanItemList = itemList.map(item => {
        // serverDataset 속성만 추출하여 사용
        const serverData = { ...item.serverDataset };
        
        // distance 속성은 serverDataset 외부에 있으므로 추가
        if (item.distance) {
          serverData.distance = item.distance;
        }
        
        // pinCoordinates가 객체인 경우 문자열로 변환
        if (serverData.pinCoordinates) {
          serverData.pinCoordinates = stringifyCoordinates(serverData.pinCoordinates);
        }
        
        // path 배열 내의 객체들도 처리
        if (Array.isArray(serverData.path)) {
          serverData.path = serverData.path.map(point => {
            return parseCoordinates(point) || point;
          });
        }
        
        return serverData;
      });
      
      // 섹션 문서 참조
      const sectionRef = doc(firebasedb, "sections", sectionName);
      
      // 서버에 데이터 가져오기
      const docSnap = await getDoc(sectionRef);
      
      if (docSnap.exists()) {
        // 서버에 데이터가 있으면 가져오기
        const serverData = docSnap.data();
        console.log(`Firebase에서 ${sectionName} 데이터 가져옴:`, serverData);
        
        // 서버 데이터가 더 최신이면 로컬 데이터 업데이트
        if (serverData.lastUpdated && (!localStorage.getItem(`${sectionName}_timestamp`) || 
            serverData.lastUpdated.toMillis() > parseInt(localStorage.getItem(`${sectionName}_timestamp`)))) {
          
          // 서버 데이터로 로컬 데이터 업데이트
          localStorage.setItem(`${sectionName}_timestamp`, serverData.lastUpdated.toMillis().toString());
          return serverData.itemList;
        } else {
          // 로컬 데이터가 더 최신이면 서버 데이터 업데이트
          await setDoc(sectionRef, {
            itemList: cleanItemList,
            lastUpdated: firestoreTimestamp()
          });
          localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
          console.log(`${sectionName} 데이터를 Firebase에 저장함`);
          return itemList;
        }
      } else {
        // 서버에 데이터가 없으면 새로 생성
        await setDoc(sectionRef, {
          itemList: cleanItemList,
          lastUpdated: firestoreTimestamp()
        });
        localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
        console.log(`${sectionName} 데이터를 Firebase에 새로 생성함`);
        return itemList;
      }
    } catch (error) {
      console.error("Firebase 동기화 오류:", error);
      return itemList; // 오류 시 로컬 데이터 유지
    }
  };

  // FB와 연동 - 초기화 방식으로 수정
  const initShopList = async (_mapInstance) => {
    // 현재 섹션의 아이템 리스트 가져오기
    let localItemList = getCurLocalItemlist();
    
    // 아이템 리스트가 비어있으면 로컬 저장소에서 로드 시도
    if (!localItemList || localItemList.length === 0) {
      localItemList = loadFromLocalStorage();
      
      // 로컬 저장소에서 데이터를 찾았으면 sectionsDB 업데이트
      if (localItemList) {
        sectionsDB.current.set(curSectionName, localItemList);
      } else {
        // 로컬 저장소에도 데이터가 없으면 서버에서 가져오기
        await fetchSectionsFromFirebase();
        localItemList = getCurLocalItemlist();
      }
    }
    
    // 기존 마커와 폴리곤 제거
    presentMakers.forEach(marker => {
      if (marker) marker.setMap(null);
    });
    presentMakers.length = 0;
    
    // 아이템 리스트가 있으면 마커와 폴리곤 생성
    if (localItemList && localItemList.length > 0) {
      console.log('아이템 리스트 로드됨:', localItemList);
      
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
            const marker = factoryMakers(coordinates, _mapInstance, shopItem);
            shopItem.itemMarker = marker;
            presentMakers.push(marker);
          }
        }
        
        // 폴리곤 생성
        if (shopItem.serverDataset.path && shopItem.serverDataset.path.length > 0) {
          const polygon = factoryPolygon(shopItem.serverDataset.path, _mapInstance, shopItem);
          shopItem.itemPolygon = polygon;
        }
      });
    }
    
    // 현재 아이템 리스트 업데이트
    setCurLocalItemlist(localItemList);
  };








  // pin 좌표 수정 버튼 클릭시 동작
  const handlePinCoordinatesButtonClick = (event) => {
    event.preventDefault();
    console.log('pin 좌표 수정 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };


  const handlerfunc25 = () => {
    const position = currentPosition;
    const map = instMap.current;
    const imageUrl = './icons/fastfood.webp';
    const marker = new window.google.maps.Marker({
      position: position,
      map: map,
      icon: {
        url: imageUrl,
        scaledSize: new window.google.maps.Size(70, 70), // 이미지 크기 조정
      },
    });


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
        locationMapRef: locationMapRef.current,
        storeName: detailPlace.name || '',
        address: detailPlace.formatted_address || '',
        googleDataId: detailPlace.place_id || '',
      };

      setEditNewShopDataSet((prev) => ({
        ...prev,
        ..._newData,
      }));

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

      console.log('overlaycomplete', '드로잉 매니저');


      _drawingManager.setDrawingMode(null); // 그리기 모드 초기화
    });

    _drawingManager.setOptions({ drawingControl: false });
    _drawingManager.setMap(_mapInstance);
    drawingManagerRef.current = _drawingManager;
    //setDrawingManager(_drawingManager); // 비동기 이므로 최후반

  } // initializeDrawingManager  

  const moveToCurrentLocation = () => {
    if (instMap.current && currentPosition) {
      instMap.current.setCenter(currentPosition);
      // console.log('Moved to current location:', currentPosition);
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

  // 폴리곤 가시성 관리를 위한 함수 추가
  const updatePolygonVisibility = (map) => {
    if (!map) return;
    
    const zoomLevel = map.getZoom();
    const isVisible = zoomLevel >= 17;
    
    // 현재 섹션의 모든 아이템을 순회하며 폴리곤 가시성 업데이트
    const currentItems = getCurLocalItemlist();
    if (currentItems && currentItems.length > 0) {
      currentItems.forEach(item => {
        if (item.itemPolygon) {
          item.itemPolygon.setVisible(isVisible);
        }
      });
    }
  };

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
    let mapDiv = document.getElementById('mapSection');

    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
      zoom: 16,
      mapTypeControl: false,
    });
    //-- g맵 인스턴스 생성 끝끝

    // 줌 변경 이벤트 리스너 추가
    window.google.maps.event.addListener(_mapInstance, 'zoom_changed', () => {
      updatePolygonVisibility(_mapInstance);
    });

    // g맵용 로드 완료시 동작 
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => {
      initDrawingManager(_mapInstance);
      initSearchInput(_mapInstance);
      initPlaceInfo(_mapInstance);
      initMarker();
      initShopList(_mapInstance);
      
      // 초기 폴리곤 가시성 설정
      updatePolygonVisibility(_mapInstance);
    });

    instMap.current = _mapInstance;
  } // initializeGoogleMapPage 마침

  useEffect(() => { // 1회 실행 but 2회 실행중
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



  // selectedCurShop이 변경될 때 formData 업데이트 - 편집 모드에서는 폼 데이터 업데이트만 스킵
  useEffect(() => {
    if (selectedCurShop) {
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
      
      // 3. 폼 데이터 업데이트 - 편집 모드에서는 스킵
      if (!isEditing) {
        // 새로운 폼 데이터 객체 생성
        const newFormData = {};
        
        // 기본 필드 처리
        Object.keys(formData).forEach(field => {
          // 특수 필드(pinCoordinates, path) 제외하고 처리
          if (field !== 'pinCoordinates' && field !== 'path') {
            let fieldValue = selectedCurShop.serverDataset[field];
            
            // 배열 처리 (예: businessHours)
            if (Array.isArray(fieldValue) && field === 'businessHours') {
              fieldValue = fieldValue.join(', ');
            }
            
            // undefined나 null인 경우 빈 문자열로 설정
            newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
          }
        });
        
        // 특수 필드 처리 (pin좌표, path)
        const hasCoordinates = Boolean(selectedCurShop.serverDataset.pinCoordinates);
        newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
        
        const pathArray = selectedCurShop.serverDataset.path;
        const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
        newFormData.path = hasPath ? '등록됨' : '';
        
        // 폼 데이터 상태 업데이트
        setFormData(newFormData);
      }
    } else {
      // selectedCurShop이 없는 경우 폼 초기화 (편집 모드가 아닐 때만)
      if (!isEditing) {
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
    }
  }, [selectedCurShop]); // isEditing 의존성 제거, 내부에서 조건부로 처리

  
  useEffect(() => { //AT 지역변경 동작[curSectionName
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
          const storedSectionsDB = localStorage.getItem('sectionsDB');
          if (storedSectionsDB) {
            const parsedSectionsDB = JSON.parse(storedSectionsDB);
            
            // 현재 섹션 찾기
            const currentSection = parsedSectionsDB.find(section => section.name === curSectionName);
            if (currentSection) {
              console.log(`localStorage에서 ${curSectionName} 섹션 데이터 찾음`);
              sectionsDB.current.set(curSectionName, currentSection.list);
              setCurLocalItemlist(currentSection.list);
              dataLoaded = true;
            }
          }
          
          // 데이터가 로드되지 않았으면 서버에서 가져오기
          if (!dataLoaded) {
            // 서버에서 데이터 가져오기
            await fetchSectionsFromFirebase();
            dataLoaded = true;
          }
        } catch (error) {
          console.error('섹션 데이터 로드 오류:', error);
          // 오류 발생 시 빈 데이터 생성
          sectionsDB.current.set(curSectionName, []);
          setCurLocalItemlist([]);
        }
      }
      
      // 데이터가 로드되었고 지도가 초기화되었으면 마커 생성
      if (dataLoaded && instMap.current) {
        initShopList(instMap.current);
      }
    };
    
    loadSectionData();
  }, [curSectionName]);

  // 선택된 상점 정보를 저장하는 상태 변수 추가
  // const [selectedCurShop, setSelectedCurShop] = useState(null); // 중복 선언 제거

  
  useEffect(() => { //AT 상점선택 동작 [selectedCurShop
    if (selectedCurShop) {
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
      
      // 3. 폼 데이터 업데이트 - 편집 모드에서는 스킵
      if (!isEditing) {
        // 새로운 폼 데이터 객체 생성
        const newFormData = {};
        
        // 기본 필드 처리
        Object.keys(formData).forEach(field => {
          // 특수 필드(pinCoordinates, path) 제외하고 처리
          if (field !== 'pinCoordinates' && field !== 'path') {
            let fieldValue = selectedCurShop.serverDataset[field];
            
            // 배열 처리 (예: businessHours)
            if (Array.isArray(fieldValue) && field === 'businessHours') {
              fieldValue = fieldValue.join(', ');
            }
            
            // undefined나 null인 경우 빈 문자열로 설정
            newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
          }
        });
        
        // 특수 필드 처리 (pin좌표, path)
        const hasCoordinates = Boolean(selectedCurShop.serverDataset.pinCoordinates);
        newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
        
        const pathArray = selectedCurShop.serverDataset.path;
        const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
        newFormData.path = hasPath ? '등록됨' : '';
        
        // 폼 데이터 상태 업데이트
        setFormData(newFormData);
      }
    }
  }, [selectedCurShop]);

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

  // Firebase에서 섹션 데이터 가져오기 함수 수정
  const fetchSectionsFromFirebase = async () => {
    try {
      console.log('Firebase에서 섹션 데이터 가져오기 시도');
      
      // 현재 섹션 문서 참조
      const sectionRef = doc(firebasedb, "sections", curSectionName);
      const docSnap = await getDoc(sectionRef);
      
      if (docSnap.exists()) {
        const serverData = docSnap.data();
        console.log(`Firebase에서 ${curSectionName} 데이터 가져옴:`, serverData);
        
        // 아이템 리스트 처리
        const itemList = serverData.itemList || [];
        
        // 서버 데이터를 올바른 구조로 변환
        const transformedItemList = itemList.map(item => {
          return {
            ...protoShopDataSet,
            serverDataset: { ...protoServerDataset, ...item },
            distance: item.distance || "",
            itemMarker: null,
            itemPolygon: null
          };
        });
        
        // sectionsDB 업데이트
        sectionsDB.current.set(curSectionName, transformedItemList);
        
        // 로컬 저장소 업데이트
        saveToLocalStorage(sectionsDB.current);
        
        // 타임스탬프 저장
        if (serverData.lastUpdated) {
          localStorage.setItem(`${curSectionName}_timestamp`, serverData.lastUpdated.toMillis().toString());
        } else {
          localStorage.setItem(`${curSectionName}_timestamp`, Date.now().toString());
        }
        
        // 현재 아이템 리스트 업데이트
        setCurLocalItemlist(transformedItemList);
        
        return [{ name: curSectionName, list: transformedItemList }];
      } else {
        console.log(`Firebase에 ${curSectionName} 데이터가 없음`);
        
        // 빈 데이터 생성
        const emptyList = [];
        sectionsDB.current.set(curSectionName, emptyList);
        setCurLocalItemlist([]);
        
        return [];
      }
    } catch (error) {
      console.error('Firebase 데이터 가져오기 오류:', error);
      return [];
    }
  };

  // 수정된 필드를 추적하는 상태 추가
  const [modifiedFields, setModifiedFields] = useState({});

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
      <div className={styles.map} id="mapSection">
        {/* 구글 맵이 표시되는 영역 */}
      </div>
      <div className={styles.rightSidebar}>
        <div className={styles.editor}>
          {/* 상단 버튼들만 숨김 처리 */}
          <div style={{ display: 'none' }}>
            <button className={styles.menuButton}>거리지도</button>
            <button className={styles.menuButton} onClick={moveToCurrentLocation}>현재위치</button>
            <button className={styles.menuButton} onClick={handlerfunc25}>2.5D</button>
          </div>
          <div className={styles.divider}>
            {!isEditing && !isEditCompleted ? (
              <button 
                className={`${styles.emptyButton} ${styles.addShopButton}`}
                onClick={addNewShopItem}
              >
                +상점추가
              </button>
            ) : isEditing ? (
              <div className={styles.editingStatusText}>
                {editNewShopDataSet.serverDataset.storeName || '새 상점'}을 수정중...
              </div>
            ) : (
              <>
                <div className={styles.editingStatusText}>
                  {hasChanges 
                    ? `${editNewShopDataSet.serverDataset.storeName || '상점'} 수정완료.` 
                    : "수정사항 없음"}
                </div>
                {hasChanges ? (
                  <div className={styles.editActionButtons}>
                    <button 
                      className={styles.cancelButton}
                      onClick={handleCancelEdit}
                    >
                      취소
                    </button>
                    <button 
                      className={styles.confirmButton}
                      onClick={handleConfirmEdit}
                    >
                      확인
                    </button>
                  </div>
                ) : (
                  <button 
                    className={`${styles.emptyButton} ${styles.addShopButton}`}
                    onClick={addNewShopItem}
                    style={{marginLeft: '10px'}}
                  >
                    +상점추가
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`${styles.card} ${isEditing ? styles.cardEditing : ''}`}>
          <h3>상점 Data
            <div className={styles.buttonContainer}>
              <button 
                onClick={handleEditFoamCardButton} 
                className={styles.menuButton}
                title={isEditing ? '수정을 마침. 이후 수정내용 확정 및 취소 가능' : '현재 상점 자료 편집'}
              >
                {isEditing ? '완료' : '수정'}
              </button>
              <span 
                className={styles.tooltipIcon} 
                title="상점에 대한 데이터 편집. 수정 완료 후 최종 확인을 한번 더 해야 합니다"
              >
                ?
              </span>
            </div>
          </h3>
          <form className={styles.form}>
            <div className={styles.formRow}>
              <span>가게명</span> |
              <input 
                type="text" 
                name="storeName" 
                ref={inputRefs.storeName} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.storeName : formData.storeName}
                readOnly={!isEditing || (isEditing && Boolean(formData.storeName))}
                className={`
                  ${Boolean(isEditing ? editNewShopDataSet.serverDataset.storeName : formData.storeName) ? styles.filledInput : styles.emptyInput}
                  ${modifiedFields.storeName ? styles.modifiedInput : ''}
                `}
              />
              {isEditing && Boolean(formData.storeName) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('storeName')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>가게스타일</span> |
              <input 
                type="text" 
                name="storeStyle" 
                ref={inputRefs.storeStyle} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.storeStyle : formData.storeStyle}
                readOnly={!isEditing || (isEditing && Boolean(formData.storeStyle))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.storeStyle : formData.storeStyle) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.storeStyle) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('storeStyle')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>별칭</span> |
              <input 
                type="text" 
                name="alias" 
                ref={inputRefs.alias} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.alias : formData.alias}
                readOnly={!isEditing || (isEditing && Boolean(formData.alias))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.alias : formData.alias) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.alias) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('alias')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>코멘트</span> |
              <input 
                type="text" 
                name="comment" 
                ref={inputRefs.comment} 
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.comment : formData.comment) ? styles.filledInput : styles.emptyInput}
                onChange={handleInputChange}
                value={isEditing ? editNewShopDataSet.serverDataset.comment : formData.comment}
                readOnly={!isEditing || (isEditing && Boolean(formData.comment))}
              />
              {isEditing && Boolean(formData.comment) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('comment')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>지역분류</span> |
              <input 
                type="text" 
                name="locationMap" 
                ref={inputRefs.locationMap} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.locationMap : formData.locationMap}
                readOnly={!isEditing || (isEditing && Boolean(formData.locationMap))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.locationMap : formData.locationMap) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.locationMap) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('locationMap')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>영업시간</span> |
              <input 
                type="text" 
                name="businessHours" 
                ref={inputRefs.businessHours} 
                onChange={handleInputChange} 
                value={isEditing ? 
                  (Array.isArray(editNewShopDataSet.serverDataset.businessHours) ? 
                    editNewShopDataSet.serverDataset.businessHours.join(', ') : 
                    editNewShopDataSet.serverDataset.businessHours) : 
                  formData.businessHours}
                readOnly={!isEditing || (isEditing && Boolean(formData.businessHours))}
                className={Boolean(isEditing ? 
                  (Array.isArray(editNewShopDataSet.serverDataset.businessHours) ? 
                    editNewShopDataSet.serverDataset.businessHours.join(', ') : 
                    editNewShopDataSet.serverDataset.businessHours) : 
                  formData.businessHours) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.businessHours) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('businessHours')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>hot시간대</span> |
              <input 
                type="text" 
                name="hotHours" 
                ref={inputRefs.hotHours} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.hotHours : formData.hotHours}
                readOnly={!isEditing || (isEditing && Boolean(formData.hotHours))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.hotHours : formData.hotHours) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.hotHours) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('hotHours')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>할인시간</span> |
              <input 
                type="text" 
                name="discountHours" 
                ref={inputRefs.discountHours} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.discountHours : formData.discountHours}
                readOnly={!isEditing || (isEditing && Boolean(formData.discountHours))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.discountHours : formData.discountHours) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.discountHours) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('discountHours')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>주소</span> |
              <input 
                type="text" 
                name="address" 
                ref={inputRefs.address} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.address : formData.address}
                readOnly={!isEditing || (isEditing && Boolean(formData.address))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.address : formData.address) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.address) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('address')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>대표이미지</span> |
              <input 
                type="text" 
                name="mainImage" 
                ref={inputRefs.mainImage} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.mainImage : formData.mainImage}
                readOnly={!isEditing || (isEditing && Boolean(formData.mainImage))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.mainImage : formData.mainImage) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.mainImage) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('mainImage')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>pin좌표</span> |
              <input 
                type="text" 
                name="pinCoordinates" 
                ref={inputRefs.pinCoordinates} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.pinCoordinates : formData.pinCoordinates}
                readOnly={true}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.pinCoordinates : formData.pinCoordinates) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && (
                <button 
                  type="button"
                  onClick={handlePinCoordinatesButtonClick} 
                  className={styles.inputOverlayButton}
                >
                  좌표
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>path</span> |
              <input 
                type="text" 
                name="path" 
                ref={inputRefs.path} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.path : formData.path}
                readOnly={true}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.path : formData.path) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && (
                <button 
                  type="button"
                  onClick={handlePathButtonClick} 
                  className={styles.inputOverlayButton}
                >
                  도형그리기
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>카테고리아이콘</span> |
              <input 
                type="text" 
                name="categoryIcon" 
                ref={inputRefs.categoryIcon} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.categoryIcon : formData.categoryIcon}
                readOnly={!isEditing || (isEditing && Boolean(formData.categoryIcon))}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.categoryIcon : formData.categoryIcon) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && Boolean(formData.categoryIcon) && (
                <button 
                  type="button"
                  onClick={() => handleFieldEditButtonClick('categoryIcon')} 
                  className={styles.inputOverlayButton}
                >
                  변경
                </button>
              )}
            </div>
            <div className={styles.formRow}>
              <span>구글데이터ID</span> |
              <input 
                type="text" 
                name="googleDataId" 
                ref={inputRefs.googleDataId} 
                onChange={handleInputChange} 
                value={isEditing ? editNewShopDataSet.serverDataset.googleDataId : formData.googleDataId}
                readOnly={true}
                className={Boolean(isEditing ? editNewShopDataSet.serverDataset.googleDataId : formData.googleDataId) ? styles.filledInput : styles.emptyInput}
              />
              {isEditing && (
                <button 
                  type="button"
                  onClick={handleDetailLoadingClick} 
                  className={styles.inputOverlayButton}
                >
                  디테일로딩
                </button>
              )}
            </div>
            <div className={styles.photoGallery}>
              {/* 메인 이미지 (좌측) */}
              <div className={styles.mainImageContainer}>
                {(selectedCurShop?.serverDataset?.mainImage || selectedCurShop?.mainImage) ? (
                  <img 
                    src={selectedCurShop?.serverDataset?.mainImage || selectedCurShop?.mainImage} 
                    alt="메인 이미지" 
                    className={styles.mainImage} 
                  />
                ) : (
                  <div className={styles.emptyImage}>메인 이미지 없음</div>
                )}
              </div>
              
              {/* 서브 이미지 4분할 (우측) */}
              <div className={styles.subImagesGrid}>
                {Array.from({ length: 4 }).map((_, index) => {
                  // selectedCurShop만 사용
                  const subImages = selectedCurShop?.serverDataset?.subImages || 
                                    selectedCurShop?.subImages || 
                                    [];
                  
                  return (
                    <div key={`sub-${index}`} className={styles.subImageItem}>
                      {subImages && index < subImages.length ? (
                        <img 
                          src={subImages[index]} 
                          alt={`서브 이미지 ${index + 1}`} 
                          className={styles.subImage} 
                        />
                      ) : (
                        <div className={styles.emptySubImage}></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      </div>
      <form ref={searchformRef} onSubmit={(e) => e.preventDefault()} className={styles.searchForm}>
        {!isSidebarVisible && (
          <button className={styles.headerButton} onClick={toggleSidebar}>
            반월당역
          </button>
        )}
        {isSearchFocused && (
          <div className={styles.searchButtonsContainer}>
            <button
              className={`${styles.menuButton} ${selectedButton === '국가' ? styles.selected : ''}`}
              onClick={() => handleButtonClick('국가')}
            >
              국가
            </button>
            <button
              className={`${styles.menuButton} ${selectedButton === '인근' ? styles.selected : ''}`}
              onClick={() => handleButtonClick('인근')}
            >
              인근
            </button>
            <button
              className={`${styles.menuButton} ${selectedButton === '지도내' ? styles.selected : ''}`}
              onClick={() => handleButtonClick('지도내')}
            >
              지도내
            </button>
          </div>
        )}
        <div className={styles.searchInputContainer}>
          <input
            ref={searchInputDomRef}
            id="searchInput"
            type="text"
            placeholder="가게 검색"
            className={styles.searchInput}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          <button type="submit" className={styles.searchButton}>
            <span className="material-icons searchIcon">search</span>
          </button>
        </div>
      </form>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing&loading=async`}
        strategy="afterInteractive"
      />
    </div>

  );
} 