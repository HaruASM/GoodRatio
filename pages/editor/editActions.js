/**
 * 액션 타입 정의
 * @typedef {Object} ActionTypes
 */
export const ActionTypes = {
  EDIT: {
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

/**
 * @typedef {Object} EditState
 * @property {boolean} isPanelVisible - 패널 표시 여부
 * @property {boolean} isEditing - 편집 모드 상태
 * @property {boolean} isEditCompleted - 편집 완료 상태
 * @property {boolean} hasChanges - 변경 사항 있음 여부
 * @property {import('./dataModels').ShopDataSet|null} originalShopData - 원본 상점 데이터
 * @property {import('./dataModels').ShopDataSet|null} editNewShopDataSet - 편집 중인 상점 데이터
 * @property {Object<string, boolean>} modifiedFields - 수정된 필드 목록 (필드명: 수정 여부)
 */

/**
 * 초기 상태
 * @type {EditState}
 */
export const initialEditState = {
  isPanelVisible: true, // 항상 보이도록 true로 유지
  isEditing: false,
  isEditCompleted: false,
  hasChanges: false,
  originalShopData: null,
  editNewShopDataSet: null,
  modifiedFields: {}
};

/**
 * 편집 리듀서
 * @param {EditState} state - 현재 상태
 * @param {Object} action - 액션 객체
 * @param {string} action.type - 액션 타입
 * @param {*} [action.payload] - 액션 페이로드
 * @returns {EditState} 새 상태
 */
export const editReducer = (state, action) => {
  switch (action.type) {
    // 편집 단계
    case ActionTypes.EDIT.PHASE.BEGIN:
      return {
        ...state,
        isEditing: true,
        isEditCompleted: false,
        originalShopData: action.payload.originalShopData,
        editNewShopDataSet: action.payload.editNewShopDataSet || action.payload.originalShopData,
        modifiedFields: {}
      };
    case ActionTypes.EDIT.PHASE.ONGOING:
      return { ...state, isEditing: true };
    case ActionTypes.EDIT.PHASE.COMPLETE:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: true,
        hasChanges: action.payload?.hasChanges || false,
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
    case ActionTypes.EDIT.CHANGE.NONE:
      return {
        ...state,
        hasChanges: false,
        isEditCompleted: true
      };
    case ActionTypes.EDIT.CHANGE.EXIST:
      return {
        ...state,
        hasChanges: true
      };
    
    // 확정 상태
    case ActionTypes.EDIT.CONFIRM.ACCEPT:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: false,
        hasChanges: false,
        originalShopData: null,
        editNewShopDataSet: null
      };
    case ActionTypes.EDIT.CONFIRM.CANCEL:
      return {
        ...state,
        isEditing: false,
        isEditCompleted: false,
        hasChanges: false,
        originalShopData: null,
        editNewShopDataSet: null
      };
    
    // 데이터 업데이트
    case ActionTypes.EDIT.DATA.UPDATE_FIELD:
      // editNewShopDataSet이 없거나 serverDataset이 없는 경우 안전하게 처리
      if (!state.editNewShopDataSet) {
        console.error('editNewShopDataSet이 정의되지 않았습니다.');
        return state;
      }
      
      return {
        ...state,
        editNewShopDataSet: {
          ...state.editNewShopDataSet,
          serverDataset: {
            ...(state.editNewShopDataSet.serverDataset || {}),
            [action.payload.fieldName]: action.payload.value
          }
        },
        modifiedFields: {
          ...state.modifiedFields,
          [action.payload.fieldName]: true
        }
      };
    case ActionTypes.EDIT.DATA.UPDATE_PLACE:
      // editNewShopDataSet이 없거나 serverDataset이 없는 경우 안전하게 처리
      if (!state.editNewShopDataSet) {
        console.error('editNewShopDataSet이 정의되지 않았습니다.');
        return state;
      }
      
      return {
        ...state,
        editNewShopDataSet: {
          ...state.editNewShopDataSet,
          serverDataset: {
            ...(state.editNewShopDataSet.serverDataset || {}),
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

/**
 * 액션 생성 함수들
 */
export const editActions = {
  /**
   * 편집 시작 액션
   * @param {import('./dataModels').ShopDataSet} originalShopData - 원본 상점 데이터
   * @param {import('./dataModels').ShopDataSet} [editNewShopDataSet] - 편집할 상점 데이터 (없으면 originalShopData 사용)
   * @returns {Object} 액션 객체
   */
  beginEdit: (originalShopData, editNewShopDataSet = originalShopData) => ({
    type: ActionTypes.EDIT.PHASE.BEGIN,
    payload: { originalShopData, editNewShopDataSet }
  }),
  
  /**
   * 편집 완료 액션
   * @param {boolean} hasChanges - 변경 사항 있음 여부
   * @returns {Object} 액션 객체
   */
  completeEdit: (hasChanges = false) => ({
    type: ActionTypes.EDIT.PHASE.COMPLETE,
    payload: { hasChanges }
  }),
  
  /**
   * 변경 사항 확정 액션
   * @returns {Object} 액션 객체
   */
  confirmEdit: () => ({
    type: ActionTypes.EDIT.CONFIRM.ACCEPT
  }),
  
  /**
   * 변경 사항 취소 액션
   * @returns {Object} 액션 객체
   */
  cancelEdit: () => ({
    type: ActionTypes.EDIT.CONFIRM.CANCEL
  }),
  
  /**
   * 필드 변경 추적 액션
   * @param {string} fieldName - 변경된 필드 이름
   * @returns {Object} 액션 객체
   */
  trackFieldChange: (fieldName) => ({
    type: ActionTypes.EDIT.CHANGE.FIELD,
    payload: { fieldName }
  }),
  
  /**
   * 변경 없음 상태 설정 액션
   * @returns {Object} 액션 객체
   */
  setNoChanges: () => ({
    type: ActionTypes.EDIT.CHANGE.NONE
  }),
  
  /**
   * 변경 있음 상태 설정 액션
   * @returns {Object} 액션 객체
   */
  setHasChanges: () => ({
    type: ActionTypes.EDIT.CHANGE.EXIST
  }),
  
  /**
   * 필드 데이터 업데이트 액션
   * @param {string} fieldName - 업데이트할 필드 이름
   * @param {*} value - 업데이트할 값
   * @returns {Object} 액션 객체
   */
  updateField: (fieldName, value) => ({
    type: ActionTypes.EDIT.DATA.UPDATE_FIELD,
    payload: { fieldName, value }
  }),
  
  /**
   * 장소 데이터 업데이트 액션
   * @param {Object} placeData - 업데이트할 장소 데이터
   * @returns {Object} 액션 객체
   */
  updatePlace: (placeData) => ({
    type: ActionTypes.EDIT.DATA.UPDATE_PLACE,
    payload: placeData
  }),
  
  /**
   * 폼 데이터 업데이트 함수 (편의를 위해 액션 객체에 추가)
   * @param {import('./dataModels').ShopDataSet} shopData - 상점 데이터
   * @param {Object} formData - 폼 데이터
   * @returns {Object} 업데이트된 폼 데이터
   */
  updateFormDataFromShop: (shopData, formData) => {
    if (!shopData) return formData;
    
    const newFormData = { ...formData };
    const serverDataset = shopData.serverDataset || {};
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    return newFormData;
  },
  
  /**
   * 편집 데이터에서 폼 데이터 업데이트 함수
   * @param {import('./dataModels').ShopDataSet} editNewShopDataSet - 편집 중인 상점 데이터
   * @param {Object} formData - 폼 데이터
   * @returns {Object} 업데이트된 폼 데이터
   */
  updateFormDataFromEditData: (editNewShopDataSet, formData) => {
    // shopData와 동일한 로직을 사용하므로 updateFormDataFromShop 함수 재사용
    return editUtils.updateFormDataFromShop(editNewShopDataSet, formData);
  }
};

/**
 * 편집 유틸리티 함수들
 */
export const editUtils = {
  /**
   * 데이터 비교 함수
   * @param {import('./dataModels').ShopDataSet} original - 원본 상점 데이터
   * @param {import('./dataModels').ShopDataSet} current - 현재 상점 데이터
   * @returns {boolean} 변경 사항 있음 여부
   */
  compareShopData: (original, current) => {
    if (!original) return true; // 원본이 없으면 변경된 것으로 간주
    if (!current) return true; // 현재 데이터가 없으면 변경된 것으로 간주
    
    console.log('데이터 비교:', { original, current });
    
    // serverDataset 객체 비교
    const originalData = original.serverDataset || {};
    const currentData = current.serverDataset || {};
    
    // 모든 키를 순회하며 비교
    for (const key in originalData) {
      // 배열인 경우 문자열로 변환하여 비교
      if (Array.isArray(originalData[key]) && Array.isArray(currentData[key])) {
        if (originalData[key].join(',') !== currentData[key].join(',')) {
          console.log(`배열 필드 ${key} 변경됨:`, originalData[key], currentData[key]);
          return true; // 변경됨
        }
      } 
      // 일반 값 비교
      else if (originalData[key] !== currentData[key]) {
        console.log(`필드 ${key} 변경됨:`, originalData[key], currentData[key]);
        return true; // 변경됨
      }
    }
    
    // 새로 추가된 키가 있는지 확인
    for (const key in currentData) {
      if (originalData[key] === undefined) {
        console.log(`새 필드 ${key} 추가됨:`, currentData[key]);
        return true; // 새로운 키가 추가됨
      }
    }
    
    console.log('변경 없음');
    return false; // 변경 없음
  },
  
  /**
   * 폼 데이터 업데이트 함수
   * @param {import('./dataModels').ShopDataSet} shopData - 상점 데이터
   * @param {Object} formData - 폼 데이터
   * @returns {Object} 업데이트된 폼 데이터
   */
  updateFormDataFromShop: (shopData, formData) => {
    if (!shopData) return formData;
    
    const newFormData = { ...formData };
    const serverDataset = shopData.serverDataset || {};
    
    // 기본 필드 처리
    Object.keys(formData).forEach(field => {
      // 특수 필드(pinCoordinates, path) 제외하고 처리
      if (field !== 'pinCoordinates' && field !== 'path') {
        let fieldValue = serverDataset[field];
        
        // 배열 처리 (예: businessHours)
        if (Array.isArray(fieldValue) && field === 'businessHours') {
          fieldValue = fieldValue.join(', ');
        }
        
        // undefined나 null인 경우 빈 문자열로 설정
        newFormData[field] = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }
    });
    
    // 특수 필드 처리 (pin좌표, path)
    const hasCoordinates = Boolean(serverDataset.pinCoordinates);
    newFormData.pinCoordinates = hasCoordinates ? '등록됨' : '';
    
    const pathArray = serverDataset.path;
    const hasPath = Array.isArray(pathArray) && pathArray.length > 0;
    newFormData.path = hasPath ? '등록됨' : '';
    
    return newFormData;
  },
  
  /**
   * 편집 데이터에서 폼 데이터 업데이트 함수
   * @param {import('./dataModels').ShopDataSet} editNewShopDataSet - 편집 중인 상점 데이터
   * @param {Object} formData - 폼 데이터
   * @returns {Object} 업데이트된 폼 데이터
   */
  updateFormDataFromEditData: (editNewShopDataSet, formData) => {
    // shopData와 동일한 로직을 사용하므로 updateFormDataFromShop 함수 재사용
    return editUtils.updateFormDataFromShop(editNewShopDataSet, formData);
  }
}; 