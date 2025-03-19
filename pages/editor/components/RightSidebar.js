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
  finalConfirmAndSubmit
} from '../store/slices/rightSidebarSlice';

/**
 * 비교 모달 컴포넌트
 * 상점 데이터 폼과 동일한 모양으로 우측에 표시되는 모달
 * 원본 데이터와 수정된 데이터를 비교하는 기능 제공
 */
const CompareModal = ({ onShopUpdate, mapOverlayHandlers }) => {
  const dispatch = useDispatch();
  const isVisible = useSelector(selectIsCompareModalVisible);
  const originalShopData = useSelector(selectOriginalShopData);
  const editedShopData = useSelector(selectEditNewShopDataSet);

  // 모달이 표시되지 않으면 null 반환
  if (!isVisible) {
    return null;
  }

  // 원본 데이터가 없는 경우 (신규 추가 시)
  const isNewShop = !originalShopData || Object.keys(originalShopData).length === 0;

  // 원본 데이터 값 가져오기
  const getOriginalValue = (field) => {
    if (!originalShopData) return '';
    return originalShopData[field] || '';
  };

  // 수정된 데이터 값 가져오기
  const getEditedValue = (field) => {
    if (!editedShopData) return '';
    return editedShopData[field] || '';
  };

  // 필드 변경 여부 확인
  const isFieldChanged = (field) => {
    const originalValue = getOriginalValue(field);
    const editedValue = getEditedValue(field);
    
    // 배열인 경우 문자열로 변환하여 비교
    if (Array.isArray(originalValue) && Array.isArray(editedValue)) {
      return JSON.stringify(originalValue) !== JSON.stringify(editedValue);
    }
    
    return originalValue !== editedValue;
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    dispatch(closeCompareModal());
  };

  // 최종 확인 핸들러 - 확인 액션 후 저장 로직 실행
  const handleFinalConfirm = () => {
    // 데이터 저장 대신 콘솔에 출력만 함
    console.log('서버로 전송할 데이터:', editedShopData);
    
    // 외부로 임시 오버레이 정리 함수 호출
    if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
      mapOverlayHandlers.cleanupTempOverlays();
    }
    
    // 모달 닫기
    dispatch(closeCompareModal());
    
    // 편집 취소 액션 호출하여 폼 데이터 비우기
    dispatch(cancelEdit());
  };

  // 원본 값과 수정된 값 모두 표시
  const renderComparisonField = (field, label, formatValue = value => value) => {
    const originalValue = getOriginalValue(field);
    const editedValue = getEditedValue(field);
    const isChanged = isFieldChanged(field);
    
    const formattedOriginalValue = formatValue(originalValue);
    const formattedEditedValue = formatValue(editedValue);
    
    if( field === 'comment' ){
    console.log(originalValue," / " ,editedValue, "///", isChanged, '/', formattedOriginalValue, " / ", formattedEditedValue );
    }
    
    return (
      <div className={styles.formRow}>
        <div className={styles.formLabelContainer}>
          <span className={styles.formLabel}>{label}</span>
        </div>
        <div className={styles.comparisonContainer}>
          <div className={styles.originalValueContainer}>
            <input
              type="text"
              value={formattedOriginalValue}
              readOnly
              className={`${styles.filledInput} ${isChanged ? styles.originalValue : ''}`}
            />
          </div>
          <div className={styles.editedValueContainer}>
            <input
              type="text"
              value={formattedEditedValue}
              readOnly
              className={`${styles.filledInput} ${isChanged ? styles.changedField : ''}`}
            />
            {isChanged && <div className={styles.changeIndicator}>변경됨</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.compareModal} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.compareModalHeader}>
        <h3>{isNewShop ? "신규 추가 데이터 확인" : "데이터 비교"}</h3>
        <div className={styles.headerButtonGroup}>
          <button 
            className={styles.confirmButton}
            onClick={handleFinalConfirm}
          >
            최종확인
          </button>
          <button 
            className={styles.headerButton}
            onClick={handleCloseModal}
          >
            닫기
          </button>
        </div>
      </div>
      
      <div className={styles.compareCard}>
        <div className={styles.comparisonHeader}>
          <h3>{isNewShop ? "신규 추가" : "원본 데이터"}</h3>
          <h3>{"수정된 데이터"}</h3>
        </div>
        <div className={styles.form}>
          {/* 상점명 */}
          {renderComparisonField('storeName', '상점명')}

          {/* 상점 스타일 */}
          {renderComparisonField('storeStyle', '상점 스타일')}

          {/* 별칭 */}
          {renderComparisonField('alias', '별칭')}

          {/* 코멘트 */}
          {renderComparisonField('comment', '코멘트')}

          {/* 위치지역 */}
          {renderComparisonField('locationMap', '위치지역')}

          {/* 영업시간 */}
          {renderComparisonField('businessHours', '영업시간', 
            value => Array.isArray(value) ? value.join(', ') : value)}

          {/* hot시간 */}
          {renderComparisonField('hotHours', 'hot시간')}

          {/* 할인 시간 */}
          {renderComparisonField('discountHours', '할인시간')}

          {/* 주소 */}
          {renderComparisonField('address', '주소')}

          {/* 메인 이미지 */}
          {renderComparisonField('mainImage', '메인 이미지')}

          {/* 핀 좌표 */}
          {renderComparisonField('pinCoordinates', '핀 좌표')}

          {/* 다각형 경로 */}
          {renderComparisonField('path', '다각형 경로')}

          {/* 아이콘분류 */}
          {renderComparisonField('categoryIcon', '아이콘분류')}

          {/* Google 데이터 ID */}
          {renderComparisonField('googleDataId', '구글데이터ID')}
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
  const cardClassName = isEditing ? `${styles.card} ${styles.cardEditing}` : styles.card;

  // 수정 상태에 따른 버튼 텍스트 결정
  let buttonText = "수정";
  if (isEditing) {
    buttonText = "수정완료";
  } else if (isConfirming) {
    buttonText = "재수정";
  }

  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    // 특별한 필드 타입에 따른 빈 값 체크
    let isEmpty = true;
    
    if (fieldName === 'businessHours') {
      isEmpty = !formData[fieldName] || formData[fieldName] === '';
    } else if (fieldName === 'path' || fieldName === 'pinCoordinates') {
      isEmpty = !formData[fieldName] || formData[fieldName] === '';
    } else {
      isEmpty = !formData[fieldName];
    }
    
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
        <div className={styles.buttonContainer}>
          <h3>{formData.storeName || (!isEditing ? "상점 Data" : "신규상점 추가")}</h3>
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
                {buttonText}
              </button>
            </div>
          ) : (
            <button 
              className={styles.headerButton} 
              onClick={handleEditFoamCardButton}
              disabled={status === 'loading'}
            >
              {buttonText}
            </button>
          )}
        </div>

        {/* 상점 정보 폼 */}
        <form className={styles.form}>
          {/* 상점명 */}
          <div className={styles.formRow}>
            <span>상점명</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="storeName"
                value={formData.storeName || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("storeName")}
                className={getInputClassName("storeName")}
                ref={el => inputRefs.current.storeName = el}
                onClick={() => {
                  if (isEditing && formData.storeName) {
                    handleFieldEditButtonClick(new Event('click'), "storeName");
                  }
                }}
              />
              {isEditing && formData.storeName && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "storeName")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 상점 스타일 */}
          <div className={styles.formRow}>
            <span>상점 스타일</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="storeStyle"
                value={formData.storeStyle || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("storeStyle")}
                className={getInputClassName("storeStyle")}
                ref={el => inputRefs.current.storeStyle = el}
                onClick={() => {
                  if (isEditing && formData.storeStyle) {
                    handleFieldEditButtonClick(new Event('click'), "storeStyle");
                  }
                }}
              />
              {isEditing && formData.storeStyle && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "storeStyle")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 별칭 */}
          <div className={styles.formRow}>
            <span>별칭</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="alias"
                value={formData.alias || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("alias")}
                className={getInputClassName("alias")}
                ref={el => inputRefs.current.alias = el}
                onClick={() => {
                  if (isEditing && formData.alias) {
                    handleFieldEditButtonClick(new Event('click'), "alias");
                  }
                }}
              />
              {isEditing && formData.alias && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "alias")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 코멘트 */}
          <div className={styles.formRow}>
            <span>코멘트</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="comment"
                value={formData.comment || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("comment")}
                className={getInputClassName("comment")}
                ref={el => inputRefs.current.comment = el}
                onClick={() => {
                  if (isEditing && formData.comment) {
                    handleFieldEditButtonClick(new Event('click'), "comment");
                  }
                }}
              />
              {isEditing && formData.comment && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "comment")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 위치지역 */}
          <div className={styles.formRow}>
            <span>위치지역</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="locationMap"
                value={formData.locationMap || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("locationMap")}
                className={getInputClassName("locationMap")}
                ref={el => inputRefs.current.locationMap = el}
                onClick={() => {
                  if (isEditing && formData.locationMap) {
                    handleFieldEditButtonClick(new Event('click'), "locationMap");
                  }
                }}
              />
              {isEditing && formData.locationMap && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "locationMap")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 영업시간 */}
          <div className={styles.formRow}>
            <span>영업시간</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="businessHours"
                value={formData.businessHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("businessHours")}
                className={getInputClassName("businessHours")}
                ref={el => inputRefs.current.businessHours = el}
                onClick={() => {
                  if (isEditing && formData.businessHours) {
                    handleFieldEditButtonClick(new Event('click'), "businessHours");
                  }
                }}
              />
              {isEditing && formData.businessHours && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "businessHours")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* hot시간 */}
          <div className={styles.formRow}>
            <span>hot시간</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="hotHours"
                value={formData.hotHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("hotHours")}
                className={getInputClassName("hotHours")}
                ref={el => inputRefs.current.hotHours = el}
                onClick={() => {
                  if (isEditing && formData.hotHours) {
                    handleFieldEditButtonClick(new Event('click'), "hotHours");
                  }
                }}
              />
              {isEditing && formData.hotHours && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "hotHours")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 할인 시간 */}
          <div className={styles.formRow}>
            <span>할인시간</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="discountHours"
                value={formData.discountHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("discountHours")}
                className={getInputClassName("discountHours")}
                ref={el => inputRefs.current.discountHours = el}
                onClick={() => {
                  if (isEditing && formData.discountHours) {
                    handleFieldEditButtonClick(new Event('click'), "discountHours");
                  }
                }}
              />
              {isEditing && formData.discountHours && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "discountHours")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 주소 */}
          <div className={styles.formRow}>
            <span>주소</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="address"
                value={formData.address || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("address")}
                className={getInputClassName("address")}
                ref={el => inputRefs.current.address = el}
                onClick={() => {
                  if (isEditing && formData.address) {
                    handleFieldEditButtonClick(new Event('click'), "address");
                  }
                }}
              />
              {isEditing && formData.address && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "address")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 메인 이미지 */}
          <div className={styles.formRow}>
            <span>메인 이미지</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="mainImage"
                value={formData.mainImage || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("mainImage")}
                className={getInputClassName("mainImage")}
                ref={el => inputRefs.current.mainImage = el}
                onClick={() => {
                  if (isEditing && formData.mainImage) {
                    handleFieldEditButtonClick(new Event('click'), "mainImage");
                  }
                }}
              />
              {isEditing && formData.mainImage && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "mainImage")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* 핀 좌표 */}
          <div className={styles.formRow}>
            <span>핀 좌표</span>
            <div className={styles.inputContainer}>
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

          {/* 다각형 경로 */}
          <div className={styles.formRow}>
            <span>다각형 경로</span>
            <div className={styles.inputContainer}>
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

          {/* 아이콘분류류 */}
          <div className={styles.formRow}>
            <span>아이콘분류</span>
            <div className={styles.inputContainer}>
              <input
                type="text"
                name="categoryIcon"
                value={formData.categoryIcon || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("categoryIcon")}
                className={getInputClassName("categoryIcon")}
                ref={el => inputRefs.current.categoryIcon = el}
                onClick={() => {
                  if (isEditing && formData.categoryIcon) {
                    handleFieldEditButtonClick(new Event('click'), "categoryIcon");
                  }
                }}
              />
              {isEditing && formData.categoryIcon && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "categoryIcon")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

          {/* Google 데이터 ID */}
          <div className={styles.formRow}>
            <span>구글데이터ID</span>
            <div className={styles.inputContainer}>
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
              {isEditing && formData.googleDataId && (
                <button
                  className={styles.inputOverlayButton}
                  onClick={(e) => handleFieldEditButtonClick(e, "googleDataId")}
                  style={{ display: 'block' }}
                  title="편집"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>

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