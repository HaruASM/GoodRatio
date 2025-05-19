import { useDispatch, useSelector } from 'react-redux';
import React, { useState, useEffect, useRef } from 'react';
import MapViewMarking from '../../components/mapviewmarking';
import ExploringItemSidebar from '../../components/exploringItemSidebar';
import TravelCommunity from '../../components/travelCommunity';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';
import { curSectionChangedThunk, selectcurrentSectionName } from '../../lib/store/slices/mapEventSlice';
// import { setMapInstance } from '../../lib/map/GoogleMapManager'; // 직접 import 대신 모듈에서 사용


const BrowserPage = () => {
  // Redux dispatch 가져오기
  const dispatch = useDispatch();
  
  // 리덕스에서 현재 섹션 이름 가져오기 - 비어있는 경우 그대로 사용
  const currentSectionName = useSelector(selectcurrentSectionName);
  
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  
  // 이전 아이템 리스트를 참조로 관리 (오버레이 제거 용도)
  const prevItemListforRelieveOverlays = useRef([]);
  
  // 구독 해제 함수 참조 관리
  const unsubscribeRef = useRef(null);
  
  // 맵 초기화 완료 시 이벤트 리스너 (비동기 함수로 변경)
  const handleMapReady = async (event) => {
    console.log('[BrowserPage] 맵 초기화 완료 이벤트 수신');
    
    // 이벤트에서 맵 인스턴스 가져오기
    const mapInstance = event.detail.mapInstance;
    
    if (!mapInstance) {
      console.error('[BrowserPage] 이벤트에서 맵 인스턴스를 찾을 수 없습니다.');
      return;
    }
    
    try {
      // GoogleMapManager 모듈 비동기 로드 (await 사용)
      const GoogleMapManager = await ModuleManager.loadGlobalModule('googleMapManager');
      console.log('[BrowserPage] GoogleMapManager 모듈 로드 완료');
      
      // 맵 인스턴스 확인 (비동기 로드 후 메서드 호출)
      const currentStoredMapInstance = GoogleMapManager ? GoogleMapManager.getMapInstance() : null;
      
      console.log('[BrowserPage] 현재 GoogleMapManager에 저장된 맵 인스턴스:', currentStoredMapInstance ? '있음' : '없음');
      console.log('[BrowserPage] 이벤트에서 받은 맵 인스턴스:', mapInstance ? '있음' : '없음');
      
      // 맵 인스턴스를 ModuleManager에 등록
      const mapViewMarkingModule = await ModuleManager.loadGlobalModule('mapViewMarking');
      if (mapViewMarkingModule && typeof mapViewMarkingModule.initialize === 'function') {
        console.log('[BrowserPage] 맵뷰마킹 모듈에 맵 인스턴스 등록');
        mapViewMarkingModule.initialize(mapInstance);
      }
      
      // 맵 인스턴스를 GoogleMapManager에 명시적으로 등록
      if (!currentStoredMapInstance) {
        console.log('[BrowserPage] GoogleMapManager에 맵 인스턴스 명시적 등록 (setMapInstance 사용)');
        // 이미 생성된 맵 인스턴스를 직접 설정
        GoogleMapManager.setMapInstance(mapInstance);
      }
          
      // MapOverlayManager 초기화 (비동기 로드)
      const mapOverlayManager = await ModuleManager.loadGlobalModule('mapOverlayManager');
      if (mapOverlayManager && typeof mapOverlayManager.initialize === 'function') {
        console.log('[BrowserPage] 맵오버레이 매니저 초기화');
        mapOverlayManager.initialize(mapInstance);
      }
      
      // 모든 구독 설정 및 초기 섹션 설정
      await setupAllSubscriptionsForModules(mapInstance);
     
      // 맵 중심점 설정
      mapInstance.setCenter({ lat: 35.8714, lng: 128.6014 }); // 반월당 중심
    } catch (error) {
      console.error('[BrowserPage] 맵 초기화 중 오류 발생:', error);
    }
  };
  
  useEffect(() => {
    // 이벤트 리스너 등록 - 맵 초기화가 완료되면 모든 설정을 한 번에 처리
    window.addEventListener('map:ready', handleMapReady);
  
    return () => {
      console.log('[BrowserPage] 맵 이벤트 리스너 제거');
      window.removeEventListener('map:ready', handleMapReady);
      // 구독 해제
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);
  
  // 섹션 설정 - 맵 인스턴스 초기화 후 호출
  const setupAllSubscriptionsForModules = async (mapInstance) => {
    console.log('[BrowserPage] 섹션 설정 시작');
    try {
      // SectionDBManager 로드 (비동기)
      const sectionDBManager = await ModuleManager.loadGlobalModule('sectionDBManager');
      if (sectionDBManager) {
        // 섹션 변경 디스패치만 처리
        // SectionDBManager가 데이터 관리와 오버레이 등록을 담당
        // ExploringItemSidebar가 UI 업데이트를 담당
        if (currentSectionName) {
          dispatch(curSectionChangedThunk(currentSectionName));
        } else {
          //TODO 테스트 코드- 차후 삭제 
          dispatch(curSectionChangedThunk('반월당'));
        }
      }
      
      console.log('[BrowserPage] 섹션 설정 완료');
    } catch (error) {
      console.error('[BrowserPage] 섹션 설정 중 오류:', error);
    }
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