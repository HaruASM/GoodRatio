import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import store from '../../lib/store';
import Image from 'next/image';

import styles from '../../pages/editor/styles.module.css';
import { 
  selectIsCompareBarActive, 
  selectCompareBarData,
  selectIsInserting,
   beginInserting,
  endInserting,
  endCompareBar,
  } from '../../lib/store/slices/compareBarSlice';
import { 
  updateField,
  trackField,
  startEdit,
  beginEditor,
  selectIsEditing,
  selectIsEditorOn,
  selectIsIdle,
  addImagesToSubImages
} from '../../lib/store/slices/rightSidebarSlice';
import {
  selectSelectedItemId,
  selectSelectedSectionName
} from '../../lib/store/slices/mapEventSlice';

import { 
  openImageSelectionMode,
  selectIsImageSelectionMode,
  selectSelectedImages,
  resetImageSelection,
  confirmImageSelection,
  openGallery  
} from '../../lib/store/slices/imageGallerySlice';
import { titlesofDataFoam, protoServerDataset, isValueEmpty } from '../../lib/models/editorModels';
import { batchPreCacheImagesForGoggleReferece } from '../../lib/utils/imageHelpers';
import { createLoadingOverlayforDIV, withLoadingOverlay } from '../../lib/utils/uiHelpers';
import Md5 from 'crypto-js/md5';


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
 * Google 이미지 참조 문자열을 Cloudinary public ID로 변환합니다.
 * @param {string} photoReference - Google 이미지 참조 문자열
 * @param {string} sectionName - 섹션 이름 (예: 'tempsection')
 * @param {string|object} placeId - 장소 ID (문자열 또는 객체)
 * @param {number} imageIndex - 이미지 인덱스
 * @returns {string} Cloudinary public ID
 */
