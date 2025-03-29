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
  endCompareBar,
  selectisSyncGoogleSearchCompareBar
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
import { 
  openImageSelectionMode,
  selectIsImageSelectionMode
} from '../store/slices/imageManagerSlice';
import { getValidImageRefs } from '../utils/imageHelpers';
import { titlesofDataFoam } from '../dataModels';

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
    }
  };

  // 데이터에 유효한 필드가 있는지 확인
  const hasValidData = hasAnyValidField(compareData);

  // 리덕스 상태 사용
  const isImageSelectionMode = useSelector(selectIsImageSelectionMode);
  
  // 이미지 갤러리에 이미지 삽입 핸들러
  const handleInsertImagesToRightsidebar = () => {
    // 이미지 데이터 유효성 검사
    const validImages = getValidImageRefs(compareData?.mainImage, compareData?.subImages);
    
    // 유효한 이미지가 없으면 종료
    if (validImages.length === 0) {
      return;
    }
    
    // 이미지 매니저 상태 완전 초기화
    dispatch({ type: 'imageManager/resetImageData' });
    
    // 이미지 선택 모드 활성화 - compareData의 원본 이미지를 직접 전달
    dispatch(openImageSelectionMode({
      source: 'compareBar',
      mainImage: compareData?.mainImage,
      subImages: compareData?.subImages,
      availableImages: validImages // 모든 유효한 이미지를 별도 필드로 전달
    }));
  };

  // 이미지 선택 완료 핸들러
  const handleImagesSelected = (selectedImages) => {
    // 선택된 이미지 배열 깊은 복사 (문자열 배열이므로 JSON 방식 사용)
    const selectedImagesCopy = JSON.parse(JSON.stringify(selectedImages || []));
    
    // 이미지 매니저 상태 즉시 초기화
    dispatch({ type: 'imageManager/resetImageData' });
    
    // 복사된 이미지 유효성 검사
    const validImages = selectedImagesCopy.filter(img => 
      img && typeof img === 'string' && img.trim() !== ''
    );
    
    if (!validImages?.length) return;
    
    // Redux 스토어에서 현재 RightSidebar의 subImages 배열 가져오기
    const currentFormData = store.getState().rightSidebar.formData;
    const currentSubImages = Array.isArray(currentFormData.subImages) ? 
      [...currentFormData.subImages] : [];
    
    // 이미 존재하는 이미지는 추가하지 않도록 필터링
    const newImages = validImages.filter(img => !currentSubImages.includes(img));
    
    // 추가할 새 이미지가 없으면 함수 종료
    if (newImages.length === 0) return;
    
    // 새로 선택된 이미지를 기존 배열에 추가
    const updatedSubImages = [...currentSubImages, ...newImages];
    
    // Redux 액션 디스패치 - RightSidebar 상태 업데이트
    dispatch(updateField({ field: 'subImages', value: updatedSubImages }));
    dispatch(trackField({ field: 'subImages' }));
  };

  // 이미지 선택 취소 핸들러
  const handleCancelImageSelection = () => {
    // 이미지 매니저 상태 즉시 초기화
    dispatch({ type: 'imageManager/resetImageData' });
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
                    <strong>&gt;&gt;</strong>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {/* 이미지 미리보기 섹션 */}
        <div className={styles.imageSectionPreviewContainer}>
          <ImageSectionManager 
            mainImage={compareData?.mainImage}
            subImages={compareData?.subImages}
            onImagesSelected={handleImagesSelected}
            onCancelSelection={handleCancelImageSelection}
            isSelectionMode={isImageSelectionMode}
            source="compareBar"
          />
          {/* 삽입 모드일 때 이미지 오버레이 표시 */}
          {isInserting && (
            <div 
              className={styles.imageSectionOverlayContainer}
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