// 액션 타입 정의
export const ActionTypes = {
  EDIT: {
    PANEL: {
      ON: 'EDIT_PANEL_ON',
      OFF: 'EDIT_PANEL_OFF'
    },
    PHASE: {
      BEGIN: 'EDIT_PHASE_BEGIN',
      ONGOING: 'EDIT_PHASE_ONGOING',
      COMPLETE: 'EDIT_PHASE_COMPLETE'
    },
    CHANGE: {
      NONE: 'EDIT_CHANGE_NONE',
      EXIST: 'EDIT_CHANGE_EXIST',
      FIELD: 'EDIT_CHANGE_FIELD'
    },
    CONFIRM: {
      ACCEPT: 'EDIT_CONFIRM_ACCEPT',
      CANCEL: 'EDIT_CONFIRM_CANCEL'
    },
    DATA: {
      UPDATE_FIELD: 'EDIT_DATA_UPDATE_FIELD',
      UPDATE_PLACE: 'EDIT_DATA_UPDATE_PLACE'
    }
  },
  EXPLORER: {
    SHOPS: {
      BEGIN: 'EXPLORER_SHOPS_BEGIN',
      SELECTED: 'EXPLORER_SHOP_SELECTED',
    },
    STREETS: {
      BEGIN: 'EXPLORER_STREETS_BEGIN',
      SELECTED: 'EXPLORER_STREET_SELECTED',
    },
    AREAS: {
      SELECTED: 'EXPLORER_AREA_SELECTED',
    },
    NATIONS: {
      SELECTED: 'EXPLORER_NATION_SELECTED',
    },
    GLOBES: {
      SELECTED: 'EXPLORER_GLOBE_SELECTED',
    }
  }
};

// 초기 상태
export const initialEditState = {
  isPanelVisible: true,
  isEditing: false,
  isEditCompleted: false,
  hasChanges: false,
  originalShopData: null,
  editNewShopDataSet: null,
  modifiedFields: {}
};

// 편집 리듀서
export const editReducer = (state, action) => {
  switch (action.type) {
    // 패널 표시/숨김
    case ActionTypes.EDIT.PANEL.ON:
      return { ...state, isPanelVisible: true };
    case ActionTypes.EDIT.PANEL.OFF:
      return { ...state, isPanelVisible: false };
    
    // 편집 단계
    case ActionTypes.EDIT.PHASE.BEGIN:
      return {
        ...state,
        isEditing: true,
        isEditCompleted: false,
        originalShopData: action.payload.originalShopData,
        editNewShopDataSet: action.payload.editNewShopDataSet,
        modifiedFields: {}
      };
    case ActionTypes.EDIT.PHASE.ONGOING:
      return { ...state, isEditing: true };
    case ActionTypes.EDIT.PHASE.COMPLETE:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: true,
        hasChanges: action.payload.hasChanges,
        modifiedFields: {}
      };
    
    // 변경 상태
    case ActionTypes.EDIT.CHANGE.FIELD:
      return {
        ...state,
        modifiedFields: {
          ...state.modifiedFields,
          [action.payload.fieldName]: true
        }
      };
    
    // 확정 상태
    case ActionTypes.EDIT.CONFIRM.ACCEPT:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: false,
        hasChanges: false,
        originalShopData: null
      };
    case ActionTypes.EDIT.CONFIRM.CANCEL:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: false,
        hasChanges: false,
        originalShopData: null
      };
    
    // 데이터 업데이트
    case ActionTypes.EDIT.DATA.UPDATE_FIELD:
      return {
        ...state,
        editNewShopDataSet: {
          ...state.editNewShopDataSet,
          serverDataset: {
            ...state.editNewShopDataSet.serverDataset,
            [action.payload.fieldName]: action.payload.value
          }
        },
        modifiedFields: {
          ...state.modifiedFields,
          [action.payload.fieldName]: true
        }
      };
    case ActionTypes.EDIT.DATA.UPDATE_PLACE:
      return {
        ...state,
        editNewShopDataSet: {
          ...state.editNewShopDataSet,
          serverDataset: {
            ...state.editNewShopDataSet.serverDataset,
            ...action.payload
          }
        },
        modifiedFields: {
          ...state.modifiedFields,
          ...action.payload
        }
      };
    
    default:
      console.error('알 수 없는 액션 타입:', action.type);
      return state;
  }
};

// 액션 생성 함수들
export const editActions = {
  // 패널 관련 액션
  togglePanel: (isVisible) => ({
    type: isVisible ? ActionTypes.EDIT.PANEL.OFF : ActionTypes.EDIT.PANEL.ON
  }),
  
  // 편집 시작
  beginEdit: (originalShopData, editNewShopDataSet) => ({
    type: ActionTypes.EDIT.PHASE.BEGIN,
    payload: { originalShopData, editNewShopDataSet }
  }),
  
  // 편집 완료
  completeEdit: (hasChanges) => ({
    type: ActionTypes.EDIT.PHASE.COMPLETE,
    payload: { hasChanges }
  }),
  
  // 변경 사항 확정
  confirmEdit: () => ({
    type: ActionTypes.EDIT.CONFIRM.ACCEPT
  }),
  
  // 변경 사항 취소
  cancelEdit: () => ({
    type: ActionTypes.EDIT.CONFIRM.CANCEL
  }),
  
  // 필드 변경 추적
  trackFieldChange: (fieldName) => ({
    type: ActionTypes.EDIT.CHANGE.FIELD,
    payload: { fieldName }
  }),
  
  // 필드 데이터 업데이트
  updateField: (fieldName, value) => ({
    type: ActionTypes.EDIT.DATA.UPDATE_FIELD,
    payload: { fieldName, value }
  }),
  
  // 장소 데이터 업데이트
  updatePlace: (placeData) => ({
    type: ActionTypes.EDIT.DATA.UPDATE_PLACE,
    payload: placeData
  })
};

// 유틸리티 함수들
export const editUtils = {
  // 데이터 비교 함수
  compareShopData: (original, current) => {
    if (!original) return true; // 원본이 없으면 변경된 것으로 간주
    
    // serverDataset 객체 비교
    const originalData = original.serverDataset || {};
    const currentData = current.serverDataset || {};
    
    // 모든 키를 순회하며 비교
    for (const key in originalData) {
      // 배열인 경우 문자열로 변환하여 비교
      if (Array.isArray(originalData[key]) && Array.isArray(currentData[key])) {
        if (originalData[key].join(',') !== currentData[key].join(',')) {
          return true; // 변경됨
        }
      } 
      // 일반 값 비교
      else if (originalData[key] !== currentData[key]) {
        return true; // 변경됨
      }
    }
    
    // 새로 추가된 키가 있는지 확인
    for (const key in currentData) {
      if (originalData[key] === undefined) {
        return true; // 새로운 키가 추가됨
      }
    }
    
    return false; // 변경 없음
  },
  
  // 폼 데이터 업데이트 함수
  updateFormDataFromShop: (shopData, formData) => {
    if (!shopData) return formData;
    
    const newFormData = { ...formData };
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = shopData.serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(shopData.serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = shopData.serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    return newFormData;
  },
  
  // 편집 데이터에서 폼 데이터 업데이트 함수
  updateFormDataFromEditData: (editNewShopDataSet, formData) => {
    if (!editNewShopDataSet) return formData;
    
    const newFormData = { ...formData };
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = editNewShopDataSet.serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(editNewShopDataSet.serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = editNewShopDataSet.serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    return newFormData;
  }
}; 