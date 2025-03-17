import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../dataModels';
import { compareShopData, updateFormDataFromShop } from '../utils/sidebarUtils';

// 초기 상태
const initialState = {
  isPanelVisible: true,
  isEditing: false,
  isConfirming: false,
  hasChanges: false,
  originalShopData: null,
  editNewShopDataSet: null,
  formData: { ...protoServerDataset },
  modifiedFields: {},
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null
};

// 비동기 액션: 상점 데이터 저장
export const saveShopData = createAsyncThunk( // 액션 생성자자
  'rightSidebar/shop/saved',
  async (shopData, { rejectWithValue }) => {
    try {
      // 여기에 실제 API 호출 코드가 들어갈 수 있습니다.
      // 예: const response = await api.saveShopData(shopData);
      
      // 현재는 모의 응답을 반환합니다.
      console.log('상점 데이터 저장:', shopData);
      
      // 저장 성공 시 데이터 반환
      return shopData;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 사이드바 슬라이스 생성 //AT Slice 리듀서, 액션 선언부 
const rightSidebarSlice = createSlice({
  name: 'rightSidebar',
  initialState,
  reducers: {
    // 패널 토글
    togglePanel: (state) => {
      state.isPanelVisible = !state.isPanelVisible;
    },
    
    // 편집 시작
    startEdit: (state, action) => {
      state.isEditing = true;
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = action.payload.shopData;
      state.editNewShopDataSet = { ...action.payload.shopData };
      state.modifiedFields = {};
    },
    
    // 편집 완료
    completeEdit: (state) => {
      const hasChanges = compareShopData(
        state.originalShopData,
        state.editNewShopDataSet
      );
      
      state.isEditing = false;
      state.isConfirming = hasChanges;
      state.hasChanges = hasChanges;
    },
    
    // 편집 취소
    cancelEdit: (state) => {
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.editNewShopDataSet = state.originalShopData;
      state.formData = updateFormDataFromShop(state.originalShopData, state.formData);
      state.modifiedFields = {};
    },
    
    // 편집 확인
    confirmEdit: (state) => {
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = state.editNewShopDataSet;
      state.modifiedFields = {};
    },
    
    // 필드 업데이트
    updateField: (state, action) => {
      const { field, value } = action.payload;
      
      // 새로운 editNewShopDataSet 업데이트
      if (state.editNewShopDataSet) {
        if (state.editNewShopDataSet.serverDataset) {
          state.editNewShopDataSet.serverDataset[field] = value;
        } else {
          state.editNewShopDataSet[field] = value;
        }
      }
    },
    
    // 필드 변경 추적
    trackField: (state, action) => {
      state.modifiedFields[action.payload.field] = true;
    },
    
    // 폼 데이터 업데이트
    updateFormData: (state, action) => {
      
      state.formData = {
        ...state.formData,
        ...action.payload
      };

    },
    
    // 상태 초기화
    resetState: () => initialState,
    
    // 외부 상점 데이터와 동기화
    syncExternalShop: (state, action) => {
      if (!action.payload.shopData) return;
      
      state.formData = updateFormDataFromShop(action.payload.shopData, state.formData);
    }
  },
  extraReducers: (builder) => { // 비동기처리  리듀서 선언부 
    builder
      // saveShopData는 createAsyncThunk로 생성됨. 
      .addCase(saveShopData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(saveShopData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.editNewShopDataSet = action.payload;
        state.originalShopData = action.payload;
        state.isEditing = false;
        state.isConfirming = false;
        state.hasChanges = false;
        state.modifiedFields = {};
      })
      .addCase(saveShopData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  }
});

// 액션 생성자 내보내기
export const {
  togglePanel,
  startEdit,
  completeEdit,
  cancelEdit,
  confirmEdit,
  updateField,
  trackField,
  updateFormData,
  resetState,
  syncExternalShop
} = rightSidebarSlice.actions;

// 선택자 함수들
export const selectRightSidebarState = (state) => state.rightSidebar;
export const selectIsPanelVisible = (state) => state.rightSidebar.isPanelVisible;
export const selectIsEditing = (state) => state.rightSidebar.isEditing;
export const selectIsConfirming = (state) => state.rightSidebar.isConfirming;
export const selectHasChanges = (state) => state.rightSidebar.hasChanges;
export const selectFormData = (state) => state.rightSidebar.formData;
export const selectModifiedFields = (state) => state.rightSidebar.modifiedFields;
export const selectOriginalShopData = (state) => state.rightSidebar.originalShopData;
export const selectEditNewShopDataSet = (state) => state.rightSidebar.editNewShopDataSet;
export const selectStatus = (state) => state.rightSidebar.status;
export const selectError = (state) => state.rightSidebar.error;

// 리듀서 내보내기
export default rightSidebarSlice.reducer; 