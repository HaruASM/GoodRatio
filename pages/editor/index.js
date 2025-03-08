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

  let sectionsDB = [];

  const [curLocalItemlist, setCurLocalItemlist] = useState([]);
  let curSectionName = "반월당";
  const presentMakers = []; // 20개만 보여줘도 됨 // localItemlist에 대한 마커 객체 저장

  const protoShopDataSet = {
    locationMap: "",
    storeName: "",
    storeStyle: "",
    alias: "",
    businessHours: [],
    hotHours: "",
    discountHours: "",
    distance: "",
    address: "",
    mainImage: "",
    pinCoordinates: "",
    categoryIcon: "",
    googleDataId: "",
    path: [],
    itemMarker: null,
    itemPolygon: null,
  };


  // 브라우저 뒷단에서 데이터 저장 및 관리 
  const [editNewShopDataSet, setEditNewShopDataSet] = useState(protoShopDataSet);

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

  const [selectedItemOfShopList, setSelectedItemOfShopList] = useState(null);
  const [selectedItemSidebarList, setSelectedItemSidebarList] = useState(null);

  // 이전 선택 항목의 DOM 요소를 추적하는 useRef
  const prevSelectedElementRef = useRef(null);

  const handleButtonClick = (buttonName) => {
    setSelectedButton(buttonName);
  };

  // 로딩 상태 관리를 위한 상태 추가
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // 비동기 작업을 위한 래퍼 함수
  const asyncHandler = async (asyncFunction, successMessage = null) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const result = await asyncFunction();
      if (successMessage) {
        alert(successMessage);
      }
      return result;
    } catch (error) {
      console.error("작업 실패:", error);
      setErrorMessage(`작업 실패: ${error.message}`);
      alert(`작업 실패: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetailLoadingClick = () => {
    asyncHandler(async () => {
    const placeId = editNewShopDataSet.googleDataId;

      if (!placeId) {
        throw new Error('Place ID가 없습니다.');
      }

      return new Promise((resolve, reject) => {
      const service = new window.google.maps.places.PlacesService(instMap.current);
      service.getDetails({ placeId }, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const _updates = {};

          if (result.opening_hours) {
            // 영업시간 정보를 상태에 설정
            _updates.businessHours = result.opening_hours.weekday_text;
          }

          // 위경도 정보를 상태에 설정
          if (result.geometry && result.geometry.location) {
            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            _updates.pinCoordinates = `${lat}, ${lng}`;
          }

          // 사진 정보를 상태에 설정
          if (result.photos && result.photos.length > 0) {
              // 최대 10장의 사진 URL을 배열로 저장
            const photoUrls = result.photos.slice(0, 10).map(photo => 
              photo.getUrl({ maxWidth: 400, maxHeight: 400 })
            );
            _updates.subImages = photoUrls; // 여러 장의 사진을 저장할 배열 필드
            _updates.mainImage = photoUrls[0]; // 첫 번째 사진은 기존 필드에도 저장
          }

            // 데이터셋 업데이트
          updateDataSet(_updates);
            resolve(true);
        } else {
            reject(new Error(`장소 상세 정보를 가져오지 못했습니다: ${status}`));
        }
      });
      });
    }, '구글에서 가게 상세 정보를 가져왔습니다.');
  };

  const updateDataSet = (updates) => {
    setEditNewShopDataSet((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleEditFoamCardButton = () => {
    console.log('수정 버튼 클릭');
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
  // 4. 생선된 다각형 pin 객체는 editMyShopDataSet에 저장
  const handlePathButtonClick = (event) => {
    event.preventDefault();
    const _drawingManager = drawingManagerRef.current;
    _drawingManager.setOptions({ drawingControl: true });

    if (_drawingManager) {
      _drawingManager.setOptions({ drawingControl: true, });
      _drawingManager.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);

      // 다각형 이벤츠 처리부 
      window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', (eventObjOverlay) => {

        console.log('handlePathButtonClick');
        // const coordinates = [];
        // path.forEach((point) => {
        //   coordinates.push({ lat: point.lat(), lng: point.lng() });
        // });
        // const coordinates = [];
        // eventObjOverlay.getPath().forEach((point) => {
        //   coordinates.push({ lat: point.lat(), lng: point.lng() });
        // });
        // console.log('다각형 좌표들:', coordinates);



        //updateDataSet('path', eventObjOverlay.getPath()); 
        // setEditNewShopDataSet((prev) => ({
        //   ...prev,
        //   ['path']: eventObjOverlay.getPath(),
        // }));
        // setOverlayPolygonFoamCard(prev => {
        //   if (prev) prev.setMap(null);
        //   return eventObjOverlay;
        // });
        // const handlePolygonPathChange = () => {
        //   console.log('다각형 경로 변경');
        // };

        // const path = eventObjOverlay.getPath();
        // window.google.maps.event.addListener(path, 'set_at', handlePolygonPathChange);
        // window.google.maps.event.addListener(path, 'insert_at', handlePolygonPathChange);
        // window.google.maps.event.addListener(path, 'remove_at', handlePolygonPathChange);


        // 초기화 
        _drawingManager.setOptions({ drawingControl: false });
      });



    } else console.error('드로잉 매니저 생성 안됨')

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

    // 이단계에서 마커와 폴리곤들 이벤트 바인딩을 해야할듯
    ({ optionsMarker, optionsPolygon } = setProtoOverlays());  //전역 위치의 포로토타입 마커에 세팅 
  }


  const factoryMakers = (coordinates, mapInst, shopItem) => {
    const defaultIcon = {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#FF0000',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    };
    
    const _markerOptions = Object.assign({}, optionsMarker, { position: coordinates });
    const _marker = new window.google.maps.Marker(_markerOptions);
    
    // 마커 객체에 아이템 객체 직접 연결
    _marker.shopItem = shopItem;

    const handleOverlayClick = () => {
      // 마커에 연결된 아이템 객체 직접 사용
      selectItemHandlerMarkerInMap(_marker);
      
      // InfoWindow 생성 및 설정
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div>
            <strong>${shopItem.storeName || '이름 없음'}</strong><br>
            ${shopItem.address || '주소 없음'}<br>
            <button id="customButton">상세 정보</button>
          </div>
        `,
      });

      // InfoWindow를 오버레이의 위치에 표시
      infoWindow.open(mapInst, _marker);

      // 버튼 클릭 이벤트 리스너 추가
      window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
        const customButton = document.getElementById('customButton');
        if (customButton) {
          customButton.addEventListener('click', () => {
            selectItemHandlerMarkerInMap(_marker);
          });
        }
      });
    };

    const handleOverlayMouseOver = () => {
      // 선택된 아이템이 아닌 경우에만 마우스오버 효과 적용
      if (!selectedItemOfShopList || selectedItemOfShopList.googleDataId !== shopItem.googleDataId) {
      _marker.setIcon({ url: OVERLAY_ICON.MARKER_MOUSEOVER });
    }
    }
    
    const handleOverlayMouseOut = () => {
      // 선택된 아이템이 아닌 경우에만 마우스아웃 효과 적용
      if (!selectedItemOfShopList || selectedItemOfShopList.googleDataId !== shopItem.googleDataId) {
        _marker.setIcon(defaultIcon);
      }
    }

    // 오버레이에 이벤트 바인딩 
    window.google.maps.event.addListener(_marker, 'click', handleOverlayClick);
    window.google.maps.event.addListener(_marker, 'mouseover', handleOverlayMouseOver);
    window.google.maps.event.addListener(_marker, 'mouseout', handleOverlayMouseOut);

    return _marker;
  }


  const factoryPolygon = (paths, mapInst, shopItem) => {
    const _polygonOptions = Object.assign({}, optionsPolygon, { paths: paths });
    const _polygon = new window.google.maps.Polygon(_polygonOptions);

    const handleOverlayClick = () => {
      // infoWindow 생성 및 설정
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div>
            <strong>아이템 리스트의 정보보</strong><br>
          </div>
        `,
      });

      const bounds = new window.google.maps.LatLngBounds(); // 경계 객체 생성
      paths.forEach((point) => bounds.extend(point)); // 경로의 각 점을 경계에 추가
      infoWindow.setPosition(bounds.getCenter()); // 경계의 중심에 InfoWindow 위치 설정
      infoWindow.open(mapInst, paths); // InfoWindow를 지도에 표시

    } // handleOverlayClick

    const handleOverlayMouseOver = () => {
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.MOUSEOVER, });
    } //handleOverlayMouseOver

    const handleOverlayMouseOut = () => {
      _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE, });
    } //handleOverlayMouseOut

    // 오버레이에 이벤트 바인딩 
    window.google.maps.event.addListener(_polygon, 'click', handleOverlayClick);
    window.google.maps.event.addListener(_polygon, 'mouseover', handleOverlayMouseOver);
    window.google.maps.event.addListener(_polygon, 'mouseout', handleOverlayMouseOut);
    return _polygon;
  }



  

  // 로컬 스토리지에서 sectionsDB로 데이터 로드
  const loadFromLocalToSectionsDB = (sectionName) => {
    try {
      // 로컬 스토리지에서 섹션 데이터 가져오기
      const storedSectionData = localStorage.getItem(`section_${sectionName}`);
      const storedTimestamp = localStorage.getItem(`${sectionName}_timestamp`);
      
      if (storedSectionData) {
        const parsedSectionData = JSON.parse(storedSectionData);
        const timestamp = parseInt(storedTimestamp || '0');
        
        // sectionsDB 업데이트 (Firebase 타임스탬프 포함)
        const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
        if (sectionIndex !== -1) {
          sectionsDB[sectionIndex] = {
            ...sectionsDB[sectionIndex],
            list: parsedSectionData.list,
            timestamp: timestamp, // Firebase 타임스탬프 또는 로컬 타임스탬프
            lastUpdated: new Date(timestamp) // 가독성을 위한 Date 객체
          };
        } else {
          sectionsDB.push({
            name: sectionName,
            list: parsedSectionData.list,
            timestamp: timestamp, // Firebase 타임스탬프 또는 로컬 타임스탬프
            lastUpdated: new Date(timestamp) // 가독성을 위한 Date 객체
          });
        }
        
        console.log(`로컬 스토리지에서 ${sectionName} 데이터를 가져와 sectionsDB에 로드함 (타임스탬프: ${new Date(timestamp).toLocaleString()})`);
        
        return parsedSectionData.list;
      } else {
        console.log(`로컬 스토리지에 ${sectionName} 데이터가 없음`);
        return null;
      }
      } catch (error) {
      console.error(`로컬 스토리지에서 ${sectionName} 데이터 가져오기 오류:`, error);
        return null;
      }
    };

  // 파이어베이스에서 데이터 가져와 로컬 스토리지에 저장하는 함수
  const fetchAndSaveFromFirebase = async (sectionName) => {
    try {
      // Firebase에서 섹션 데이터 가져오기
      const sectionRef = doc(firebasedb, "sections", sectionName);
      const docSnap = await getDoc(sectionRef);
      
      if (docSnap.exists()) {
        const serverData = docSnap.data();
        const serverTimestamp = serverData.lastUpdated?.toMillis() || Date.now();
        
        // 로컬 스토리지에 저장
        const sectionData = {
          name: sectionName,
          list: serverData.itemList || [],
          timestamp: serverTimestamp
        };
        
        localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
        localStorage.setItem(`${sectionName}_timestamp`, serverTimestamp.toString());
        
        // sectionsDB 직접 업데이트 (Firebase 타임스탬프 포함)
        const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
        if (sectionIndex !== -1) {
          sectionsDB[sectionIndex] = {
            ...sectionsDB[sectionIndex],
            list: serverData.itemList || [],
            timestamp: serverTimestamp,
            lastUpdated: new Date(serverTimestamp)
          };
        } else {
          sectionsDB.push({
            name: sectionName,
            list: serverData.itemList || [],
            timestamp: serverTimestamp,
            lastUpdated: new Date(serverTimestamp)
          });
        }
        
        console.log(`Firebase에서 ${sectionName} 데이터를 가져와 로컬 스토리지와 sectionsDB에 저장함 (타임스탬프: ${new Date(serverTimestamp).toLocaleString()})`);
        
        return serverData.itemList || [];
      } else {
        console.log(`Firebase에 ${sectionName} 데이터가 없음`);
        return [];
      }
    } catch (error) {
      console.error(`Firebase에서 ${sectionName} 데이터 가져오기 오류:`, error);
      return [];
    }
  };

  // 파이어베이스에서 로컬 스토리지로 데이터 동기화 확인 함수
  const checkAndSyncFromFirebase = async (sectionName) => {
    try {
      // Firebase에서 섹션 데이터 가져오기
      const sectionRef = doc(firebasedb, "sections", sectionName);
        const docSnap = await getDoc(sectionRef);
        
        if (docSnap.exists()) {
          const serverData = docSnap.data();
          const serverTimestamp = serverData.lastUpdated?.toMillis() || 0;
        const localtimestamp = parseInt(localStorage.getItem(`${sectionName}_timestamp`) || '0');
          
        console.log(`Firebase 타임스탬프: ${new Date(serverTimestamp).toLocaleString()}, 로컬 타임스탬프: ${new Date(localtimestamp).toLocaleString()}`);
        
        // 서버 데이터가 더 최신인 경우 로컬 스토리지와 sectionsDB 업데이트
          if (serverTimestamp > localtimestamp) {
          console.log(`Firebase의 ${sectionName} 데이터가 더 최신임. 로컬 스토리지와 sectionsDB 업데이트`);
          
          // 로컬 스토리지에 저장
          const sectionData = {
            name: sectionName,
            list: serverData.itemList || [],
            timestamp: serverTimestamp
          };
          
          localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
          localStorage.setItem(`${sectionName}_timestamp`, serverTimestamp.toString());
          
          // sectionsDB 직접 업데이트
          const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
            if (sectionIndex !== -1) {
            sectionsDB[sectionIndex] = {
              ...sectionsDB[sectionIndex],
              list: serverData.itemList || [],
              timestamp: serverTimestamp,
              lastUpdated: new Date(serverTimestamp)
            };
            } else {
            sectionsDB.push({
              name: sectionName,
              list: serverData.itemList || [],
              timestamp: serverTimestamp,
              lastUpdated: new Date(serverTimestamp)
            });
          }
          
          return serverData.itemList || [];
          } else {
          console.log(`로컬 스토리지의 ${sectionName} 데이터가 최신이거나 같음. 업데이트 안함`);
          return null;
        }
      } else {
        console.log(`Firebase에 ${sectionName} 데이터가 없음`);
        return null;
      }
    } catch (error) {
      console.error(`Firebase 동기화 확인 오류:`, error);
      return null;
    }
  };

  // 빈 데이터 생성 시에도 타임스탬프 추가
  const createEmptySection = (sectionName) => {
    const currentTimestamp = Date.now();
    
    // 빈 데이터 생성
    const emptySectionData = {
      name: sectionName,
      list: [],
      timestamp: currentTimestamp
    };
    
    // 로컬 스토리지에 저장
    localStorage.setItem(`section_${sectionName}`, JSON.stringify(emptySectionData));
    localStorage.setItem(`${sectionName}_timestamp`, currentTimestamp.toString());
    
    // sectionsDB 업데이트
    const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
    if (sectionIndex !== -1) {
      sectionsDB[sectionIndex] = {
        ...sectionsDB[sectionIndex],
        list: [],
        timestamp: currentTimestamp,
        lastUpdated: new Date(currentTimestamp)
      };
    } else {
      sectionsDB.push({
        name: sectionName,
        list: [],
        timestamp: currentTimestamp,
        lastUpdated: new Date(currentTimestamp)
      });
    }
    
    console.log(`${sectionName} 섹션에 빈 데이터 생성 (타임스탬프: ${new Date(currentTimestamp).toLocaleString()})`);
    
    return [];
  };

  // FB와 연동 - initShopList 함수 수정
  const initShopList = async (_mapInstance) => {
    // 1) 로컬 스토리지에서 sectionsDB로 데이터 로드
    let localItemList = loadFromLocalToSectionsDB(curSectionName);
    
    if (localItemList) {
      // 로컬 스토리지에 데이터가 있는 경우
      console.log(`로컬 스토리지에서 ${curSectionName} 데이터를 가져옴`);
      
      // 2) Firebase와 동기화 확인 (Firebase → 로컬 스토리지 방향으로만)
      const updatedList = await checkAndSyncFromFirebase(curSectionName);
      
      // 업데이트된 데이터가 있으면 사용
      if (updatedList) {
        localItemList = updatedList;
            }
          } else {
      // 3) 로컬 스토리지에 데이터가 없는 경우 Firebase에서 가져오기
      console.log(`로컬 스토리지에 ${curSectionName} 데이터가 없음. Firebase에서 가져오기 시도`);
            
      // Firebase에서 데이터 가져와 로컬 스토리지와 sectionsDB에 저장
      localItemList = await fetchAndSaveFromFirebase(curSectionName);
            
          // Firebase에도 데이터가 없는 경우 빈 데이터 생성
      if (localItemList.length === 0) {
        console.log(`Firebase에도 ${curSectionName} 데이터가 없음. 빈 데이터 생성`);
        localItemList = createEmptySection(curSectionName);
      }
    }
    
    // 최종적으로 가져온 데이터로 마커와 폴리곤 생성
    if (localItemList && localItemList.length > 0) {
      // 동기화된 데이터로 마커와 폴리곤 생성
      localItemList.forEach((item) => {
        // pinCoordinates가 문자열인 경우 객체로 변환
        if (typeof item.pinCoordinates === 'string') {
          const [lat, lng] = item.pinCoordinates.split(',').map(coord => parseFloat(coord.trim()));
          item.pinCoordinates = { lat, lng };
        }
        
        if (item.pinCoordinates) {
          item.marker = factoryMakers(item.pinCoordinates, _mapInstance, item);
          item.marker.setTitle(item.storeName);
          presentMakers.push(item.marker);
        }

        if (item.path && item.path.length > 0) {
          item.polygon = factoryPolygon(item.path, _mapInstance, item);
          presentMakers.push(item.polygon);
        }
      });

      presentMakers.forEach((item) => {
        item.setMap(_mapInstance);
      });

      // 현재 섹션 설정
      const _temp = sectionsDB.find(section => section.name === curSectionName);
      setCurLocalItemlist(_temp ? _temp.list : []);
    }
  };

  // 모든 섹션 데이터를 Firebase에 저장하는 함수 (명시적 호출용)
  const saveSectionsToFirebase = async () => {
    return asyncHandler(async () => {
      // 각 섹션을 Firebase에 저장
      for (const section of sectionsDB) {
        await saveToFirebase(section.name, section.list);
      }
      
      return true;
    }, '모든 섹션 데이터가 서버에 저장되었습니다.');
  };

  // pin 좌표 수정 버튼 클릭시 동작
  const handlePinCoordinatesButtonClick = (event) => {
    event.preventDefault();
    console.log('pin 좌표 수정 버튼 클릭');
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

  const initPlaceInfo = (_mapInstance) => { // 이부분은 구글 search 부분 하위에 넣어야 할듯듯
    //const service = new window.google.maps.places.PlacesService(_mapInstance);

    window.google.maps.event.addListener(_mapInstance, 'click', (clickevent) => {
      // 여기에 사이드바 가리기 처리 - 지도 빈땅 클릭시 이벤트 
      console.log('click event');
    });
  }

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

    // g맵용 로드 완료시 동작 
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => {

      initDrawingManager(_mapInstance);
      initSearchInput(_mapInstance);
      initPlaceInfo(_mapInstance);
      initMarker();
      initShopList(_mapInstance);


      // -- 현재 내위치 마커 
    });  // idle 이벤트 

    instMap.current = _mapInstance;
  } // initializeGoogleMapPage 마침

  //  useEffect(() => { // 1회 실행 but 2회 실행중
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



  useEffect(() => { // 브라우저 백단에 있는 샵데이터 객체 업데이트시 => form 입력 필드 업데이트 해줌
    Object.keys(inputRefs).forEach((field) => {
      const input = inputRefs[field].current;

      if (input) {
        const _value = editNewShopDataSet[field];
        if (Array.isArray(_value)) {
          input.value = _value.length > 0 ? _value.join(', ') : '';
          input.readOnly = _value.length > 0;
        } else {
          input.value = _value || '';
          input.readOnly = Boolean(_value);
        }
      } else {
        console.log('input 요소가 없습니다. DOM 미스매치');
      }

      if (field === 'path' && editNewShopDataSet[field]) {
        console.log('editMyShopDataSet[field] - 폼데이터내 path 업데이트 되었음');
        //const _value = editMyShopDataSet[field];
        //const _map = instMap.current;
        //const _drawingManager = drawingManagerRef.current;

      }

    });
  }, [editNewShopDataSet]);

  // 사이드바에서 아이템 선택 시 핸들러
  const selectItemHandlerSidebar = (item, index) => {
    console.log("사이드바에서 아이템 선택됨:", item);
    
    // curLocalItemlist에서 해당 아이템 찾기
    const foundItem = curLocalItemlist.find(listItem => 
      listItem.googleDataId === item.googleDataId
    );
    // 선택된 아이템 인덱스 저장
    setSelectedItemOfShopList(item);
    
  };
  
  // 2. 검색 입력에서 아이템 선택 시 핸들러 (공란으로 유지)
  const selectItemHandlerSearchInput = (item) => {
    // 검색 입력에서 아이템 선택 시 처리 로직 (향후 구현)
  };
  
  // 3. 지도 내 마커 클릭 시 핸들러
  const selectItemHandlerMarkerInMap = (marker) => {
        
    // 마커에 직접 연결된 아이템 객체 사용
    const shopItem = marker.shopItem;
        if (!shopItem) {      console.error("마커에 연결된 아이템 객체가 없습니다.");      return;    }
       
    // 선택된 아이템 상태 업데이트
    setSelectedItemOfShopList(shopItem);
   
  };
  
  // selectedItemSidebarList가 변경될 때 실행되는 useEffect
  useEffect(() => {
    if (!selectedItemOfShopList || !selectedItemOfShopList.marker) return;
    
    // 지도 중심 이동만 수행
    if (instMap.current && selectedItemOfShopList.marker) {
      instMap.current.setCenter(selectedItemOfShopList.marker.getPosition());
      instMap.current.setZoom(18);
    }
    
    // 폼 데이터 업데이트
    setEditNewShopDataSet(selectedItemOfShopList);
    
    // 사이드바 아이템 선택 상태 업데이트
    setSelectedItemSidebarList((prev) => {
      // 같은 항목을 다시 선택한 경우 이전 상태 유지 (토글 기능 제거)
      if (prev && prev.googleDataId === selectedItemOfShopList.googleDataId)  return prev; // 이전 상태 유지
      
      return selectedItemOfShopList; // 새 항목으로 상태 업데이트
    });
    
    // 4. 기타 필요한 상태 업데이트
    // ...

  }, [selectedItemOfShopList]);

  // 폼 데이터 초기화 버튼 추가
  const handleResetForm = () => {
    // 선택된 아이템 초기화
    setSelectedItemOfShopList(null);
    setSelectedItemSidebarList(null);
    
    // 폼 데이터 초기화
    setEditNewShopDataSet(protoShopDataSet);
  };

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
    
    // 코멘트 입력 필드의 값을 가져옴
    const commentValue = inputRefs.comment.current.value;
    
    if (commentValue.trim() !== '') {
      // 별칭 필드 업데이트
      updateDataSet({ alias: commentValue });
      
      // 코멘트 입력 필드 초기화
      inputRefs.comment.current.value = '';
    } else {
      // 코멘트 입력 필드가 비어있으면 별칭 값을 코멘트 입력 필드에 복사
      inputRefs.comment.current.value = editNewShopDataSet.alias || '';
      // 포커스 설정
      inputRefs.comment.current.focus();
    }
  };

  // 로딩 인디케이터 UI 추가
  const LoadingIndicator = () => (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingSpinner}></div>
      <p>데이터 처리 중...</p>
    </div>
  );

  // 에러 메시지 UI 추가
  const ErrorMessage = ({ message, onClose }) => (
    <div className={styles.errorMessage}>
      <p>{message}</p>
      <button onClick={onClose}>닫기</button>
    </div>
  );

  // 사이드바 아이템 목록 생성 부분 - curLocalItemlist에만 의존
  useEffect(() => {
    const itemListContainer = document.querySelector(`.${styles.itemList}`);
    if (!itemListContainer) {
      console.error('Item list container not found');
      return;
    }

    // 기존 아이템 제거
    itemListContainer.innerHTML = '';

    // curLocalItemlist의 아이템을 순회하여 사이드바에 추가
    curLocalItemlist.forEach((item, index) => {
      const listItem = document.createElement('li');
      listItem.className = styles.item;
      
      // 선택 스타일은 여기서 적용하지 않음 (별도 useEffect에서 처리)
      
      const link = document.createElement('a');
      link.href = '#';

      const itemDetails = document.createElement('div');
      itemDetails.className = styles.itemDetails;

      const itemTitle = document.createElement('span');
      itemTitle.className = styles.itemTitle;
      itemTitle.innerHTML = `${item.storeName} <small>${item.storeStyle}</small>`;

      const businessHours = document.createElement('p');
      businessHours.textContent = `영업 중 · ${item.businessHours[0] || '정보 없음'}`;

      const address = document.createElement('p');
      address.innerHTML = `<strong>${item.distance || '정보 없음'}</strong> · ${item.address}`;

      const itemImage = document.createElement('img');
      itemImage.src = item.mainImage || "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDF8fGZvb2R8ZW58MHx8fHwxNjE5MjY0NzYx&ixlib=rb-1.2.1&q=80&w=400";
      itemImage.alt = `${item.storeName} ${item.storeStyle}`;
      itemImage.className = styles.itemImage;
      itemImage.width = 100;
      itemImage.height = 100;

      // 아이템 클릭 시 해당 마커로 이동 및 선택 처리
      link.addEventListener('click', (e) => {
        e.preventDefault();
        selectItemHandlerSidebar(item, index);
      });

      itemDetails.appendChild(itemTitle);
      itemDetails.appendChild(businessHours);
      itemDetails.appendChild(address);
      link.appendChild(itemDetails);
      link.appendChild(itemImage);
      listItem.appendChild(link);
      itemListContainer.appendChild(listItem);
      
      // 중요: 사이드바 DOM 요소를 아이템 객체에 저장
      item.sidebarElement = listItem;
      item.sidebarIndex = index;
    });
    
    // 사이드바 생성 후 현재 선택된 아이템이 있으면 스타일 적용
    // (초기 로드 시 선택 상태 처리를 위함)
    if (selectedItemSidebarList) {
      const selectedItem = curLocalItemlist.find(item => 
        item.googleDataId === selectedItemSidebarList.googleDataId
      );
      
      if (selectedItem && selectedItem.sidebarElement) {
        selectedItem.sidebarElement.classList.add(styles.selectedItem);
      }
    }
  }, [curLocalItemlist]); // selectedItemSidebarList 의존성 제거

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 순환 참조 해제
      curLocalItemlist.forEach(item => {
        if (item.marker) {
          item.marker.shopItem = null;
          item.marker.setMap(null);
          item.marker = null;
        }
      });
    };
  }, []);

  // DOM 조작을 처리하는 useEffect
  useEffect(() => {
    if (!selectedItemSidebarList || !selectedItemSidebarList.sidebarElement) return;
    
    // 이전 선택 항목이 있으면 스타일 초기화
    if (prevSelectedElementRef.current && 
        prevSelectedElementRef.current !== selectedItemSidebarList.sidebarElement) {
      prevSelectedElementRef.current.classList.remove('selected');
      // 인라인 스타일 초기화
      prevSelectedElementRef.current.style.backgroundColor = '';
      prevSelectedElementRef.current.style.color = '';
      prevSelectedElementRef.current.style.fontWeight = '';
      prevSelectedElementRef.current.style.borderLeft = '';
      prevSelectedElementRef.current.style.boxShadow = '';
    }
    
    // 선택된 항목에 클래스 추가 및 인라인 스타일 적용
    const element = selectedItemSidebarList.sidebarElement;
    element.classList.add('selected');
    
    // 인라인 스타일 직접 적용 - 왼쪽 세로 바와 그림자 효과만 적용
    element.style.borderLeft = '4px solid #4a90e2';
    element.style.paddingLeft = '12px';
    element.style.backgroundColor = '#f8f9fa';
    element.style.boxShadow = '0 0 8px rgba(74, 144, 226, 0.5)';
    
    prevSelectedElementRef.current = element;
    
    // 선택된 항목이 보이도록 스크롤 조정
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'nearest' 
    });
  }, [selectedItemSidebarList]);

  // 디버깅을 위한 useEffect
  useEffect(() => {
    // 모든 스타일시트에서 .selected 관련 규칙 찾기
    const findSelectedRules = () => {
      const rules = [];
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const styleSheet = document.styleSheets[i];
          const cssRules = styleSheet.cssRules || styleSheet.rules;
          for (let j = 0; j < cssRules.length; j++) {
            if (cssRules[j].selectorText && 
                (cssRules[j].selectorText.includes('.selected') || 
                 cssRules[j].selectorText.includes('.sidebar-item.selected'))) {
              rules.push({
                selector: cssRules[j].selectorText,
                cssText: cssRules[j].cssText
              });
            }
          }
        } catch (e) {
          console.warn('스타일시트 접근 오류:', e);
        }
      }
      return rules;
    };
    
    console.log('선택 관련 CSS 규칙:', findSelectedRules());
    
    // 선택된 항목이 있으면 해당 항목의 계산된 스타일 확인
    if (selectedItemSidebarList && selectedItemSidebarList.sidebarElement) {
      const computedStyle = window.getComputedStyle(selectedItemSidebarList.sidebarElement);
      console.log('선택된 요소의 계산된 스타일:', {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        fontWeight: computedStyle.fontWeight,
        borderLeft: computedStyle.borderLeft,
        boxShadow: computedStyle.boxShadow
      });
    }
  }, [selectedItemSidebarList]);

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
          <button className={styles.menuButton}>거리지도</button>
          <button className={styles.menuButton} onClick={moveToCurrentLocation}>현재위치</button>
          <div className={styles.divider}></div>
          <button className={styles.menuButton}>추가</button>
          <button className={styles.menuButton}>삭제</button>
          <button className={styles.menuButton} onClick={handlerfunc25}>2.5D</button>
          <button
            className={styles.menuButton}
            onClick={handleDetailLoadingClick}
            title="구글에서 가게 디테일 정보 가져옴"
            disabled={isLoading}
          >
            {isLoading ? '로딩 중...' : '디테일 로딩'}
          </button>
          <button
            className={styles.menuButton}
            onClick={() => {
              if (curSectionName) {
                saveToFirebase(curSectionName, curLocalItemlist);
              } else {
                alert('저장할 섹션이 선택되지 않았습니다.');
              }
            }}
            title="현재 데이터를 서버에 저장"
            disabled={isLoading}
          >
            {isLoading ? '저장 중...' : '서버송신'}
          </button>
          <button
            className={styles.menuButton}
            onClick={saveSectionsToFirebase}
            title="모든 섹션 데이터를 서버에 저장"
            disabled={isLoading}
          >
            {isLoading ? '저장 중...' : '전체저장'}
          </button>
          <button 
            className={styles.menuButton}
            onClick={handleResetForm}
            title="폼 데이터 초기화"
          >
            초기화
          </button>
        </div>
        <div className={styles.card}>
          <h3>
            {selectedItemOfShopList ? selectedItemOfShopList.storeName : 'My Shops Data'}
            <button onClick={handleEditFoamCardButton} className={`${styles.menuButton} ${styles.disabledButton}`}>
              수정
            </button>
          </h3>
          <form className={styles.form}>
            <div className={styles.formRow}>
              <span>가게명</span> |
              <input type="text" name="storeName" ref={inputRefs.storeName} value={editNewShopDataSet.storeName} />
            </div>
            <div className={styles.formRow}>
              <span>별칭</span> |
              <input type="text" name="alias" ref={inputRefs.alias} value={editNewShopDataSet.alias} />
            </div>
            <div className={styles.formRow}>
              <span>코멘트</span> |
              <input 
                type="text" 
                name="comment" 
                ref={inputRefs.comment} 
                className={styles.commentInput} 
                
              />
              <button 
                onClick={(event) => handleCommentButtonClick(event)} 
                className={styles.inputOverlayButton}
              >
                수정
              </button>
            </div>
            <div className={styles.formRow}>
              <span>지역분류</span> |
              <input type="text" name="locationMap" ref={inputRefs.locationMap} value={editNewShopDataSet.locationMap} />
            </div>
            <div className={styles.formRow}>
              <span>영업시간</span> |
              <input type="text" name="businessHours" ref={inputRefs.businessHours} value={editNewShopDataSet.businessHours} />
            </div>
            <div className={styles.formRow}>
              <span>hot시간대</span> |
              <input type="text" name="hotHours" ref={inputRefs.hotHours} value={editNewShopDataSet.hotHours} />
            </div>
            <div className={styles.formRow}>
              <span>할인시간</span> |
              <input type="text" name="discountHours" ref={inputRefs.discountHours} value={editNewShopDataSet.discountHours} />
            </div>
            <div className={styles.formRow}>
              <span>거리</span> |
              <input type="text" name="distance" ref={inputRefs.distance} value={editNewShopDataSet.distance} />
            </div>
            <div className={styles.formRow}>
              <span>주소</span> |
              <input type="text" name="address" ref={inputRefs.address} value={editNewShopDataSet.address} />
            </div>
            <div className={styles.formRow}>
              <span>대표이미지</span> |
              <input type="text" name="mainImage" ref={inputRefs.mainImage} value={editNewShopDataSet.mainImage} />
            </div>
            <div className={styles.formRow}>
              <span>pin좌표</span> |
              <input type="text" name="pinCoordinates" ref={inputRefs.pinCoordinates} value={editNewShopDataSet.pinCoordinates} />
              <button onClick={(event) => handlePinCoordinatesButtonClick(event)} className={styles.inputOverlayButton}>
                수정
              </button>
            </div>
            <div className={styles.formRow}>
              <span>지적도 도형</span> |
              <input type="text" name="path" ref={inputRefs.path} value={editNewShopDataSet.path} readOnly />
              <button onClick={(event) => handlePathButtonClick(event)} className={styles.inputOverlayButton}>
                수정
              </button>
            </div>
            <div className={styles.formRow}>
              <span>분류아이콘</span> |
              <input type="text" name="categoryIcon" ref={inputRefs.categoryIcon} value={editNewShopDataSet.categoryIcon} />
            </div>
            <div className={styles.formRow}>
              <span>구글데이터ID</span> |
              <input type="text" name="googleDataId" ref={inputRefs.googleDataId} value={editNewShopDataSet.googleDataId} />
            </div>
            <div className={styles.photoGallery}>
              <div className={styles.mainImageContainer}>
                {editNewShopDataSet.mainImage ? (
                  <img 
                    src={editNewShopDataSet.mainImage} 
                    alt="메인 이미지" 
                    className={styles.mainImage} 
                  />
                ) : (
                  <div className={styles.emptyImage}>메인 이미지 없음</div>
                )}
              </div>
              <div className={styles.thumbnailsContainer}>
                {editNewShopDataSet.mainImages && editNewShopDataSet.mainImages.slice(1, 5).map((imageUrl, index) => (
                  <div key={index} className={styles.thumbnailItem}>
                    <img 
                      src={imageUrl} 
                      alt={`썸네일 ${index + 1}`} 
                      className={styles.thumbnail} 
                    />
                    {index === 3 && editNewShopDataSet.mainImages.length > 5 && (
                      <div className={styles.morePhotosIndicator}>
                        +{editNewShopDataSet.mainImages.length - 5}
                      </div>
                    )}
                  </div>
                ))}
                {/* 이미지가 부족한 경우 빈 썸네일 표시 */}
                {editNewShopDataSet.mainImages && Array.from({ length: Math.max(0, 4 - (editNewShopDataSet.mainImages.length - 1)) }).map((_, index) => (
                  <div key={`empty-${index}`} className={styles.emptyImage}>
                    이미지 없음
                  </div>
                ))}
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
      
      {/* 로딩 인디케이터 */}
      {isLoading && <LoadingIndicator />}
      
      {/* 에러 메시지 */}
      {errorMessage && (
        <ErrorMessage 
          message={errorMessage} 
          onClose={() => setErrorMessage(null)} 
        />
      )}
    </div>

  );
} 