import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { firebasedb } from '../../firebase';
import { randomizeLocations } from '../../utils/randomizeLocations';




const myAPIkeyforMAp = process.env.NEXT_PUBLIC_MAPS_API_KEY;

export default function Driver() {
  const [status, setStatus] = useState('ready'); // 내 운전자 상황 상태 변수
  const [currentPosition, setCurrentPosition] = useState(null); // 현재 위치
  const [DriversLocalDB, setDriversLocalDB] = useState([]); // 로컬DB
  const [DriverMap, setDriverMap] = useState(null); // 구글맵 인스턴스
  const [DriverMarkers, setDriverMarkers] = useState([]); // 마커 인스턴스
  const [MapIcons, setMapIcons] = useState([]); // 아이콘 이미지 배열
  const [displayDB, setDisplayDB] = useState(false); // 로컬DB 표시 여부 true/false

  
 
  useEffect(() => { //아이콘 이미지 배열을 생성하는 객체 
    // 이미지 객체를 한 번 생성하여 상태에 저장
    const iconNames = [
      'driver-bicycle',
      'driver-car',
      'driver-person',
      'driver-van',      
    ];
    let MapIcons_ = []

    iconNames.forEach((iconName) => {
      let carIconImg = document.createElement("img");
      carIconImg .src = `/icons/${iconName}.svg`; // public 디렉토리에 저장된 이미지 경로
      carIconImg.style.width = '28px'; // 이미지 크기 설정
      carIconImg.style.height = '28px';
      MapIcons_[iconName] = carIconImg;
    });
    setMapIcons(MapIcons_);
  }, [MapIcons]);

  useEffect(() => {
    // Map과 MAker 생성 
    let map_, marker_;
    
    const loadMap = () => {
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const positionObj = { lat: latitude, lng: longitude };
          
          if (!map_) {
            map_ = new google.maps.Map(document.getElementById('map'), {
              center: positionObj,
              zoom: 15,
              mapId: process.env.NEXT_PUBLIC_MAP_ID
            });
            loadMarker(positionObj);
          } else {
            map_.setCenter(positionObj);
            if (marker_) {
              marker_.position = positionObj; // 위치 업데이트
            }
          }
        });
      } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      }
    };

    
    const loadMarker = async (positionObj) => {
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
      marker_ = new AdvancedMarkerElement({
        position: positionObj,
        map: map_,
        title: '현재 위치',
        content: MapIcons['driver-person'],
      });
      
      return Promise.resolve(); // 마커 생성 후 Promise 반환
    };

    window.loadMap = loadMap;
  }, [MapIcons]);

  useEffect(() => {
    // 현재 위치를 가져와서 currentPosition 상태를 설정합니다.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        console.log('Current position set:', { lat: latitude, lng: longitude });
      });
    }
  }, []);

  useEffect(() => {
    // currentPosition이 설정되면 Firebase에서 차량 데이터를 가져와서 DriversLocalDB 상태를 업데이트합니다.
    if (currentPosition) {
      const collectionRef = collection(firebasedb, 'vehicles');

      // Firestore 컬렉션의 실시간 업데이트 수신
      const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
        const fetchedData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDriversLocalDB(fetchedData);
        console.log('데이터받음', fetchedData);
      });

      // 컴포넌트 언마운트 시 구독 해제
      return () => unsubscribe();
    }
  }, [currentPosition]);

  useEffect(() => {
    // Google Maps API가 로드되었고 currentPosition이 설정되면 맵을 초기화합니다.
    const initializeMap = () => {
      const mapDiv = document.getElementById('map');
      if (window.google && mapDiv && currentPosition && !DriverMap) {
        const mapInstance = new window.google.maps.Map(mapDiv, {
          center: currentPosition,
          zoom: 14,
        });
        setDriverMap(mapInstance);
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
  }, [currentPosition, DriverMap]);

  useEffect(() => {

    const displayLocationsOnMap = async () => {
      console.log(DriversLocalDB.length, MapIcons.length);
      // if (map && DriversLocalDB.length > 0 && MapIcons.length > 0) {
        
        if (DriverMap && DriversLocalDB.length > 0 ) {
        //clearMarkers();
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const markers = DriversLocalDB.map(item => {
          if (item.location) {
            const icon = MapIcons.find(icon => icon.name === 'person');
            return new AdvancedMarkerElement({
              position: item.location,
              map: DriverMap,
              title: item.vehicle || 'Vehicle',
              content : icon //content: MapIcons['driver-person'],
            });
          }
          return null;
        }).filter(marker => marker !== null);
        setDriverMarkers(markers);
        console.log('Markers added to map');
      } else {
        console.log('No items to display or map not initialized');
      }
      
    };

    if (displayDB) {
      displayLocationsOnMap();
    }
  }, [displayDB, DriverMap, DriversLocalDB]);

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

  const clearMarkers = () => {
    // 기존 마커를 모두 제거합니다.
    DriverMarkers.forEach(marker => marker.setMap(null));
    //setDriverMarkers([]);
  };

  const handleRandomizeAndWrite = async () => {
    console.log('Button clicked');
    if (currentPosition && DriversLocalDB.length > 0) {
      try {
        console.log('Randomizing locations');
        const updatedData = randomizeLocations(DriversLocalDB, currentPosition);
        setDriversLocalDB(updatedData);
        console.log('Randomized data:', updatedData);

        // Firestore에 데이터 쓰기
        for (const item of updatedData) {
          const docRef = doc(firebasedb, 'vehicles', item.id);
          await setDoc(docRef, item);
        }
        console.log('Updated items written to Firestore:', updatedData);
      } catch (error) {
        console.error('Error in randomizing or writing to Firestore:', error);
      }
    } else {
      console.log('No items to update or current position not set');
    }
  };

  const handleDisplayButtonClick = () => {
     
    setDisplayDB( !displayDB );
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
        <button onClick={handleRandomizeAndWrite}>Randomize and Write to Firestore</button>
        <button onClick={handleDisplayButtonClick}>Display Locations on Map</button>
      </main>
      <Script 
        src={`https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMAp}&callback=loadMap&v=beta&marker&loading=async`}
        strategy="afterInteractive"
      />
      
    </div>
  );
}