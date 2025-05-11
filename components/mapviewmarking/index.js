import React, { useEffect, useState, useRef } from 'react';
import styles from './styles.module.css';

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

/**
 * 맵 뷰 컴포넌트 - 단순화 버전
 * 구글 맵을 표시하고 검색 기능만 제공
 */
const MapViewMarking = ({ className }) => {
  const instMap = useRef(null);
  const searchInputDomRef = useRef(null);
  const searchformRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구 기본 위치
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // 구글 맵 초기화
  const initGoogleMapPage = () => {
    // 위치 정보 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
      }, (error) => {
        console.error('geolocation 에러 : ', error);
      });
    }

    // 맵 요소 확인
    let mapDiv = document.getElementById('map');
    if (!mapDiv) {
      console.error('맵 DOM 요소를 찾을 수 없습니다. 지도 초기화를 중단합니다.');
      return;
    }

    // 맵 인스턴스 생성
    const _mapInstance = new window.google.maps.Map(mapDiv, {
      center: currentPosition,
      zoom: 15,
      mapTypeControl: false,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: window.google.maps.ControlPosition.LEFT_BOTTOM
      },
      mapId: "2ab3209702dae9cb"
    });
    

    // 맵 로드 완료시 동작
    window.google.maps.event.addListenerOnce(_mapInstance, 'idle', () => {
      // initSearchInput(_mapInstance);
      console.log('idle 맵생성완료');
    });

    instMap.current = _mapInstance;
  };

  // 검색 초기화
  const initSearchInput = (_mapInstance) => {
    const inputDom = searchInputDomRef.current;
    if (!inputDom) {
      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputDom, {
      fields: [
        'name', 'formatted_address', 'place_id', 'geometry', 'photos', 
        'opening_hours.weekday_text'
      ]
    });
    autocomplete.bindTo('bounds', _mapInstance);

    autocomplete.addListener('place_changed', () => {
      const detailPlace = autocomplete.getPlace();
      if (!detailPlace.geometry || !detailPlace.geometry.location) {
        console.error(`구글place 미작동: '${detailPlace.name}'`);
        return;
      }

      // 지도 이동 처리
      if (detailPlace.geometry.viewport) {
        _mapInstance.fitBounds(detailPlace.geometry.viewport);
      } else {
        _mapInstance.setCenter(detailPlace.geometry.location);
        _mapInstance.setZoom(15);
      }

      // 검색창 비우기
      if (searchInputDomRef.current) {
        searchInputDomRef.current.value = '';
      }
    });

    _mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(searchformRef.current);
  };

  // 구글 맵 API 로드
  useEffect(() => {
    // 이미 로드되었는지 확인
    if (window.google && window.google.maps) {
      setIsMapLoaded(true);
      return;
    }
    
    // 아직 로드되지 않았다면 스크립트 로드
    const googleMapScript = document.createElement('script');
    googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${myAPIkeyforMap}&libraries=places,drawing,marker&loading=async`;
    googleMapScript.async = true;
    googleMapScript.defer = true;
    
    window.initMap = () => {
      setIsMapLoaded(true);
    };
    
    document.head.appendChild(googleMapScript);
    
    return () => {
      // 클린업 함수에서 콜백 제거
      window.initMap = undefined;
    };
  }, []);

  // 맵 로드 완료 후 초기화
  useEffect(() => {
    if (isMapLoaded) {
      initGoogleMapPage();
    }
  }, [isMapLoaded]);

  return (
    <div className={`${styles['mapviewmarking-mapContainer']} ${className || ''}`}>
      <div id="map" className={styles['mapviewmarking-map']}></div>
      {/* <div ref={searchformRef} className={styles['mapviewmarking-searchForm']}>
        <div className={styles['mapviewmarking-searchInputContainer']}>
          <input
            ref={searchInputDomRef}
            type="text"
            placeholder="장소 검색..."
            className={styles['mapviewmarking-searchInput']}
          />
          <button className={styles['mapviewmarking-searchButton']}>
            <span className={styles['mapviewmarking-searchIcon']}>🔍</span>
          </button>
        </div>
      </div> */}
      
    </div>
  );
};

export default MapViewMarking; 