import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { protoServerDataset } from '../dataModels';
import { parseGooglePlaceData, fetchPlaceDetailById } from '../utils/googlePlaceUtils';
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
  beginEditor
} from '../store/slices/rightSidebarSlice';

import { setCompareBarActive, setSyncGoogleSearch, selectIsInserting, endCompareBar } from '../store/slices/compareBarSlice';
import ImageSectionManager from './ImageSectionManager';

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
  
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});
  
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

  // 수정 버튼 렌더링 부분 (기존 코드를 이 코드로 대체)
  const EditButton = () => {
    const dispatch = useDispatch();
    const isIdle = useSelector(selectIsIdle);
    const isEditing = useSelector(selectIsEditing);
    const isEditorOn = useSelector(selectIsEditorOn);
    
    // Command 패턴: 상태에 따른 명령 객체 정의
    const buttonCommands = {
      IDLE: {
        text: '수정',
        action: () => dispatch(startEdit({ shopData: currentShopServerDataSet }))
      },
      EDITOR_ON: {
        text: '수정완료',
        action: () => dispatch(completeEditor())
      },
      RE_EDIT: {
        text: '재수정',
        action: () => dispatch(beginEditor())
      }
    };
    
    // 현재 상태에 따라 적절한 명령 선택
    let currentCommand;
    if (isIdle) {
      currentCommand = buttonCommands.IDLE;
    } else if (isEditorOn) {
      currentCommand = buttonCommands.EDITOR_ON;
    } else if (isEditing && !isEditorOn) {
      currentCommand = buttonCommands.RE_EDIT;
    } else {
      // 기본값
      currentCommand = buttonCommands.IDLE;
    }
    
    return (
      <button 
        className={styles.editButton}
        onClick={currentCommand.action}
      >
        {currentCommand.text}
      </button>
    );
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

  // 상태 추가
  const [localInputState, setLocalInputState] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [isComposing, setIsComposing] = useState(false); // IME 입력 중인지 여부

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
    
    // 편집 모드에서 빈 필드는 항상 편집 가능
    if (isEditorOn && (!formData[fieldName] || formData[fieldName] === "")) {
      return false;
    }
    
    // 편집 모드에서 값이 있는 필드는 읽기 전용으로 설정
    if (formData && formData[fieldName]) {
      return true; // 값이 있으면 읽기 전용
    }
    
    // 그 외에는 편집 가능
    return false;
  };

  // 필드 편집 버튼 클릭 핸들러
  const handleFieldEditButtonClick = (e, fieldName) => {
    e.preventDefault();
    
    // 이미 활성화된 필드가 있다면 먼저 저장
    if (activeField && activeField !== fieldName) {
      const currentValue = localInputState[activeField];
      if (currentValue !== undefined) {
        dispatch(updateField({ field: activeField, value: currentValue }));
      }
    }
    
    // 현재 formData의 값을 로컬 상태에 복사
    setLocalInputState(prev => ({
      ...prev,
      [fieldName]: formData[fieldName] || ""
    }));
    
    // 필드 활성화
    setActiveField(fieldName);
    
    // readonly 해제 및 포커스
    setTimeout(() => {
      if (inputRefs.current[fieldName]) {
        inputRefs.current[fieldName].readOnly = false;
        inputRefs.current[fieldName].focus();
      }
    }, 50);
  };

  // 로컬 입력 변경 핸들러에 디버깅 로그 추가
  const handleLocalInputChange = (e) => {
    const { name, value } = e.target;
    
    console.log(`[LocalInputChange] field: ${name}, value: "${value}", isComposing: ${isComposing}`);
    
    // IME 입력 중이 아닐 때만 상태 업데이트
    if (!isComposing) {
      // 로컬 상태만 업데이트
      setLocalInputState(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // IME 이벤트 핸들러에 디버깅 로그 추가
  const handleCompositionStart = (e) => {
    const { name } = e.target;
    console.log(`[CompositionStart] field: ${name}`);
    setIsComposing(true);
  };

  // IME 입력 종료 이벤트 핸들러
  const handleCompositionEnd = (e) => {
    const { name, value } = e.target;
    console.log(`[CompositionEnd] field: ${name}, value: "${value}"`);
    
    setIsComposing(false);
    // 입력 종료 시 값 업데이트
    setLocalInputState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 입력 완료 시 Redux 상태 업데이트 - 지연 처리로 개선
  const handleInputBlur = (e) => {
    const { name } = e.target;
    const value = localInputState[name];
    const originalValue = formData[name];
    
    console.log(`[InputBlur] field: ${name}, value: "${value}", original: "${originalValue}", isComposing: ${isComposing}`);
    
    // IME 입력 중이면 무시
    if (isComposing) {
      console.log('[InputBlur] Ignoring blur during composition');
      return;
    }
    
    // 300ms 지연 후 처리 - 포커스 문제 방지
    setTimeout(() => {
      console.log(`[InputBlur-Delayed] field: ${name}, value: "${value}", original: "${originalValue}"`);
      
      // 활성 필드 초기화
      setActiveField(null);
      
      // Redux 상태 업데이트
      if (value !== undefined) {
        // 값이 실제로 변경되었는지 확인
        const hasChanged = value !== originalValue;
        console.log(`[InputBlur-Delayed] 값 변경 여부: ${hasChanged}`);
        
        // 항상 업데이트하여 일관된 상태 유지
        dispatch(updateField({ field: name, value }));
        
        // 값이 변경된 경우에만 추적 필드에 추가
        if (hasChanged) {
          console.log(`[InputBlur-Delayed] 추적 필드 추가: ${name}`);
          dispatch(trackField({ field: name }));
        }
        
        // 배열형 필드 특수 처리
        if (name === 'businessHours') {
          // 기존 로직 유지
          let processedValue = value;
          if (value === '' || value.trim() === '') {
            processedValue = [""];
          } else {
            processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
            if (processedValue.length === 0) {
              processedValue = [""];
            }
          }
          
          if (processedValue !== value) {
            dispatch(updateField({ field: name, value: processedValue }));
          }
        }
      }
    }, 300);
  };

  // 필드 포커스 이벤트 핸들러 수정 - 빈 필드 문제 해결
  const handleInputFocus = (e, fieldName) => {
    const { name } = e.target;
    console.log(`[InputFocus] field: ${name}, activeField: ${activeField}, isReadOnly: ${isFieldReadOnly(fieldName)}`);
    
    // 중요: 빈 필드이거나 편집 모드에서 필드에 포커스할 때 활성화
    if (isEditorOn && (!formData[fieldName] || activeField === fieldName)) {
      console.log(`[InputFocus] 빈 필드 활성화: ${fieldName}`);
      
      // 활성 필드 설정
      setActiveField(fieldName);
      
      // 로컬 상태 초기화 (현재 값으로)
      setLocalInputState(prev => ({
        ...prev,
        [fieldName]: formData[fieldName] || ""
      }));
      
      // readOnly 해제
      if (inputRefs.current[fieldName]) {
        inputRefs.current[fieldName].readOnly = false;
      }
    }
    
    // 이미 활성화된 경우 전체 선택
    if (activeField === fieldName && inputRefs.current[fieldName]) {
      inputRefs.current[fieldName].select();
    }
  };

  // 일반 필드용 입력 컴포넌트 - 로컬 상태 사용 및 디버깅 로그 추가
  const renderInput = (fieldName, readOnly) => {
    const isActive = fieldName === activeField;
    const value = isActive ? localInputState[fieldName] || "" : formData[fieldName] || "";
    
    return (
      <>
        <input
          type="text"
          name={fieldName}
          value={value}
          onChange={isActive ? handleLocalInputChange : handleInputChange}
          onBlur={isActive ? handleInputBlur : undefined}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={(e) => handleInputFocus(e, fieldName)}
          readOnly={readOnly}
          className={getInputClassName(fieldName)}
          ref={el => inputRefs.current[fieldName] = el}
          autoComplete="off"
          onClick={() => {
            // 빈 필드 클릭 시 활성화 (중요 수정)
            if (isEditorOn && (!formData[fieldName] || formData[fieldName] === "")) {
              console.log(`[Click] 빈 필드 클릭: ${fieldName}`);
              handleInputFocus({target: {name: fieldName}}, fieldName);
            }
            // 기존 값 있는 필드 클릭 처리
            else if (isEditorOn && formData[fieldName] && !isFieldReadOnly(fieldName)) {
              handleFieldEditButtonClick(new Event('click'), fieldName);
            }
          }}
        />
        {/* 필드 편집 버튼 - 편집 모드일 때만 표시 */}
        {isEditorOn && formData[fieldName] && !isActive && (
          <button
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

  // 기존 handleEditFoamCardButton 함수를 Command 패턴에 맞게 수정
  const handleEditFoamCardButton = (e) => {
    e.preventDefault();
    
    // Command 패턴: 상태에 따른 액션 분기
    if (isIdle) {
      dispatch(startEdit({ shopData: currentShopServerDataSet }));
    } else if (isEditorOn) {
      dispatch(completeEditor());
    } else if (isEditing && !isEditorOn) {
      dispatch(beginEditor());
    }
  };
  
  const handleConfirmEdit = () => {
    dispatch(startConfirm());
    // 편집 상태 종료 (isEditing = false)
    dispatch(endEdit());
    // 오버레이 정리를 컴포넌트에서 직접 처리
    mapOverlayHandlers.cleanupTempOverlays();
    // console.log('수정 내용 확인 처리됨');
  };
  
  const handleCancelEdit = () => {
    // 기존 액션 디스패치
    dispatch(cancelEdit());
    
    // 편집 상태 종료 (isEditing = false)
    dispatch(endEdit());
    
    // compareBar가 isInserting 모드이면 endCompareBar 액션 디스패치
    if (isInsertingMode) {
      dispatch(endCompareBar());
    }
    
    // 오버레이 정리를 컴포넌트에서 직접 처리
    mapOverlayHandlers.cleanupTempOverlays();
    // console.log('편집 취소 처리됨');
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 단일 업데이트 경로 사용
    dispatch(updateField({ field: name, value }));
    
    // 배열형 필드 처리 (특수 처리 필요한 경우)
    // 배열형 필드 처리
    if (name === 'businessHours') {
      let processedValue = value;
      if (value === '' || value.trim() === '') {
        processedValue = [""];  // 빈 값은 [""] 형태로 저장
      } else {
        processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
        if (processedValue.length === 0) {
          processedValue = [""];  // 결과가 빈 배열이면 [""] 형태로 저장
        }
      }
      
      // 배열 형태로 다시 업데이트
      if (processedValue !== value) {
    dispatch(updateField({ field: name, value: processedValue }));
      }
    }
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
      console.log('구글 Place ID가 입력되지 않았습니다.');
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
        console.log('구글 Place 상세 정보를 가져오지 못했습니다.');
      }
    } catch (error) {
      console.error('구글 Place 상세 정보 요청 중 오류 발생:', error);
    }
  };

  // 이미지 편집 핸들러
  const handleEditImagesOfGallery = () => {
    // 현재 이미지 배열 생성 (mainImage + subImages)
    const currentImages = [];
    
    // mainImage가 있으면 추가
    if (formData.mainImage) {
      currentImages.push(formData.mainImage);
    }
    
    // subImages가 있으면 추가
    if (formData.subImages && Array.isArray(formData.subImages) && formData.subImages.length > 0) {
      currentImages.push(...formData.subImages);
    }
    
    // 이미지 순서 편집 모드 활성화
    setIsImageSelectionMode(true);
    setEditMode(true);
  };
  
  // 이미지 선택 모드 상태
  const [isImageSelectionMode, setIsImageSelectionMode] = useState(false);
  const [isEditMode, setEditMode] = useState(false);
  
  // 이미지 선택 완료 처리
  const handleImagesSelected = (selectedImages) => {
    if (selectedImages && selectedImages.length > 0) {
      console.log('선택/편집된 이미지:', selectedImages);
      
      if (isEditMode) {
        // 순서 편집 모드인 경우: 첫 번째 이미지는 메인, 나머지는 서브 이미지로 설정
        const mainImg = selectedImages[0];
        const subImgs = selectedImages.slice(1);
        
        // Redux 상태 업데이트
        dispatch(updateField({ field: 'mainImage', value: mainImg }));
        dispatch(updateField({ field: 'subImages', value: subImgs }));
        
        // 변경 필드 추적
        dispatch(trackField({ field: 'mainImage' }));
        dispatch(trackField({ field: 'subImages' }));
        
        console.log('이미지 순서가 업데이트되었습니다.');
        
        // 편집 모드 종료
        setEditMode(false);
      } else {
        // 선택 모드인 경우: 이전 로직 유지 (모든 이미지를 subImages에 추가)
        const currentSubImages = formData.subImages || [];
        const updatedSubImages = [...currentSubImages, ...selectedImages];
        
        dispatch(updateField({ field: 'subImages', value: updatedSubImages }));
        dispatch(trackField({ field: 'subImages' }));
        
        console.log('이미지가 subImages 배열에 추가되었습니다.');
      }
    }
    
    // 선택 모드 종료
    setIsImageSelectionMode(false);
  };
  
  // 이미지 선택 취소 처리
  const handleCancelImageSelection = () => {
    setIsImageSelectionMode(false);
    setEditMode(false);
    console.log('이미지 편집이 취소되었습니다.');
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
          {!isIdle && !isConfirming && !isEditorOn && currentShopServerDataSet && (
            <EditButton />
          )}
          
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
          ) : (
            isEditorOn && (
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
            )
          )}
        </div>

        {/* 상점 정보 폼 */}
        {isIdle ? (
          <div className={styles.emptyStateMessage}>
            <p>상점에디터터</p>
            </div>
        ) : (
          <form className={styles.rightSidebarForm}>
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
          <div className={styles.compareBarSection}>
            <ImageSectionManager 
              mainImage={formData.mainImage} 
              subImages={formData.subImages}
              onImagesSelected={handleImagesSelected}
              onCancelSelection={handleCancelImageSelection}
              isSelectionMode={isImageSelectionMode && !isEditMode}
              isEditMode={isEditMode}
              editImages={isEditMode ? [
                ...(formData.mainImage ? [formData.mainImage] : []), 
                ...(formData.subImages || [])
              ] : []}
            />
            {/* 이미지 편집 오버레이 - 에디터 모드일 때만 표시 */}
            {isEditorOn && (
              <div 
                className={styles.imageSectionOverlay}
                onClick={handleEditImagesOfGallery}
              >
                <span className={styles.imageSectionOverlayText}>이미지 편집</span>
              </div>
            )}
          </div>
        </form>
        )}
      </div>
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