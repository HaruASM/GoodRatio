import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
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

    });


    // 오버레이 생성시 
    window.google.maps.event.addListener(_drawingManager, 'overlaycomplete', (event)=>{
      
      const handleOverlayClick = () => {
        console.log('오버레이가 클릭 ', event.type );
      };
     
      const handleOverlayMouseOver = () => {
      
        if (event.type === 'polygon') {
          event.overlay.setOptions({
            fillColor: OVERLAY_COLOR.MOUSEOVER, // 초록색
          });
        } else if (event.type === 'marker') {
          event.overlay.setIcon({
            url: OVERLAY_ICON.MARKER_MOUSEOVER // 파란색
          });
        }
      }
      const handleOverlayMouseOut = () => {
        if (event.type === 'polygon') {
          event.overlay.setOptions({
            fillColor: OVERLAY_COLOR.IDLE, // 초록색
          });
        } else if (event.type === 'marker') {
          event.overlay.setIcon({
            url: OVERLAY_ICON.MARKER, // 파란색
          });
        }
      }

      // 오버레이에 이벤트 바인딩 
      window.google.maps.event.addListener(event.overlay, 'click', handleOverlayClick);
      window.google.maps.event.addListener(event.overlay, 'mouseover', handleOverlayMouseOver);
      window.google.maps.event.addListener(event.overlay, 'mouseout', handleOverlayMouseOut);

      setOverlayEditing((prev) => { // 기존 오버레이 삭제하고 새 오버레이 event 객체 저장   
        if (prev) prev.overlay.setMap(null);
        return event; });
      
      _drawingManager.setDrawingMode(null); // 그리기 모드 초기화
    });
    
    // window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', function(event) {
    //   // if (event.type == 'circle') {
    //   const vertices = event.getPath();
    //   let coordinates = [];
    //   // ...

    //   window.google.maps.event.addListener(event, 'click', function() {
    //     console.log('오버레이가 클릭되었습니다!');
    //   });
    //   console.log("polygoncomplete", );

    //   //마우스오버시 색깔 변환 'mouseover' // mouseout 이벤트 추가
    //   window.google.maps.event.addListener(event, 'mouseover', function() {
    //     console.log('마우스오버');
    //   });

    //   window.google.maps.event.addListener(event, 'mouseout', function() {
    //     console.log('마우스아웃');
    //   });

    // _drawingManager.setDrawingMode(null);
    // });



    _drawingManager.setMap(_mapInstance);
    setDrawingManager(_drawingManager); // 비동기 이므로 최후반
  }


  const initializePage = () => {
    console.log('initPage');

    // g맵 인스턴스 생성
    let mapDiv = document.getElementById('mapSection');
    // 여기서 interval을 줘야할지? if (window.google && mapDiv && !instMap) {
    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition ? currentPosition : { lat: 35.8714, lng: 128.6014 },
      zoom: 15,
    });
    
    // g맵용 이벤트 핸들러 
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', ()=>{ 
      // useEffect [instMap] or 'idle' 이벤트 
      console.log("idle Map");  
      initializeDrawingManager(_mapInstance);


    });
    
    setInstMap(_mapInstance); //비동기 이므로 최후반
  }

  

  useEffect(() => { // 1회 실행 
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
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
        <ul className={styles.itemList}>
          <li className={styles.item}>
            <a href="https://example.com">
              <div className={styles.itemDetails}>
                <span className={styles.itemTitle}>남산에 <small>일식당</small></span>
                <p>영업 중 · 20:30에 라스트오더</p>
                <p><strong>380m</strong> · 대구 중구 남산동</p>
              </div>
              <img
                src="https://example.com/image.jpg"
                alt="남산에 일식당"
                className={styles.itemImage}
              />
            </a>
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에2 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에2 일식당"
              className={styles.itemImage}
            />
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에3 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에3 일식당"
              className={styles.itemImage}
            />
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에4 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에4 일식당"
              className={styles.itemImage}
            />
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