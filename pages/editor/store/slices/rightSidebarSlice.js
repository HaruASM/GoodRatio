import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../dataModels';
import { compareShopData, updateFormDataFromShop } from '../utils/rightSidebarUtils';

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
  error: null,
  // 드로잉 관련 상태 추가
  isDrawing: false,
  drawingType: null // 'MARKER' 또는 'POLYGON'
};

// 비동기 액션: 상점 데이터 저장
export const saveShopData = createAsyncThunk( // 액션 생성자자
  'rightSidebar/shop/saved',
  async (shopData, { rejectWithValue }) => {
    try {
      // 여기에 실제 API 호출 코드가 들어갈 수 있습니다.
      // 예: const response = await api.saveShopData(shopData);
      
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
      // null 체크 강화
      if (!state.originalShopData || !state.editNewShopDataSet) {
        state.isEditing = false;
        state.isConfirming = false;
        state.hasChanges = false;
        return;
      }
      
      // modifiedFields에 기록된 필드가 있는지 먼저 확인
      const hasModifiedFields = Object.keys(state.modifiedFields).length > 0;
      
      // 실제 데이터 비교로 변경 여부 확인
      const compareResult = compareShopData(
        state.originalShopData,
        state.editNewShopDataSet
      );
      
      // 변경된 필드가 있고, 실제 데이터 비교에서도 차이가 있는 경우
      const hasChanges = hasModifiedFields && compareResult;
      
      state.isEditing = false;
      state.isConfirming = true; // 항상 확인 상태로 전환
      state.hasChanges = hasChanges;
      
      // 변경 사항이 없으면 modifiedFields 초기화
      if (!hasChanges) {
        state.modifiedFields = {};
      }
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
        let originalValue;
        
        // 원본 값 가져오기
        if (state.originalShopData) {
          if (state.originalShopData.serverDataset) {
            originalValue = state.originalShopData.serverDataset[field];
          } else {
            originalValue = state.originalShopData[field];
          }
        }
        
        // 새 값 설정
        if (state.editNewShopDataSet.serverDataset) {
          // 변경사항 추적을 위해 원본 값과 비교
          if (value !== originalValue) {
            state.modifiedFields[field] = true;
          } else {
            // 값이 원래대로 되돌아왔다면 수정된 필드에서 제거
            delete state.modifiedFields[field];
          }
          
          // 값 업데이트
          state.editNewShopDataSet.serverDataset[field] = value;
        } else {
          // 변경사항 추적을 위해 원본 값과 비교
          if (value !== originalValue) {
            state.modifiedFields[field] = true;
          } else {
            // 값이 원래대로 되돌아왔다면 수정된 필드에서 제거
            delete state.modifiedFields[field];
          }
          
          // 값 업데이트
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
      // 업데이트할 데이터가 없는 경우는 무시
      if (!action.payload) {
        return;
      }
      
      // 새 폼 데이터로 업데이트
      state.formData = {
        ...state.formData,
        ...action.payload
      };
    },
    
    // 상태 초기화
    resetState: () => initialState,
    
    // 외부 상점 데이터와 동기화
    syncExternalShop: (state, action) => {
      // shopData가 null인 경우에도 명시적 처리
      if (!action.payload || action.payload.shopData === undefined) {
        return;
      }
      
      // 편집 모드인 경우 동기화 스킵
      if (state.isEditing || state.isConfirming) {
        return;
      }
      
      try {
        // shopData가 null이어도 빈 폼 데이터로 처리
        state.formData = updateFormDataFromShop(action.payload.shopData, state.formData);
      } catch (error) {
        // 오류 처리
      }
    },
    
    // 드로잉 모드 시작
    startDrawingMode: (state, action) => {
      const { type } = action.payload;
      state.isDrawing = true;
      state.drawingType = type;
    },
    
    // 드로잉 모드 종료
    endDrawingMode: (state) => {
      state.isDrawing = false;
    },
    
    // 좌표 업데이트 (마커 또는 폴리곤)
    updateCoordinates: (state, action) => {
      const { type, coordinates } = action.payload;
      
      // 편집 모드가 아니거나 상점 데이터가 없으면 무시
      if (!state.isEditing || !state.editNewShopDataSet) {
        return;
      }
      
      if (type === 'MARKER') {
        // 1. 폼 데이터 업데이트 (UI 반영)
        state.formData.pinCoordinates = coordinates;
        
        // 2. 필드 값 업데이트 (데이터 저장)
        if (state.editNewShopDataSet.serverDataset) {
          state.editNewShopDataSet.serverDataset.pinCoordinates = coordinates;
        } else {
          state.editNewShopDataSet.pinCoordinates = coordinates;
        }
        
        // 3. 필드 변경 추적
        state.modifiedFields.pinCoordinates = true;
      } else if (type === 'POLYGON') {
        // 1. 폼 데이터 업데이트 (UI 반영)
        state.formData.path = coordinates;
        
        // 2. 필드 값 업데이트 (데이터 저장)
        if (state.editNewShopDataSet.serverDataset) {
          state.editNewShopDataSet.serverDataset.path = coordinates;
        } else {
          state.editNewShopDataSet.path = coordinates;
        }
        
        // 3. 필드 변경 추적
        state.modifiedFields.path = true;
      }
    }
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(saveShopData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(saveShopData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // 원본 데이터 업데이트
        state.originalShopData = action.payload;
        
        // 확인 모드 해제
        state.isConfirming = false;
        state.hasChanges = false;
        state.modifiedFields = {};
      })
      .addCase(saveShopData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || '저장 중 오류가 발생했습니다.';
      });
  }
});

// 셀렉터 함수들
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

// 드로잉 관련 셀렉터
export const selectIsDrawing = (state) => state.rightSidebar.isDrawing;
export const selectDrawingType = (state) => state.rightSidebar.drawingType;

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
  syncExternalShop,
  // 드로잉 관련 액션 내보내기
  startDrawingMode,
  endDrawingMode,
  updateCoordinates
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 