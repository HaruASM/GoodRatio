import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import {
  togglePanel,
  startEdit,
  completeEdit,
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
  selectStatus,
  selectError,
  selectIsCompareModalActive,
  selectOriginalShopData,
  startDrawingMode,
  addNewShop,
  closeCompareModal,
  finalConfirmAndSubmit,
  selectIsIdle,
  startGsearch,
  selectIsGsearch,
  startCompareModal,
  updateCompareModalTarget,
  endGsearch,
  selectIsCompareBarActive,
  toggleCompareBar
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
 * 왼쪽 사이드바 내부 컴포넌트
 * 비교를 위한 상점 정보 표시 및 편집 기능 제공
 * 
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareSidebarContent = ({ addNewShopItem, moveToCurrentLocation, mapOverlayHandlers, currentShopServerDataSet, onShopUpdate }) => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const isEditing = useSelector(selectIsEditing);
  const isConfirming = useSelector(selectIsConfirming);
  const hasChanges = useSelector(selectHasChanges);
  const formData = useSelector(selectFormData);
  const modifiedFields = useSelector(selectModifiedFields);
  const editNewShopDataSet = useSelector(selectEditNewShopDataSet);
  const originalShopData = useSelector(selectOriginalShopData);
  const status = useSelector(selectStatus);
  const error = useSelector(selectError);
  const isCompareModalActive = useSelector(selectIsCompareModalActive);
  const isIdle = useSelector(selectIsIdle);
  const isGsearchMode = useSelector(selectIsGsearch);
  
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

  // 이벤트 핸들러 (compareBar 접두어 추가)
  const compareBarHandleEditFoamCardButton = (e) => {
    e.preventDefault();
    console.log('compareBar: Edit foam card button clicked');
    
    if (isEditing) {
      dispatch(completeEdit());
    } else {
      // 직접 데이터 전달 (serverDataset 구조 사용 않음)
      dispatch(startEdit({ 
        shopData: currentShopServerDataSet
      }));
    }
  };
  
  const compareBarHandleConfirmEdit = () => {
    console.log('compareBar: Confirm edit clicked');
    // 데이터 저장 없이 모달창만 표시 - startCompareModal 직접 사용
    dispatch(startCompareModal({
      reference: { 
        label: '원본', 
        data: originalShopData 
      },
      target: { 
        label: '수정본', 
        data: true  // true면 state.editNewShopDataSet 참조
      },
      options: {
        insertMode: false,
        modalConfig: {
          title: '비교후 전송',
          button: {
            text: '확정전송',
            action: 'confirmComplete'
          }
        }
      }
    }));
  };
  
  const compareBarHandleCancelEdit = () => {
    console.log('compareBar: Cancel edit clicked');
    // 취소 시 확인창 표시
    dispatch(cancelEdit({ mapOverlayHandlers }));
  };
  
  const compareBarHandleFieldEditButtonClick = (e, fieldName) => {
    e.preventDefault();
    console.log(`compareBar: Field edit button clicked for ${fieldName}`);
    
    // 필드 편집 가능하게 설정
    if (inputRefs.current[fieldName]) {
      inputRefs.current[fieldName].readOnly = false;
      inputRefs.current[fieldName].focus();
      
      // 필드 변경 추적
      dispatch(trackField({ field: fieldName }));
    }
  };
  
  const compareBarHandleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`compareBar: Input changed for ${name}: ${value}`);
    
    // 단일 업데이트 경로 사용
    dispatch(updateField({ field: name, value }));
    
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
  
  const compareBarHandlePinCoordinatesButtonClick = (e) => {
    e.preventDefault();
    console.log('compareBar: Pin coordinates button clicked');
    
    // Redux 액션 디스패치 - 마커 드로잉 모드 시작
    dispatch(startDrawingMode({ type: 'MARKER' }));
  };
  
  const compareBarHandlePathButtonClick = (e) => {
    e.preventDefault();
    console.log('compareBar: Path button clicked');
    
    // Redux 액션 디스패치 - 폴리곤 드로잉 모드 시작
    dispatch(startDrawingMode({ type: 'POLYGON' }));
  };

  // 구글 장소 검색 클릭 처리
  const compareBarHandleGooglePlaceSearchClick = (e) => {
    e.preventDefault(); // A태그 클릭 방지
    console.log('compareBar: Google place search clicked');
    
    // 구글 검색 모드 시작
    dispatch(startGsearch());
    
    // 검색창으로 포커스 이동 (존재하는 경우)
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

  /**
   * 구글 장소 데이터로 직접 비교 모달 표시 (샘플)
   */
  const compareBarHandleDirectShowCompareModal = (googleData) => {
    console.log('compareBar: Direct show compare modal');
    // 컴포넌트에서 직접 모달 설정을 구성
    dispatch(startCompareModal({
      reference: {
        label: '구글데이터',
        data: googleData
      },
      target: {
        label: '현재데이터',
        data: true // true면 state.editNewShopDataSet 참조
      },
      options: {
        insertMode: true,
        modalConfig: {
          title: '구글Place 데이터',
          button: {
            text: '',
            action: ''
          }
        }
      }
    }));
  };

  return (
    <div className={`${styles.rightSidebar} ${styles.compareBarSidebar}`}>
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
              ? "비교 Data" 
              : (formData.storeName || (!isEditing ? "비교 Data" : "비교상점 데이터"))}
          </h3>
          
          {/* 수정/완료 버튼 - 상태에 따라 다르게 표시 */}
          {!isIdle && !isConfirming && !isEditing && currentShopServerDataSet && (
            <button 
              className={styles.headerButton} 
              onClick={compareBarHandleEditFoamCardButton}
              disabled={status === 'loading'}
            >
              {buttonText}
            </button>
          )}
          
          {isConfirming ? (
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelButton} 
                onClick={compareBarHandleCancelEdit}
                disabled={status === 'loading'}
              >
                취소
              </button>
              {hasChanges && (
                <button 
                  className={styles.confirmButton} 
                  onClick={compareBarHandleConfirmEdit}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? '처리 중...' : '확인'}
                </button>
              )}
              <button 
                className={styles.headerButton} 
                onClick={compareBarHandleEditFoamCardButton}
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
                  onClick={compareBarHandleCancelEdit}
                  disabled={status === 'loading'}
                >
                  취소
                </button>
                <button 
                  className={styles.headerButton} 
                  onClick={compareBarHandleEditFoamCardButton}
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
            <p>비교에디터mode</p>
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
                        onChange={compareBarHandleInputChange}
                        readOnly={true}
                        className={getInputClassName("pinCoordinates")}
                        ref={el => inputRefs.current.pinCoordinates = el}
                      />
                      {isEditing && (
                        <button
                          className={styles.inputOverlayButton}
                          onClick={compareBarHandlePinCoordinatesButtonClick}
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
                        onChange={compareBarHandleInputChange}
                        readOnly={true}
                        className={getInputClassName("path")}
                        ref={el => inputRefs.current.path = el}
                      />
                      {isEditing && (
                        <button
                          className={styles.inputOverlayButton}
                          onClick={compareBarHandlePathButtonClick}
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
                        onChange={compareBarHandleInputChange}
                        readOnly={isFieldReadOnly("googleDataId")}
                        className={getInputClassName("googleDataId")}
                        ref={el => inputRefs.current.googleDataId = el}
                        onClick={() => {
                          if (isEditing && formData.googleDataId) {
                            compareBarHandleFieldEditButtonClick(new Event('click'), "googleDataId");
                          }
                        }}
                      />
                      {isEditing && (
                        <button
                          className={styles.inputOverlayButton}
                          onClick={compareBarHandleGooglePlaceSearchClick}
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
                        onChange={compareBarHandleInputChange}
                        readOnly={isFieldReadOnly(item.field)}
                        className={getInputClassName(item.field)}
                        ref={el => inputRefs.current[item.field] = el}
                        onClick={() => {
                          if (isEditing && formData[item.field]) {
                            compareBarHandleFieldEditButtonClick(new Event('click'), item.field);
                          }
                        }}
                      />
                      {isEditing && formData[item.field] && (
                        <button
                          className={styles.inputOverlayButton}
                          onClick={(e) => compareBarHandleFieldEditButtonClick(e, item.field)}
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
 * 왼쪽 사이드바 컴포넌트 (Redux 연결)
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {React.ReactElement} 왼쪽 사이드바 UI 컴포넌트
 */
const CompareBar = ({ moveToCurrentLocation, mapOverlayHandlers, curSelectedShop, onShopUpdate }) => {
  const dispatch = useDispatch();
  const isPanelVisible = useSelector(selectIsPanelVisible);
  const isCompareModalActive = useSelector(selectIsCompareModalActive);
  const isCompareBarActive = useSelector(selectIsCompareBarActive);
  
  console.log("CompareBar 렌더링: isCompareBarActive =", isCompareBarActive);
  
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
  
  // 상점 데이터에서 serverDataset 추출
  const currentShopServerDataSet = curSelectedShop?.serverDataset || null;

  // 상점 추가 핸들러 (메인 컴포넌트와 공유)
  const compareBarHandleAddNewShopItem = (e) => {
    if (e) e.preventDefault();
    console.log('compareBar: Add new shop item clicked');
    
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
      className={`${styles.floatingPanelToggle} ${styles.compareBarPanelToggle}`}
      onClick={() => dispatch(togglePanel())}
      title="패널 표시"
    >
      ≫
    </button>
  );

  // isCompareBarActive가 false일 때는 null 반환 (렌더링하지 않음)
  if (!isCompareBarActive) {
    return null;
  }

  return (
    <>
      <div className={`${styles.compareBarSidebar} ${!isCompareBarActive ? styles.compareBarHidden : ''}`}>
        <CompareSidebarContent 
          addNewShopItem={compareBarHandleAddNewShopItem}
          moveToCurrentLocation={moveToCurrentLocation}
          mapOverlayHandlers={mapOverlayHandlers}
          currentShopServerDataSet={currentShopServerDataSet}
          onShopUpdate={onShopUpdate}
        />
      </div>
      {togglePanelButton}
    </>
  );
};

export default CompareBar; 