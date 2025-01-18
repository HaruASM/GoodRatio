import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';

const myAPIkeyforMAp = process.env.NEXT_PUBLIC_MAPS_API_KEY;

export default function Call() {
  useEffect(() => {
    let map;
    let marker;

    const loadMap = () => {
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const positionObj = { lat: latitude, lng: longitude };

          if (!map) {
            map = new google.maps.Map(document.getElementById('map'), {
              center: positionObj,
              zoom: 15,
            });

            marker = new google.maps.Marker({
              position: positionObj,
              map,
              title: '현재 위치',
            });
          } else {
            map.setCenter(positionObj);
            marker.setPosition(positionObj);
          }
        });
      } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      }
    };

    window.loadMap = loadMap;
  }, []);

  return (
    <div>
      <Head>
        <title>Call 위치 정보</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main>
        <h1>Call 위치 정보</h1>
        <div id="map" style={{ width: '100%', height: '500px' }}></div>
      </main>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMAp}&callback=loadMap&v=beta`}
        strategy="afterInteractive"
      />
    </div>
  );
} 