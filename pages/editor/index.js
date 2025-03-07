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
    const _markerOptions = Object.assign({}, optionsMarker, { position: coordinates });
    const _marker = new window.google.maps.Marker(_markerOptions);

    const handleOverlayClick = () => {
      // InfoWindow 생성 및 설정
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div>
            <strong>아이템 리스트의 정보보</strong><br>
            타입: ${_marker.type}<br>
            <button id="customButton">내가 원하는 버튼</button>
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
            alert('버튼이 클릭되었습니다!');
          });
        }
      });
    };

    const handleOverlayMouseOver = () => {
      _marker.setIcon({ url: OVERLAY_ICON.MARKER_MOUSEOVER });
    }
    const handleOverlayMouseOut = () => {
      _marker.setIcon(optionsMarker.icon);
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



  // 데이터 정제를 위한 공통 유틸리티 함수
  const cleanItemForStorage = (item) => {
    // 깊은 복사를 통해 원본 객체 변경 방지
    const cleanItem = { ...item };
    
    // Google Maps 객체 제거
    delete cleanItem.marker;
    delete cleanItem.polygon;
    delete cleanItem.itemMarker;
    delete cleanItem.itemPolygon;
    
    // pinCoordinates가 객체인 경우 문자열로 변환
    if (typeof cleanItem.pinCoordinates === 'object') {
      cleanItem.pinCoordinates = `${cleanItem.pinCoordinates.lat}, ${cleanItem.pinCoordinates.lng}`;
    }
    
    // path 배열 내의 객체들도 처리
    if (Array.isArray(cleanItem.path)) {
      cleanItem.path = cleanItem.path.map(point => {
        if (typeof point.lat === 'function') {
          // Google LatLng 객체인 경우
          return { lat: point.lat(), lng: point.lng() };
        }
        return point; // 이미 { lat, lng } 형태인 경우
      });
    }
    
    return cleanItem;
  };

  // 아이템 리스트 정제 함수
  const cleanItemListForStorage = (itemList) => {
    return itemList.map(item => cleanItemForStorage(item));
  };

  // FB와 연동 
  const initShopList = async (_mapInstance) => {
    // 1) initShopList 함수에서 로컬저장소의 curSectionName에 해당되는 list를 sectionDB로 가져오기
    const loadFromLocalStorage = (sectionName) => {
      try {
        // localStorage에서 특정 섹션 데이터 가져오기
        const storedSectionData = localStorage.getItem(`section_${sectionName}`);
        
        if (storedSectionData) {
          const parsedSectionData = JSON.parse(storedSectionData);
          console.log(`localStorage에서 ${sectionName} 섹션 데이터 찾음:`, parsedSectionData);
          
          // sectionsDB에 현재 섹션 데이터 추가/업데이트
          const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
          if (sectionIndex !== -1) {
            sectionsDB[sectionIndex].list = parsedSectionData.list;
          } else {
            sectionsDB.push({ 
              name: sectionName, 
              list: parsedSectionData.list 
            });
          }
          
          return parsedSectionData.list;
        }
        return null; // 로컬에 데이터가 없는 경우
      } catch (error) {
        console.error('localStorage 로드 오류:', error);
        return null;
      }
    };

    // 로컬 저장소에 특정 섹션 데이터 저장
    const saveToLocalStorage = (sectionName, itemList) => {
      try {
        // 공통 함수 사용하여 데이터 정제
        const cleanItemList = cleanItemListForStorage(itemList);
        
        // 섹션 데이터 객체 생성
        const sectionData = {
          name: sectionName,
          list: cleanItemList,
          timestamp: Date.now()
        };
        
        // localStorage에 저장
        localStorage.setItem(`section_${sectionName}`, JSON.stringify(sectionData));
        localStorage.setItem(`${sectionName}_timestamp`, sectionData.timestamp.toString());
        
        // sectionsDB 업데이트 - 명시적으로 sectionsDB 업데이트
        const sectionIndex = sectionsDB.findIndex(section => section.name === sectionName);
        if (sectionIndex !== -1) {
          sectionsDB[sectionIndex].list = itemList;
        } else {
          sectionsDB.push({ name: sectionName, list: itemList });
        }
        
        console.log(`${sectionName} 데이터를 localStorage에 저장함 및 sectionsDB 업데이트 완료`);
      } catch (error) {
        console.error('localStorage 저장 오류:', error);
      }
    };
    
    // 서버에서 특정 섹션 데이터 가져와 로컬 및 sectionsDB 업데이트
    const updateLocalFromServer = async (sectionName) => {
      try {
        // Firebase에서 현재 섹션 데이터 가져오기
        const sectionRef = doc(firebasedb, "sections", sectionName);
        const docSnap = await getDoc(sectionRef);
        
        if (docSnap.exists()) {
          const serverData = docSnap.data();
          const serverTimestamp = serverData.lastUpdated?.toMillis() || 0;
          const localTimestamp = parseInt(localStorage.getItem(`${sectionName}_timestamp`) || '0');
          
          if (serverTimestamp > localTimestamp) {
            // 서버 데이터가 더 최신인 경우에만 로컬 데이터 업데이트
            console.log(`Firebase의 ${sectionName} 데이터가 더 최신임. 로컬 데이터 업데이트`);
            
            // 로컬 저장소 업데이트
            saveToLocalStorage(sectionName, serverData.itemList);
            
            // sectionsDB 업데이트 (saveToLocalStorage 내에서 이미 처리됨)
            console.log(`sectionsDB의 ${sectionName} 데이터도 업데이트됨`);
            
            return {
              updated: true,
              itemList: serverData.itemList
            };
          } else {
            // 로컬 데이터가 더 최신이거나 같은 경우 - 아무 작업 안함
            console.log(`로컬의 ${sectionName} 데이터가 더 최신이거나 같음. 자동 업데이트 안함`);
            return {
              updated: false,
              itemList: null
            };
          }
        } else {
          // 서버에 데이터가 없는 경우 - 아무 작업 안함
          console.log(`Firebase에 ${sectionName} 데이터가 없음. 자동 업데이트 안함`);
          return {
            updated: false,
            itemList: null
          };
        }
      } catch (error) {
        console.error(`${sectionName} 섹션 서버 데이터 가져오기 오류:`, error);
        return {
          updated: false,
          itemList: null,
          error
        };
      }
    };
    
    // 1) 로컬 저장소에서 데이터 가져오기
    let localItemList = loadFromLocalStorage(curSectionName);
    
    if (localItemList) {
      // 로컬 저장소에 데이터가 있는 경우
      console.log(`로컬 저장소에서 ${curSectionName} 데이터를 가져옴`);
      
      // 2) 서버와 동기화 확인 (서버 → 로컬 방향으로만)
      try {
        const updateResult = await updateLocalFromServer(curSectionName);
        
        if (updateResult.updated) {
          // 서버에서 업데이트된 경우 새 데이터 사용
          localItemList = updateResult.itemList;
        }
      } catch (error) {
        console.error('Firebase 동기화 확인 오류:', error);
      }
    } else {
      // 3) 로컬 저장소에 데이터가 없는 경우 Firebase에서 가져오기
      console.log(`로컬 저장소에 ${curSectionName} 데이터가 없음. Firebase에서 가져오기 시도`);
      
      try {
        // Firebase에서 현재 섹션 데이터 가져오기
        const sectionRef = doc(firebasedb, "sections", curSectionName);
        const docSnap = await getDoc(sectionRef);
        
        if (docSnap.exists()) {
          // Firebase에 데이터가 있는 경우
          const serverData = docSnap.data();
          localItemList = serverData.itemList;
          console.log(`Firebase에서 ${curSectionName} 섹션 데이터 찾음`);
          
          // 로컬 저장소에 저장 (sectionsDB도 함께 업데이트)
          saveToLocalStorage(curSectionName, localItemList);
          
          // 타임스탬프 저장
          if (serverData.lastUpdated) {
            localStorage.setItem(`${curSectionName}_timestamp`, serverData.lastUpdated.toMillis().toString());
          }
        } else {
          // Firebase에도 데이터가 없는 경우 빈 데이터 생성
          console.log(`Firebase에 ${curSectionName} 섹션 데이터가 없음. 빈 데이터 생성`);
          localItemList = [];
          
          // 로컬 저장소에 빈 데이터 저장 (sectionsDB도 함께 업데이트)
          saveToLocalStorage(curSectionName, localItemList);
        }
      } catch (error) {
        console.error('Firebase 데이터 가져오기 오류:', error);
        // 오류 발생 시 빈 데이터 생성
        localItemList = [];
        saveToLocalStorage(curSectionName, localItemList);
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

      // 현재 섹션 설정 - sectionsDB에서 최신 데이터 사용
      const _temp = sectionsDB.find(section => section.name === curSectionName);
      setCurLocalItemlist(_temp ? _temp.list : []);
    }
  };

  // 로컬 데이터를 서버로 명시적으로 업데이트하는 함수
  const updateServerFromLocal = async (sectionName, itemList) => {
    return asyncHandler(async () => {
      // 공통 함수 사용하여 데이터 정제
      const cleanItemList = cleanItemListForStorage(itemList);
      
      // 섹션 문서 참조
      const sectionRef = doc(firebasedb, "sections", sectionName);
      
      // Firebase에 저장
      await setDoc(sectionRef, {
        itemList: cleanItemList,
        lastUpdated: firestoreTimestamp()
      });
      
      // 로컬 타임스탬프 업데이트
      const serverTimestamp = Date.now();
      localStorage.setItem(`${sectionName}_timestamp`, serverTimestamp.toString());
      
      console.log(`${sectionName} 데이터를 Firebase에 업데이트함`);
      return true;
    }, `${sectionName} 데이터가 서버에 성공적으로 업데이트되었습니다.`);
  };

  // 데이터 변경 시 Firebase에 저장하는 함수 수정 (명시적 호출용)
  const saveToFirestore = async (sectionName, itemList) => {
    return updateServerFromLocal(sectionName, itemList);
  };

  // sectionsDB를 Firebase에 저장하는 함수 개선 (명시적 호출용)
  const saveSectionsToFirebase = async () => {
    return asyncHandler(async () => {
      // 각 섹션을 Firebase에 저장
      for (const section of sectionsDB) {
        await updateServerFromLocal(section.name, section.list);
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

  useEffect(() => {
    const itemListContainer = document.querySelector(`.${styles.itemList}`);
    if (!itemListContainer) {
      console.error('Item list container not found');
      return;
    }

    // 기존 아이템 제거
    itemListContainer.innerHTML = '';

    // curLocalItemlist의 아이템을 순회하여 사이드바에 추가
    curLocalItemlist.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.className = styles.item;

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
      itemImage.src = "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDF8fGZvb2R8ZW58MHx8fHwxNjE5MjY0NzYx&ixlib=rb-1.2.1&q=80&w=400";
      itemImage.alt = `${item.storeName} ${item.storeStyle}`;
      itemImage.className = styles.itemImage;
      itemImage.width = 100;
      itemImage.height = 100;

      // 아이템 클릭 시 해당 마커로 이동
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (item.marker && instMap.current) {
          instMap.current.setCenter(item.marker.getPosition());
          instMap.current.setZoom(18); // 필요에 따라 줌 레벨 조정
        }
      });

      itemDetails.appendChild(itemTitle);
      itemDetails.appendChild(businessHours);
      itemDetails.appendChild(address);
      link.appendChild(itemDetails);
      link.appendChild(itemImage);
      listItem.appendChild(link);
      itemListContainer.appendChild(listItem);
    });
  }, [curLocalItemlist]);

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
                saveToFirestore(curSectionName, curLocalItemlist);
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
        </div>
        <div className={styles.card}>
          <h3>My Shops Data
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