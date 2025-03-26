import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import store from '../store';

import styles from '../styles.module.css';
import { 
  selectIsCompareBarActive, 
  selectCompareBarData,
  selectIsInserting,
  setCompareBarActive,
  beginInserting,
  endInserting,
  endCompareBar 
} from '../store/slices/compareBarSlice';
import { 
  updateField,
  trackField,
  startEditYourself,
  beginEditor,
  selectIsEditing,
  selectIsEditorOn,
  selectIsIdle,
} from '../store/slices/rightSidebarSlice';
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
 * 값이 비어있는지 확인하는 공통 함수
 * compareBar 컴포넌트 외부로 이동하여 공유 가능하도록 함
 */
const isValueEmpty = (value, fieldName) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && (value.length === 0 || (value.length === 1 && value[0] === ''))) return true;
  if (fieldName === 'path' || fieldName === 'pinCoordinates') {
    return !value || value === '';
  }
  return false;
};

/**
 * 데이터 객체에서 유효한 필드가 하나라도 있는지 확인
 * @param {Object} data - 확인할 데이터 객체
 * @returns {boolean} 하나라도 유효한 값이 있으면 true, 모두 비어있으면 false
 */
const hasAnyValidField = (data) => {
  if (!data) return false;
  
  // 기본 필드들만 검사 (이미지 필드 제외)
  const fieldsToCheck = titlesofDataFoam.map(item => item.field);
  
  return fieldsToCheck.some(field => !isValueEmpty(data[field], field));
};

