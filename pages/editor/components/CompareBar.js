import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { 
  selectIsCompareBarActive, 
  selectCompareBarData,
  setCompareBarActive,
  endCompareBar 
} from '../store/slices/compareBarSlice';

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
 * 비교를 위한 상점 정보 표시 기능 제공
 * 
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareSidebarContent = () => {
  // Redux에서 compareBar 데이터 가져오기
  const compareData = useSelector(selectCompareBarData);
  
  // 값이 비어있는지 확인하는 공통 함수
  const isValueEmpty = (value, fieldName) => {
    if (value === null || value === undefined) return true;
    if (value === '') return true;
    if (Array.isArray(value) && (value.length === 0 || (value.length === 1 && value[0] === ''))) return true;
    if (fieldName === 'path' || fieldName === 'pinCoordinates') {
      return !value || value === '';
    }
    return false;
  };

  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    const value = compareData[fieldName];
    const isEmpty = isValueEmpty(value, fieldName);
    return !isEmpty ? styles.filledInput : styles.emptyInput;
  };

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
                value={compareData[item.field] || ""}
                readOnly={true}
                className={getInputClassName(item.field)}
              />
            </div>
          </div>
        ))}
        
        {/* 이미지 미리보기 영역 */}
        <div className={styles.imagesPreviewContainer}>
          <div className={styles.imageSection}>
            <div className={styles.mainImageContainer}>
              {compareData.mainImage ? (
                <img 
                  src={compareData.mainImage} 
                  alt="메인 이미지" 
                  className={styles.mainImagePreview}
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/200x150?text=이미지+로드+실패";
                    e.target.alt = "이미지 로드 실패";
                  }}
                />
              ) : (
                <div className={styles.emptyImagePlaceholder}>
                  <span>메인 이미지</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.imageSection}>
            <div className={styles.subImagesContainer}>
              {compareData.subImages && Array.isArray(compareData.subImages) && compareData.subImages.length > 0 && compareData.subImages[0] !== "" ? (
                compareData.subImages.slice(0, 4).map((imgUrl, index) => (
                  <div key={index} className={styles.subImageItem}>
                    <img 
                      src={imgUrl} 
                      alt={`서브 이미지 ${index + 1}`} 
                      className={styles.subImagePreview}
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/100x75?text=로드+실패";
                        e.target.alt = "이미지 로드 실패";
                      }}
                    />
                  </div>
                ))
              ) : (
                // 빈 서브 이미지 4개 표시
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className={styles.subImageItem}>
                    <div className={styles.emptyImagePlaceholder}>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

/**
 * 왼쪽 사이드바 컴포넌트 (Redux 연결)
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

  // 컴포넌트 마운트 시 데이터 초기화
  useEffect(() => {
    
     return () => {
      dispatch(endCompareBar());
    };
  }, [dispatch]);

  // 닫기 버튼 클릭 핸들러
  const handleCloseButtonClick = () => {
    dispatch(endCompareBar());
  };

  // 내부 조건부 렌더링 제거 (이제 index.js에서 처리함)
  return (
    <div className={`${styles.compareBarSidebar}`}>
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