import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { selectIsCompareBarActive, toggleCompareBar } from '../store/slices/rightSidebarSlice';

// 상점 데이터 인풋창 타이틀 배열
const titlesofDataFoam = [
  { field: 'storeName', title: '상점명' },
  { field: 'storeStyle', title: '상점 스타일' },
  { field: 'alias', title: '별칭' },
  { field: 'comment', title: '코멘트' },
  { field: 'locationMap', title: '위치지역' },
  { field: 'businessHours', title: '영업시간' },
  { field: 'hotHours', title: 'hot시간' },
  { field: 'discountHours', title: '할인시간' },
  { field: 'address', title: '주소' },
  { field: 'pinCoordinates', title: '핀 좌표' },
  { field: 'path', title: '다각형 경로' },
  { field: 'categoryIcon', title: '아이콘분류' },
  { field: 'googleDataId', title: '구글데이터ID' }
];

/**
 * 왼쪽 사이드바 내부 컴포넌트
 * 비교를 위한 상점 정보 표시 기능 제공 (데이터 바인딩 없음)
 * 
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareSidebarContent = () => {
  return (
    <div className={`${styles.rightSidebarCard}`}>
      <div className={styles.rightSidebarButtonContainer}>
        <h3>비교 데이터</h3>
      </div>
      
      <form className={styles.rightSidebarForm}>
        {/* 상점 정보 필드들을 배열로부터 렌더링 */}
        {titlesofDataFoam.map(item => (
          <div key={item.field} className={styles.rightSidebarFormRow}>
            <span>{item.title}</span>
            <div className={styles.rightSidebarInputContainer}>
              <input
                type="text"
                name={item.field}
                value=""
                readOnly={true}
                className={styles.emptyInput}
              />
            </div>
          </div>
        ))}
        
        {/* 이미지 미리보기 영역 */}
        <div className={styles.imagesPreviewContainer}>
          <div className={styles.imageSection}>
            <div className={styles.mainImageContainer}>
              <div className={styles.emptyImagePlaceholder}>
                <span>메인 이미지</span>
              </div>
            </div>
          </div>
          
          <div className={styles.imageSection}>
            <div className={styles.subImagesContainer}>
              {/* 빈 서브 이미지 4개 표시 */}
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

/**
 * 왼쪽 사이드바 컴포넌트 (UI만 표시)
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareBar = () => {
  const isCompareBarActive = useSelector(selectIsCompareBarActive);
  const dispatch = useDispatch();

  // CompareBar 활성화 상태가 변경될 때 body 클래스 토글
  useEffect(() => {
    if (isCompareBarActive) {
      document.body.classList.add('compareBarVisible');
    } else {
      document.body.classList.remove('compareBarVisible');
    }
    
    // 컴포넌트 언마운트 시 클래스 제거
    return () => {
      document.body.classList.remove('compareBarVisible');
    };
  }, [isCompareBarActive]);

  // 닫기 버튼 클릭 핸들러
  const handleCloseButtonClick = () => {
    dispatch(toggleCompareBar());
  };

  // isCompareBarActive가 false일 때는 null 반환 (렌더링하지 않음)
  if (!isCompareBarActive) {
    return null;
  }

  return (
    <div className={`${styles.rightSidebar} ${styles.compareBarPosition}`}>
      {/* 상단 헤더 영역 추가 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          <span className={styles.editingStatusText}>비교 데이터</span>
        </div>
        <button 
          className={styles.addShopButton} 
          onClick={handleCloseButtonClick}
          title="비교 데이터 닫기"
        >
          &gt;닫기
        </button>
      </div>
      
      <CompareSidebarContent />
    </div>
  );
};

export default CompareBar; 