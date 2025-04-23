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
} from '../../lib/store/slices/rightSidebarSlice';
import {
  selectSelectedItemId,
  selectSelectedSectionName
} from '../../lib/store/slices/mapEventSlice';

import { 
  openImageSelectionMode,
  //selectIsImageSelectionMode,
  openGallery,
  resetImageSelection
} from '../../lib/store/slices/imageGallerySlice';
import { titlesofDataFoam, protoServerDataset } from '../../lib/models/editorModels';
import { batchPreCacheImagesForGoggleReferece } from '../../lib/utils/imageHelpers';
import Md5 from 'crypto-js/md5';

/**
 * 값이 비어있는지 확인하는 공통 함수
 * compareBar 컴포넌트 외부로 이동하여 공유 가능하도록 함
 */
const isValueEmpty = (value, fieldName) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && (value.length === 0 || (value.length === 1 && value[0] === ''))) return true;
  
  // 특정 필드에 대한 추가 로직
  if (fieldName === 'pinCoordinates') {
    // 값이 없거나 빈 문자열이면 빈 값으로 간주
    if (!value || value === '') return true;
    
    // 값이 객체이고 protoServerDataset의 기본값과 같으면 빈 값으로 간주
    if (typeof value === 'object' && value !== null) {
      return (value.lat === 0 && value.lng === 0) || 
             (value.lat === protoServerDataset.pinCoordinates.lat && 
              value.lng === protoServerDataset.pinCoordinates.lng);
    }
  }
  
  if (fieldName === 'path') {
    // 값이 없거나 빈 문자열이면 빈 값으로 간주
    if (!value || value === '') return true;
    
    // 값이 배열이고 protoServerDataset의 기본값과 같으면 빈 값으로 간주
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      if (value.length === 1) {
        const defaultPath = protoServerDataset.path[0];
        return value[0].lat === defaultPath.lat && value[0].lng === defaultPath.lng;
      }
    }
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
 * Google 이미지 참조 문자열을 Cloudinary public ID로 변환합니다.
 * @param {string} photoReference - Google 이미지 참조 문자열
 * @param {string} sectionName - 섹션 이름 (예: 'tempsection')
 * @param {string|object} placeId - 장소 ID (문자열 또는 객체)
 * @param {number} imageIndex - 이미지 인덱스
 * @returns {string} Cloudinary public ID
 */
