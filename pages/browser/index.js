import React, { useState } from 'react';
import MapViewMarking from '../../components/mapviewmarking';
import ExploringSidebar from '../../components/exploringsidebar';
import TravelCommunity from '../../components/travelCommunity';
import styles from './styles.module.css';

const BrowserPage = () => {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);

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
        <ExploringSidebar />
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className={styles['browser-mainContent']}>
        {/* 왼쪽 사이드바 토글 버튼 */}
        <button 
          className={`${styles['browser-toggleButton']} ${styles['browser-leftToggleButton']}`} 
          onClick={toggleLeftSidebar}
          title={isLeftSidebarVisible ? "사이드바 숨기기" : "사이드바 표시"}
        >
          {isLeftSidebarVisible ? "◀" : "▶"}
        </button>

        {/* 오른쪽 사이드바 토글 버튼 */}
        <button 
          className={`${styles['browser-toggleButton']} ${styles['browser-rightToggleButton']}`} 
          onClick={toggleRightSidebar}
          title={isRightSidebarVisible ? "채팅 숨기기" : "채팅 표시"}
        >
          {isRightSidebarVisible ? "▶" : "◀"}
        </button>

        {/* 맵 뷰 */}
        <MapViewMarking className={styles['browser-mapView']} />
      </div>

      {/* 오른쪽 사이드바 영역 - 채팅 컴포넌트 */}
      <div className={`${styles['browser-rightSidebar']} ${isRightSidebarVisible ? '' : styles['browser-rightSidebarHidden']}`}>
        <TravelCommunity />
      </div>
    </div>
  );
};

export default BrowserPage; 