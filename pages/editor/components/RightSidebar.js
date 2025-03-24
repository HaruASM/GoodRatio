import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { protoServerDataset } from '../dataModels';
import { parseGooglePlaceData } from '../utils/placeUtils';
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
  endEdit
} from '../store/slices/rightSidebarSlice';

import { setCompareBarActive, setSyncGoogleSearch } from '../store/slices/compareBarSlice';

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
  if (isEditorOn) {
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

  // 입력 필드가 읽기 전용인지 확인하는 함수
  const isFieldReadOnly = (fieldName) => {
    // 편집 모드가 아니면 모든 필드가 읽기 전용
    if (!isEditorOn) {
      return true;
    }
    
    // 편집 중이면 모든 필드 편집 가능
    return false;
  };

  // 이벤트 핸들러
  const handleEditFoamCardButton = (e) => {
    e.preventDefault();
    
    if (isEditorOn) {
      dispatch(completeEditor());
      // 편집 종료 시 (isEditing = false)
      dispatch(endEdit());
      // 오버레이 정리를 컴포넌트에서 직접 처리
      mapOverlayHandlers.cleanupTempOverlays();
    } else {
      // 직접 데이터 전달 (serverDataset 구조 사용 않음)
      dispatch(startEdit({ 
        shopData: currentShopServerDataSet
      }));
    }
  };
  
  const handleConfirmEdit = () => {
    // startCompareModal 대신 startConfirm 액션 사용
    dispatch(startConfirm());
    // 편집 상태 종료 (isEditing = false)
    dispatch(endEdit());
    // 오버레이 정리를 컴포넌트에서 직접 처리
    mapOverlayHandlers.cleanupTempOverlays();
    console.log('수정 내용 확인 처리됨');
  };
  
  const handleCancelEdit = () => {
    dispatch(cancelEdit());
    // 편집 상태 종료 (isEditing = false)
    dispatch(endEdit());
    // 오버레이 정리를 컴포넌트에서 직접 처리
    mapOverlayHandlers.cleanupTempOverlays();
    console.log('편집 취소 처리됨');
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

  // 구글 장소 검색 클릭 처리
  const handleGooglePlaceSearchClick = (e) => {
    e.preventDefault(); // A태그 클릭 방지
    
  
    
    
    // 검색창으로 포커스 이동 (존재하는 경우)
    // 3번만 시도하도록 변경
    let attempt = 0;
    const maxAttempts = 3;
    setTimeout(() => {
      if(attempt < maxAttempts) {
        const searchInput = document.querySelector('[data-testid="place-search-input"]');
        if (searchInput) 
          searchInput.focus();
        attempt++;
      }
    }, 100);

  };

  // Google에서 데이터 직접 표시 함수 // fix 쓰지 않음. 
  const handleDirectShowCompareModal = (googleData) => {
    // 만약 googleData가 직접 구글 API에서 온 데이터라면 파싱
    const processedData = googleData.geometry ? 
      parseGooglePlaceData(googleData, process.env.NEXT_PUBLIC_MAPS_API_KEY) : 
      googleData;
    
    // 파싱된 데이터 콘솔에 출력
    console.log('[구글 직접 검색 결과 - 상세]', processedData);
    
    
    // 필요한 필드 자동 업데이트
    if (processedData.storeName) {
      dispatch(updateField({ field: 'storeName', value: processedData.storeName }));
      dispatch(trackField({ field: 'storeName' }));
    }
    
    if (processedData.address) {
      dispatch(updateField({ field: 'address', value: processedData.address }));
      dispatch(trackField({ field: 'address' }));
    }
    
    if (processedData.pinCoordinates) {
      dispatch(updateField({ field: 'pinCoordinates', value: processedData.pinCoordinates }));
      dispatch(trackField({ field: 'pinCoordinates' }));
    }
    
    if (processedData.businessHours && processedData.businessHours.length) {
      dispatch(updateField({ field: 'businessHours', value: processedData.businessHours }));
      dispatch(trackField({ field: 'businessHours' }));
    }
    
    // 이미지 처리 (있는 경우)
    if (processedData.mainImage) {
      dispatch(updateField({ field: 'mainImage', value: processedData.mainImage }));
      dispatch(trackField({ field: 'mainImage' }));
    }
    
    if (processedData.subImages && processedData.subImages.length) {
      dispatch(updateField({ field: 'subImages', value: processedData.subImages }));
      dispatch(trackField({ field: 'subImages' }));
    }
    
    console.log('구글 검색 데이터로 폼이 업데이트되었습니다.');
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
            isEditorOn && (
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
                        value={formData.googleDataId || ""}
                onChange={handleInputChange}
                        readOnly={isFieldReadOnly("googleDataId")}
                        className={getInputClassName("googleDataId")}
                        ref={el => inputRefs.current.googleDataId = el}
                onClick={() => {
                          if (isEditorOn && formData.googleDataId) {
                            handleFieldEditButtonClick(new Event('click'), "googleDataId");
                  }
                }}
              />
                      {isEditorOn && (
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
                          if (isEditorOn && formData[item.field]) {
                            handleFieldEditButtonClick(new Event('click'), item.field);
                  }
                }}
              />
                      {isEditorOn && formData[item.field] && (
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