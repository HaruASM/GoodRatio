import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { protoServerDataset } from '../../../lib/models/editorModels';
import { parseGooglePlaceData, fetchPlaceDetailById } from '../../../lib/utils/googlePlaceUtils';
import {
  togglePanel,
  startEdit,
  completeEditor,
  cancelEdit,
  updateField,
  trackField,
  syncExternalShop,
  saveShopData,
  selectIsPanelVisible,
  selectIsEditing,
  selectIsConfirming,
  selectHasChanges,
  selectFormData,
  selectModifiedFields,
  selectEditNewShopDataSet,
  selectOriginalShopData,
  selectStatus,
  selectError,
  selectIsDrawing,
  selectDrawingType,
  selectIsIdle,
  selectIsEditorOn,
  
  startGsearch,
  setFieldValue,
  clearFieldValue,
  startConfirm,
  confirmAndSubmit,
  startDrawingMode,
  endEdit,
  beginEditor,
  finalSubmitToServer
} from '../../../lib/store/slices/rightSidebarSlice';

import { setCompareBarActive, setSyncGoogleSearch, selectIsInserting, endCompareBar } from '../../../lib/store/slices/compareBarSlice';
import ImageSectionManager from './ImageSectionManager';
import { 
  openImageOrderEditor,
  selectIsImageSelectionMode,
  selectIsImageOrderEditorOpen,
  resetImageData
} from '../../../lib/store/slices/imageManagerSlice';
import { getValidImageRefs } from '../../../lib/utils/imageHelpers';
import { titlesofDataFoam } from '../../../lib/models/editorModels';

// 확인 모달 컴포넌트
const ConfirmModal = ({ isOpen, storeName, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className={styles.confirmModalOverlay}>
      <div className={styles.confirmModal}>
        <h3>업데이트 확인</h3>
        <p><strong>&apos;{storeName || '신규 상점'}&apos;</strong>에 대한 서버업데이트를 진행</p>
        <div className={styles.confirmModalButtons}>
          <button className={styles.cancelButton} onClick={onCancel}>
            취소
          </button>
          <button className={styles.confirmSubmitButton} onClick={onConfirm}>
            확인 및 송신
          </button>
        </div>
      </div>
    </div>
  );
};

// 값이 비어있는지 확인하는 공통 함수
const isValueEmpty = (value, fieldName) => {
  // 값이 null 또는 undefined인 경우
  if (value === null || value === undefined) return true;
  
  // 빈 문자열인 경우
  if (value === '') return true;
  
  // 배열이고 비어있거나 첫 요소가 빈 문자열인 경우
  if (Array.isArray(value) && (value.length === 0 || (value.length === 1 && value[0] === ''))) return true;
  
  // 특정 필드에 대한 추가 로직
  if (fieldName === 'path' || fieldName === 'pinCoordinates') {
    return !value || value === '';
  }
  
  return false;
};

