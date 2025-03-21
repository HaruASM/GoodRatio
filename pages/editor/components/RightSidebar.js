import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { protoServerDataset } from '../dataModels';
import {
  togglePanel,
  startEdit,
  completeEdit,
  cancelEdit,
  confirmEdit,
  updateField,
  trackField,
  updateFormData,
  syncExternalShop,
  saveShopData,
  selectIsPanelVisible,
  selectIsEditing,
  selectIsConfirming,
  selectHasChanges,
  selectFormData,
  selectModifiedFields,
  selectEditNewShopDataSet,
  selectStatus,
  selectError,
  selectIsCompareModalVisible,
  selectOriginalShopData,
  startDrawingMode,
  addNewShop,
  closeCompareModal,
  finalConfirmAndSubmit,
  selectIsIdle,
  startGsearch,
  selectIsGsearch,
  selectGooglePlaceData,
  startCompareModal
} from '../store/slices/rightSidebarSlice';

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
 * 비교 모달 컴포넌트
 * 상점 데이터 폼과 동일한 모양으로 우측에 표시되는 모달
 * 원본 데이터와 수정된 데이터를 비교하는 기능 제공
 */
const CompareModal = ({ onShopUpdate, mapOverlayHandlers }) => { //AT (작업중) 비교모달 출력부분
  const dispatch = useDispatch();
  const isVisible = useSelector(selectIsCompareModalVisible);
  const originalShopData = useSelector(selectOriginalShopData);
  const editedShopData = useSelector(selectEditNewShopDataSet);
  const insertMode = useSelector(selectIsGsearch);
  const googlePlaceData = useSelector(selectGooglePlaceData);
  
  // 비교 모달 데이터 가져오기
  const compareModalData = useSelector(state => state.rightSidebar.compareModalData);

  // 모달이 표시되지 않으면 null 반환
  if (!isVisible) {
    return null;
  }

  // 모달 데이터에서 레퍼런스와 타겟 데이터 및 라벨 가져오기
  const referenceLabel = compareModalData.reference.label; 
  const targetLabel = compareModalData.target.label; 
  
  // 레퍼런스 데이터 (compareModalData 사용, 없으면 기존 로직 사용)
  const referenceData = compareModalData.reference.data;
  
  // 타겟 데이터 (compareModalData 사용, 없으면 기존 로직 사용)
  const targetData = compareModalData.target.data; 

  // 원본 데이터가 없는 경우 (신규 추가 시)
  const isNewShop = !originalShopData || Object.keys(originalShopData).length === 0;

  // 원본 데이터 값 가져오기 (단순화된 방식)
  const getOriginalValue = (field) => {
    if (!referenceData) return '';
    return referenceData[field] !== undefined ? referenceData[field] : '';
  };

  // 수정된 데이터 값 가져오기 (단순화된 방식)
  const getEditedValue = (field) => {
    if (!targetData) return '';
    return targetData[field] !== undefined ? targetData[field] : '';
  };

  // 필드 변경 여부 확인 (단순화된 방식)
  const isFieldChanged = (field) => {
    const originalValue = getOriginalValue(field);
    const editedValue = getEditedValue(field);
    
    // 배열인 경우 문자열로 변환하여 비교
    if (Array.isArray(originalValue) && Array.isArray(editedValue)) {
      return JSON.stringify(originalValue) !== JSON.stringify(editedValue);
    }
    
    return originalValue !== editedValue;
  };
  
  // reference 데이터를 target으로 복사하는 함수
  const copyReferenceToTarget = (field) => {
    const value = getOriginalValue(field);
    
    // 필드 값이 없는 경우 처리하지 않음
    if (value === undefined || value === null) return;
    
    // 편집 중인 상태에서 필드 업데이트
    dispatch(updateField({ field, value }));
    
    // 필드 변경 추적
    dispatch(trackField({ field }));
    
    // 로컬 상태에도 즉시 반영 (UI 업데이트를 위해)
    if (targetData) {
      // 깊은 복사를 통한 객체 업데이트
      const updatedTargetData = { 
        ...targetData,
        [field]: value 
      };
      
      // compareModalData 업데이트
      dispatch({
        type: 'rightSidebar/updateCompareModalTarget',
        payload: updatedTargetData
      });
    }
    
    console.log(`${field} 필드 값 복사됨:`, value);
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    // 외부로 임시 오버레이 정리 함수 호출 (기존 오버레이 정리)
    if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
      mapOverlayHandlers.cleanupTempOverlays();
    }
    
    // 모달 닫기 및 구글 장소 데이터 초기화
    dispatch(closeCompareModal());
    
    console.log('모달 닫힘: 구글 데이터 초기화됨');
  };

  // 최종 확인 핸들러 - 확인 액션 후 저장 로직 실행
  const handleFinalConfirm = () => {
    // 구글 검색 모드일 경우 데이터 업데이트
      if (insertMode && googlePlaceData) {
      const updatedData = {
        storeName: googlePlaceData.name || '',
        address: googlePlaceData.formatted_address || '',
        googleDataId: googlePlaceData.place_id || '',
      };
      
      // 폼 데이터 업데이트
      dispatch(updateFormData(updatedData));
      
      // 편집 중인 경우 필드 업데이트
      if (originalShopData) {
        dispatch(updateField({ field: 'storeName', value: googlePlaceData.name || '' }));
        dispatch(updateField({ field: 'address', value: googlePlaceData.formatted_address || '' }));
        dispatch(updateField({ field: 'googleDataId', value: googlePlaceData.place_id || '' }));
        
        // 필드 변경 추적
        dispatch(trackField({ field: 'storeName' }));
        dispatch(trackField({ field: 'address' }));
        dispatch(trackField({ field: 'googleDataId' }));
      }
      
      console.log('구글 장소 데이터 적용:', updatedData);
    } else {
      // 일반 모드에서는 기존 방식대로 처리
    console.log('서버로 전송할 데이터:', editedShopData);
    }
    
    // 외부로 임시 오버레이 정리 함수 호출
    if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
      mapOverlayHandlers.cleanupTempOverlays();
    }
    
    // 모달 닫기
    dispatch(closeCompareModal());
    
    // 구글 검색 모드가 아닌 경우에만 편집 취소
    if (!insertMode) {
    dispatch(cancelEdit());
    }
  };

  // 원본 값과 수정된 값 모두 표시
  const renderComparisonField = (field, label, formatValue = value => value) => {
    const originalValue = getOriginalValue(field);
    const editedValue = getEditedValue(field);
    const isChanged = isFieldChanged(field);
    const isOriginalEmpty = isValueEmpty(originalValue, field);
    
    const formattedOriginalValue = formatValue(originalValue);
    const formattedEditedValue = formatValue(editedValue);
    
    return (
      <div key={field} className={styles.rightSidebarFormRow}>
        <div className={styles.rightSidebarFormLabelContainer}>
          <span className={styles.rightSidebarFormLabel}>{label}</span>
        </div>
        <div className={styles.rightSidebarComparisonContainer}>
          <div className={styles.rightSidebarOriginalValueContainer}>
            <div className={styles.rightSidebarInputWithButton}>
              <input
                type="text"
                value={formattedOriginalValue || ""}
                readOnly
                className={`${styles.filledInput} ${isChanged ? styles.rightSidebarOriginalValue : ''}`}
              />
              {insertMode && isChanged && !isOriginalEmpty && (
                <button
                  className={styles.copyButton}
                  onClick={() => copyReferenceToTarget(field)}
                  title="이 값으로 업데이트"
                >
                  →
                </button>
              )}
            </div>
          </div>
          <div className={styles.rightSidebarEditedValueContainer}>
            <input
              type="text"
              value={formattedEditedValue || ""}
              readOnly
              className={`${styles.filledInput} ${isChanged ? styles.rightSidebarChangedField : ''}`}
            />
          </div>
        </div>
      </div>
    );
  };

  // 모달 설정 가져오기
  const modalTitle = compareModalData.modalConfig?.title || "데이터 비교";
  const buttonText = compareModalData.modalConfig?.button?.text || "확인";
  const showConfirmButton = compareModalData.modalConfig?.button !== null && 
                          compareModalData.modalConfig?.button !== undefined && 
                          Object.keys(compareModalData.modalConfig?.button || {}).length > 0 &&
                          compareModalData.modalConfig?.button?.text !== "";

  return (
    <div className={`${styles.rightSidebarCompareModal} ${isVisible ? styles.rightSidebarVisible : ''}`}>
      <div className={styles.rightSidebarCompareModalHeader}>
        <h3>{modalTitle}</h3>
        <div className={styles.rightSidebarHeaderButtonGroup}>
          {showConfirmButton && (
            <button 
              className={styles.confirmButton}
              onClick={handleFinalConfirm}
            >
              {buttonText}
            </button>
          )}
          <button 
            className={styles.cancelButton}
            onClick={handleCloseModal}
          >
            &gt;닫기
          </button>
        </div>
      </div>
      <div className={styles.rightSidebarCompareCard}>
        <div className={styles.rightSidebarForm}>
          {/* 상점명 라벨 */}
          <div className={styles.rightSidebarFormRow}>
            <div className={styles.rightSidebarFormLabelContainer}>
              <span className={styles.rightSidebarFormLabel}></span>
        </div>
            <div className={styles.rightSidebarComparisonContainer}>
              <div className={styles.rightSidebarOriginalValueContainer}>
                <div className={styles.rightSidebarColumnLabel}>{referenceLabel}</div>
              </div>
              <div className={styles.rightSidebarEditedValueContainer}>
                <div className={styles.rightSidebarColumnLabel}>{targetLabel}</div>
              </div>
            </div>
          </div>
          
          {/* 필드들을 배열로부터 렌더링 */}
          {titlesofDataFoam.map(item => {
            // 영업시간 필드는 포맷팅 함수 추가
            if (item.field === 'businessHours') {
              return renderComparisonField(
                item.field, 
                item.title, 
                value => Array.isArray(value) ? value.join(', ') : value
              );
            }
            return renderComparisonField(item.field, item.title);
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * 오른쪽 사이드바 내부 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const SidebarContent = ({ addNewShopItem, moveToCurrentLocation, mapOverlayHandlers, currentShopServerDataSet, onShopUpdate }) => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const isEditing = useSelector(selectIsEditing);
  const isConfirming = useSelector(selectIsConfirming);
  const hasChanges = useSelector(selectHasChanges);
  const formData = useSelector(selectFormData);
  const modifiedFields = useSelector(selectModifiedFields);
  const editNewShopDataSet = useSelector(selectEditNewShopDataSet);
  const status = useSelector(selectStatus);
  const error = useSelector(selectError);
  const isCompareModalVisible = useSelector(selectIsCompareModalVisible);
  const isIdle = useSelector(selectIsIdle);
  
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

  // 수정 상태에 따른 버튼 텍스트 결정
  let buttonText = "수정";
  if (isEditing) {
    buttonText = "수정완료";
  } else if (isConfirming) {
    buttonText = "재수정";
  }

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

  // 입력 필드의 readOnly 상태 결정 함수
  const isFieldReadOnly = (fieldName) => {
    // 편집 모드가 아니면 모든 필드 readOnly
    if (!isEditing) return true;
    
    // 편집 모드에서 값이 없는 필드는 자동으로 편집 가능
    if (!formData[fieldName]) return false;
    
    // 수정된 필드는 편집 가능 (inputRefs에서 readOnly 상태 확인)
    if (inputRefs.current[fieldName] && inputRefs.current[fieldName].readOnly === false) {
      return false;
    }
    
    // 값이 있는 필드는 기본적으로 readOnly (편집 버튼으로 활성화)
    return true;
  };

  // 이벤트 핸들러
  const handleEditFoamCardButton = (e) => {
    e.preventDefault();
    
    if (isEditing) {
      dispatch(completeEdit());
    } else {
      // 직접 데이터 전달 (serverDataset 구조 사용 않음)
      dispatch(startEdit({ 
        shopData: currentShopServerDataSet
      }));
    }
  };
  
  const handleConfirmEdit = () => {
    // 데이터 저장 없이 모달창만 표시
    dispatch(confirmEdit());
  };
  
  const handleCancelEdit = () => {
    // 외부로 임시 오버레이 정리 함수 호출 (props로 전달받은 함수)
    if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
      mapOverlayHandlers.cleanupTempOverlays();
    }
    
    // 편집 취소 액션 디스패치
    dispatch(cancelEdit());
  };
  
  const handleFieldEditButtonClick = (e, fieldName) => {
    e.preventDefault();
    
    // 필드 편집 가능하게 설정
    if (inputRefs.current[fieldName]) {
      inputRefs.current[fieldName].readOnly = false;
      inputRefs.current[fieldName].focus();
      
      // 필드 변경 추적
      dispatch(trackField({ field: fieldName }));
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 폼 데이터 업데이트
    dispatch(updateFormData({ [name]: value }));
    
    // 필드 값 업데이트 - 배열 타입 특수 처리
    let processedValue = value;
    
    // 배열형 필드 처리
    if (name === 'businessHours') {
      if (value === '' || value.trim() === '') {
        processedValue = [""];  // 빈 값은 [""] 형태로 저장
      } else {
        processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
        if (processedValue.length === 0) {
          processedValue = [""];  // 결과가 빈 배열이면 [""] 형태로 저장
        }
      }
    }
    
    // 원본 값 가져오기
    let originalValue = null;
    if (currentShopServerDataSet) {
      originalValue = currentShopServerDataSet[name];
    }
    
    // 값 업데이트 액션 디스패치
    dispatch(updateField({ field: name, value: processedValue }));
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

  // 구글 플레이스 검색 시작 (서버 데이터와 구글 데이터 비교)
  const handleGooglePlaceSearchClick = (e) => {
    e.preventDefault();
    
    // 구글 데이터 초기화
    dispatch(startGsearch());
    
    // 검색 입력란으로 포커스 이동
    if (document.querySelector('[data-testid="place-search-input"]')) {
      document.querySelector('[data-testid="place-search-input"]').focus();
    }
    
    console.log('검색 인풋으로 포커스 이동 및 구글 검색 모드 활성화');
  };

  // 직접 비교 모달 호출 예제 (modalConfig 설정 추가)
  const handleCustomCompare = (referenceData, targetData, options = {}) => {
    // 옵션에서 값 추출
    const { insertMode = false, modalConfig = null } = options;
    
    // 비교 모달 시작 (레퍼런스 데이터, 타겟 데이터, 옵션)
    dispatch(startCompareModal([
      ['참조데이터', referenceData],
      ['대상데이터', targetData],
      { insertMode, modalConfig }
    ]));
  };

  return (
    <div className={styles.rightSidebar}>
      {/* 상단 버튼 영역 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          {isEditing && !currentShopServerDataSet && (
            <span className={styles.editingStatusText}>신규상점 입력 중...</span>
          )}
          {isEditing && currentShopServerDataSet && (
            <span className={styles.editingStatusText}>데이터 수정 중...</span>
          )}
          {isConfirming && !hasChanges && (
            <span className={styles.editingStatusText}>
              변경사항 없음
            </span>
          )}
          {isConfirming && hasChanges && (
            <span className={styles.editingStatusText}>
              변경사항이 있습니다
            </span>
          )}
          {!isEditing && !isConfirming && (
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
          onClick={addNewShopItem}
          title="상점 추가"
          disabled={isEditing || isConfirming || status === 'loading'}
        >
          ➕ 상점 추가
        </button>
      </div>

      {/* 상점 정보 카드 */}
      <div className={cardClassName}>
        <div className={styles.rightSidebarButtonContainer}>
          <h3>
            {isIdle 
              ? "상점 Data" 
              : (formData.storeName || (!isEditing ? "상점 Data" : "신규상점 추가"))}
          </h3>
          
          {/* 수정/완료 버튼 - 상태에 따라 다르게 표시 */}
          {!isIdle && !isConfirming && !isEditing && currentShopServerDataSet && (
            <button 
              className={styles.headerButton} 
              onClick={handleEditFoamCardButton}
              disabled={status === 'loading'}
            >
              {buttonText}
            </button>
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
              <button 
                className={styles.headerButton} 
                onClick={handleEditFoamCardButton}
                disabled={status === 'loading'}
              >
                재수정
              </button>
            </div>
          ) : (
            isEditing && (
              <div className={styles.buttonGroup}>
                <button 
                  className={styles.cancelButton} 
                  onClick={handleCancelEdit}
                  disabled={status === 'loading'}
                >
                  취소
                </button>
            <button 
              className={styles.headerButton} 
              onClick={handleEditFoamCardButton}
              disabled={status === 'loading'}
            >
              {buttonText}
            </button>
              </div>
            )
          )}
        </div>

        {/* 상점 정보 폼 */}
        {isIdle ? (
          <div className={styles.emptyStateMessage}>
            <p>상점에디터mode</p>
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
              />
              {isEditing && (
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
              />
              {isEditing && (
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
                        value={formData.googleDataId || ""}
                onChange={handleInputChange}
                        readOnly={isFieldReadOnly("googleDataId")}
                        className={getInputClassName("googleDataId")}
                        ref={el => inputRefs.current.googleDataId = el}
                onClick={() => {
                          if (isEditing && formData.googleDataId) {
                            handleFieldEditButtonClick(new Event('click'), "googleDataId");
                  }
                }}
              />
                      {isEditing && (
                <button
                  className={styles.inputOverlayButton}
                          onClick={handleGooglePlaceSearchClick}
                  style={{ display: 'block' }}
                          title="구글 장소 검색"
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
              <input
                type="text"
                        name={item.field}
                        value={formData[item.field] || ""}
                onChange={handleInputChange}
                        readOnly={isFieldReadOnly(item.field)}
                        className={getInputClassName(item.field)}
                        ref={el => inputRefs.current[item.field] = el}
                onClick={() => {
                          if (isEditing && formData[item.field]) {
                            handleFieldEditButtonClick(new Event('click'), item.field);
                  }
                }}
              />
                      {isEditing && formData[item.field] && (
                <button
                  className={styles.inputOverlayButton}
                          onClick={(e) => handleFieldEditButtonClick(e, item.field)}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>
                );
              }
            })}

          {/* 이미지 미리보기 영역 */}
          <div className={styles.imagesPreviewContainer}>
            <div className={styles.imageSection}>
              <div className={styles.mainImageContainer}>
                {formData.mainImage ? (
                  <img 
                    src={formData.mainImage} 
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
                {formData.subImages && Array.isArray(formData.subImages) && formData.subImages.length > 0 && formData.subImages[0] !== "" ? (
                  formData.subImages.slice(0, 4).map((imgUrl, index) => (
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
        )}
      </div>
      
      {/* 비교 모달에 필요한 props 전달 */}
      <CompareModal 
        onShopUpdate={onShopUpdate}
        mapOverlayHandlers={mapOverlayHandlers}
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
  const isCompareModalVisible = useSelector(selectIsCompareModalVisible);
  
  // 상점 데이터에서 serverDataset 추출
  const currentShopServerDataSet = curSelectedShop?.serverDataset || null;

  // 상점 추가 핸들러 (메인 컴포넌트와 공유)
  const handleAddNewShopItem = (e) => {
    if (e) e.preventDefault();
    
    // 외부로 임시 오버레이 정리 함수 호출 (기존 오버레이 정리)
    if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
      mapOverlayHandlers.cleanupTempOverlays();
    }
    
    // 새 상점 추가 액션 디스패치
    dispatch(addNewShop());
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
        addNewShopItem={handleAddNewShopItem}
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