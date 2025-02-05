import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import styles from '../shops/styles.module.css'; // CSS 모듈을 동일하게 사용

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

export default function Editor() { // 메인 페이지
  const [map, setMap] = useState(null);
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구의 기본 위치

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        console.log('Current position set:', { lat: latitude, lng: longitude });
      });
    }
  }, []);

  useEffect(() => {
    const initializeMap = () => {
      const mapDiv = document.getElementById('map');
      if (window.google && mapDiv && !map) {
        const mapInstance = new window.google.maps.Map(mapDiv, {
          center: currentPosition,
          zoom: 15,
        });
        setMap(mapInstance);
        console.log('Map initialized');
      }
    };

    if (window.google) {
      initializeMap();
    } else {
      const intervalId = setInterval(() => {
        if (window.google) {
          initializeMap();
          clearInterval(intervalId);
        }
      }, 100); // 100ms 간격으로 Google Maps API 로드 확인
    }
  }, [currentPosition, map]);

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
      <div className={styles.map} id="map" style={{ width: '100%', height: '400px' }}>
        {/* 구글 지도가 여기에 표시됩니다 */}
      </div>
      <Script 
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&callback=initializeMap`}
        strategy="afterInteractive"
      />
    </div>
  );
} 