/**
 * 오른쪽 사이드바 내부 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const SidebarContent = ({ googlePlaceSearchBarButtonHandler, moveToCurrentLocation, mapOverlayHandlers, currentShopServerDataSet, onShopUpdate }) => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const isEditing = useSelector(selectIsEditing);
  const isEditorOn = useSelector(selectIsEditorOn);
  const isConfirming = useSelector(selectIsConfirming);
  const hasChanges = useSelector(selectHasChanges);
  const formData = useSelector(selectFormData);
  const modifiedFields = useSelector(selectModifiedFields);
  const editNewShopDataSet = useSelector(selectEditNewShopDataSet);
  const originalShopData = useSelector(selectOriginalShopData);
  const status = useSelector(selectStatus);
  const error = useSelector(selectError);
  const isDrawing = useSelector(selectIsDrawing);
  const drawingType = useSelector(selectDrawingType);
  const isIdle = useSelector(selectIsIdle);
  const isInsertingMode = useSelector(selectIsInserting);
  const isImageOrderEditorOpen = useSelector(selectIsImageOrderEditorOpen);
  const isImageSelectionMode = useSelector(selectIsImageSelectionMode);
  const isGalleryOpen = useSelector(state => state.imageManager.isGalleryOpen);
  
  // 상태 추가 - 모든 useState 호출을 여기로 이동
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [localInputState, setLocalInputState] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [isComposing, setIsComposing] = useState(false); // IME 입력 중인지 여부
  
  // 참조 객체 - 모든 useRef 호출을 여기로 이동
  const inputRefs = useRef({});
  const imageSectionManagerRef = useRef(null);
  const prevModalOpenRef = useRef(false);
  
  // 현재 상점 데이터가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (currentShopServerDataSet && !isEditing) {
      // 외부 상점 데이터와 동기화 - 직접 데이터 전달
      dispatch(syncExternalShop({ shopData: currentShopServerDataSet }));
    }
  }, [currentShopServerDataSet, isEditing, dispatch]);
  
  // 패널이 보이지 않으면 null 반환
  if (!isPanelVisible) {
    return null;
  }

  // 수정 상태에 따른 카드 스타일 결정
  const cardClassName = isEditing 
    ? `${styles.rightSidebarCard} ${styles.rightSidebarCardEditing}` 
    : styles.rightSidebarCard;

  // 입력 필드가 읽기 전용인지 확인하는 함수
  const isFieldReadOnly = (fieldName) => {
    // 현재 활성화된 필드는 편집 가능
    if (fieldName === activeField) {
      return false;
    }

    // 편집 모드가 아니면 모든 필드가 읽기 전용
    if (!isEditorOn) {
      return true;
    }
    
    // 핀 좌표와 경로는 항상 읽기 전용 (버튼으로만 수정 가능)
    if (fieldName === 'pinCoordinates' || fieldName === 'path') {
      return true;
    }
    
    // 편집 모드에서 빈 필드는 직접 편집 가능
    if (!formData[fieldName] || formData[fieldName] === '') {
      return false;
    }
    
    // 그 외 값이 있는 필드는 편집 버튼 사용 (읽기 전용)
    return true;
  };

  // 필드 편집 버튼 클릭 핸들러 - 완전히 새로 작성
  const handleFieldEditButtonClick = (e, fieldName) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
   
    // 이미 다른 활성 필드가 있다면 저장
    if (activeField && activeField !== fieldName) {
      saveActiveFieldValue();
    }
    
    // 로컬 상태 업데이트 및 필드 활성화
    activateField(fieldName);
  };

  // 필드 활성화 함수 (여러 곳에서 재사용)
  const activateField = (fieldName) => {
        
    // 현재 formData 값으로 로컬 상태 초기화
    setLocalInputState(prev => ({
      ...prev,
      [fieldName]: formData[fieldName] || ""
    }));
    
    // 필드 활성화
    setActiveField(fieldName);
    
    // 포커스 및 필드 내용 선택
    requestAnimationFrame(() => {
      if (inputRefs.current[fieldName]) {
        inputRefs.current[fieldName].focus();
        inputRefs.current[fieldName].select();
      }
    });
  };

  // 현재 활성 필드 값 저장
  const saveActiveFieldValue = () => {
    if (!activeField) return;
    
    const currentValue = localInputState[activeField];
    const originalValue = formData[activeField];
           
    if (currentValue !== undefined) {
      // 값 변경 여부 확인
      const hasChanged = currentValue !== originalValue;
      
      // Redux 상태 업데이트
      dispatch(updateField({ field: activeField, value: currentValue }));
      
      // 값이 변경된 경우에만 추적 필드 추가
      if (hasChanged) {
        dispatch(trackField({ field: activeField }));
      }
      
      // 배열형 필드 특수 처리
      if (activeField === 'businessHours' && currentValue !== undefined) {
        let processedValue = currentValue;
        if (currentValue === '' || (typeof currentValue === 'string' && currentValue.trim() === '')) {
          processedValue = [""];
        } else if (typeof currentValue === 'string') {
          processedValue = currentValue.split(',').map(item => item.trim()).filter(item => item !== '');
          if (processedValue.length === 0) {
            processedValue = [""];
          }
        }
        
        if (JSON.stringify(processedValue) !== JSON.stringify(currentValue)) {
          dispatch(updateField({ field: activeField, value: processedValue }));
        }
      }
    }
  };

  // 로컬 입력 변경 핸들러 - 단순화
  const handleLocalInputChange = (e) => {
    const { name, value } = e.target;
    
    // 로컬 상태만 업데이트 (항상 업데이트 - IME 상태와 무관하게)
    setLocalInputState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // IME 이벤트 핸들러
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e) => {
    const { name, value } = e.target;
    setIsComposing(false);
    
    // 입력 완료 시 로컬 상태 최종 업데이트
    setLocalInputState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 포커스 핸들러 - 간소화
  const handleInputFocus = (e, fieldName) => {
    const { name } = e.target;
    
    // 이미 활성화된 필드라면 아무것도 하지 않음
    if (activeField === fieldName) {
      return;
    }
    
    // 해당 필드를 activeField로 설정했을 때만 활성화 처리
    if (
      // 빈 필드는 직접 활성화 가능
      (isEditorOn && (!formData[fieldName] || formData[fieldName] === '')) ||
      // 또는 편집 버튼으로 이미 활성화된 경우
      fieldName === activeField
    ) {
      // 이전 활성 필드가 있다면 저장
      if (activeField && activeField !== fieldName) {
        saveActiveFieldValue();
      }
      
      // 새 필드 활성화
      activateField(fieldName);
    }
  };

  // 블러 핸들러 - 단순화
  const handleInputBlur = (e) => {
    const { name } = e.target;
    
    // IME 입력 중에는 blur 무시
    if (isComposing) {
      
      // 다음 프레임에서 다시 포커스
      requestAnimationFrame(() => {
        if (inputRefs.current[name]) {
          inputRefs.current[name].focus();
        }
      });
      return;
    }
    
    // 활성 필드와 blur된 필드가 같을 때만 처리
    if (activeField === name) {
      // 값 저장
      saveActiveFieldValue();
      
      // 활성 필드 초기화
      setActiveField(null);
    }
  };

  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    // 값이 비어있는지 확인
    const isEmpty = isValueEmpty(formData[fieldName], fieldName);
    
    // 기본 스타일 (비어있거나 채워져 있는지)
    const baseClassName = !isEmpty ? styles.filledInput : styles.emptyInput;
    
    // 수정된 필드인 경우 추가 스타일
    if (modifiedFields && modifiedFields[fieldName]) {
      return `${baseClassName} ${styles.modifiedInput}`;
    }
    
    return baseClassName;
  };

  // 일반 필드용 입력 컴포넌트 - 단순화
  const renderInput = (fieldName, readOnly) => {
    const isActive = fieldName === activeField;
    const value = isActive ? (localInputState[fieldName] ?? "") : (formData[fieldName] ?? "");
    
    // 키 다운 이벤트 핸들러 추가
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // 기본 제출 동작 방지
        
        // 현재 필드의 값 저장
        if (activeField) {
          saveActiveFieldValue();
          setActiveField(null);
          e.target.blur(); // 포커스 해제
        }
      }
    };
    
    return (
      <>
        <input
          type="text"
          name={fieldName}
          value={value}
          onChange={isActive ? handleLocalInputChange : () => {}}
          onKeyDown={handleKeyDown} // 키 다운 이벤트 핸들러 추가
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={(e) => handleInputFocus(e, fieldName)}
          onBlur={handleInputBlur}
          readOnly={readOnly}
          className={getInputClassName(fieldName)}
          ref={el => inputRefs.current[fieldName] = el}
          autoComplete="off"
          onClick={() => {
            // 읽기 전용이 아닌 필드를 클릭했을 때만 활성화
            if (!isFieldReadOnly(fieldName) && !isActive) {
              activateField(fieldName);
            }
          }}
        />
        {/* 필드 편집 버튼 - 편집 모드일 때 값이 있는 필드에만 표시 */}
        {isEditorOn && formData[fieldName] && formData[fieldName] !== '' && !isActive && (
          <button
            type="button"
            className={styles.inputOverlayButton}
            onClick={(e) => handleFieldEditButtonClick(e, fieldName)}
            style={{ display: 'block' }}
            title="편집"
          >
            ✏️
          </button>
        )}
      </>
    );
  };

  // 수정 버튼 렌더링 부분 
  const EditButton = () => {
    const dispatch = useDispatch();
    const isIdle = useSelector(selectIsIdle);
    const isEditing = useSelector(selectIsEditing);
    const isEditorOn = useSelector(selectIsEditorOn);
    const isConfirming = useSelector(selectIsConfirming);
    
    // Command 패턴: 상태에 따른 명령 객체 정의
    const buttonCommands = {
      IDLE: {
        text: '수정',
        action: () => dispatch(startEdit({ shopData: currentShopServerDataSet }))
      },
      EDITOR_ON: {
        text: '수정완료',
        action: () => {
          // 1. 활성 필드가 있으면 값 저장
          if (activeField) {
            saveActiveFieldValue();
            setActiveField(null);
          }
          
          // 2. completeEditor 액션 디스패치
          dispatch(completeEditor());
        }
      },
      RE_EDIT: {
        text: '재수정',
        action: () => dispatch(beginEditor())
      }
    };
    
    // 현재 상태에 따른 명확한 버튼 선택 로직
    let currentCommand;
    
    if (isIdle) {
      // IDLE 상태 - 수정 버튼
      currentCommand = buttonCommands.IDLE;
    } else if (isEditorOn) {
      // 에디터 활성 상태 - 수정완료 버튼
      currentCommand = buttonCommands.EDITOR_ON;
    } else if (isEditing && !isEditorOn && isConfirming) {
      // 확인 상태 - 재수정 버튼
      currentCommand = buttonCommands.RE_EDIT;
    } else {
      // 초기화 이전 상태임. 
      // 기타 상태 - 안전하게 수정 버튼으로 대체
      currentCommand = buttonCommands.IDLE;
    }
    
    return (
      <button 
        type="button"
        className={styles.editButton}
        onClick={(e) => {
          e.preventDefault();
          currentCommand.action();
        }}
      >
        {currentCommand.text}
      </button>
    );
  };

  // 확인 버튼 핸들러 수정
  const handleConfirmEdit = () => {
    // 확인 단계 시작 액션
    dispatch(startConfirm());
    
    // 확인 모달 표시
    setIsConfirmModalOpen(true);
    
    // 오버레이 정리는 endEdit 이후에 수행
  };
  
  // 최종 확인 핸들러 추가
  const handleFinalConfirm = () => {
    // 모달 닫기
    setIsConfirmModalOpen(false);
    
    // 확인 및 제출 액션
    dispatch(confirmAndSubmit());
    
    // 편집 종료
    dispatch(endEdit());
    
    // 서버로 데이터 제출
    dispatch(finalSubmitToServer())
      .unwrap()
      .then(() => {
        // 성공 시 오버레이 정리
        mapOverlayHandlers.cleanupTempOverlays();
      })
      .catch((error) => {
        console.error('서버 제출 실패:', error);
        // 오류 처리는 리듀서에서 상태 변경으로 처리됨
      });
  };
  
  // 확인 모달 취소 핸들러
  const handleCancelConfirmModal = () => {
    setIsConfirmModalOpen(false);
  };
  
  const handleCancelEdit = () => {
    // 기존 액션 디스패치
    dispatch(cancelEdit());
    
    // 이미지 매니저 상태 초기화 액션 추가
    dispatch(resetImageData());
    
    // 편집 상태 종료 (isEditing = false)
    dispatch(endEdit());
    
    // compareBar가 isInserting 모드이면 endCompareBar 액션 디스패치
    if (isInsertingMode) {
      dispatch(endCompareBar());
    }
    
    // 오버레이 정리를 컴포넌트에서 직접 처리
    mapOverlayHandlers.cleanupTempOverlays();
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 단일 업데이트 경로 사용
    dispatch(updateField({ field: name, value }));
  };
  
  const handlePinCoordinatesButtonClick = (e) => {
    e.preventDefault();
    
    // Redux 액션 디스패치 - 마커 드로잉 모드 시작
    dispatch(startDrawingMode({ type: 'MARKER' }));
  };
  
  const handlePathButtonClick = (e) => {
    e.preventDefault();
    
    // Redux 액션 디스패치 - 폴리곤 드로잉 모드 시작
    dispatch(startDrawingMode({ type: 'POLYGON' }));
  };

  // 구글 장소 ID로 상세 정보를 가져오는 핸들러
  const googlePlaceDetailLoadingHandler = async (e) => {
    e.preventDefault();
    
    // 현재 googleDataId 필드 값 가져오기
    const googlePlaceId = formData.googleDataId;
    
    if (!googlePlaceId) {
      console.error('구글 Place ID가 입력되지 않았습니다.');
      return;
    }
    
    
    
    try {
      // Google Place 상세 정보 가져오기
      const placeDetail = await fetchPlaceDetailById(
        googlePlaceId, 
        process.env.NEXT_PUBLIC_MAPS_API_KEY
      );
      
      if (placeDetail) {
        dispatch(setCompareBarActive(placeDetail));
      } else {
        console.error('구글 Place 상세 정보를 가져오지 못했습니다.');
      }
    } catch (error) {
      console.error('구글 Place 상세 정보 요청 중 오류 발생:', error);
    }
  };

  // 이미지 관리 관련 상태 및 Redux 상태
  
  // 이미지 편집 핸들러
  const handleEditImagesOfGallery = () => {
    // 이미지 순서 편집기 열기 (Redux 액션 사용)
    dispatch(openImageOrderEditor({
      source: 'rightSidebar',
      mainImage: formData.mainImage,
      subImages: formData.subImages
    }));
  };
  
  // 이미지 선택 완료 처리
  const handleImagesSelected = (selectedImages) => {
    // 이미지 배열이 비어있는 경우 메인/서브 이미지 모두 초기화
    if (!selectedImages || selectedImages.length === 0) {
      // 모든 이미지 초기화 (protoServerDataset 초기값과 일치)
      dispatch(updateField({ field: 'mainImage', value: "" }));
      dispatch(trackField({ field: 'mainImage' }));
      dispatch(updateField({ field: 'subImages', value: [] }));
      dispatch(trackField({ field: 'subImages' }));
      return;
    }
    
    // 선택된 이미지 배열 깊은 복사 (문자열 배열이므로 JSON 방식 사용)
    const selectedImagesCopy = JSON.parse(JSON.stringify(selectedImages || []));
    
    // 유효한 이미지만 필터링
    const validImages = selectedImagesCopy.filter(img => 
      img && typeof img === 'string' && img.trim() !== ''
    );
    
    if (!validImages.length) return;
    
    // 순서 편집 모달에서 호출된 경우 (이미지 순서 변경)
    if (isImageOrderEditorOpen) {
      // 첫 번째 이미지를 메인 이미지로, 나머지를 서브 이미지로 설정
      if (validImages.length > 0) {
        // 메인 이미지 설정
        dispatch(updateField({ field: 'mainImage', value: validImages[0] }));
        dispatch(trackField({ field: 'mainImage' }));
        
        // 서브 이미지 설정 (첫 번째 이미지 제외)
        const subImagesArray = validImages.slice(1);
        dispatch(updateField({ field: 'subImages', value: subImagesArray }));
        dispatch(trackField({ field: 'subImages' }));
      }
      return;
    }
    
    // 이미지 선택 모달에서 호출된 경우 (이미지 추가)
    // 현재 폼 데이터의 이미지 상태 가져오기
    const currentMainImage = formData.mainImage;
    const currentSubImages = Array.isArray(formData.subImages) ? 
      [...formData.subImages] : [];
    
    // 선택된 이미지가 1개이고 메인 이미지가 없는 경우: 메인 이미지로 설정
    if (validImages.length === 1 && !currentMainImage) {
      dispatch(updateField({ field: 'mainImage', value: validImages[0] }));
      dispatch(trackField({ field: 'mainImage' }));
    } 
    // 그 외의 경우: 모든 이미지를 서브 이미지에 추가
    else {
      // 중복 이미지 필터링
      const newImages = validImages.filter(img => 
        img !== currentMainImage && !currentSubImages.includes(img)
      );
      
      // 추가할 이미지가 있으면 서브 이미지 배열에 추가
      if (newImages.length > 0) {
        const updatedSubImages = [...currentSubImages, ...newImages];
        dispatch(updateField({ field: 'subImages', value: updatedSubImages }));
        dispatch(trackField({ field: 'subImages' }));
      }
    }
  };
  
  // 이미지 선택 취소 처리
  const handleCancelImageSelection = () => {
    // 모달은 자동으로 닫힘
  };

  

  return (
    <div className={styles.rightSidebar}>
      {/* 상단 버튼 영역 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          {isEditorOn && !currentShopServerDataSet && (
            <span className={styles.editingStatusText}>신규상점 입력 중...</span>
          )}
          {isEditorOn && currentShopServerDataSet && (
            <span className={styles.editingStatusText}>데이터 수정 중...</span>
          )}
          {isConfirming && !hasChanges && !isEditorOn && (
            <span className={styles.editingStatusText}>
              변경사항 없음
            </span>
          )}
          {isConfirming && hasChanges && !isEditorOn && (
            <span className={styles.editingStatusText}>
              변경사항이 있습니다
            </span>
          )}
          {!isEditorOn && !isConfirming && (
            <span className={styles.editingStatusText}></span>
          )}
          {status === 'loading' && (
            <span className={styles.editingStatusText}>저장 중...</span>
          )}
          {status === 'failed' && error && (
            <span className={styles.errorStatusText}>오류: {error}</span>
          )}
        </div>
        <button 
          className={styles.addShopButton} 
          onClick={googlePlaceSearchBarButtonHandler}
          title="구글 장소 검색"
          disabled={isEditorOn || isConfirming || status === 'loading'}
        >
          &lt;구글탐색
        </button>
      </div>

      {/* 상점 정보 카드 */}
      <div className={cardClassName}>
        <div className={styles.rightSidebarButtonContainer}>
          <h3>
            {isIdle 
              ? "상점 Data" 
              : (formData.storeName || (!isEditorOn ? "상점 Data" : "신규상점 추가"))}
          </h3>
          
          {/* 수정/완료 버튼 - 상태에 따라 다르게 표시 */}
          {isConfirming ? (
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelButton} 
                onClick={handleCancelEdit}
                disabled={status === 'loading'}
              >
                취소
              </button>
              {hasChanges && (
                <button 
                  className={styles.confirmButton} 
                  onClick={handleConfirmEdit}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? '처리 중...' : '확인'}
                </button>
              )}
              <EditButton />
            </div>
          ) : isEditorOn ? (
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelButton} 
                onClick={handleCancelEdit}
                disabled={status === 'loading'}
              >
                취소
              </button>
              <EditButton />
            </div>
          ) : (!isIdle && !isEditorOn && !isConfirming && currentShopServerDataSet) ? (
            <EditButton />
          ) : null}
        </div>

        {/* 상점 정보 폼 */}
        {isIdle ? (
          <div className={styles.emptyStateMessage}>
            <p>상점에디터터</p>
            </div>
        ) : (
          <form 
            className={styles.rightSidebarForm}
            onSubmit={(e) => e.preventDefault()} // 폼 제출 방지
          >
            {/* 상점 정보 필드들을 배열로부터 렌더링 */}
            {titlesofDataFoam.map(item => {
              // 특별한 필드 처리 (핀 좌표, 다각형 경로, 구글 데이터 ID)
              if (item.field === 'pinCoordinates') {
                return (
                  <div key={item.field} className={styles.rightSidebarFormRow}>
                    <span>{item.title}</span>
                    <div className={styles.rightSidebarInputContainer}>
              <input
                type="text"
                name="pinCoordinates"
                value={formData.pinCoordinates || ""}
                onChange={handleInputChange}
                readOnly={true}
                className={getInputClassName("pinCoordinates")}
                ref={el => inputRefs.current.pinCoordinates = el}
                        autoComplete="off"
              />
              {isEditorOn && (
                <button
                  type="button"
                  className={styles.inputOverlayButton}
                  onClick={handlePinCoordinatesButtonClick}
                  style={{ display: 'block' }}
                  title="핀 좌표 수정"
                >
                  📍
                </button>
              )}
            </div>
          </div>
                );
              } else if (item.field === 'path') {
                return (
                  <div key={item.field} className={styles.rightSidebarFormRow}>
                    <span>{item.title}</span>
                    <div className={styles.rightSidebarInputContainer}>
              <input
                type="text"
                name="path"
                value={formData.path || ""}
                onChange={handleInputChange}
                readOnly={true}
                className={getInputClassName("path")}
                ref={el => inputRefs.current.path = el}
                        autoComplete="off"
              />
              {isEditorOn && (
                <button
                  type="button"
                  className={styles.inputOverlayButton}
                  onClick={handlePathButtonClick}
                  style={{ display: 'block' }}
                  title="경로 수정"
                >
                  🗺️
                </button>
              )}
            </div>
          </div>
                );
              } else if (item.field === 'googleDataId') {
                return (
                  <div key={item.field} className={styles.rightSidebarFormRow}>
                    <span>{item.title}</span>
                    <div className={styles.rightSidebarInputContainer}>
              <input
                type="text"
                        name="googleDataId"
                        value={activeField === 'googleDataId' ? localInputState.googleDataId || "" : formData.googleDataId || ""}
                        onChange={activeField === 'googleDataId' ? handleLocalInputChange : handleInputChange}
                        onBlur={activeField === 'googleDataId' ? handleInputBlur : undefined}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onFocus={(e) => handleInputFocus(e, 'googleDataId')}
                        readOnly={isFieldReadOnly('googleDataId')}
                        className={getInputClassName('googleDataId')}
                        ref={el => inputRefs.current.googleDataId = el}
                        autoComplete="off"
              />
                      {isEditorOn && (
                <button
                  type="button"
                  className={styles.inputOverlayButton}
                          onClick={googlePlaceDetailLoadingHandler}
                  style={{ display: 'block' }}
                          title="구글ID디테일 로딩"
                >
                          🔍
                </button>
              )}
            </div>
          </div>
                );
              } else {
                // 일반 필드 렌더링
                return (
                  <div key={item.field} className={styles.rightSidebarFormRow}>
                    <span>{item.title}</span>
                    <div className={styles.rightSidebarInputContainer}>
                      {renderInput(item.field, isFieldReadOnly(item.field))}
            </div>
          </div>
                );
              }
            })}

          {/* 이미지 미리보기 영역 */}
          <div className={styles.imageSectionPreviewContainer}>
            <ImageSectionManager 
              ref={imageSectionManagerRef}
              mainImage={formData.mainImage} 
              subImages={formData.subImages}
              onImagesSelected={handleImagesSelected}
              onCancelImageSelection={handleCancelImageSelection}
              source="rightSidebar"
            />
            {/* 이미지 편집 오버레이 - 에디터 모드일 때만 표시 */}
            {isEditorOn && (
              (formData.mainImage && typeof formData.mainImage === 'string' && formData.mainImage.trim() !== '') || 
              (Array.isArray(formData.subImages) && formData.subImages.length > 0 && 
                formData.subImages.some(img => img && typeof img === 'string' && img.trim() !== ''))
            ) && (
              <button 
                type="button"
                className={styles.imageSectionOverlayContainer}
                onClick={handleEditImagesOfGallery}
              >
                <span className={styles.imageSectionOverlayText}>이미지 편집</span>
              </button>
            )}
          </div>
        </form>
        )}
      </div>
      
      {/* 확인 모달 추가 */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        storeName={formData.storeName}
        onConfirm={handleFinalConfirm}
        onCancel={handleCancelConfirmModal}
      />
    </div>
  );
};

