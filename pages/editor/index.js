import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import Image from 'next/image';
import styles from '../shops/styles.module.css'; // CSS 모듈을 동일하게 사용

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
  const [instMap, setInstMap] = useState(null); //구글맵 인스턴스 
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구의 기본 위치로 저장
  const [editMarker, setEditMarker] = useState(null);
  const [myLocMarker, setMyLocMarker] = useState(null);
  const [drawingManager, setDrawingManager] = useState(null);
  const [overlayEditing, setOverlayEditing] = useState(null); // 에디터에서 작업중인 오버레이. 1개만 운용
  
  const initializeDrawingManager = ( _mapInstance ) => { // 
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
      
      const handleOverlayClick = () => {
        console.log('오버레이가 클릭 ', eventObj.type );

        // InfoWindow 생성 및 설정
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div><strong>오버레이 정보</strong><br>타입: ${eventObj.type}</div>`,
        });

        
        // InfoWindow를 오버레이의 위치에 표시
        if (eventObj.type === 'marker') {
          infoWindow.open(instMap, eventObj.overlay);
        } else if (eventObj.type === 'polygon') {
          // 폴리곤 타입의 오버레이인 경우
          const path = eventObj.overlay.getPath(); // 폴리곤의 경로를 가져옴
          const bounds = new window.google.maps.LatLngBounds(); // 경계 객체 생성
          path.forEach((point) => bounds.extend(point)); // 경로의 각 점을 경계에 추가
          infoWindow.setPosition(bounds.getCenter()); // 경계의 중심에 InfoWindow 위치 설정
          //infoWindow.setPosition(currentPosition);
          
          infoWindow.open(instMap, eventObj.overlay); // InfoWindow를 지도에 표시
          
        }
      };
     
      const handleOverlayMouseOver = () => {
      
        if (eventObj.type === 'polygon') {
          eventObj.overlay.setOptions({
            fillColor: OVERLAY_COLOR.MOUSEOVER, // 초록색
          });
        } else if (eventObj.type === 'marker') {
          eventObj.overlay.setIcon({
            url: OVERLAY_ICON.MARKER_MOUSEOVER // 파란색
          });
        }
      }
      const handleOverlayMouseOut = () => {
        if (eventObj.type === 'polygon') {
          eventObj.overlay.setOptions({
            fillColor: OVERLAY_COLOR.IDLE, // 초록색
          });
        } else if (eventObj.type === 'marker') {
          eventObj.overlay.setIcon({
            url: OVERLAY_ICON.MARKER, // 파란색
          });
        }
      }

      // 오버레이에 이벤트 바인딩 
      window.google.maps.event.addListener(eventObj.overlay, 'click', handleOverlayClick);
      window.google.maps.event.addListener(eventObj.overlay, 'mouseover', handleOverlayMouseOver);
      window.google.maps.event.addListener(eventObj.overlay, 'mouseout', handleOverlayMouseOut);

      setOverlayEditing((prev) => { // 기존 오버레이 삭제하고 새 오버레이 event 객체 저장   
        if (prev) prev.overlay.setMap(null);
        return eventObj; });
      
      _drawingManager.setDrawingMode(null); // 그리기 모드 초기화
    });
    
    
    _drawingManager.setMap(_mapInstance);
    setDrawingManager(_drawingManager); // 비동기 이므로 최후반
  } // initializeDrawingManager  


  

  const moveToCurrentLocation = () => {
    if (instMap && currentPosition) {
      instMap.setCenter(currentPosition);
      console.log('Moved to current location:', currentPosition);
    }
  };

  useEffect(() => { // 1회 실행 but 2회 실행중
    const initializePage = () => {
      console.log('initPage');
  
      // g맵 인스턴스 생성
      let mapDiv = document.getElementById('mapSection');
      // 여기서 interval을 줘야할지? if (window.google && mapDiv && !instMap) {
      const _mapInstance = new window.google.maps.Map(mapDiv, {
        center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
        zoom: 16,
      });
      
      // g맵용 로드 완료시 동작 
      window.google.maps.event.addListenerOnce(_mapInstance, 'idle', ()=>{ 
        // useEffect [instMap] or 'idle' 이벤트 
        console.log("idle Map");  
        initializeDrawingManager(_mapInstance);
  
        // -- 현재 내위치 마커 
      });  // idle 이벤트 
      
      setInstMap(_mapInstance); //비동기 이므로 최후반
    } // initializePage 마침
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        console.log('현재 위치 : ', latitude, longitude);
      }, 
    (error) => {
      console.log('geolocation 에러 : ',error);
    });
    } else {
      console.log('geolocation 지원 안되는 중');
    }

    const intervalId = setInterval( () => {
      console.log("set interval");
      if(window.google) {
        initializePage();
        clearInterval(intervalId);    }
    }, 100);  

    return () => clearInterval(intervalId); // 컴포넌트 언마운트시
  }, []);     


  useEffect(() => {
 
    console.log("use effect 0");

  }, [currentPosition]);

  return (
    <div className={styles.container}>
      <Head>
        <title>Editor</title>
      </Head>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <button className={styles.backButton}>←</button>
          <h1>반월당역 관광지도</h1>
          <button className={styles.iconButton}>⚙️</button>
        </div>
        <div className={styles.menu}>
          <button className={styles.menuButton}>숙소</button>
          <button className={styles.menuButton}>맛집</button>
          <button className={styles.menuButton}>관광</button>
        </div>
        <div className={styles.editor}>
          <button className={styles.menuButton}>거리지도</button>
          <button className={styles.menuButton} onClick={moveToCurrentLocation}>현재위치</button>
          <button className={styles.menuButton}>추가</button>
          <button className={styles.menuButton}>수정</button>
          <button className={styles.menuButton}>삭제</button>
          <button className={styles.menuButton}>리셋</button>
          <button className={styles.menuButton}>기능1</button>
          <button className={styles.menuButton}>기능2</button>
          <button className={styles.menuButton}>기능3</button>
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
              />
            </a>
          </li>
        </ul>
      </div>
      <div className={styles.map} id="mapSection" style={{ width: '100%', height: '400px' }}>
        {/* 구글 지도가 여기에 표시됩니다 */}
      </div>
      <Script 
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=drawing&loading=async`}
        strategy="afterInteractive"
      />
    </div>

  );
} 