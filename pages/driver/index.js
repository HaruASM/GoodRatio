import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { collection, getDocs } from 'firebase/firestore';
import { firebasedb } from '../../firebase';


const myAPIkeyforMAp = process.env.NEXT_PUBLIC_MAPS_API_KEY;


export default function Driver() {
  const [status, setStatus] = useState('ready');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(firebasedb, 'vehicles'));
        querySnapshot.forEach((doc) => {
          console.log(doc.id, '=>', doc.data());
        });
      } catch (e) {
        console.error('Error fetching data: ', e);
      }
    };

    fetchData();

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
              mapId: process.env.NEXT_PUBLIC_MAP_ID
            });
            loadMarker(positionObj);
          } else {
            map.setCenter(positionObj);
            if (marker) {
              marker.position = positionObj; // 위치 업데이트
            }
          }
        });
      } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      }
    };

    const loadMarker = async (positionObj) => {
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
      marker = new AdvancedMarkerElement({
        position: positionObj,
        map,
        title: '현재 위치',
      });
      return Promise.resolve(); // 마커 생성 후 Promise 반환
    };

    window.loadMap = loadMap;
  }, []);

  const getStatusStyle = () => {
    switch (status) {
      case 'ride':
        return { backgroundColor: 'yellow', color: 'black' };
      case 'otw':
        return { borderColor: 'orange', color: 'orange', backgroundColor: 'transparent' };
      default:
        return { borderColor: 'blue', color: 'blue', backgroundColor: 'transparent' };
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ride':
        return '탑승중';
      case 'otw':
        return '가는중';
      default:
        return '대기중';
    }
  };

  return (
    <div>
      <Head>
        <title>기사용</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ marginRight: '10px' }}>기사용</h1>
          <button style={{
            backgroundColor: 'black',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}>
            차량: 혼다2123CX(칸디호텔)
          </button>
          <button
            style={{
              padding: '10px 20px',
              border: '2px solid',
              borderRadius: '5px',
              cursor: 'pointer',
              ...getStatusStyle()
            }}
            onClick={() => {
              if (status === 'ready') setStatus('ride');
              else if (status === 'ride') setStatus('otw');
              else setStatus('ready');
            }}
          >
            {getStatusText()}
          </button>
        </div>
        <div id="map" style={{ width: '100%', height: '500px' }}></div>
      </main>
      <Script 
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMAp}&callback=loadMap&v=beta&loading=async`}
        strategy="afterInteractive"
      />
    </div>
  );
}