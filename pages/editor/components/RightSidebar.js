import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
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
  startDrawingMode
} from '../store/slices/rightSidebarSlice';

/**
 * 오른쪽 사이드바 내부 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const SidebarContent = ({ addNewShopItem, moveToCurrentLocation, handlerfunc25, currentShop, onShopUpdate }) => {
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
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});
  
  // 현재 상점 데이터가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (currentShop && !isEditing) {
      // 외부 상점 데이터와 동기화
      dispatch(syncExternalShop({ shopData: currentShop }));
    }
  }, [currentShop, isEditing, dispatch]);
  
  // 패널이 보이지 않으면 null 반환
  if (!isPanelVisible) {
    return null;
  }

  // 수정 상태에 따른 카드 스타일 결정
  const cardClassName = isEditing ? `${styles.card} ${styles.cardEditing}` : styles.card;

  // 수정 상태에 따른 버튼 텍스트 결정
  let buttonText = "수정";
  if (isEditing) {
    buttonText = "완료";
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
      dispatch(startEdit({ shopData: currentShop }));
    }
  };
  
  const handleConfirmEdit = () => {
    // 비동기 액션을 사용하여 데이터 저장
    dispatch(saveShopData(editNewShopDataSet))
      .unwrap()
      .then((savedData) => {
        // 저장 성공 시 외부 상태 업데이트 (onShopUpdate 콜백 호출)
        if (onShopUpdate) {
          onShopUpdate(savedData);
        }
      })
      .catch((error) => {
        // 오류 처리
      });
  };
  
  const handleCancelEdit = () => {
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
    if (currentShop) {
      if (currentShop.serverDataset) {
        originalValue = currentShop.serverDataset[name];
      } else {
        originalValue = currentShop[name];
      }
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
          {isEditing && (
            <span className={styles.editingStatusText}>데이터 수정중...</span>
          )}
          {isConfirming && !hasChanges && (
            <span className={styles.editingStatusText}>
              변경사항 없음. 
              
            </span>
          )}
          {isConfirming && hasChanges && (
            <span className={styles.editingStatusText}>
              변경사항이 있습니다. 
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
          disabled={status === 'loading'}
        >
          ➕ 상점 추가
        </button>
      </div>

      {/* 상점 정보 카드 */}
      <div className={cardClassName}>
        <div className={styles.buttonContainer}>
          <h3>{formData.storeName || "상점 Data"}</h3>
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
                  {status === 'loading' ? '저장 중...' : '확인'}
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
        </form>
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
const RightSidebar = ({ addNewShopItem, moveToCurrentLocation, handlerfunc25, curSelectedShop, onShopUpdate }) => {
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  
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
        addNewShopItem={addNewShopItem}
        moveToCurrentLocation={moveToCurrentLocation}
        handlerfunc25={handlerfunc25}
        currentShop={curSelectedShop}
        onShopUpdate={onShopUpdate}
      />
      {togglePanelButton}
    </>
  );
};

export default RightSidebar; 