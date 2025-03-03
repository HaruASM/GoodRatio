import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from './styles.module.css'; 

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;
const OVERLAY_COLOR = {
  IDLE : '#FF0000', // 빨간색
  MOUSEOVER : '#00FF00', // 초록색
};
const OVERLAY_ICON = {
  MARKER_MOUSEOVER : "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // 파란색
  MARKER : "http://maps.google.com/mapfiles/ms/icons/green-dot.png", // 초록색
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
  
  

  let sectionsDB = [];
  let curLocalItemlist = [];
  let curSectionName  = "지역명";
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
    locationMap: useRef(null),
    businessHours: useRef(null),
    hotHours: useRef(null),
    discountHours: useRef(null),
    distance: useRef(null),
    address: useRef(null),
    mainImage: useRef(null),
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

    if (placeId) {
      const service = new window.google.maps.places.PlacesService(instMap.current);
      service.getDetails({ placeId }, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          if (result.opening_hours) {
            // 영업시간 정보를 상태에 설정
            updateDataSet('businessHours', result.opening_hours.weekday_text);
          } else {
            console.log('No opening hours information available.');
          }

          // 위경도 정보를 상태에 설정
          if (result.geometry && result.geometry.location) {
            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            updateDataSet('pinCoordinates', `${lat}, ${lng}`);
          } else {
            console.log('No location information available.');
          }
        } else {
          console.error('Failed to get place details:', status);
        }
      });
    } else {
      console.error('Place ID is not available.');
    }
  };

  // const updateDataSet = (field, value) => {
  //   setEditNewShopDataSet((prev) => ({
  //     ...prev,
  //     [field]: value,
  //   }));
  // };

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
        _drawingManager.setOptions({          drawingControl: true,        });
        _drawingManager.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);

        // 다각형 이벤츠 처리부 
        window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', (eventObjOverlay)=>{
          
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

  

    } else  console.error('드로잉 매니저 생성 안됨')
    
  }; 


  let optionsMarker, optionsPolygon;
  
  const setProtoOverlays = (  ) => {
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


  const factoryMakers = ( coordinates, mapInst, shopItem ) => {
    const _markerOptions = Object.assign({}, optionsMarker, {  position: coordinates });
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
       _marker.setIcon({          url: OVERLAY_ICON.MARKER_MOUSEOVER       });
    }
    const handleOverlayMouseOut = () => {
        _marker.setIcon(  optionsMarker.icon );
    }

    // 오버레이에 이벤트 바인딩 
    window.google.maps.event.addListener(_marker, 'click', handleOverlayClick);
    window.google.maps.event.addListener(_marker, 'mouseover', handleOverlayMouseOver);
    window.google.maps.event.addListener(_marker, 'mouseout', handleOverlayMouseOut);
    
    return _marker;
  }


  const factoryPolygon = ( paths, mapInst, shopItem ) => {
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
         _polygon.setOptions({ fillColor: OVERLAY_COLOR.MOUSEOVER,});
      } //handleOverlayMouseOver

      const handleOverlayMouseOut = () => {
          _polygon.setOptions({ fillColor: OVERLAY_COLOR.IDLE,});
      } //handleOverlayMouseOut
      
    // 오버레이에 이벤트 바인딩 
    window.google.maps.event.addListener(_polygon, 'click', handleOverlayClick);
    window.google.maps.event.addListener(_polygon, 'mouseover', handleOverlayMouseOver);
    window.google.maps.event.addListener(_polygon, 'mouseout', handleOverlayMouseOut);
    return _polygon;
  }



  // FB와 연동 
  const initShopList = (_mapInstance) => {
    
    sectionsDB = [ {name:'Clark', list: []}, {name:'Cebu', list: []}];

    // FB 세팅 
    // 섹션 세팅
    // 데이터 수신 완료시 호출한 cb에 처리하는 부분
    const _localItemlist = [];
    const _newShopData = Object.assign({}, protoShopDataSet);
    _newShopData.address = "대한민국 대구광역시 중구 중앙대로66길 20 효성해링턴플레이스 상가 1층";
    _newShopData.storeName = "남산에";
    _newShopData.storeStyle = "일식당";
    _newShopData.businessHours = ['월요일: 오전 12:00~8:00', '화요일: 오전 11:30 ~ 오후 3:00, 오후 5:00~9:00', '수요일: 오전 11:30 ~ 오후 3:00, 오후 5:00~9:00', '목요일: 오전 11:30 ~ 오후 3:00, 오후 5:00~9:00', '금요일: 오전 11:30 ~ 오후 3:00, 오후 5:00~9:00', '토요일: 오후 12:00~4:00, 오후 5:00 ~ 오전 12:00', '일요일: 오전 12:00~8:00, 오후 12:00~4:00, 오후 5:00 ~ 오전 12:00'];
    _newShopData.googleDataId = "ChIJtWSlZ4rjZTUR7qRzJJ3jSnA";
    _newShopData.pinCoordinates = { lat: 35.8611117, lng: 128.5941372 };
    _newShopData.path = [
      { lat: 35.86099311405982, lng: 128.593923871688 },
      { lat: 35.861147451666795, lng: 128.59399092691336 },
      { lat: 35.86122353347513, lng: 128.59420013921653 },
      { lat: 35.86108223863008, lng: 128.59428060548697 },
      { lat: 35.86089094674624, lng: 128.59418404596244 }
    ];
    _localItemlist.push(_newShopData);

    const _newShopData2 = Object.assign({}, protoShopDataSet);
    _newShopData2.address = "대한민국 대구광역시 중구 중앙대로66길";
    _newShopData2.storeName = "탑마트 대구점";
    _newShopData2.googleDataId = "ChIJwQyzSL_jZTURceWdkWAOOJo";
    _newShopData2.pinCoordinates = {lat: 35.86125608523786, lng: 128.59337340622102};
    _localItemlist.push(_newShopData2);


    // 해당 site의 아이템리스트 수신 후 
    // ittem list 객체에 마커 객체를 생성
    // 팩토리 패턴
    _localItemlist.forEach((item) => {
      if (item.pinCoordinates) {
          item.marker = factoryMakers(item.pinCoordinates, _mapInstance, item);
          item.marker.setTitle(item.storeName);
          presentMakers.push(item.marker);
      }
      
      if (item.path) {
          item.polygon = factoryPolygon(item.path, _mapInstance, item);
          presentMakers.push(item.polygon);
      }
    });
  
     //임시 테스트용 객체 도형 생성부
     presentMakers.forEach((item) => {
      item.setMap(_mapInstance);
     });

    
    sectionsDB.push({name:'반월당', list: _localItemlist});
    curLocalItemlist = _localItemlist;
    curSectionName = '반월당';
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
  const initDrawingManager = ( _mapInstance ) => { // 
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
    window.google.maps.event.addListener(_drawingManager, 'overlaycomplete', (eventObj)=>{
      
      // const handleOverlayClick = () => {
      //   // console.log('오버레이가 클릭 ', eventObj.type );

      //   // InfoWindow 생성 및 설정
      //   const infoWindow = new window.google.maps.InfoWindow({
      //     content: `
      //       <div>
      //         <strong>오버레이 정보</strong><br>
      //         타입: ${eventObj.type}<br>
      //         <button id="customButton">내가 원하는 버튼</button>
      //       </div>
      //     `,
      //   });

      //   // InfoWindow를 오버레이의 위치에 표시
      //   if (eventObj.type === 'marker') {
      //     infoWindow.open(instMap.current, eventObj.overlay);
      //   } else if (eventObj.type === 'polygon') {
      //     // 폴리곤 타입의 오버레이인 경우
      //     const path = eventObj.overlay.getPath(); // 폴리곤의 경로를 가져옴
      //     const bounds = new window.google.maps.LatLngBounds(); // 경계 객체 생성
      //     path.forEach((point) => bounds.extend(point)); // 경로의 각 점을 경계에 추가
      //     infoWindow.setPosition(bounds.getCenter()); // 경계의 중심에 InfoWindow 위치 설정
      //     infoWindow.open(instMap.current, eventObj.overlay); // InfoWindow를 지도에 표시
      //   }

      //   // 버튼 클릭 이벤트 리스너 추가
      //   window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
      //     const customButton = document.getElementById('customButton');
      //     if (customButton) {
      //       customButton.addEventListener('click', () => {
      //         alert('버튼이 클릭되었습니다!');
      //       });
      //     }
      //   });
      // };
     
      // const handleOverlayMouseOver = () => {
      
      //   if (eventObj.type === 'polygon') {
      //     eventObj.overlay.setOptions({
      //       fillColor: OVERLAY_COLOR.MOUSEOVER, // 초록색
      //     });
      //   } else if (eventObj.type === 'marker') {
      //     eventObj.overlay.setIcon({
      //       url: OVERLAY_ICON.MARKER_MOUSEOVER // 파란색
      //     });
      //   }
      // }
      // const handleOverlayMouseOut = () => {
      //   if (eventObj.type === 'polygon') {
      //     eventObj.overlay.setOptions({
      //       fillColor: OVERLAY_COLOR.IDLE, // 초록색
      //     });
      //   } else if (eventObj.type === 'marker') {
      //     eventObj.overlay.setIcon({
      //       url: OVERLAY_ICON.MARKER, // 파란색
      //     });
      //   }
      // }

      // // 오버레이에 이벤트 바인딩 
      // window.google.maps.event.addListener(eventObj.overlay, 'click', handleOverlayClick);
      // window.google.maps.event.addListener(eventObj.overlay, 'mouseover', handleOverlayMouseOver);
      // window.google.maps.event.addListener(eventObj.overlay, 'mouseout', handleOverlayMouseOut);

      
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
      mapTypeControl : false,
    });
    //-- g맵 인스턴스 생성 끝끝
    
    // g맵용 로드 완료시 동작 
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', ()=>{ 
       
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
            if (window.google.maps.Map ) { // window.google.maps.Marker도 체크 해줘야 하나.. 
              initGoogleMapPage();
              clearInterval(_intervalId);            
            } else {
              if (_cnt++ > 10) {           clearInterval(_intervalId);           console.error('구글맵 로딩 오류');        }
              console.log('구글맵 로딩 중', _cnt);
            }
            
            
          }, 100);
        } else {
          if (_cnt++ > 10) {           clearInterval(_intervalId);           console.error('구글서비스 로딩 오류');        }
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

    //return () => clearInterval(intervalId); // 컴포넌트 언마운트시
  //}, []);     

 

  return (
    <div className={styles.container}>
      <Head>
        <title>Editor</title>
      </Head>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <button className={styles.backButton}>←</button>
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
              <input type="text" name="storeName" ref={inputRefs.storeName} value={editNewShopDataSet.storeName}    />
            </div>
            <div className={styles.formRow}>
              <span>별칭</span> | 
              <input type="text" name="alias" ref={inputRefs.alias} value={editNewShopDataSet.alias} />
            </div>
            <div className={styles.formRow}>
              <span>지역분류</span> | 
              <input type="text" name="locationMap" ref={inputRefs.locationMap} value={editNewShopDataSet.locationMap} />
            </div>
            <div className={styles.formRow}>
              <span>영업시간</span> | 
              <input type="text" name="businessHours" ref={inputRefs.businessHours} value={editNewShopDataSet.businessHours}  />
            </div>
            <div className={styles.formRow}>
              <span>hot시간대</span> | 
              <input type="text" name="hotHours" ref={inputRefs.hotHours} value={editNewShopDataSet.hotHours}  />
            </div>
            <div className={styles.formRow}>
              <span>할인시간</span> | 
              <input type="text" name="discountHours" ref={inputRefs.discountHours} value={editNewShopDataSet.discountHours}  />
            </div>
            <div className={styles.formRow}>
              <span>거리</span> | 
              <input type="text" name="distance" ref={inputRefs.distance} value={editNewShopDataSet.distance}  />
            </div>
            <div className={styles.formRow}>
              <span>주소</span> | 
              <input type="text" name="address" ref={inputRefs.address} value={editNewShopDataSet.address}  />
            </div>
            <div className={styles.formRow}>
              <span>대표이미지</span> | 
              <input type="text" name="mainImage" ref={inputRefs.mainImage} value={editNewShopDataSet.mainImage}  />
            </div>
            <div className={styles.formRow}>
              <span>pin좌표</span> | 
              <input type="text" name="pinCoordinates" ref={inputRefs.pinCoordinates} value={editNewShopDataSet.pinCoordinates}  />
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
              <input type="text" name="categoryIcon" ref={inputRefs.categoryIcon} value={editNewShopDataSet.categoryIcon}  />
            </div>
            <div className={styles.formRow}>
              <span>구글데이터ID</span> | 
              <input type="text" name="googleDataId" ref={inputRefs.googleDataId} value={editNewShopDataSet.googleDataId}  />
            </div>
          </form>
        </div>
      </div>
      <form ref={searchformRef} onSubmit={(e) => e.preventDefault()} className={styles.searchForm}>
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
        <div className={styles.searchInputContainer}>
          <input
            ref={searchInputDomRef}
            id="searchInput"
            type="text"
            placeholder="가게 검색"
            className={styles.searchInput}
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