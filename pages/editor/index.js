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

  // 로컬 저장소에서 데이터 로드
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
            // 이미 serverDataset 구조인지 확인
            if (item.serverDataset) {
              return {
                ...protoShopDataSet,
                serverDataset: { ...item.serverDataset },
                distance: item.distance || "",
                itemMarker: null,
                itemPolygon: null
              };
            } else {
              // 기존 아이템을 serverDataset 구조로 변환
              return {
                ...protoShopDataSet,
                serverDataset: {
                  ...protoServerDataset,
                  ...item // 기존 속성들을 serverDataset으로 복사
                },
                distance: item.distance || "",
                itemMarker: null,
                itemPolygon: null
              };
            }
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
          // serverDataset만 저장하도록 변경
          if (item.serverDataset) {
            // serverDataset 구조를 가진 경우
            return {
              ...item.serverDataset,
              distance: item.distance || ""
            };
          } else {
            // 기존 구조인 경우 (호환성 유지)
            const cleanItem = { ...item };
            delete cleanItem.marker;
            delete cleanItem.polygon;
            delete cleanItem.itemMarker;
            delete cleanItem.itemPolygon;
            return cleanItem;
          }
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

  const protoServerDataset = {
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
  }

  const protoShopDataSet = {
    serverDataset: {...protoServerDataset}, // 깊은 복사를 통해 참조 문제 방지
    distance: "",
    itemMarker: null,
    itemPolygon: null,
    comment: "", // comment 필드 추가
    // 모든 입력 필드에 대한 초기값 설정
    storeName: "",
    storeStyle: "",
    alias: "",
    businessHours: [],
    hotHours: "",
    discountHours: "",
    address: "",
    mainImage: "",
    mainImages: [],
    subImages: [],
    pinCoordinates: "",
    categoryIcon: "",
    googleDataId: "",
    path: [],
    locationMap: "",
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


  const handleDetailLoadingClick = () => {
    const placeId = editNewShopDataSet.googleDataId;

    if (!placeId) {
      alert('구글 데이터 ID를 입력해주세요.');
      return;
    }

    if (!window.google || !window.google.maps || !window.google.maps.places) {
      alert('Google Maps API가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      const service = new window.google.maps.places.PlacesService(instMap.current);
      service.getDetails({ placeId }, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          console.log('Google Place 상세 정보:', result);
          const _updates = {};

          if (result.opening_hours) {
            // 영업시간 정보를 상태에 설정
            _updates.businessHours = result.opening_hours.weekday_text;
          } else {
            console.log('No opening hours information available.');
          }

          // 위경도 정보를 상태에 설정
          if (result.geometry && result.geometry.location) {
            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            _updates.pinCoordinates = `${lat}, ${lng}`;
          } else {
            console.log('No location information available.');
          }

          // 사진 정보를 상태에 설정
          if (result.photos && result.photos.length > 0) {
            // 최대 10장의 사진 URL을 배열로 저장
            const photoUrls = result.photos.slice(0, 10).map(photo => 
              photo.getUrl({ maxWidth: 400, maxHeight: 400 })
            );
            _updates.subImages = photoUrls; // Google Place API에서 가져온 이미지는 subImages에 저장
            
            // mainImage가 없는 경우에만 첫 번째 사진을 메인 이미지로 설정
            if (!editNewShopDataSet.mainImage) {
              _updates.mainImage = photoUrls[0];
            }
          } else {
            console.log('No photos available.');
          }

          // 주소 정보 설정
          if (result.formatted_address) {
            _updates.address = result.formatted_address;
          }

          // 가게 이름 설정
          if (result.name) {
            _updates.storeName = result.name;
          }

          // 가게 유형 설정
          if (result.types && result.types.length > 0) {
            _updates.storeStyle = result.types[0];
          }

          // Place ID 저장 (이미 입력된 ID와 동일하지만 일관성을 위해 저장)
          _updates.googleDataId = result.place_id;

          // 여기서 데이터셋 한번에 업데이트
          updateDataSet(_updates);
          alert('Google Place 정보를 성공적으로 가져왔습니다.');
        } else {
          console.error('Failed to get place details:', status);
          alert(`Place 정보를 가져오는데 실패했습니다: ${status}`);
        }
      });
    } catch (error) {
      console.error('Google Place API 호출 중 오류 발생:', error);
      alert('Google Place API 호출 중 오류가 발생했습니다.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    updateDataSet({ [name]: value });
  };

  const updateDataSet = (updates) => {
    // undefined 값을 빈 문자열로 변환
    const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      // 배열인 경우 빈 배열로, undefined/null인 경우 빈 문자열로 변환
      acc[key] = Array.isArray(value) ? (value || []) : (value === undefined || value === null ? "" : value);
      return acc;
    }, {});

    setEditNewShopDataSet((prev) => ({
      ...prev,
      ...sanitizedUpdates,
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
    
    // 마커를 지도에 표시
    _marker.setMap(mapInst);

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
    
    // 폴리곤을 지도에 표시
    _polygon.setMap(mapInst);

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



  // Firebase와 데이터 동기화 함수 수정
  const syncWithFirestore = async (sectionName, itemList) => {
    try {
      // Firestore에 저장 가능한 형태로 데이터 변환
      const cleanItemList = itemList.map(item => {
        // serverDataset 구조를 가진 경우
        if (item.serverDataset) {
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
        } else {
          // 기존 구조인 경우 (호환성 유지)
          const cleanItem = { ...item };
          
          // Google Maps 객체 제거
          delete cleanItem.marker;
          delete cleanItem.polygon;
          delete cleanItem.itemMarker;
          delete cleanItem.itemPolygon;
          
          // pinCoordinates가 객체인 경우 문자열로 변환
          if (cleanItem.pinCoordinates) {
            cleanItem.pinCoordinates = stringifyCoordinates(cleanItem.pinCoordinates);
          }
          
          // path 배열 내의 객체들도 처리
          if (Array.isArray(cleanItem.path)) {
            cleanItem.path = cleanItem.path.map(point => {
              return parseCoordinates(point) || point;
            });
          }
          
          return cleanItem;
        }
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

  // FB와 연동 
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
      localItemList.forEach(shopItem => {
        // 마커 생성
        if (shopItem.pinCoordinates) {
          const coordinates = parseCoordinates(shopItem.pinCoordinates);
          if (coordinates) {
            const marker = factoryMakers(coordinates, _mapInstance, shopItem);
            shopItem.itemMarker = marker;
            presentMakers.push(marker);
          }
        }
        
        // 폴리곤 생성
        if (shopItem.path && shopItem.path.length > 0) {
          const polygon = factoryPolygon(shopItem.path, _mapInstance, shopItem);
          shopItem.itemPolygon = polygon;
        }
      });
    }
    
    // 현재 아이템 리스트 업데이트
    setCurLocalItemlist(localItemList);
    sectionsDB.current.set(curSectionName, localItemList);
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

  // curSectionName이 변경될 때 데이터 로드
  useEffect(() => {
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
  const [selectedCurShop, setSelectedCurShop] = useState(null);

  // selectedCurShop이 변경될 때마다 실행
  useEffect(() => {
    if (selectedCurShop) {
            
      // 선택된 상점 정보로 폼 데이터 업데이트
      if (selectedCurShop.serverDataset) {
        // serverDataset 구조를 가진 경우
        const serverDataset = { ...selectedCurShop.serverDataset };
        
        // 서버 데이터는 이미 적절한 형식이므로 그대로 사용
        // 하지만 serverDataset 외부에 있는 필드도 업데이트해야 함
        const updates = {
          ...serverDataset,
          distance: selectedCurShop.distance || '',
          comment: selectedCurShop.comment || '',
        };
        
        updateDataSet(updates);
      } else {
        // 기존 구조인 경우
        const updates = {
          storeName: selectedCurShop.storeName || '',
          storeStyle: selectedCurShop.storeStyle || '',
          alias: selectedCurShop.alias || '',
          businessHours: selectedCurShop.businessHours || [],
          hotHours: selectedCurShop.hotHours || '',
          discountHours: selectedCurShop.discountHours || '',
          distance: selectedCurShop.distance || '',
          address: selectedCurShop.address || '',
          mainImage: selectedCurShop.mainImage || '',
          mainImages: selectedCurShop.mainImages || [],
          subImages: selectedCurShop.subImages || [],
          path: selectedCurShop.path || [],
          googleDataId: selectedCurShop.googleDataId || '',
          categoryIcon: selectedCurShop.categoryIcon || '',
          locationMap: selectedCurShop.locationMap || '',
          comment: selectedCurShop.comment || '',
        };
        
        // pinCoordinates 처리
        if (selectedCurShop.pinCoordinates) {
          updates.pinCoordinates = stringifyCoordinates(selectedCurShop.pinCoordinates);
        }
        
        updateDataSet(updates);
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
    
    if (editNewShopDataSet.comment && editNewShopDataSet.comment.trim() !== '') {
      // 별칭 필드 업데이트
      updateDataSet({ 
        alias: editNewShopDataSet.comment || '',
        comment: '' // 코멘트 필드 초기화
      });
    } else {
      // 코멘트 입력 필드가 비어있으면 별칭 값을 코멘트 입력 필드에 복사
      updateDataSet({ 
        comment: editNewShopDataSet.alias || '' 
      });
      // 포커스 설정
      if (inputRefs.comment.current) {
        inputRefs.comment.current.focus();
      }
    }
  };

  // 데이터 변경 시 Firebase에 저장하는 함수 수정
  const saveToFirestore = async (sectionName, itemList) => {
    try {
      // Firestore에 저장 가능한 형태로 데이터 변환
      const cleanItemList = itemList.map(item => {
        // serverDataset 구조를 가진 경우
        if (item.serverDataset) {
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
        } else {
          // 기존 구조인 경우 (호환성 유지)
          const cleanItem = { ...item };
          
          // Google Maps 객체 제거
          delete cleanItem.marker;
          delete cleanItem.polygon;
          delete cleanItem.itemMarker;
          delete cleanItem.itemPolygon;
          
          // pinCoordinates가 객체인 경우 문자열로 변환
          if (cleanItem.pinCoordinates) {
            cleanItem.pinCoordinates = stringifyCoordinates(cleanItem.pinCoordinates);
          }
          
          // path 배열 내의 객체들도 처리
          if (Array.isArray(cleanItem.path)) {
            cleanItem.path = cleanItem.path.map(point => {
              return parseCoordinates(point) || point;
            });
          }
          
          return cleanItem;
        }
      });
      
      const sectionRef = doc(firebasedb, "sections", sectionName);
      await setDoc(sectionRef, {
        itemList: cleanItemList,
        lastUpdated: firestoreTimestamp()
      });
      
      localStorage.setItem(`${sectionName}_timestamp`, Date.now().toString());
      console.log(`${sectionName} 데이터를 Firebase에 저장함`);
    } catch (error) {
      console.error("Firebase 저장 오류:", error);
    }
  };

  // Firebase에서 섹션 데이터 가져오기
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
        
        // 서버 데이터를 serverDataset 속성에 저장하도록 변환
        const transformedItemList = itemList.map(item => {
          // 기존 아이템이 serverDataset 구조를 가지고 있는지 확인
          if (item.serverDataset) {
            return {
              ...protoShopDataSet,
              serverDataset: { ...item.serverDataset },
              distance: item.distance || "",
              itemMarker: null,
              itemPolygon: null
            };
          } else {
            // 기존 아이템을 serverDataset 구조로 변환
            return {
              ...protoShopDataSet,
              serverDataset: {
                ...protoServerDataset,
                ...item // 기존 속성들을 serverDataset으로 복사
              },
              distance: item.distance || "",
              itemMarker: null,
              itemPolygon: null
            };
          }
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
        setCurLocalItemlist(emptyList);
        
        return [];
      }
    } catch (error) {
      console.error('Firebase 데이터 가져오기 오류:', error);
      return [];
    }
  };

  // sectionsDB를 Firebase에 저장하는 함수
  const saveSectionsToFirebase = async () => {
    try {
      // 각 섹션을 Firebase에 저장
      for (const [sectionName, itemList] of sectionsDB.current) {
        // Firestore에 저장 가능한 형태로 데이터 변환
        const cleanItemList = itemList.map(item => {
          // 깊은 복사를 통해 원본 객체 변경 방지
          const cleanItem = { ...item };
          
          // Google Maps 객체 제거
          delete cleanItem.marker;
          delete cleanItem.polygon;
          delete cleanItem.itemMarker;
          delete cleanItem.itemPolygon;
          
          // pinCoordinates가 객체인 경우 문자열로 변환
          if (cleanItem.pinCoordinates) {
            cleanItem.pinCoordinates = stringifyCoordinates(cleanItem.pinCoordinates);
          }
          
          // path 배열 내의 객체들도 처리
          if (Array.isArray(cleanItem.path)) {
            cleanItem.path = cleanItem.path.map(point => {
              return parseCoordinates(point) || point;
            });
          }
          
          return cleanItem;
        });
        
        // 섹션 문서 참조
        const sectionRef = doc(firebasedb, "sections", sectionName);
        
        // Firebase에 저장
        await setDoc(sectionRef, {
          itemList: cleanItemList,
          lastUpdated: firestoreTimestamp()
        });
        
        console.log(`${sectionName} 섹션을 Firebase에 저장함`);
      }
      
      alert('모든 섹션 데이터가 서버에 저장되었습니다.');
    } catch (error) {
      console.error("Firebase sections 데이터 저장 오류:", error);
      alert('데이터 저장 중 오류가 발생했습니다.');
    }
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
          >
            디테일 로딩
          </button>
          <button
            className={styles.menuButton}
            onClick={() => console.log(editNewShopDataSet)}
          >
            체크1
          </button>
          <button
            className={styles.menuButton}
            onClick={() => {
              if (curSectionName) {
                saveToFirestore(curSectionName, getCurLocalItemlist());
                alert('서버에 데이터가 저장되었습니다.');
              } else {
                alert('저장할 섹션이 선택되지 않았습니다.');
              }
            }}
            title="현재 데이터를 서버에 저장"
          >
            서버송신
          </button>
          <button
            className={styles.menuButton}
            onClick={saveSectionsToFirebase}
            title="모든 섹션 데이터를 서버에 저장"
          >
            전체저장
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
              <input type="text" name="storeName" ref={inputRefs.storeName} value={editNewShopDataSet.storeName} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>별칭</span> |
              <input type="text" name="alias" ref={inputRefs.alias} value={editNewShopDataSet.alias} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>코멘트</span> |
              <input 
                type="text" 
                name="comment" 
                ref={inputRefs.comment} 
                className={styles.commentInput} 
                value={editNewShopDataSet.comment}
                onChange={handleInputChange}
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
              <input type="text" name="locationMap" ref={inputRefs.locationMap} value={editNewShopDataSet.locationMap} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>영업시간</span> |
              <input type="text" name="businessHours" ref={inputRefs.businessHours} value={editNewShopDataSet.businessHours} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>hot시간대</span> |
              <input type="text" name="hotHours" ref={inputRefs.hotHours} value={editNewShopDataSet.hotHours} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>할인시간</span> |
              <input type="text" name="discountHours" ref={inputRefs.discountHours} value={editNewShopDataSet.discountHours} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>거리</span> |
              <input type="text" name="distance" ref={inputRefs.distance} value={editNewShopDataSet.distance} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>주소</span> |
              <input type="text" name="address" ref={inputRefs.address} value={editNewShopDataSet.address} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>대표이미지</span> |
              <input type="text" name="mainImage" ref={inputRefs.mainImage} value={editNewShopDataSet.mainImage} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>pin좌표</span> |
              <input type="text" name="pinCoordinates" ref={inputRefs.pinCoordinates} value={editNewShopDataSet.pinCoordinates} onChange={handleInputChange} />
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
              <input type="text" name="categoryIcon" ref={inputRefs.categoryIcon} value={editNewShopDataSet.categoryIcon} onChange={handleInputChange} />
            </div>
            <div className={styles.formRow}>
              <span>구글데이터ID</span> |
              <input type="text" name="googleDataId" ref={inputRefs.googleDataId} value={editNewShopDataSet.googleDataId} onChange={handleInputChange} />
              <button onClick={handleDetailLoadingClick} className={styles.inputOverlayButton}>
                디테일 로딩
              </button>
            </div>
            <div className={styles.photoGallery}>
              {/* 메인 이미지 (좌측) */}
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
              
              {/* 서브 이미지 4분할 (우측) */}
              <div className={styles.subImagesGrid}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`sub-${index}`} className={styles.subImageItem}>
                    {editNewShopDataSet.subImages && index < editNewShopDataSet.subImages.length ? (
                      <img 
                        src={editNewShopDataSet.subImages[index]} 
                        alt={`서브 이미지 ${index + 1}`} 
                        className={styles.subImage} 
                      />
                    ) : (
                      <div className={styles.emptySubImage}></div>
                    )}
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
    </div>

  );
} 