import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import styles from '../shops/styles.module.css'; // CSS 모듈을 동일하게 사용

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;


export default function Editor() { // 메인 페이지
  const [instMap, setInstMap] = useState(null); //구글맵 인스턴스 
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구의 기본 위치로 저장
  const [editMarker, setEditMarker] = useState(null);
  const [myLocMarker, setMyLocMarker] = useState(null);
  const [drawingManager, setDrawingManager] = useState(null);

  
  const initializeDrawingManager = ( _mapInstance ) => {
    var _drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.MARKER,
          google.maps.drawing.OverlayType.POLYGON,
        ],
        polygonOptions: {
          strokeColor: 'red',
          fillOpacity: 0.9,
          fillColor: 'red',
          fillOpacity: 1,
          strokeWeight: 5,
          clickable: false,
          editable: true,
          zIndex: 1,
        }
      }
    });

    window.google.maps.event.addListener(_drawingManager, 'polygoncomplete', function(event) {
      // if (event.type == 'circle') {
      const vertices = event.getPath();
      let coordinates = [];
      // ...
    });
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