/**
 * 왼쪽 사이드바 내부 컴포넌트
 * 비교를 위한 상점 정보 표시 기능 제공
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {Function} props.onClose - 닫기 버튼 클릭 시 호출될 함수
 * @param {Function} props.onInsertToRightSidebar - 삽입 버튼 클릭 시 호출될 함수
 * @param {Function} props.onStopInsertMode - 삽입 모드 종료 시 호출될 함수
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareSidebarContent = ({ onClose, onInsertToRightSidebar, onStopInsertMode }) => {
  // Redux에서 compareBar 데이터 가져오기
  const compareData = useSelector(selectCompareBarData);
  const isInserting = useSelector(selectIsInserting);
  const dispatch = useDispatch();
  
  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    const value = compareData[fieldName];
    const isEmpty = isValueEmpty(value, fieldName);
    return !isEmpty ? styles.filledInput : styles.emptyInput;
  };
  
  // 개별 필드 삽입 핸들러
  const handleInsertField = (field, value) => {
    // 필드 값이 비어있지 않은 경우에만 삽입
    if (!isValueEmpty(value, field)) {
      dispatch(updateField({ field, value }));
      dispatch(trackField({ field }));
      console.log(`필드 '${field}' 삽입: ${value}`);
    }
  };

  // 데이터에 유효한 필드가 있는지 확인
  const hasValidData = hasAnyValidField(compareData);

  // 이미지 선택 모드 상태
  const [isImageSelectionMode, setIsImageSelectionMode] = useState(false);

  // 이미지 미리보기 섹션에서 선택 모드 활성화
  const handleInsertImagesToRightsidebar = () => {
    setIsImageSelectionMode(true);
    // 순서 편집 모드 비활성화 - 명시적으로 선택 모드만 사용
    console.log('이미지 선택 모드 활성화');
  };
  
  // 이미지 선택 완료 처리
  const handleImagesSelected = (selectedImages) => {
    if (selectedImages && selectedImages.length > 0) {
      // 선택된 이미지 배열을 콘솔에 출력
      console.log('선택된 이미지:', selectedImages);
      
      // 1. 현재 rightSidebar의 subImages 배열을 가져옴
      const currentFormData = store.getState().rightSidebar.formData;
      const currentSubImages = currentFormData.subImages || [];
      
      // 2. 새 이미지들을 기존 배열에 추가
      const updatedSubImages = [...currentSubImages, ...selectedImages];
      
      // 3. 업데이트된 배열을 rightSidebar에 전달
      dispatch(updateField({ field: 'subImages', value: updatedSubImages }));
      
      // 4. 변경 필드 추적
      dispatch(trackField({ field: 'subImages' }));
      
      console.log('이미지가 subImages 배열에 추가되었습니다.');
    } else {
      console.log('선택된 이미지 없음');
    }
    
    // 선택 모드 종료
    setIsImageSelectionMode(false);
  };
  
  // 이미지 선택 취소 처리
  const handleCancelImageSelection = () => {
    setIsImageSelectionMode(false);
    console.log('이미지 편집이 취소되었습니다.');
  };

  return (
    <div className={`${styles.rightSidebarCard}`}>
      {/* isInserting 상태가 아닐 때만 버튼 표시 */}
      {!isInserting && (
        <div className={styles.rightSidebarButtonContainer}>
          <h3>비교Data</h3>
          <button 
            onClick={onInsertToRightSidebar}
            title={hasValidData ? "비교값을 상점Data로 보내기" : "유효한 데이터가 없습니다"}
            disabled={!hasValidData}
            className={!hasValidData ? styles.disabledButton : ''}
          > 
          &gt;&gt;삽입
          </button>
          <button 
            onClick={onClose}
            title="비교창 닫기"
          >
            닫기
          </button>
        </div>
      )}
      
      {/* isInserting 상태일 때는 다른 헤더 표시 */}
      {isInserting && (
        <div className={styles.rightSidebarButtonContainer}>
          <h3>필드 선택</h3>
          <button 
            onClick={onStopInsertMode}
            title="삽입 모드 종료"
          > 
            완료
          </button>
        </div>
      )}
      
      <form className={styles.rightSidebarForm}>
        {/* 상점 정보 필드들을 배열로부터 렌더링 */}
        {titlesofDataFoam.map(item => {
          const value = compareData[item.field];
          const isEmpty = isValueEmpty(value, item.field);
          
          return (
            <div key={item.field} className={styles.rightSidebarFormRow}>
              <span>{item.title}</span>
              <div className={styles.rightSidebarInputContainer}>
                <input
                  type="text"
                  name={item.field}
                  value={value || ""}
                  readOnly={true}
                  className={getInputClassName(item.field)}
                />
                
                {/* 삽입 모드이고 값이 있는 경우에만 삽입 버튼 표시 */}
                {isInserting && !isEmpty && (
                  <button
                    type="button"
                    className={styles.insertFieldButton}
                    onClick={() => handleInsertField(item.field, value)}
                    title={`${item.title} 필드 삽입`}
                  >
                    &gt;&gt;
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {/* 이미지 미리보기 섹션 */}
        <div className={styles.compareBarSection}>
          <ImageSectionManager 
            mainImage={compareData?.mainImage}
            subImages={compareData?.subImages}
            onImagesSelected={handleImagesSelected}
            onCancelSelection={handleCancelImageSelection}
            isSelectionMode={isImageSelectionMode}
            isEditMode={false}
          />
          {/* 삽입 모드일 때 이미지 오버레이 표시 */}
          {isInserting && (
            <div 
              className={styles.imageSectionOverlay}
              onClick={handleInsertImagesToRightsidebar}
            >
              <span className={styles.imageSectionOverlayText}>&gt;&gt; 이미지 삽입</span>
            </div>
          )}
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
  const isInserting = useSelector(selectIsInserting);
  const isEditing = useSelector(selectIsEditing);
  const isEditorOn = useSelector(selectIsEditorOn);
  const isIdle = useSelector(selectIsIdle);
  const compareData = useSelector(selectCompareBarData);
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

  // 삽입 모드 종료 핸들러
  const handleStopInsertMode = () => {
    dispatch(endInserting());
  };

  // 삽입 버튼 클릭 핸들러
  const handleInsertButtonClick = () => {
    if (isInserting) {
      // 이미 삽입 모드인 경우 종료
      dispatch(endInserting());
      console.log('이 케이스 발생시 수정 필요');
    } else {
      
    

      // 모든 필드가 비어있는지 확인
      if (!hasAnyValidField(compareData) || isIdle ) {
        //console.log('삽입 불가: 유효한 데이터가 없습니다.');
        // 우측 사이드바가 Idle 상태인 경우 삽입 불가
        return; // 모든 필드가 비어있으면 액션 종료
      }
      
      // 삽입 모드 시작
      dispatch(beginInserting());
      
      
      // rightSidebar의 에디터 상태 활성화
      // isEditing이 false일 때만 startEditYourself 호출 
      if (!isEditing  ) {
        // rightSidebar가 자신의 formData를 사용하도록 startEditYourself 호출
        dispatch(startEditYourself());
        // 에디터 상태 활성화
        dispatch(beginEditor());
      }
      
      // isEditorOn이 false이고 isEditing이 true일 때만 beginEditor 호출
      if (!isEditorOn && isEditing) {
        dispatch(beginEditor());
      }
    }
  };

  return (
    <div className={styles.compareBarWrapper}>
      <div className={styles.rightSidebarCard}>
        {/* 상단 헤더 영역 제외 */}
        <CompareSidebarContent 
          onClose={handleCloseButtonClick} 
          onInsertToRightSidebar={handleInsertButtonClick} 
          onStopInsertMode={handleStopInsertMode}
        />
      </div>
    </div>
  );
};

export default CompareBar; 