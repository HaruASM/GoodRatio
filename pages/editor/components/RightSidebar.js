import React, { useRef } from 'react';
import styles from '../styles.module.css';

/**
 * 오른쪽 사이드바 컴포넌트
 * 상점 정보 표시 및 편집 기능 제공
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.isPanelVisible - 패널 표시 여부
 * @param {boolean} props.isEditing - 편집 모드 상태
 * @param {boolean} props.isEditCompleted - 수정 완료 상태
 * @param {boolean} props.hasChanges - 수정 여부 상태
 * @param {Object} props.editNewShopDataSet - 편집 중인 데이터
 * @param {Object} props.formData - 폼 필드에 표시되는 데이터
 * @param {Object} props.modifiedFields - 수정된 필드 추적
 * @param {Object} props.inputRefs - 입력 필드 참조
 * @param {Function} props.handleEditFoamCardButton - 수정/완료/재수정 버튼 클릭 핸들러
 * @param {Function} props.handleConfirmEdit - 수정 확인 핸들러
 * @param {Function} props.handleCancelEdit - 수정 취소 핸들러
 * @param {Function} props.handleFieldEditButtonClick - 필드 편집 버튼 클릭 핸들러
 * @param {Function} props.handleInputChange - 입력 필드 변경 핸들러
 * @param {Function} props.addNewShopItem - 상점 추가 핸들러
 * @param {Function} props.handlePinCoordinatesButtonClick - 핀 좌표 버튼 클릭 핸들러
 * @param {Function} props.handlePathButtonClick - 경로 버튼 클릭 핸들러
 * @param {Function} props.handleCommentButtonClick - 코멘트 버튼 클릭 핸들러
 * @param {Function} props.moveToCurrentLocation - 현재 위치로 이동 핸들러
 * @param {Function} props.handlerfunc25 - 기타 핸들러 함수
 * @returns {React.ReactElement} 오른쪽 사이드바 UI 컴포넌트
 */
const RightSidebar = ({
  isPanelVisible,
  isEditing,
  isEditCompleted,
  hasChanges,
  editNewShopDataSet,
  formData,
  modifiedFields,
  inputRefs,
  handleEditFoamCardButton,
  handleConfirmEdit,
  handleCancelEdit,
  handleFieldEditButtonClick,
  handleInputChange,
  addNewShopItem,
  handlePinCoordinatesButtonClick,
  handlePathButtonClick,
  handleCommentButtonClick,
  moveToCurrentLocation,
  handlerfunc25
}) => {
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
  } else if (isEditCompleted) {
    buttonText = "재수정";
  }

  // 입력 필드 스타일 결정 함수
  const getInputClassName = (fieldName) => {
    // 기본 스타일 (비어있거나 채워져 있는지)
    const baseClassName = formData[fieldName] ? styles.filledInput : styles.emptyInput;
    
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

  return (
    <div className={styles.rightSidebar}>
      {/* 상단 버튼 영역 */}
      <div className={styles.editorHeader}>
        <div className={styles.statusMessage}>
          {isEditing && (
            <span className={styles.editingStatusText}>데이터 수정중...</span>
          )}
          {isEditCompleted && !hasChanges && (
            <span className={styles.editingStatusText}>수정된 내용이 없습니다. 다시 탐색하세요.</span>
          )}
          {isEditCompleted && hasChanges && (
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
          <h3>{formData.storeName || "상점 Data"}</h3>
          {isEditCompleted && hasChanges ? (
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

export default RightSidebar; 