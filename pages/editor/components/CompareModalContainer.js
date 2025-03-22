import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../styles.module.css';
import { 
  closeCompareModal, 
  updateCompareModalTarget,
  selectEditNewShopDataSet,
  selectOriginalShopData,
  selectIsGsearch,
  endGsearch,
  updateField,
  trackField,
  cancelEdit
} from '../store/slices/rightSidebarSlice';

// 값이 비어있는지 확인하는 함수
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

// 비교 모달 컨테이너 컴포넌트
const CompareModalContainer = ({ mapOverlayHandlers }) => {
  const dispatch = useDispatch();
  
  const editedShopData = useSelector(selectEditNewShopDataSet);
  const isGsearchMode = useSelector(selectIsGsearch);
  
  // 비교 모달 데이터 가져오기
  const compareModalData = useSelector(state => state.rightSidebar.compareModalData);
  
  // 모달 데이터에서 레퍼런스와 타겟 데이터 및 라벨 가져오기
  const referenceLabel = compareModalData.reference.label; 
  const targetLabel = compareModalData.target.label; 
  
  // 레퍼런스 데이터 (compareModalData 사용)
  const referenceData = compareModalData.reference.data;
  console.log('CompareModal - referenceData:', referenceData);
  
  let targetData = null;
  // 타겟 데이터 (compareModalData 사용)
  if (compareModalData.target.data === true) {
     targetData = editedShopData;
  } else {
     targetData = compareModalData.target.data; 
  }
  console.log('CompareModal - targetData:', targetData);
  
  // 모달 설정 가져오기
  const modalConfig = compareModalData.modalConfig;
  
  // 삽입 모드 여부 (구글 데이터 등)
  const insertMode = compareModalData.insertModeModal;
  console.log('CompareModal - insertMode:', insertMode);

  // 원본 데이터 값 가져오기
  const getOriginalValue = (field) => {
    if (!referenceData) return '';
    
    // 필드에 직접 접근 (이미 protoServerDataset 형식으로 변환되어 있음)
    return referenceData[field] !== undefined ? referenceData[field] : '';
  };

  // 수정된 데이터 값 가져오기
  const getEditedValue = (field) => {
    if (!targetData) return '';
    return targetData[field] !== undefined ? targetData[field] : '';
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

  // reference 데이터를 target으로 복사하는 함수
  const copyReferenceToTarget = (field) => {
    const value = getOriginalValue(field);
    
    // 필드 값이 없는 경우 처리하지 않음
    if (value === undefined || value === null) return;
    
    // 단일 필드 업데이트
    dispatch(updateField({ field, value }));
    // 추적을 위해 필드 변경 기록
    dispatch(trackField({ field }));
    
    console.log(`${field} 필드 값 복사됨:`, value);
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    // 모달 닫기
    dispatch(closeCompareModal());
    
    // 구글 검색 모드인 경우 완전히 종료
    if (isGsearchMode) {
      dispatch(endGsearch());
    }
  };
  

  // 최종 확인 핸들러 - 확인 액션 후 저장 로직 실행
  const handleFinalConfirm = () => {
    
    
      // 일반 모드에서는 기존 방식대로 처리
      console.log('서버로 전송할 데이터:', editedShopData);
    
    
    // 모달 닫기
    dispatch(closeCompareModal());
    
    // 구글 검색 모드인 경우 완전히 종료
    if (isGsearchMode) {
      dispatch(endGsearch());
    }
    
    // 구글 검색 모드가 아닌 경우에만 편집 취소
    if (!isGsearchMode) {
      // mapOverlayHandlers를 액션 페이로드로 전달
      dispatch(cancelEdit({ mapOverlayHandlers }));
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
  const modalTitle = modalConfig?.title || "데이터 비교";
  const buttonText = modalConfig?.button?.text || "확인";
  const showConfirmButton = modalConfig?.button !== null && 
                         modalConfig?.button !== undefined && 
                         Object.keys(modalConfig?.button || {}).length > 0 &&
                         modalConfig?.button?.text !== "";

  return (
    <div className={`${styles.rightSidebarCompareModal} ${styles.rightSidebarVisible}`}>
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

export default CompareModalContainer; 