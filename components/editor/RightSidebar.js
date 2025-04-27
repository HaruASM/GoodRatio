import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../../pages/editor/styles.module.css';
import { protoServerDataset, titlesofDataFoam } from '../../lib/models/editorModels';
import {  fetchPlaceDetailById } from '../../lib/utils/googlePlaceUtils';
import store from '../../lib/store'; // 스토어 가져오기
import {
  togglePanel,
  startEdit,
  completeEditor,
  cancelEdit,
  updateField,
  trackField,
  saveitemdata,
  selectIsPanelVisible,
  selectIsEditing,
  selectIsConfirming,
  selectHasChanges,
  selectFormData,
  selectModifiedFields,
  selectEditNewitemdataSet,
  selectOriginalitemdata,
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
  finalSubmitToServer,
  syncExternalShop
} from '../../lib/store/slices/rightSidebarSlice';

import { setCompareBarActive, setSyncGoogleSearch, selectIsInserting, endCompareBar } from '../../lib/store/slices/compareBarSlice';
import ImageSectionManager from './ImageSectionManager';
import { 
  
  selectIsImageSelectionMode,
  openImageOrderEditor,
  resetImageSelection,
  selectIsImageOrderEditorOpen,
  selectIsGalleryOpen
} from '../../lib/store/slices/imageGallerySlice';

import { openGallery } from '../../lib/store/slices/imageGallerySlice';
import { selectSelectedItemId, selectSelectedSectionName } from '../../lib/store/slices/mapEventSlice';
import { createLoadingOverlayforDIV, withLoadingOverlay } from '../../lib/utils/uiHelpers';