const convertGoogleImageReferenceToPublicId = (photoReference, sectionName, placeId ) => {
 
  // MD5 해시를 사용하여 고유한 ID 생성
  return `map-places/${sectionName}/${placeId}/${
    Md5(photoReference).toString()
  }`;
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
  //const selectedItemId = useSelector(selectSelectedItemId);
  //const selectedSectionName = useSelector(selectSelectedSectionName);
  
  
  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    const value = compareData[fieldName];
    const isEmpty = isValueEmpty(value, fieldName);
    return !isEmpty ? styles.filledInput : styles.emptyInput;
  };
  
  // 개별 필드 삽입 핸들러
  const handleInsertField = (field, value) => {
    console.log('handleInsertField', field, value); 
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
  const selectedImagesFromRedux = useSelector(selectSelectedImages);

  // 유효한 이미지 개수 계산, 구글 photo reference ID를 publicID로 변환 
  let totalCountValidImages = 0; //구글 이미지 섹션 DOM에서 이미지 개수 표시용
  const allImagePublicIds = []; // 이미지 갤러리 열기 액션의 payload용
  // 모든 관련 정보를 함께 저장하는 배열 추가
  const imageInfoArray = []; // pre캐싱을 위한 이미지 정보 배열
  
  if( typeof compareData?.mainImage === 'string' && compareData?.mainImage.trim() !== '' ) { //''문자열은 빈값
    totalCountValidImages++;
    const publicId = convertGoogleImageReferenceToPublicId(compareData.mainImage, 'tempsection', compareData.googleDataId);
    allImagePublicIds.push(publicId);
    
    // 이미지별 html_attributions 가져오기
    let imageAttributions = [];
    
    // 이미지별 attributions 맵에서 저작권 정보 가져오기
    if (compareData.imageAttributions && compareData.imageAttributions[compareData.mainImage]) {
      imageAttributions = compareData.imageAttributions[compareData.mainImage];
      console.log('메인 이미지 저작권 정보:', imageAttributions);
    }
    
    // 이미지 정보 배열에 추가
    imageInfoArray.push({
      publicId,
      reference: compareData.mainImage,
      placeId: compareData.googleDataId,
      html_attributions: imageAttributions
    });
  }


  if( Array.isArray(compareData?.subImages) ) {
    compareData.subImages.forEach((imgRef, index) => {
      if( typeof imgRef === 'string' && imgRef.trim() !== '' ) {
        totalCountValidImages++;
        const publicId = convertGoogleImageReferenceToPublicId(imgRef, 'tempsection', compareData.googleDataId);
        allImagePublicIds.push(publicId);
        
        // 이미지별 html_attributions 가져오기
        let imageAttributions = [];
        
        // 이미지별 attributions 맵에서 저작권 정보 가져오기
        if (compareData.imageAttributions && compareData.imageAttributions[imgRef]) {
          imageAttributions = compareData.imageAttributions[imgRef];
          console.log(`서브 이미지 #${index} 저작권 정보:`, imageAttributions);
        }
        
        // 이미지 정보 배열에 추가
        imageInfoArray.push({
          publicId,
          reference: imgRef,
          placeId: compareData.googleDataId,
          html_attributions: imageAttributions
        });
      }
    });
  }

  console.log('totalCountValidImages', totalCountValidImages);
  console.log('allImagePublicIds', allImagePublicIds.length);
  console.log('imageInfoArray', imageInfoArray.length);

  
  // 로딩 오버레이를 표시할 DOM 요소 참조를 위한 useRef
  const galleryLoadingContainerRef = useRef(null); // 갤러리 보기 버튼에 로딩 오버레이 표시용, 이미지 삽입 버튼에 로딩 오버레이 표시에도 재사용
  
  // 이미지 갤러리 열기 핸들러 수정
  const handleViewGallery = () => {
    // 이미 정의된 조건 검사
    if (totalCountValidImages === 0) return;
    
    // withLoadingOverlay를 직접 호출하여 사용
    return withLoadingOverlay(
      // 비동기 함수 정의
      async () => {
        // 이미지 프리캐싱 실행
        const cachedPublicIds = await batchPreCacheImagesForGoggleReferece(
          imageInfoArray, 
          compareData.googleDataId, 
          3
        );
        
        // 갤러리 열기
        if (cachedPublicIds && cachedPublicIds.length > 0) {
          dispatch(openGallery({
            images: cachedPublicIds,
            index: 0
          }));
        } else if (allImagePublicIds.length > 0) {
          dispatch(openGallery({
            images: allImagePublicIds,
            index: 0
          }));
        }
      },
      // 로딩 오버레이가 표시될 DOM 요소
      galleryLoadingContainerRef.current,
      // 오버레이 옵션
      {
        message: '...',
        zIndex: 10
      }
    )();
  };

  // 이미지 섹션 오버레이 클릭 핸들러 수정
  const handleImageSectionOverlayClick = () => {
    if (totalCountValidImages === 0) return;
    
    return withLoadingOverlay(
      // 비동기 함수 정의
      async () => {
        // 이미지 데이터 초기화
        dispatch(resetImageSelection());
        
        // 이미지 프리캐싱 실행
        const cachedPublicIds = await batchPreCacheImagesForGoggleReferece(
          imageInfoArray, 
          compareData.googleDataId, 
          3
        );
        
        // 갤러리 열기
        if (cachedPublicIds && cachedPublicIds.length > 0) {
          dispatch(openImageSelectionMode({
            images: cachedPublicIds,
          }));
        } else if (allImagePublicIds.length > 0) {
          dispatch(openImageSelectionMode({
            images: allImagePublicIds,
          }));
        }
      },
      // 로딩 오버레이가 표시될 DOM 요소
      galleryLoadingContainerRef.current,
      // 오버레이 옵션
      {
        //message: '이미지 준비중...',
        zIndex: 20
      }
    )();
  };

  // confirmImageSelection 액션을 구독하는 useEffect 추가
  useEffect(() => {
    // 이미지 선택 모드가 종료되고 선택된 이미지가 있을 때
    if (!isImageSelectionMode && selectedImagesFromRedux && selectedImagesFromRedux.length > 0) {
      // 새로운 액션 디스패치하여 이미지 추가
      dispatch(addImagesToSubImages(selectedImagesFromRedux));
    }
  }, [isImageSelectionMode, selectedImagesFromRedux, dispatch]);

  // 이미지 선택 취소 핸들러
  const handleCancelImageSelection = () => {
    // 이미지 매니저 상태 즉시 초기화
    dispatch(resetImageSelection());
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
          
          // 특별한 필드 처리 (핀 좌표, 다각형 경로)
          if (item.field === 'pinCoordinates' || item.field === 'path') {
            // isEmpty가 이미 isValueEmpty 함수에서 판단됨
            // protoServerDataset의 기본값과 같으면 isEmpty=true
            const displayValue = isEmpty ? "" : "좌표있음";
            
            return (
              <div key={item.field} className={styles.rightSidebarFormRow}>
                <span>{item.title}</span>
                <div className={styles.rightSidebarInputContainer}>
                  <input
                    type="text"
                    name={item.field}
                    value={displayValue}
                    readOnly={true}
                    className={!isEmpty ? styles.filledInput : styles.emptyInput}
                  />
                  
                  {/* 삽입 모드이고 값이 있는 경우에만 삽입 버튼 표시 */}
                  {isInserting && !isEmpty && (
                    <button
                      type="button"
                      className={styles.insertFieldButton}
                      onClick={() => handleInsertField(item.field,  compareData[item.field])} //value 대신 compareData[item.field] 사용
                      title={`${item.title} 필드 삽입`}
                    >
                      <strong>&gt;&gt;</strong>
                    </button>
                  )}
                </div>
              </div>
            );
          } else {
            // 일반 필드 처리 (기존 코드)
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
                      onClick={() => handleInsertField(item.field, compareData[item.field])}//value 대신 compareData[item.field] 사용
                      title={`${item.title} 필드 삽입`}
                    >
                      <strong>&gt;&gt;</strong>
                    </button>
                  )}
                </div>
              </div>
            );
          }
        })}
        
        {/* 이미지 미리보기 섹션 */}
        <div className={styles.imageSectionPreviewContainer}>
          {/* 이미지 갤러리 버튼 영역 */}
          <div 
            
            className={styles.emptyImagePlaceholder}
            style={{ cursor: totalCountValidImages > 0 && !isInserting ? 'pointer' : 'default' }}
            onClick={!isInserting && totalCountValidImages > 0 ? handleViewGallery : undefined}
          >
            <div style={{ fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {totalCountValidImages > 0 
                ? `구글 이미지 ${totalCountValidImages}개${!isInserting ? ' ' : ''}` 
                : ' '}
            </div>

           
          </div>
          
          
          {/* 삽입 모드일 때 이미지 오버레이 표시 */}
          {isInserting && (
            <div 
              className={styles.imageSectionOverlayContainer}
              onClick={handleImageSectionOverlayClick}
            >
              <span className={styles.imageSectionOverlayText}>&gt;&gt; 이미지 삽입</span>
            </div>
          )}

          
        </div>
        <div ref={galleryLoadingContainerRef} > </div>
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
  const selectedItemId = useSelector(selectSelectedItemId);
  const selectedSectionName = useSelector(selectSelectedSectionName);
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
      console.error('이 케이스 발생시 수정 필요');
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
      // isEditing이 false일 때만 startEdit 호출
      if (!isEditing) {
        // 현재 선택된 아이템이 있는 경우 해당 아이템의 데이터를 가져와 startEdit 액션 디스패치
        if (selectedItemId && selectedSectionName && window.SectionsDBManager) {
          const selectedItem = window.SectionsDBManager.getItemByIDandSectionName(
            selectedItemId, 
            selectedSectionName
          );
          
          if (selectedItem && selectedItem.serverDataset) {
            dispatch(startEdit({ itemdata: selectedItem.serverDataset }));
          }
        } else {
          // 선택된 아이템이 없거나 SectionsDBManager가 없는 경우
          // 빈 protoServerDataset으로 시작
          dispatch(startEdit({ itemdata: protoServerDataset }));
        }
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