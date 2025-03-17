import { createContext, useContext, useReducer, useMemo } from 'react';

// 액션 타입 정의
export const RightSidebarActionTypes = {
  PANEL_TOGGLE: 'rightSidebar/panel/toggle',
  EDIT_START: 'rightSidebar/edit/start',
  EDIT_COMPLETE: 'rightSidebar/edit/complete',
  EDIT_CANCEL: 'rightSidebar/edit/cancel',
  EDIT_CONFIRM: 'rightSidebar/edit/confirm',
  FIELD_UPDATE: 'rightSidebar/field/update',
  FIELD_TRACK: 'rightSidebar/field/track',
  FORM_DATA_UPDATE: 'rightSidebar/form/update',
  RESET_STATE: 'rightSidebar/reset',
  SYNC_EXTERNAL_SHOP: 'rightSidebar/sync/external_shop'
};

// 초기 상태
export const initialRightSidebarState = {
  isPanelVisible: true,
  isEditing: false,
  isConfirming: false,
  hasChanges: false,
  originalShopData: null,
  editNewShopDataSet: null,
  formData: {
    storeName: "",
    storeStyle: "",
    alias: "",
    comment: "",
    locationMap: "",
    businessHours: "",
    hotHours: "",
    discountHours: "",
    address: "",
    mainImage: "",
    pinCoordinates: "",
    path: "",
    categoryIcon: "",
    googleDataId: "",
  },
  modifiedFields: {}
};

// 리듀서 함수
export const rightSidebarReducer = (state, action) => {
  switch (action.type) {
    case RightSidebarActionTypes.PANEL_TOGGLE:
      return {
        ...state,
        isPanelVisible: !state.isPanelVisible
      };
      
    case RightSidebarActionTypes.EDIT_START:
      return {
        ...state,
        isEditing: true,
        isConfirming: false,
        hasChanges: false,
        originalShopData: action.payload.shopData,
        editNewShopDataSet: { ...action.payload.shopData },
        modifiedFields: {}
      };
      
    case RightSidebarActionTypes.EDIT_COMPLETE:
      // 변경 사항이 있는지 확인
      const hasChanges = compareShopData(
        state.originalShopData,
        state.editNewShopDataSet
      );
      
      return {
        ...state,
        isEditing: false,
        isConfirming: hasChanges,
        hasChanges
      };
      
    case RightSidebarActionTypes.EDIT_CANCEL:
      // 원본 데이터로 복원
      return {
        ...state,
        isEditing: false,
        isConfirming: false,
        hasChanges: false,
        editNewShopDataSet: state.originalShopData,
        formData: updateFormDataFromShop(state.originalShopData, state.formData),
        modifiedFields: {}
      };
      
    case RightSidebarActionTypes.EDIT_CONFIRM:
      // 편집 완료 및 상태 초기화
      return {
        ...state,
        isEditing: false,
        isConfirming: false,
        hasChanges: false,
        originalShopData: state.editNewShopDataSet,
        modifiedFields: {}
      };
      
    case RightSidebarActionTypes.FIELD_UPDATE:
      // 필드 값 업데이트
      const { field, value } = action.payload;
      
      // 새로운 editNewShopDataSet 생성
      const updatedShopData = {
        ...state.editNewShopDataSet
      };
      
      // serverDataset이 있는 경우 해당 필드 업데이트
      if (updatedShopData.serverDataset) {
        updatedShopData.serverDataset = {
          ...updatedShopData.serverDataset,
          [field]: value
        };
      } else {
        // serverDataset이 없는 경우 직접 필드 업데이트
        updatedShopData[field] = value;
      }
      
      return {
        ...state,
        editNewShopDataSet: updatedShopData
      };
      
    case RightSidebarActionTypes.FIELD_TRACK:
      // 수정된 필드 추적
      return {
        ...state,
        modifiedFields: {
          ...state.modifiedFields,
          [action.payload.field]: true
        }
      };
      
    case RightSidebarActionTypes.FORM_DATA_UPDATE:
      // 폼 데이터 전체 업데이트
      return {
        ...state,
        formData: {
          ...state.formData,
          ...action.payload
        }
      };
      
    case RightSidebarActionTypes.RESET_STATE:
      // 상태 초기화
      return initialRightSidebarState;
      
    case RightSidebarActionTypes.SYNC_EXTERNAL_SHOP:
      // 외부 상점 데이터와 동기화
      if (!action.payload.shopData) return state;
      
      return {
        ...state,
        formData: updateFormDataFromShop(action.payload.shopData, state.formData)
      };
      
    default:
      return state;
  }
};

// 액션 생성자
export const rightSidebarActions = {
  togglePanel: () => ({ 
    type: RightSidebarActionTypes.PANEL_TOGGLE 
  }),
  
  startEdit: (shopData) => ({
    type: RightSidebarActionTypes.EDIT_START,
    payload: { shopData }
  }),
  
  completeEdit: () => ({
    type: RightSidebarActionTypes.EDIT_COMPLETE
  }),
  
  cancelEdit: () => ({
    type: RightSidebarActionTypes.EDIT_CANCEL
  }),
  
  confirmEdit: () => ({
    type: RightSidebarActionTypes.EDIT_CONFIRM
  }),
  
  updateField: (field, value) => ({
    type: RightSidebarActionTypes.FIELD_UPDATE,
    payload: { field, value }
  }),
  
  trackField: (field) => ({
    type: RightSidebarActionTypes.FIELD_TRACK,
    payload: { field }
  }),
  
  updateFormData: (formData) => ({
    type: RightSidebarActionTypes.FORM_DATA_UPDATE,
    payload: formData
  }),
  
  resetState: () => ({
    type: RightSidebarActionTypes.RESET_STATE
  }),
  
  syncExternalShop: (shopData) => ({
    type: RightSidebarActionTypes.SYNC_EXTERNAL_SHOP,
    payload: { shopData }
  })
};

