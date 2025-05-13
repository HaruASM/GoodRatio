import React, { useState, useEffect, useRef } from 'react';
import MapViewMarking from '../../components/mapviewmarking';
import ExploringSidebar from '../../components/exploringsidebar';
import TravelCommunity from '../../components/travelCommunity';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';


const BrowserPage = () => {
  // 맵 인스턴스 참조
  const mapInstanceRef = useRef(null);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  
  // 현재 섹션 이름과 해당 섹션의 아이템 리스트를 상태로 관리
  const [curSectionName, setCurSectionName] = useState('');
  const [curItemListInCurSection, setCurItemListInCurSection] = useState([]);
  
  // 이전 아이템 리스트를 참조로 관리 (오버레이 제거 용도)
  const prevItemListforRelieveOverlays = useRef([]);
  
  // 구독 해제 함수 참조 관리
  const unsubscribeRef = useRef(null);

  // 맵 초기화 완료 후 추가 설정을 위한 효과
  useEffect(() => {
    // 맵 초기화 완료 시 이벤트 리스너
    const handleMapReady = (event) => {
      const mapInstance = event.detail.mapInstance;
      console.log('[BrowserPage] 맵 초기화 완료 이벤트 수신');
      
      // MapOverlayManager 초기화
      const mapOverlayManager = ModuleManager.loadGlobalModule('mapOverlayManager');
      if (mapOverlayManager) {
        console.log('[BrowserPage] MapOverlayManager 초기화');
        mapOverlayManager.initialize(mapInstance);
      }
      
      // 데이터 구독 설정
      setupDataSubscription();
    };
    
    // 이벤트 리스너 등록
    window.addEventListener('map:ready', handleMapReady);
    
    // 이미 맵이 초기화되어 있는 경우 처리
    if (mapInstanceRef.current) {
      console.log('[BrowserPage] 맵이 이미 초기화됨');
      const mapReadyEvent = new CustomEvent('map:ready', { 
        detail: { mapInstance: mapInstanceRef.current } 
      });
      window.dispatchEvent(mapReadyEvent);
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener('map:ready', handleMapReady);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
  
  // 데이터 구독 설정 함수 - 맵 초기화 후 호출됨
  const setupDataSubscription = () => {
    console.log('[BrowserPage] 데이터 구독 설정 시작');
    
    // ModuleManager에서 sectionDBManager 모듈 가져오기
    const sectionDBManager = ModuleManager.loadGlobalModule('sectionDBManager');
    
    if (!sectionDBManager) {
      console.error('[BrowserPage] sectionDBManager 모듈을 찾을 수 없음');
      return;
    }
    
    // 초기 섹션명 설정
    if (!curSectionName) {
      setCurSectionName('반월당');
      return; // 섹션명 변경 시 useEffect에서 다시 데이터 로드함
    }
    
    // 섹션 데이터 변경 구독 - sectionName과 items를 함께 받는 콜백
    unsubscribeRef.current = sectionDBManager.subscribe((sectionName, items) => {
      // 현재 선택된 섹션에 대한 업데이트만 처리
      if (sectionName === curSectionName) {
        console.log(`[BrowserPage] ${sectionName} 섹션 데이터 업데이트 수신 (${items.length}개 항목)`);
        setCurItemListInCurSection((prev) => {
          prevItemListforRelieveOverlays.current = prev;
          return items;
        });
      }
    });
    
    // 초기 데이터 로드
    sectionDBManager.getSectionItems(curSectionName).catch(error => {
      console.error(`[BrowserPage] ${curSectionName} 섹션 데이터 로드 오류:`, error);
    });
  };
  
  // curSectionName 변경 시 실행되는 효과
  useEffect(() => {
    if (!curSectionName) return;
    
    const sectionDBManager = ModuleManager.loadGlobalModule('sectionDBManager');
    if (!sectionDBManager) return;
    
    console.log(`[BrowserPage] ${curSectionName} 섹션 데이터 로드 요청`);
    
    // 섹션 변경 시 새 섹션 데이터 로드
    sectionDBManager.getSectionItems(curSectionName).catch(error => {
      console.error(`[BrowserPage] ${curSectionName} 섹션 데이터 로드 오류:`, error);
    });
  }, [curSectionName]);

  const toggleLeftSidebar = () => {
    setIsLeftSidebarVisible(!isLeftSidebarVisible);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarVisible(!isRightSidebarVisible);
  };

  return (
    <div className={styles['browser-container']}>
      {/* 왼쪽 사이드바 영역 */}
      <div className={`${styles['browser-sidebar']} ${isLeftSidebarVisible ? styles['browser-sidebarVisible'] : styles['browser-sidebarHidden']}`}>
        <ExploringSidebar 
          curSectionName={curSectionName}
          curItemListInCurSection={curItemListInCurSection}
          onSectionChange={setCurSectionName}
        />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className={styles['browser-mainContent']}>
        {/* 맵 뷰 */}
        <MapViewMarking 
          className={styles['browser-mapView']}
          mapInstanceRef={mapInstanceRef}
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