/**
 * 오른쪽 사이드바 컴포넌트 (Redux 연결)
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const RightSidebar = ({ moveToCurrentLocation, mapOverlayHandlers, curSelectedShop, onShopUpdate }) => {
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  
  // 상점 데이터에서 serverDataset 추출
  const currentShopServerDataSet = curSelectedShop?.serverDataset || null;

  // 구글탐색 버튼 핸들러
  const googlePlaceSearchBarButtonHandler = (e) => {
    if (e) e.preventDefault();
    
    // CompareBar 활성화
    dispatch(setSyncGoogleSearch()); // 구글 검색폼의 데이터가 setCompareBarActive를 호출하며 넘어옴옴
    dispatch(setCompareBarActive(null));
    
  };
  
  // 패널 토글 버튼
  const togglePanelButton = !isPanelVisible && (
    <button 
      className={styles.floatingPanelToggle}
      onClick={() => dispatch(togglePanel())}
      title="패널 표시"
    >
      ≫
    </button>
  );

  return (
    <>
      <SidebarContent 
        googlePlaceSearchBarButtonHandler={googlePlaceSearchBarButtonHandler}
        moveToCurrentLocation={moveToCurrentLocation}
        mapOverlayHandlers={mapOverlayHandlers}
        currentShopServerDataSet={currentShopServerDataSet}
        onShopUpdate={onShopUpdate}
      />
      {togglePanelButton}
    </>
  );
};

export default RightSidebar; 