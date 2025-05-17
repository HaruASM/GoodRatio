import React, { useEffect, useState, useRef } from 'react';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';
import { initializeMap, getMapInstance, loadGoogleMapsScript } from '../../lib/map/GoogleMapManager';

const myAPIkeyforMap = process.env.NEXT_PUBLIC_MAPS_API_KEY;

/**
 * 맵 뷰 컴포넌트 - 단순화 버전
 * 구글 맵을 표시하고 검색 기능만 제공
 */

// 이 컴포넌트는 구글 API로 로딩한 맵의 인스턴스를 페이지간 이동에도 유지하도록 하는것이 임무다
const MapViewMarking = ({ className }) => {
  const instMap = useRef(null);
  const searchInputDomRef = useRef(null);
  const searchformRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState({ lat: 35.8714, lng: 128.6014 }); // 대구 기본 위치
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // 지도 맵 초기화 - window.google과 window.google.maps객체가 로딩 확정된 시점에서 실행
  const initGoogleMapPage = () => {
    // 위치 정보 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
      }, (error) => {
        console.error('geolocation 오류 : ', error);
      });
    }

    // 맵 요소 확인
    let mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('맵 DOM 요소를 찾을 수 없습니다. 지도 초기화를 중단합니다.');
      return;
    }

    // 맵 인스턴스 초기화 또는 재사용 (GoogleMapManager 사용)
    const _mapInstance = initializeMap(mapContainer, {
      center: currentPosition,
      zoom: 15,
      mapTypeControl: false,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: window.google.maps.ControlPosition.LEFT_BOTTOM
      },
      mapId: "2ab3209702dae9cb"
    });
    
    // 내부 참조 설정
    instMap.current = _mapInstance;
    
    return _mapInstance;
임  };

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

  // 구글 맵 API 로드 확인 및 초기화
  useEffect(() => {
    // GoogleMapManager의 loadGoogleMapsScript 함수 사용
    const loadMap = async () => {
      try {
        await loadGoogleMapsScript();
        console.log('[MapViewMarking] 구글 맵 API 로드 성공');
        setIsMapLoaded(true);
      } catch (error) {
        console.error('[MapViewMarking] 구글 맵 API 로드 오류:', error);
      }
    };
    
    loadMap();
    
    return () => {
      // 필요한 클린업 로직
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