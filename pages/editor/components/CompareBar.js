import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import styles from '../styles.module.css';
import { 
  selectIsCompareBarActive, 
  selectCompareBarData,
  setCompareBarActive,
  endCompareBar 
} from '../store/slices/compareBarSlice';
import { updateField } from '../store/slices/rightSidebarSlice';
import ImageSectionManager from './ImageSectionManager';

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
 * @param {Object} props - 컴포넌트 속성
 * @param {Function} props.onClose - 닫기 버튼 클릭 시 호출될 함수
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareSidebarContent = ({ onClose }) => {
  // Redux에서 compareBar 데이터 가져오기
  const compareData = useSelector(selectCompareBarData);
  
  
  // 디버깅을 위한 콘솔 로그 추가
  // console.log('CompareBar 데이터:', compareData);
  // console.log('메인 이미지 URL:', compareData.mainImage);
  // console.log('서브 이미지 배열:', compareData.subImages);
  
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
        <button 
          className={styles.addShopButton} 
          onClick={onClose}
          title="비교 데이터 닫기"
        >
          &gt;닫기
        </button>
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
        
        {/* 이미지 미리보기 섹션 */}
        <div className={styles.compareBarSection}>
          <ImageSectionManager 
            mainImage={compareData?.mainImage}
            subImages={compareData?.subImages}
          />
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
    <div className={styles.compareBarWrapper}>
      <div className={styles.rightSidebarCard}>
        {/* 상단 헤더 영역 추가 */}
        <div className={styles.editorHeader}>
        </div>
        
        <CompareSidebarContent onClose={handleCloseButtonClick} />
      </div>
    </div>
  );
};

export default CompareBar; 