// 확인 모달 컴포넌트
const ConfirmModal = ({ isOpen, itemName, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className={styles.confirmModalOverlay}>
      <div className={styles.confirmModal}>
        <h3>업데이트 확인</h3>
        <p><strong>&apos;{itemName || '신규 상점'}&apos;</strong>에 대한 서버업데이트를 진행</p>
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
 * 오른쪽 사이드바 내부 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const SidebarContent = ({ googlePlaceSearchBarButtonHandler, mapOverlayHandlers }) => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const isEditing = useSelector(selectIsEditing);
  const isEditorOn = useSelector(selectIsEditorOn);
  const isConfirming = useSelector(selectIsConfirming);
  const hasChanges = useSelector(selectHasChanges);
  const formData = useSelector(selectFormData);
  const modifiedFields = useSelector(selectModifiedFields);
  const editNewitemdataSet = useSelector(selectEditNewitemdataSet);
  const originalitemdata = useSelector(selectOriginalitemdata);
  const status = useSelector(selectStatus);
  const error = useSelector(selectError);
  const isDrawing = useSelector(selectIsDrawing);
  const drawingType = useSelector(selectDrawingType);
  const isIdle = useSelector(selectIsIdle);
  const isInsertingMode = useSelector(selectIsInserting);
  const isImageOrderEditorOpen = useSelector(selectIsImageOrderEditorOpen);
  const isGalleryOpen = useSelector(selectIsGalleryOpen);
  
  // 상태 추가 - 모든 useState 호출을 여기로 이동
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [localInputState, setLocalInputState] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [isComposing, setIsComposing] = useState(false); // IME 입력 중인지 여부
  const [showCategoryOptions, setShowCategoryOptions] = useState(false); // 카테고리 옵션 표시 상태
  const [showSectionOptions, setShowSectionOptions] = useState(false); // 섹션 옵션 표시 상태
  
  // 참조 객체 - 모든 useRef 호출을 여기로 이동
  const inputRefs = useRef({});
  const imageSectionManagerRef = useRef(null);
  const prevModalOpenRef = useRef(false);
  const sectionOptionsRef = useRef(null); // 섹션 옵션 참조 추가
  const categoryOptionsRef = useRef(null); // 카테고리 옵션 참조 추가
  
  // 새로운 상태 추가
  const selectedItemId = useSelector(selectSelectedItemId);
  const selectedSectionName = useSelector(selectSelectedSectionName);
  
  // 로딩 오버레이를 표시할 DOM 요소 참조를 위한 useRef
  const galleryContainerRef = useRef(null); // 갤러리 보기 버튼에 로딩 오버레이 표시용
  const imageSelectionContainerRef = useRef(null); // 이미지 선택 버튼에 로딩 오버레이 표시용
  const galleryLoadingContainerOfRightSidebarRef = useRef(null); // 이미지 순서 편집 버튼에 로딩 오버레이 표시용
  
  // 외부 클릭 시 옵션 닫기 효과 추가
  useEffect(() => {
    function handleClickOutside(event) {
      // 섹션 옵션 외부 클릭 시 닫기
      if (showSectionOptions && sectionOptionsRef.current && !sectionOptionsRef.current.contains(event.target)) {
        setShowSectionOptions(false);
      }
      
      // 카테고리 옵션 외부 클릭 시 닫기
      if (showCategoryOptions && categoryOptionsRef.current && !categoryOptionsRef.current.contains(event.target)) {
        setShowCategoryOptions(false);
      }
    }
    
    // 이벤트 리스너 등록
    document.addEventListener('mousedown', handleClickOutside);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSectionOptions, showCategoryOptions]);

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
    const baseClassName = !isEmpty ? styles.rightSidebarFilledInput : styles.rightSidebarEmptyInput;
    
    // 수정된 필드인 경우 추가 스타일
    if (modifiedFields && modifiedFields[fieldName]) {
      return `${baseClassName} ${styles.rightSidebarModifiedInput}`;
    }
    
    return baseClassName;
  };

  // 일반 필드용 입력 컴포넌트 - 단순화
  const renderInput = (fieldName, readOnly) => {
    // category 필드는 특별 처리
    if (fieldName === 'category') {
      return renderCategoryField(readOnly);
    }
    
    // sectionName 필드 특별 처리 추가
    if (fieldName === 'sectionName') {
      return renderSectionNameField(readOnly);
    }
    
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

  // Category 필드 렌더링 함수
  const renderCategoryField = (readOnly) => {
    const categoryOptions = ['shops', 'landmarks', 'hotspots'];
    const value = formData.category || '';
    
    // 카테고리 옵션 선택 핸들러
    const handleSelectCategory = (selectedCategory) => {
      dispatch(updateField({ field: 'category', value: selectedCategory }));
      dispatch(trackField({ field: 'category' }));
      setShowCategoryOptions(false);
    };
    
    // 카테고리 편집 버튼 클릭 핸들러
    const handleCategoryEditClick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // 이벤트 버블링 방지
      setShowCategoryOptions(!showCategoryOptions);
    };
    
    return (
      <div className={styles.rightSidebarCategoryFieldContainer}>
        <input
          type="text"
          name="category"
          value={value}
          readOnly={true}
          className={getInputClassName('category')}
          ref={el => inputRefs.current.category = el}
          autoComplete="off"
          onClick={(e) => {
            // 읽기 전용이 아닐 때만 클릭 처리
            if (isEditorOn) {
              handleCategoryEditClick(e);
            }
          }}
        />
        {isEditorOn && (
          <button
            type="button"
            className={styles.rightSidebarInputOverlayButton}
            onClick={handleCategoryEditClick}
            style={{ display: 'block' }}
            title="카테고리 선택"
          >
            {value ? '✏️' : '📋'}
          </button>
        )}
        {showCategoryOptions && isEditorOn && (
          <div className={styles.rightSidebarCategoryOptionsContainer} ref={categoryOptionsRef}>
            {categoryOptions.map(option => (
              <div 
                key={option} 
                className={styles.rightSidebarCategoryOption}
                onClick={() => handleSelectCategory(option)}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // sectionName 필드 렌더링 함수 추가
  const renderSectionNameField = (readOnly) => {
    const sectionOptions = [
      { value: '반월당', country: '한국' },
      { value: '앙헬레스', country: '필리핀' },
      { value: '말라떼', country: '필리핀' },
      { value: '세부', country: '필리핀' }
    ];
    
    const value = formData.sectionName || '';
    
    // 섹션 옵션 선택 핸들러
    const handleSelectSection = (selectedSection) => {
      dispatch(updateField({ field: 'sectionName', value: selectedSection }));
      dispatch(trackField({ field: 'sectionName' }));
      setShowSectionOptions(false);
    };
    
    // 섹션 편집 버튼 클릭 핸들러
    const handleSectionEditClick = (e) => {
      e.preventDefault();
      e.stopPropagation(); // 이벤트 버블링 방지
      setShowSectionOptions(!showSectionOptions);
    };
    
    return (
      <div className={styles.rightSidebarCategoryFieldContainer}>
        <input
          type="text"
          name="sectionName"
          value={value}
          readOnly={true}
          className={getInputClassName('sectionName')}
          ref={el => inputRefs.current.sectionName = el}
          autoComplete="off"
          onClick={(e) => {
            // 읽기 전용이 아닐 때만 클릭 처리
            if (isEditorOn) {
              handleSectionEditClick(e);
            }
          }}
        />
        {isEditorOn && (
          <button
            type="button"
            className={styles.rightSidebarInputOverlayButton}
            onClick={handleSectionEditClick}
            style={{ display: 'block' }}
            title="위치지역 선택"
          >
            {value ? '✏️' : '📍'}
          </button>
        )}
        {showSectionOptions && isEditorOn && (
          <div className={styles.rightSidebarCategoryOptionsContainer} ref={sectionOptionsRef}>
            {sectionOptions.map(option => (
              <div 
                key={option.value} 
                className={styles.rightSidebarCategoryOption}
                onClick={() => handleSelectSection(option.value)}
              >
                <small className={styles.rightSidebarCountryLabel}>{option.country}</small>
                {option.value}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 수정 버튼 렌더링 부분 
  const EditButton = () => {
    const dispatch = useDispatch();
    const isIdle = useSelector(selectIsIdle);
    const isEditing = useSelector(selectIsEditing);
    const isEditorOn = useSelector(selectIsEditorOn);
    const isConfirming = useSelector(selectIsConfirming);
    
    // 새로운 상태 추가
    const selectedItemId = useSelector(selectSelectedItemId);
    const selectedSectionName = useSelector(selectSelectedSectionName);
    
    // Command 패턴: 상태에 따른 명령 객체 정의
    const buttonCommands = {
      IDLE: {
        text: '수정',
        action: () => {
          // CompareBar와 같은 방식으로 구현
          if (selectedItemId && selectedSectionName && window.SectionsDBManager) {
            const selectedItem = window.SectionsDBManager.getItemByIDandSectionName(
              selectedItemId, 
              selectedSectionName
            );
            
            if (selectedItem && selectedItem.serverDataset) {
              dispatch(startEdit({ itemdata: selectedItem.serverDataset }));
            } else {
              dispatch(startEdit({ itemdata: protoServerDataset }));
            }
          } else {
            console.error('selectedItemId 또는 selectedSectionName이 없거나 SectionsDBManager가 없습니다.');
          }
        }
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
    dispatch(resetImageSelection());
    
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

  // 이미지 순서 편집 갤러리 열기 핸들러
  const handleOpenOrderEditImagesGallery = () => {
    // 이미지가 완전히 없을 때만 반환 (subImages가 비어있고 mainImage도 없을 때)
    if (!formData.mainImage && (!formData.subImages || formData.subImages.length === 0)) {
      return;
    }

    // withLoadingOverlay를 사용하여 로딩 오버레이 표시
    return withLoadingOverlay(
      async () => {
        // 현재 메인 이미지와 서브 이미지 배열을 합쳐서 모든 이미지 배열 생성
        const allImages = [];
        
        // mainImage 존재 여부 확인
        const hasMainImage = formData.mainImage && typeof formData.mainImage === 'string' && formData.mainImage.trim() !== '';
        
        // mainImage가 있으면 추가
        if (hasMainImage) {
          allImages.push(formData.mainImage);
        }
        
        // 서브 이미지 추가
        if (formData.subImages && formData.subImages.length > 0) {
          // 빈 문자열이 아닌 유효한 이미지만 추가
          const validSubImages = formData.subImages.filter(
            img => img && typeof img === 'string' && img.trim() !== ''
          );
          if (validSubImages.length > 0) {
            allImages.push(...validSubImages);
          }
        }
        
        // 이미지 순서 편집 모드 활성화 (hasMainImage 플래그 전달)
        // 메인 이미지가 없고(hasMainImage=false), 서브 이미지만 있거나 또는 빈 경우 설정
        dispatch(openImageOrderEditor({
          source: 'rightSidebar',
          images: allImages,
          hasMainImage: hasMainImage // 불리언 값으로 메인 이미지 존재 여부 전달
        }));
      },
      // 로딩 오버레이가 표시될 DOM 요소
      galleryLoadingContainerOfRightSidebarRef.current,
      // 오버레이 옵션
      {
        message: '이미지 준비중...',
        zIndex: 20
      }
    )();
  };
  
  // 이미지 순서 갤러리의 완료 처리 
  const handleOrderEditGalleryDone = (selectedImagesfromOerderEditGallery) => {
    //TODO 이미지 배열이 비어있다는 것이 "" 빈 문자열인지 null값인지 구분에 대한 명확한 규정이 필요한듯 함. 
    // 이미지 배열이 비어있는 경우 기존 값이 모두 삭제된 것이므로, 그대로 메인/서브 이미지 모두 초기화
    if (!selectedImagesfromOerderEditGallery || selectedImagesfromOerderEditGallery.length === 0) {
      // 모든 이미지 초기화 (protoServerDataset 초기값과 일치)
      dispatch(updateField({ field: 'mainImage', value: "" }));
      dispatch(trackField({ field: 'mainImage' }));
      dispatch(updateField({ field: 'subImages', value: [] }));
      dispatch(trackField({ field: 'subImages' }));
      return;
    }
    
    // 선택된 이미지 배열 깊은 복사 (문자열 배열이므로 JSON 방식 사용)
    const selectedImagesCopy = JSON.parse(JSON.stringify(selectedImagesfromOerderEditGallery || []));
    
    // 유효한 이미지만 필터링
    const validImages = selectedImagesCopy.filter(img => 
      img && typeof img === 'string' && img.trim() !== '' && img !== 'blank'
    );
    
    if (!validImages.length) return;
    
    // 순서 편집 모달에서 호출된 경우 (이미지 순서 변경)
    if (isImageOrderEditorOpen) {
      // 첫 번째 이미지가 'blank'인지 확인 (메인 이미지 슬롯이 비어있음을 의미)
      const hasBlankMainImage = selectedImagesCopy.length > 0 && selectedImagesCopy[0] === 'blank';
      
      if (hasBlankMainImage) {
        // 메인 이미지가 'blank'인 경우 (hasMainImage=false 였던 경우)
        // 메인 이미지는 비우고 모든 유효 이미지를 서브 이미지로 설정
        dispatch(updateField({ field: 'mainImage', value: "" }));
        dispatch(trackField({ field: 'mainImage' }));
        dispatch(updateField({ field: 'subImages', value: validImages }));
        dispatch(trackField({ field: 'subImages' }));
      } else if (validImages.length > 0) {
        // 첫 번째 이미지를 메인 이미지로, 나머지를 서브 이미지로 설정
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

  // 신규 아이템 추가 핸들러
  const handleAddNewItem = (e) => {
    if (e) e.preventDefault();
    
    // 1. 기존 데이터가 없는 빈 상태에서 편집 시작
    dispatch(startEdit({ itemdata: protoServerDataset }));
    
    // 2. 편집 시작 후 약간의 시간 간격을 두고 구글탐색 기능도 함께 실행
    setTimeout(() => {
      // 구글 탐색 기능 호출
      googlePlaceSearchBarButtonHandler();
    }, 300); // 약간의 지연 시간을 둠
  };

  return (
    <div className={styles.rightSidebar}>
      {/* 상단 버튼 영역 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          {isEditorOn && !originalitemdata?.id && (
            <span className={styles.editingStatusText}>신규상점 입력 중...</span>
          )}
          {isEditorOn && originalitemdata?.id && (
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
        <div className={styles.topButtonsContainer}>
          <button 
            className={styles.addShopButton} 
            onClick={googlePlaceSearchBarButtonHandler}
            title="구글 장소 검색"
            disabled={isEditorOn || isConfirming || status === 'loading'}
          >
            &lt;구글탐색
          </button>
          <button 
            id="addNewItem"
            className={styles.addShopButton} 
            onClick={handleAddNewItem}
            title="신규 아이템 추가"
            disabled={isEditorOn || isConfirming || status === 'loading'}
          >
            + 
          </button>
        </div>
      </div>

      {/* 상점 정보 카드 */}
      <div className={cardClassName}>
        <div className={styles.rightSidebarButtonContainer}>
          <h3>
            {isIdle 
              ? "상점 Data" 
              : (formData.itemName || (!isEditorOn ? "상점 Data" : "신규상점 추가"))}
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
          ) : (!isIdle && !isEditorOn && !isConfirming) ? (
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
                        value={isValueEmpty(formData.pinCoordinates, "pinCoordinates") ? "" : "등록됨"}
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
                        value={isValueEmpty(formData.path, "path") ? "" : "등록됨"}
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
                onImagesSelected={handleOrderEditGalleryDone}
                onCancelSelection={handleCancelImageSelection}
                source="rightSidebar"
              />
              {/* 이미지 편집 오버레이 - 에디터 모드일 때만 표시 */}
              {(() => {
                
                const mainImageValid = formData.mainImage && typeof formData.mainImage === 'string' && formData.mainImage.trim() !== '';
                const subImagesValid = Array.isArray(formData.subImages) && formData.subImages.length > 0 && 
                  formData.subImages.some(img => img && typeof img === 'string' && img.trim() !== '');
                
                const shouldShowButton = mainImageValid || subImagesValid;
                
                return shouldShowButton && (
                  <div
                    ref={galleryLoadingContainerOfRightSidebarRef}
                    className={styles.imageSectionOverlayContainer}
                    onClick={handleOpenOrderEditImagesGallery}
                  >
                    <span className={styles.imageSectionOverlayText}>이미지 순서편집</span>
                  </div>
                );
              })()}
            </div>
          </form>
        )}
      </div>
      
      {/* 확인 모달 추가 */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        itemName={formData.itemName}
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
const RightSidebar = ({ mapOverlayHandlers }) => {
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  
  // 구글탐색 버튼 핸들러
  const googlePlaceSearchBarButtonHandler = (e) => {
    if (e) e.preventDefault();
    
    // CompareBar 활성화 - 순서 중요함 (먼저 sync 설정, 그 다음 active 설정)
    dispatch(setSyncGoogleSearch()); // 구글 검색폼의 데이터가 setCompareBarActive를 호출하도록 플래그 설정
    dispatch(setCompareBarActive(null)); // CompareBar 활성화 및 초기화
    
    // 검색창으로 포커스 이동 - 사용자가 바로 장소를 검색할 수 있도록 함
    const searchInput = document.querySelector('[data-testid="place-search-input"]');
    if (searchInput) {
      searchInput.focus();
    }
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
        mapOverlayHandlers={mapOverlayHandlers}
      />
      {togglePanelButton}
    </>
  );
};

export default RightSidebar; 