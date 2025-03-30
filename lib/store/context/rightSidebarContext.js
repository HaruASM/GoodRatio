import { createContext, useContext, useReducer, useMemo } from 'react';
import { protoServerDataset } from '../../../lib/models/editorModels';
import { checkDataIsChanged, updateFormDataFromShop } from '../utils/rightSidebarUtils';

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
  formData: { ...protoServerDataset },
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
      const hasChanges = checkDataIsChanged(
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
      
      // 직접 필드 업데이트 (항상 protoServerDataset 구조)
      updatedShopData[field] = value;
      
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
  
  completeEditor: () => ({
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

// Context 생성
export const RightSidebarContext = createContext();

// Provider 컴포넌트
export const RightSidebarProvider = ({ children }) => {
  const [state, dispatch] = useReducer(rightSidebarReducer, initialRightSidebarState);
  
  // 액션 메서드 메모이제이션
  const actions = useMemo(() => {
    return {
      togglePanel: () => dispatch(rightSidebarActions.togglePanel()),
      startEdit: (shopData) => dispatch(rightSidebarActions.startEdit(shopData)),
      completeEditor: () => dispatch(rightSidebarActions.completeEditor()),
      cancelEdit: () => dispatch(rightSidebarActions.cancelEdit()),
      confirmEdit: () => dispatch(rightSidebarActions.confirmEdit()),
      updateField: (field, value) => dispatch(rightSidebarActions.updateField(field, value)),
      trackFieldChange: (field) => dispatch(rightSidebarActions.trackField(field)),
      updateFormData: (formData) => dispatch(rightSidebarActions.updateFormData(formData)),
      resetState: () => dispatch(rightSidebarActions.resetState()),
      syncExternalShop: (shopData) => dispatch(rightSidebarActions.syncExternalShop(shopData))
    };
  }, []);
  
  // 유틸리티 함수 메모이제이션
  const utils = useMemo(() => {
    return {
      compareShopData: checkDataIsChanged,
      updateFormDataFromShop
    };
  }, []);
  
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