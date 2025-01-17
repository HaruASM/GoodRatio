import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';

const myAPIkeyforMAp = process.env.NEXT_PUBLIC_MAPS_API_KEY;

export default function Home() {
  useEffect(() => {
    console.log("Google Maps API Key:", myAPIkeyforMAp);

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

            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
              marker = new google.maps.marker.AdvancedMarkerElement({
                position: positionObj,
                map,
                title: '현재 위치',
              });
            } else {
              marker = new google.maps.Marker({
                position: positionObj,
                map,
                title: '현재 위치',
              });
            }
          } else {
            map.setCenter(positionObj);
            marker.setPosition(positionObj);
          }
        }, showError);
      } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      }
    };

    const showError = (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          alert("사용자가 위치 정보 사용을 거부했습니다.");
          break;
        case error.POSITION_UNAVAILABLE:
          alert("위치 정보를 사용할 수 없습니다.");
          break;
        case error.TIMEOUT:
          alert("위치 정보를 가져오는 시간이 초과되었습니다.");
          break;
        case error.UNKNOWN_ERROR:
          alert("알 수 없는 오류가 발생했습니다.");
          break;
      }
    };

    window.loadMap = loadMap;
  }, []);

  return (
    <div>
      <Head>
        <title>위치 정보 예제</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main>
        <h1>현재 위치 정보</h1>
        <div id="map" style={{ width: '100%', height: '500px' }}></div>
      </main>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMAp}&callback=loadMap&v=beta`}
        strategy="afterInteractive"
      />
    </div>
  );
} 