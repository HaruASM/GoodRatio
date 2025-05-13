import React, { useState, useEffect, useRef } from 'react';
import MapViewMarking from '../../components/mapviewmarking';
import ExploringSidebar from '../../components/exploringsidebar';
import TravelCommunity from '../../components/travelCommunity';
import styles from './styles.module.css';


const BrowserPage = () => {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  
  // 현재 섹션 이름과 해당 섹션의 아이템 리스트를 상태로 관리
  const [curSectionName, setCurSectionName] = useState(null);
  const [curItemListInCurSection, setCurItemListInCurSection] = useState([]);
  
  // 이전 아이템 리스트를 참조로 관리 (오버레이 제거 용도)
  const prevItemListforRelieveOverlays = useRef([]);

  // 섹션 변경, 초기 설정 및 업데이트 이벤트 핸들러 통합
  useEffect(() => {
    // 섹션 업데이트 이벤트 핸들러 정의
    const handleSectionUpdate = (event) => {
      const { sectionName, items, serverLastUpdated } = event.detail;
      
      // 현재 선택된 섹션에 대한 업데이트인 경우만 처리
      if (sectionName === curSectionName) {
        console.log(`[BrowserPage] ${sectionName} 섹션 업데이트 감지`);
        
        // 로컬 스토리지 키
        const localStorageKey = `${sectionName}_lastUpdated`;
        
        // 로컬 스토리지에서 마지막 업데이트 타임스탬프 가져오기
        const localLastUpdated = localStorage.getItem(localStorageKey);
        
        // 업데이트 여부 확인 (타임스탬프가 없거나 서버 타임스탬프가 더 최신)
        const shouldUpdate = !localLastUpdated || (serverLastUpdated && serverLastUpdated > parseInt(localLastUpdated));
        
        if (shouldUpdate) {
          // UI 업데이트
          setCurItemListInCurSection((prev) => {
            prevItemListforRelieveOverlays.current = prev;
            return items;
          });
          
          // 로컬 스토리지에 마지막 업데이트 타임스탬프 저장
          if (serverLastUpdated) {
            localStorage.setItem(localStorageKey, serverLastUpdated);
          }
        } else {
          console.log(`[BrowserPage] ${sectionName} 섹션에 실제 변경사항 없음, UI 업데이트 건너뜀`);
        }
      }
    };
    
    // 섹션 업데이트 이벤트 리스너 등록
    document.addEventListener('section-items-updated', handleSectionUpdate);
    
    // 초기 섹션 설정 - 컴포넌트 마운트 시 한 번만 실행
    if (!curSectionName) {
      setCurSectionName('반월당');
      return () => {
        document.removeEventListener('section-items-updated', handleSectionUpdate);
      };
    }
    
    // curSectionName이 변경되었을 때 실행되는 로직
    // ModuleManager에서 sectionDBManager 모듈 가져오기
    if (typeof window !== 'undefined' && window.ModuleManager) {
      const sectionDBManager = window.ModuleManager.loadGlobalModule('sectionDBManager');
      
      if (sectionDBManager) {
        console.log(`[BrowserPage] ${curSectionName} 섹션 데이터 로드 시작`);
        
        // 섹션 데이터 가져오기
        sectionDBManager.getSectionItems(curSectionName).then(_sectionItemListfromDB => {
          if (_sectionItemListfromDB.length > 0) {
            // 새 아이템 리스트로 업데이트
            setCurItemListInCurSection((prev) => {
              prevItemListforRelieveOverlays.current = prev;
              return _sectionItemListfromDB;
            });
            
            console.log(`[BrowserPage] ${curSectionName} 섹션 데이터 로드 완료 (${_sectionItemListfromDB.length}개 항목)`);
          } else {
            console.error(`[BrowserPage] ${curSectionName} 섹션 데이터를 가져오지 못함`);
          }
        });
      } else {
        console.error('[BrowserPage] sectionDBManager 모듈을 찾을 수 없음');
      }
    }
    
    // 클린업 함수
    return () => {
      document.removeEventListener('section-items-updated', handleSectionUpdate);
    };
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