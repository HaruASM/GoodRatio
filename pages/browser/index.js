import { useDispatch } from 'react-redux';
import React, { useState, useEffect, useRef } from 'react';
import MapViewMarking from '../../components/mapviewmarking';
import ExploringItemSidebar from '../../components/exploringItemSidebar';
import TravelCommunity from '../../components/travelCommunity';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';
import { curSectionChangedThunk } from '../../lib/store/slices/mapEventSlice';
import { getMapInstance } from '../../lib/map/GoogleMapManager';


const BrowserPage = () => {
  // Redux dispatch 가져오기
  const dispatch = useDispatch();
  
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  
  // 이전 아이템 리스트를 참조로 관리 (오버레이 제거 용도)
  const prevItemListforRelieveOverlays = useRef([]);
  
  // 구독 해제 함수 참조 관리
  const unsubscribeRef = useRef(null);

  // 기존 맵 인스턴스 연결 및 재사용
  const setupExistingMapInstance = () => {
    console.log('[BrowserPage] 기존 맵 인스턴스 재사용 시도');
    
    // GoogleMapManager에서 맵 인스턴스 가져오기
    const existingMapInstance = getMapInstance();
    
    if (!existingMapInstance) {
      console.log('[BrowserPage] 기존 맵 인스턴스가 없습니다.');
      return false;
    }
    
    console.log('[BrowserPage] 기존 맵 인스턴스 재사용 성공');
    return true;
  };
  
  // 맵 초기화 완료 시 이벤트 리스너
  const handleMapReady = (event) => {
    console.log('[BrowserPage] 맵 초기화 완료 이벤트 수신');
    
    // 이벤트에서 맵 인스턴스 가져오기
    const mapInstance = event.detail.mapInstance;
    
    if (!mapInstance) {
      console.error('[BrowserPage] 이벤트에서 맵 인스턴스를 찾을 수 없습니다.');
      return;
    }
    
    // 맵 인스턴스를 ModuleManager에 등록 (필요한 경우)
    const mapViewMarkingModule = ModuleManager.loadGlobalModule('mapViewMarking');
    if (mapViewMarkingModule && typeof mapViewMarkingModule.initialize === 'function') {
      console.log('[BrowserPage] 맵뷰마킹 모듈에 맵 인스턴스 등록');
      mapViewMarkingModule.initialize(mapInstance);
    }
    
    // MapOverlayManager 초기화
    const mapOverlayManager = ModuleManager.loadGlobalModule('mapOverlayManager');
    if (mapOverlayManager) {
      console.log('[BrowserPage] MapOverlayManager 초기화');
      mapOverlayManager.initialize(mapInstance);
    }
    
    // 모든 구독 설정 및 초기 섹션 설정
    setupAllSubscriptionsForModules(mapInstance);
    dispatch(curSectionChangedThunk('반월당'));
  };
  
  useEffect(() => {
    // 구글 맵이 이미 로드되어 있는지 확인
    const isExistingMapSetup = window.google && window.google.maps ? setupExistingMapInstance() : false;
    
    // 이벤트 리스너 등록
    window.addEventListener('map:ready', handleMapReady);
    
    return () => {
      window.removeEventListener('map:ready', handleMapReady);
      
      // 구독 해제
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
  
  // 모든 구독 설정 함수 - 맵 초기화 후 호출
  const setupAllSubscriptionsForModules = (mapInstance) => {
    console.log('[BrowserPage] 모든 구독 설정 시작');
    
    // 1. sectionDBManager 모듈 로드
    const sectionDBManager = ModuleManager.loadGlobalModule('sectionDBManager');
    if (!sectionDBManager) {
      console.error('[BrowserPage] sectionDBManager 모듈을 찾을 수 없음');
      return;
    }
    
    
    // 3. sectionDBManager에 구독 설정
    const unsubscribe = sectionDBManager.subscribe((sectionName, items) => {
      // 섹션 데이터 업데이트 이벤트 발생
      const sectionUpdateEvent = new CustomEvent('section-data-updated', {
        detail: { sectionName, items }
      });
      window.dispatchEvent(sectionUpdateEvent);
      
      console.log(`[BrowserPage] ${sectionName} 섹션 데이터 업데이트 발생 (${items.length}개 항목)`);
    });
    
    // 구독 해제 함수 저장
    unsubscribeRef.current = unsubscribe;
    
    console.log('[BrowserPage] 모든 구독 설정 완료');
  };

  return (
    <div className={styles['browser-container']}>
      {/* 왼쪽 사이드바 영역 */}
      <div className={`${styles['browser-sidebar']} ${isLeftSidebarVisible ? styles['browser-sidebarVisible'] : styles['browser-sidebarHidden']}`}>
        <ExploringItemSidebar />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className={styles['browser-mainContent']}>
        {/* 맵 뷰 */}
        <MapViewMarking 
          className={styles['browser-mapView']}
        />
      </div>

      {/* 오른쪽 사이드바 영역 - 채팅 컴포넌트 */}
      <div className={`${styles['browser-rightSidebar']} ${isRightSidebarVisible ? '' : styles['browser-rightSidebarHidden']}`}>
        <TravelCommunity />
      </div>
    </div>
  );
};

export default BrowserPage; 