const convertGoogleImageReferenceToPublicId = (photoReference, sectionName, placeId ) => {
 
  // MD5 해시를 사용하여 고유한 ID 생성
  return `${sectionName}/${placeId}/${
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
  const hasValidData = hasAnyValidField(compareData); //FIXME 이게 왜 필요하지

  // 리덕스 상태 사용
  //const isImageSelectionMode = useSelector(selectIsImageSelectionMode);

  // 유효한 이미지 개수 계산, 구글 photo reference ID를 publicID로 변환 
  let totalCountValidImages = 0; //구글 이미지 섹션 DOM에서 이미지 개수 표시용
  const allImagePublicIds = []; // 이미지 갤러리 열기 액션의 payload용
  // 모든 관련 정보를 함께 저장하는 배열 추가
  const imageInfoArray = []; // pre캐싱을 위한 이미지 정보 배열
  
  if( typeof compareData?.mainImage === 'string' && compareData?.mainImage.trim() !== '' ) { //''문자열은 빈값
    totalCountValidImages++;
    const publicId = convertGoogleImageReferenceToPublicId(compareData.mainImage, 'tempsection', compareData.googleDataId);
    allImagePublicIds.push(publicId);
    
    // 이미지 정보 배열에 추가
    imageInfoArray.push({
      publicId,
      reference: compareData.mainImage,
      placeId: compareData.googleDataId
    });
  }

  console.log('compareData', compareData.mainImage);
  console.log('compareData', compareData.subImages);

 //FIXME 임시 코드주석

  // if( Array.isArray(compareData?.subImages) ) {
  //   compareData.subImages.forEach((imgRef, index) => {
  //     if( typeof imgRef === 'string' && imgRef.trim() !== '' ) {
  //       totalCountValidImages++;
  //       const publicId = convertGoogleImageReferenceToPublicId(imgRef, 'tempsection', compareData.googleDataId);
  //       allImagePublicIds.push(publicId);
        
  //       // 이미지 정보 배열에 추가
  //       imageInfoArray.push({
  //         publicId,
  //         reference: imgRef,
  //         placeId: compareData.googleDataId
  //       });
  //     }
  //   });
  // }

  console.log('totalCountValidImages', totalCountValidImages);
  console.log('allImagePublicIds', allImagePublicIds.length);
  console.log('imageInfoArray', imageInfoArray.length);

  
  // 이미지 갤러리 열기 핸들러.
  const handleViewGallery = useCallback(async () => {
    // 이 핸들러는 inserting 상태에서 호출되지 않음. DOM 랜더링 부터 안되도록 함.
    if (totalCountValidImages === 0) return;
    
    // 로딩 상태 표시 (DOM에 표시)
    const placeholderElement = document.querySelector(`.${styles.emptyImagePlaceholder} div`);
    let originalText = '';
    
    if (placeholderElement) {
      originalText = placeholderElement.textContent || `구글 이미지 ${totalCountValidImages}개`;
      
      // SVG 로딩 애니메이션 추가
      placeholderElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <style>
              .spinner {
                transform-origin: center;
                animation: spin 1.5s linear infinite;
              }
              @keyframes spin {
                100% { transform: rotate(360deg); }
              }
              .circle {
                stroke: #4CAF50;
                stroke-dasharray: 80;
                stroke-dashoffset: 60;
                animation: dash 1.5s ease-in-out infinite;
              }
              @keyframes dash {
                0% { stroke-dashoffset: 60; }
                50% { stroke-dashoffset: 20; }
                100% { stroke-dashoffset: 60; }
              }
            </style>
            <circle class="spinner" cx="12" cy="12" r="10" fill="none" stroke="#e6e6e6" stroke-width="2" />
            <circle class="circle" cx="12" cy="12" r="10" fill="none" stroke-width="2" stroke-linecap="round" />
          </svg>
          <div style="margin-top: 8px; font-size: 13px;">이미지 로딩중...</div>
        </div>
      `;
    }
    
    try {
      // 이미지 정보 배열에서 필요한 데이터만 사용하여 배치 프리캐싱 실행
      const cachedPublicIds = await batchPreCacheImagesForGoggleReferece(imageInfoArray, compareData.googleDataId, 3);
      
      // 작업 완료 후 로딩 표시 제거 및 이미지 갯수 표시 복원
      if (placeholderElement) {
        placeholderElement.innerHTML = `<div style="font-size: 15px; display: flex; justify-content: center; align-items: center;">구글 이미지 ${totalCountValidImages}개</div>`;
      }
      
      // cachedPublicIds가 null, undefined 또는 빈 배열이면 allImagePublicIds를 사용함
      if (!cachedPublicIds || !cachedPublicIds.length) {
        // 배치 프리캐싱이 실패한 경우 기존 방식으로 갤러리 열기
        if (allImagePublicIds.length > 0) {
          dispatch(openGallery({
            images: allImagePublicIds,
            index: 0
          }));
        }
      } else {
        // 캐싱된 이미지가 있으면 갤러리 열기
        dispatch(openGallery({
          images: cachedPublicIds,
          index: 0
        }));
      }
    } catch (error) {
      console.error('이미지 캐싱 중 오류 발생:', error);
      
      // 오류 발생 시 로딩 표시 제거 및 이미지 갯수 표시 복원
      if (placeholderElement) {
        placeholderElement.innerHTML = `<div style="font-size: 15px; display: flex; justify-content: center; align-items: center;">구글 이미지 ${totalCountValidImages}개</div>`;
      }
      
      // 오류 발생 시 기존 ID 사용하여 갤러리 열기
      if (allImagePublicIds.length > 0) {
        dispatch(openGallery({
          images: allImagePublicIds,
          index: 0
        }));
      }
    }
  }, [compareData, totalCountValidImages, allImagePublicIds, imageInfoArray, dispatch, styles.emptyImagePlaceholder]);

  // 우측 사이드바에 이미지 삽입 처리 함수
  const handleInsertImagesToRightsidebar = useCallback(() => {
   
    if( totalCountValidImages === 0 ) return;

    // 이미지 데이터 초기화
    dispatch(resetImageSelection());
    
    // 갤러리를 열기 전에 이미지가 있는지 확인
    if (allImagePublicIds.length > 0) {
      dispatch(openImageSelectionMode({
        images: allImagePublicIds,
        imageIndex: 0
      }));
    }
  }, [totalCountValidImages, allImagePublicIds, dispatch]);

  // 이미지 선택 완료 핸들러(이미지 선택 겔러리의 완료 동작을 위한 핸들러. 
  const handleSelectGalleryDone = (selectedImages) => {
    // 선택된 이미지 배열 깊은 복사 (문자열 배열이므로 JSON 방식 사용)
    const selectedImagesCopy = JSON.parse(JSON.stringify(selectedImages || []));
    
    // 이미지 매니저 상태 즉시 초기화
    dispatch(resetImageSelection());
    
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
    
    // 새로 선택된 이미지를 기존 배열에 추가 (빈 문자열 요소 필터링)
    const updatedSubImages = [...currentSubImages.filter(img => img && img.trim() !== ''), ...newImages];
    
    // Redux 액션 디스패치 - RightSidebar 상태 업데이트
    dispatch(updateField({ field: 'subImages', value: updatedSubImages }));
    dispatch(trackField({ field: 'subImages' }));
  };

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
          <div 
            className={styles.emptyImagePlaceholder}
            style={{ cursor: totalCountValidImages > 0 && !isInserting ? 'pointer' : 'default' }}
            onClick={handleViewGallery}
          >
            <div style={{ fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {totalCountValidImages > 0 
                ? `구글 이미지 ${totalCountValidImages}개${!isInserting ? ' ' : ''}` 
                : ' '}
            </div>

            {/* 메인 이미지 썸네일 미리보기 */}
            {compareData?.mainImage && typeof compareData.mainImage === 'string' && compareData.mainImage.trim() !== '' && (
              <div style={{ position: 'relative', width: '100%', height: '120px', marginTop: '8px' }}>
                <Image 
                  src={`/api/image-proxy?photo_reference=${encodeURIComponent(compareData.mainImage)}&maxwidth=150`}
                  alt="구글 이미지 미리보기"
                  fill
                  style={{ 
                    objectFit: 'contain',
                    borderRadius: '4px'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    console.error('구글 이미지 로딩 실패');
                  }}
                  unoptimized // 외부 URL을 사용하므로 Next.js의 이미지 최적화를 비활성화
                />
              </div>
            )}
            
          </div>
          
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