// 유틸리티 함수
// 상점 데이터 비교 함수
export const compareShopData = (original, edited) => {
  if (!original || !edited) return false;
  
  // serverDataset이 있는 경우
  if (original.serverDataset && edited.serverDataset) {
    const originalData = original.serverDataset;
    const editedData = edited.serverDataset;
    
    // 모든 필드 비교
    for (const key in editedData) {
      // 배열인 경우 (예: businessHours)
      if (Array.isArray(editedData[key])) {
        if (!Array.isArray(originalData[key])) return true;
        if (editedData[key].length !== originalData[key].length) return true;
        
        // 배열 내용 비교
        for (let i = 0; i < editedData[key].length; i++) {
          if (editedData[key][i] !== originalData[key][i]) return true;
        }
      } 
      // 일반 값 비교
      else if (editedData[key] !== originalData[key]) {
        return true;
      }
    }
    
    return false;
  }
  
  // serverDataset이 없는 경우 직접 비교
  for (const key in edited) {
    if (key === 'itemMarker' || key === 'itemPolygon') continue; // 마커와 폴리곤은 제외
    
    if (edited[key] !== original[key]) {
      return true;
    }
  }
  
  return false;
};

// 상점 데이터에서 폼 데이터 업데이트 함수
export const updateFormDataFromShop = (shopData, currentFormData = {}) => {
  if (!shopData) {
    return {
      storeName: "",
      storeStyle: "",
      alias: "",
      comment: "",
      locationMap: "",
      businessHours: "",
      hotHours: "",
      discountHours: "",
      address: "",
      mainImage: "",
      pinCoordinates: "",
      path: "",
      categoryIcon: "",
      googleDataId: "",
    };
  }
  
  // serverDataset이 있는 경우
  if (shopData.serverDataset) {
    const data = shopData.serverDataset;
    
    return {
      ...currentFormData,
      storeName: data.storeName || "",
      storeStyle: data.storeStyle || "",
      alias: data.alias || "",
      comment: data.comment || "",
      locationMap: data.locationMap || "",
      businessHours: Array.isArray(data.businessHours) ? data.businessHours.join(', ') : data.businessHours || "",
      hotHours: data.hotHours || "",
      discountHours: data.discountHours || "",
      address: data.address || "",
      mainImage: data.mainImage || "",
      pinCoordinates: data.pinCoordinates || "",
      path: Array.isArray(data.path) ? JSON.stringify(data.path) : data.path || "",
      categoryIcon: data.categoryIcon || "",
      googleDataId: data.googleDataId || "",
    };
  }
  
  // serverDataset이 없는 경우 직접 접근
  return {
    ...currentFormData,
    storeName: shopData.storeName || "",
    storeStyle: shopData.storeStyle || "",
    alias: shopData.alias || "",
    comment: shopData.comment || "",
    locationMap: shopData.locationMap || "",
    businessHours: Array.isArray(shopData.businessHours) ? shopData.businessHours.join(', ') : shopData.businessHours || "",
    hotHours: shopData.hotHours || "",
    discountHours: shopData.discountHours || "",
    address: shopData.address || "",
    mainImage: shopData.mainImage || "",
    pinCoordinates: shopData.pinCoordinates || "",
    path: Array.isArray(shopData.path) ? JSON.stringify(shopData.path) : shopData.path || "",
    categoryIcon: shopData.categoryIcon || "",
    googleDataId: shopData.googleDataId || "",
  };
};

// Context 생성
const RightSidebarContext = createContext();

// Provider 컴포넌트
export const RightSidebarProvider = ({ children }) => {
  const [state, dispatch] = useReducer(rightSidebarReducer, initialRightSidebarState);
  
  // 액션 메서드 메모이제이션
  const actions = useMemo(() => ({
    togglePanel: () => dispatch(rightSidebarActions.togglePanel()),
    startEdit: (shopData) => dispatch(rightSidebarActions.startEdit(shopData)),
    completeEdit: () => dispatch(rightSidebarActions.completeEdit()),
    cancelEdit: () => dispatch(rightSidebarActions.cancelEdit()),
    confirmEdit: () => dispatch(rightSidebarActions.confirmEdit()),
    updateField: (field, value) => dispatch(rightSidebarActions.updateField(field, value)),
    trackField: (field) => dispatch(rightSidebarActions.trackField(field)),
    updateFormData: (formData) => dispatch(rightSidebarActions.updateFormData(formData)),
    resetState: () => dispatch(rightSidebarActions.resetState()),
    syncExternalShop: (shopData) => dispatch(rightSidebarActions.syncExternalShop(shopData))
  }), []);
  
  // 유틸리티 함수 메모이제이션
  const utils = useMemo(() => ({
    compareShopData,
    updateFormDataFromShop
  }), []);
  
  const value = { state, actions, utils };
  
  return (
    <RightSidebarContext.Provider value={value}>
      {children}
    </RightSidebarContext.Provider>
  );
};

// 커스텀 훅
export const useRightSidebar = () => {
  const context = useContext(RightSidebarContext);
  
  if (!context) {
    throw new Error('useRightSidebar must be used within a RightSidebarProvider');
  }
  
  return context;
}; 