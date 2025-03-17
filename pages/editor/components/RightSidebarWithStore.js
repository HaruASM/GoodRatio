import React, { useRef, useEffect } from 'react';
import styles from '../styles.module.css';
import { ActionTypes } from '../editActions';
import { useRightSidebar, RightSidebarProvider } from '../../store/context/rightSidebarContext';

/**
 * 오른쪽 사이드바 내부 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {React.ReactElement} 사이드바 UI 컴포넌트
 */
const SidebarContent = ({ addNewShopItem, moveToCurrentLocation, handlerfunc25, currentShop, onShopUpdate }) => {
  // Context에서 상태와 액션 가져오기
  const { state, actions, utils } = useRightSidebar();
  
  // 입력 필드 참조 객체
  const inputRefs = useRef({});
  
  // 현재 상점 데이터가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (currentShop && !state.isEditing) {
      // 외부 상점 데이터와 동기화
      actions.syncExternalShop(currentShop);
    }
  }, [currentShop, state.isEditing, actions]);
  
  // 패널이 보이지 않으면 null 반환
  if (!state.isPanelVisible) {
    return null;
  }

  // 수정 상태에 따른 카드 스타일 결정
  const cardClassName = state.isEditing ? `${styles.card} ${styles.cardEditing}` : styles.card;

  // 수정 상태에 따른 버튼 텍스트 결정
  let buttonText = "수정";
  if (state.isEditing) {
    buttonText = "완료";
  } else if (state.isConfirming) {
    buttonText = "재수정";
  }

  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    // 기본 스타일 (비어있거나 채워져 있는지)
    const baseClassName = state.formData[fieldName] ? styles.filledInput : styles.emptyInput;
    
    // 수정된 필드인 경우 추가 스타일
    if (state.modifiedFields && state.modifiedFields[fieldName]) {
      return `${baseClassName} ${styles.modifiedInput}`;
    }
    
    return baseClassName;
  };

  // 입력 필드의 readOnly 상태 결정 함수
  const isFieldReadOnly = (fieldName) => {
    // 편집 모드가 아니면 모든 필드 readOnly
    if (!state.isEditing) return true;
    
    // 편집 모드에서 값이 없는 필드는 자동으로 편집 가능
    if (!state.formData[fieldName]) return false;
    
    // 수정된 필드는 편집 가능 (inputRefs에서 readOnly 상태 확인)
    if (inputRefs.current[fieldName] && inputRefs.current[fieldName].readOnly === false) {
      return false;
    }
    
    // 값이 있는 필드는 기본적으로 readOnly (편집 버튼으로 활성화)
    return true;
  };
  
  // 편집/완료/재수정 버튼 클릭 핸들러
  const handleEditFoamCardButton = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 완료 버튼 클릭 시
    if (state.isEditing) {
      actions.completeEdit();
    } 
    // 수정 버튼 클릭 시
    else if (!state.isEditing && !state.isConfirming) {
      actions.startEdit(currentShop);
    } 
    // 재수정 버튼 클릭 시
    else if (!state.isEditing && state.isConfirming) {
      actions.startEdit(state.originalShopData);
    }
  };

  // 수정 확인 핸들러
  const handleConfirmEdit = () => {
    if (!state.editNewShopDataSet) return;
    
    // 서버 데이터 업데이트 로직 (실제 구현은 외부에서 처리)
    console.log('수정 확인:', state.editNewShopDataSet);
    
    // 외부 상태 업데이트 (index.js의 curSelectedShop)
    if (onShopUpdate) {
      onShopUpdate(state.editNewShopDataSet);
    }
    
    // 상태 초기화
    actions.confirmEdit();
  };

  // 수정 취소 핸들러
  const handleCancelEdit = () => {
    actions.cancelEdit();
  };
  
  // 필드 편집 버튼 클릭 핸들러
  const handleFieldEditButtonClick = (event, fieldName) => {
    event.preventDefault();
    
    console.log(`편집 버튼 클릭: ${fieldName}`);
    
    // 해당 필드 편집 가능 상태로 변경
    if (inputRefs.current[fieldName]) {
      // readOnly 속성 해제
      inputRefs.current[fieldName].readOnly = false;
      
      // 포커스 설정
      setTimeout(() => {
        inputRefs.current[fieldName].focus();
        
        // 커서를 텍스트 끝으로 이동
        const length = inputRefs.current[fieldName].value.length;
        inputRefs.current[fieldName].setSelectionRange(length, length);
      }, 0);
    }
    
    // 수정된 필드 추적
    actions.trackField(fieldName);
  };
  
  // 입력 필드 변경 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 항상 formData 업데이트
    actions.updateFormData({ [name]: value });
    
    if (state.isEditing) {
      // 편집 모드에서는 editNewShopDataSet 업데이트
      let processedValue = value;
      
      // 배열 형태로 저장해야 하는 필드 처리
      if (name === 'businessHours') {
        processedValue = value.split(',').map(item => item.trim()).filter(item => item !== '');
      }
      
      // 필드 데이터 업데이트
      actions.updateField(name, processedValue);
      
      // 수정된 필드 추적
      actions.trackField(name);
    }
  };
  
  // 핀 좌표 수정 버튼 클릭 핸들러
  const handlePinCoordinatesButtonClick = (event) => {
    event.preventDefault();
    console.log('pin 좌표 수정 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };
  
  // 경로 그리기 버튼 클릭 핸들러
  const handlePathButtonClick = (event) => {
    event.preventDefault();
    console.log('경로 그리기 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };
  
  // 코멘트 수정 버튼 클릭 핸들러
  const handleCommentButtonClick = (event) => {
    event.preventDefault();
    console.log('코멘트 수정 버튼 클릭');
    // 기능 제거 - 차후 추가 예정
  };

  return (
    <div className={styles.rightSidebar}>
      {/* 상단 버튼 영역 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          {state.isEditing && (
            <span className={styles.editingStatusText}>데이터 수정중...</span>
          )}
          {state.isConfirming && !state.hasChanges && (
            <span className={styles.editingStatusText}>수정된 내용이 없습니다. 다시 탐색하세요.</span>
          )}
          {state.isConfirming && state.hasChanges && (
            <span className={styles.editingStatusText}>변경사항이 있습니다. 확인 또는 취소를 선택하세요.</span>
          )}
        </div>
        <button 
          className={styles.addShopButton} 
          onClick={addNewShopItem}
          title="상점 추가"
        >
          ➕ 상점 추가
        </button>
      </div>

      {/* 상점 정보 카드 */}
      <div className={cardClassName}>
        <div className={styles.buttonContainer}>
          <h3>{state.formData.storeName || "상점 Data"}</h3>
          {state.isConfirming && state.hasChanges ? (
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelButton} 
                onClick={handleCancelEdit}
              >
                취소
              </button>
              <button 
                className={styles.confirmButton} 
                onClick={handleConfirmEdit}
              >
                확인
              </button>
              <button 
                className={styles.headerButton} 
                onClick={handleEditFoamCardButton}
              >
                {buttonText}
              </button>
            </div>
          ) : (
            <button 
              className={styles.headerButton} 
              onClick={handleEditFoamCardButton}
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
                value={state.formData.storeName || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("storeName")}
                className={getInputClassName("storeName")}
                ref={el => inputRefs.current.storeName = el}
                onClick={() => {
                  if (state.isEditing && state.formData.storeName) {
                    handleFieldEditButtonClick(new Event('click'), "storeName");
                  }
                }}
              />
              {state.isEditing && state.formData.storeName && (
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
                value={state.formData.storeStyle || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("storeStyle")}
                className={getInputClassName("storeStyle")}
                ref={el => inputRefs.current.storeStyle = el}
                onClick={() => {
                  if (state.isEditing && state.formData.storeStyle) {
                    handleFieldEditButtonClick(new Event('click'), "storeStyle");
                  }
                }}
              />
              {state.isEditing && state.formData.storeStyle && (
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
                value={state.formData.alias || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("alias")}
                className={getInputClassName("alias")}
                ref={el => inputRefs.current.alias = el}
                onClick={() => {
                  if (state.isEditing && state.formData.alias) {
                    handleFieldEditButtonClick(new Event('click'), "alias");
                  }
                }}
              />
              {state.isEditing && state.formData.alias && (
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
                value={state.formData.comment || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("comment")}
                className={getInputClassName("comment")}
                ref={el => inputRefs.current.comment = el}
                onClick={() => {
                  if (state.isEditing && state.formData.comment) {
                    handleFieldEditButtonClick(new Event('click'), "comment");
                  }
                }}
              />
              {state.isEditing && state.formData.comment && (
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
                value={state.formData.locationMap || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("locationMap")}
                className={getInputClassName("locationMap")}
                ref={el => inputRefs.current.locationMap = el}
                onClick={() => {
                  if (state.isEditing && state.formData.locationMap) {
                    handleFieldEditButtonClick(new Event('click'), "locationMap");
                  }
                }}
              />
              {state.isEditing && state.formData.locationMap && (
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
                value={state.formData.businessHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("businessHours")}
                className={getInputClassName("businessHours")}
                ref={el => inputRefs.current.businessHours = el}
                onClick={() => {
                  if (state.isEditing && state.formData.businessHours) {
                    handleFieldEditButtonClick(new Event('click'), "businessHours");
                  }
                }}
              />
              {state.isEditing && state.formData.businessHours && (
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
                value={state.formData.hotHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("hotHours")}
                className={getInputClassName("hotHours")}
                ref={el => inputRefs.current.hotHours = el}
                onClick={() => {
                  if (state.isEditing && state.formData.hotHours) {
                    handleFieldEditButtonClick(new Event('click'), "hotHours");
                  }
                }}
              />
              {state.isEditing && state.formData.hotHours && (
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
                value={state.formData.discountHours || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("discountHours")}
                className={getInputClassName("discountHours")}
                ref={el => inputRefs.current.discountHours = el}
                onClick={() => {
                  if (state.isEditing && state.formData.discountHours) {
                    handleFieldEditButtonClick(new Event('click'), "discountHours");
                  }
                }}
              />
              {state.isEditing && state.formData.discountHours && (
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
                value={state.formData.address || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("address")}
                className={getInputClassName("address")}
                ref={el => inputRefs.current.address = el}
                onClick={() => {
                  if (state.isEditing && state.formData.address) {
                    handleFieldEditButtonClick(new Event('click'), "address");
                  }
                }}
              />
              {state.isEditing && state.formData.address && (
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
                value={state.formData.mainImage || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("mainImage")}
                className={getInputClassName("mainImage")}
                ref={el => inputRefs.current.mainImage = el}
                onClick={() => {
                  if (state.isEditing && state.formData.mainImage) {
                    handleFieldEditButtonClick(new Event('click'), "mainImage");
                  }
                }}
              />
              {state.isEditing && state.formData.mainImage && (
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
                value={state.formData.pinCoordinates || ""}
                onChange={handleInputChange}
                readOnly={true}
                className={getInputClassName("pinCoordinates")}
                ref={el => inputRefs.current.pinCoordinates = el}
              />
              {state.isEditing && (
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
                value={state.formData.path || ""}
                onChange={handleInputChange}
                readOnly={true}
                className={getInputClassName("path")}
                ref={el => inputRefs.current.path = el}
              />
              {state.isEditing && (
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
                value={state.formData.categoryIcon || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("categoryIcon")}
                className={getInputClassName("categoryIcon")}
                ref={el => inputRefs.current.categoryIcon = el}
                onClick={() => {
                  if (state.isEditing && state.formData.categoryIcon) {
                    handleFieldEditButtonClick(new Event('click'), "categoryIcon");
                  }
                }}
              />
              {state.isEditing && state.formData.categoryIcon && (
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
                value={state.formData.googleDataId || ""}
                onChange={handleInputChange}
                readOnly={isFieldReadOnly("googleDataId")}
                className={getInputClassName("googleDataId")}
                ref={el => inputRefs.current.googleDataId = el}
                onClick={() => {
                  if (state.isEditing && state.formData.googleDataId) {
                    handleFieldEditButtonClick(new Event('click'), "googleDataId");
                  }
                }}
              />
              {state.isEditing && state.formData.googleDataId && (
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
 * 오른쪽 사이드바 컴포넌트 (Context API 사용)
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {React.ReactElement} 사이드바 UI 컴포넌트
 */
const RightSidebarWithStore = (props) => {
  const { addNewShopItem, moveToCurrentLocation, handlerfunc25, currentShop, onShopUpdate } = props;
  
  // 패널 토글 버튼
  const togglePanelButton = !props.isPanelVisible && (
    <button 
      className={styles.floatingPanelToggle}
      onClick={() => props.dispatch({ type: ActionTypes.EDIT.PANEL.ON })}
      title="패널 표시"
    >
      ≫
    </button>
  );
  
  return (
    <>
      <RightSidebarProvider>
        <SidebarContent 
          addNewShopItem={addNewShopItem}
          moveToCurrentLocation={moveToCurrentLocation}
          handlerfunc25={handlerfunc25}
          currentShop={currentShop}
          onShopUpdate={onShopUpdate}
        />
      </RightSidebarProvider>
      {togglePanelButton}
    </>
  );
};

export default RightSidebarWithStore; 