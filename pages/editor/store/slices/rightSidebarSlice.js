import { createSlice, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../dataModels';
import { compareShopData, updateFormDataFromShop, checkDataIsChanged } from '../utils/rightSidebarUtils';

// 초기 상태
const initialState = {
  isPanelVisible: true,
  isEditing: false,
  isConfirming: false,
  hasChanges: false,
  originalShopData: null,
  editNewShopDataSet: null,
  // 비교 모달용 복사본 제거
  formData: { ...protoServerDataset },
  modifiedFields: {},
  // 변경된 필드 목록 추가
  changedFieldsList: [],
  // 비교 모달 데이터
  compareModalData: {
    reference: {
      label: '',
      data: null
    },
    target: {
      label: '',
      data: null
    }
  },
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  // 드로잉 관련 상태 추가
  isDrawing: false,
  drawingType: null, // 'MARKER' 또는 'POLYGON'
  // 모달 창 관련 상태 추가
  isCompareModalVisible: false,
  // IDLE 상태 추가 (초기에는 IDLE 상태)
  isIdle: true,
  // 구글 장소 검색 관련 상태 추가
  isGsearch: false,
  googlePlaceData: null
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

// 최종 확인 액션 (thunk로 분리)
export const finalConfirmAndSubmit = createAsyncThunk(
  'rightSidebar/finalConfirmAndSubmit',
  async (_, { dispatch, getState }) => {
    try {
      // 상태 초기화만 수행 (데이터 저장은 이미 CompareModal에서 수행됨)
      dispatch(rightSidebarSlice.actions.confirmAndSubmit());
      
      return { success: true };
    } catch (error) {
      console.error('상태 초기화 중 오류 발생:', error);
      return { success: false, error };
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
      
      // 항상 serverDataset 형식의 데이터로 가정
      state.originalShopData = JSON.parse(JSON.stringify(action.payload.shopData));
      state.editNewShopDataSet = JSON.parse(JSON.stringify(action.payload.shopData));

      // 새로 추가하는 경우에만 modifiedFields 초기화
      if (!state.isConfirming && !state.hasChanges) {
        state.hasChanges = false;
      }
      // modifiedFields는 유지 (수정된 필드 표시를 위해)
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
      const hasChanges = Object.keys(state.modifiedFields).length > 0;
      
               
      state.isEditing = false;
      state.isConfirming = true; // 항상 확인 상태로 전환
      state.hasChanges = hasChanges;
      
      // modifiedFields는 유지 (재수정 시 수정된 필드 표시를 위해)
    },
    
    // 편집 취소
    cancelEdit: (state) => {
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.editNewShopDataSet = null;
      state.originalShopData = null;
      state.formData = updateFormDataFromShop(null, {});
      state.modifiedFields = {};
      // 취소 시 IDLE 상태로 복귀
      state.isIdle = true;
      
      // 구글 검색 상태 초기화
      state.isGsearch = false;
      state.googlePlaceData = null;
    },
    
    // 비교 모달 시작
    startCompareModal: (state, action) => {
      // 두 개의 배열 인자 처리
      const [reference, target] = action.payload;
      
      // 레퍼런스 데이터 설정 [라벨, 데이터]
      if (Array.isArray(reference) && reference.length >= 2) {
        state.compareModalData.reference.label = reference[0] || '원본';
        state.compareModalData.reference.data = reference[1] || null;
      }
      
      // 타겟 데이터 설정 [라벨, 데이터]
      if (Array.isArray(target) && target.length >= 2) {
        state.compareModalData.target.label = target[0] || '수정본';
        state.compareModalData.target.data = target[1] || null;
      }
      
      // 모달창 표시
      state.isCompareModalVisible = true;
    },
    
    // 기존 confirmEdit 수정 - startCompareModal 액션 사용
    confirmEdit: (state) => {
      // 수정된 데이터 콘솔에 출력
      console.log('저장되는 데이터:', state.editNewShopDataSet.storeName, state.editNewShopDataSet.comment);
      console.log('원본 데이터:', state.originalShopData.storeName, state.originalShopData.comment);
      
      // 비교 모달 데이터 설정
      state.compareModalData = {
        reference: {
          label: '원본',
          data: state.originalShopData
        },
        target: {
          label: '수정본',
          data: state.editNewShopDataSet
        }
      };
      
      // 모달창 표시
      state.isCompareModalVisible = true;
    },
    
    // 모달 닫기
    closeCompareModal: (state) => {
      state.isCompareModalVisible = false;
      
      // 구글 검색 중이었다면 검색 상태 종료
      if (state.isGsearch) {
        state.isGsearch = false;
        state.googlePlaceData = null;
      }
    },
    
    // 최종 확인 및 전송 액션 추가 (리듀서 내부에만 있는 버전)
    confirmAndSubmit: (state) => {
      // 상태 초기화
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = null;
      state.editNewShopDataSet = null;
      state.modifiedFields = {};
      state.isCompareModalVisible = false;
      
      // 폼 데이터 초기화
      state.formData = updateFormDataFromShop(null, {});
    },
    
    // 필드 업데이트
    updateField: (state, action) => {
      const { field, value } = action.payload;
      
      // 새로운 editNewShopDataSet 업데이트
      if (state.editNewShopDataSet) {
        let originalValue;
        
        // 원본 값 가져오기 - 구조 변경에 맞게 수정
        if (state.originalShopData) {
          originalValue = state.originalShopData[field];
        }
        
        // 새 값 설정 - 구조 변경에 맞게 수정
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
        // IDLE 상태로 설정하고 폼 데이터 초기화
        state.isIdle = true;
        state.formData = updateFormDataFromShop(null, {});
        return;
      }
      
      // 편집 모드나 확인 모드일 경우 폼 데이터 동기화 스킵
      // isEditing = true: 편집 중일 때는 폼 데이터를 사용자 입력으로 유지
      // isConfirming = true: 확인 단계일 때는 편집 데이터 유지
      if (state.isEditing || state.isConfirming) {
        return;
      }
      
      try {
        // 직접 데이터 사용 (protoServerDataset 구조)
        const shopData = action.payload.shopData;
        
        // IDLE 상태일 때만 폼 데이터 업데이트하도록 수정
        if (state.isIdle || (!state.isEditing && !state.isConfirming)) {
          // 여기서 폼 데이터 업데이트 (Editor 컴포넌트의 updateFormDataFromShop 로직 대체)
          state.formData = updateFormDataFromShop(shopData, state.formData);
        }
        
        // 데이터가 있는 경우에만 IDLE 상태 해제
        if (shopData) {
          state.isIdle = false;
        } else {
          state.isIdle = true;
        }
      } catch (error) {
        // 오류 처리
        console.error('syncExternalShop 처리 중 오류 발생:', error);
      }
    },
    
    // 새 상점 추가
    addNewShop: (state) => {
      // 상태 초기화
      state.isEditing = true;
      state.isConfirming = false;
      state.hasChanges = false;
      state.modifiedFields = {};
      
      // 빈 상점 데이터로 초기화 (protoServerDataset 직접 사용)
      state.originalShopData = { ...protoServerDataset };
      state.editNewShopDataSet = { ...protoServerDataset };
      
      // 폼 데이터도 초기화
      state.formData = updateFormDataFromShop(null, {});
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
        state.editNewShopDataSet.pinCoordinates = coordinates;
        
        // 3. 필드 변경 추적
        state.modifiedFields.pinCoordinates = true;
      } else if (type === 'POLYGON') {
        // 1. 폼 데이터 업데이트 (UI 반영)
        state.formData.path = coordinates;
        
        // 2. 필드 값 업데이트 (데이터 저장)
        state.editNewShopDataSet.path = coordinates;
        
        // 3. 필드 변경 추적
        state.modifiedFields.path = true;
      }
    },
    
    // IDLE 상태 설정 액션 추가
    setIdleState: (state, action) => {
      state.isIdle = action.payload ?? true;
      
      // IDLE 상태로 변경 시 폼 데이터 초기화 (선택적)
      if (state.isIdle) {
        state.formData = updateFormDataFromShop(null, {});
      }
    },
    
    // 구글 장소 검색 모드 시작
    startGsearch: (state) => {
      state.isGsearch = true;
    },
    
    // 구글 장소 검색 모드 종료
    endGsearch: (state) => {
      state.isGsearch = false;
      state.googlePlaceData = null;
    },
    
    // 구글 장소 데이터 저장
    compareGooglePlaceData: (state, action) => { //AT (작업중)set구글장소
      // 구글 탐색 버튼이 눌려진 상태가 아니면 return
      if (!state.isGsearch) {
        return;
      }

      // googlePlaceData를 protoServerDataset으로 초기화 후 action.payload 값을 넣음
      state.googlePlaceData = { ...protoServerDataset };
          
      // 필요한 필드만 복사      
      if (action.payload) {
        state.googlePlaceData.storeName = action.payload.name || '';
        state.googlePlaceData.address = action.payload.formatted_address || '';
        state.googlePlaceData.googleDataId = action.payload.place_id || '';
        state.googlePlaceData.subImages = action.payload.photos || [];
        state.googlePlaceData.pinCoordinates = action.payload.geometry?.location || '';
        state.googlePlaceData.businessHours = action.payload.opening_hours || '';
      }
      
      // 비교 모달 데이터 설정
      state.compareModalData = {
        reference: {
          label: '구글Place',
          data: state.googlePlaceData
        },
        target: {
          label: '수정본',
          data: state.editNewShopDataSet
        }
      };
      
      // 비교 모달 표시
      state.isCompareModalVisible = true;
    }
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(saveShopData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(saveShopData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // 원본 데이터는 유지하고 업데이트하지 않음
        
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
export const selectOriginalShopData = (state) => state.rightSidebar.originalShopData;
export const selectEditNewShopDataSet = (state) => state.rightSidebar.editNewShopDataSet;
export const selectFormData = (state) => state.rightSidebar.formData;
export const selectModifiedFields = (state) => state.rightSidebar.modifiedFields;
export const selectStatus = (state) => state.rightSidebar.status;
export const selectError = (state) => state.rightSidebar.error;

// IDLE 상태 선택자 추가
export const selectIsIdle = (state) => state.rightSidebar.isIdle;

// 드로잉 관련 셀렉터
export const selectIsDrawing = (state) => state.rightSidebar.isDrawing;
export const selectDrawingType = (state) => state.rightSidebar.drawingType;

// 모달 창 관련 셀렉터
export const selectIsCompareModalVisible = (state) => state.rightSidebar.isCompareModalVisible;

// 구글 장소 검색 관련 셀렉터
export const selectIsGsearch = (state) => state.rightSidebar.isGsearch;
export const selectGooglePlaceData = (state) => state.rightSidebar.googlePlaceData;

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
  startDrawingMode,
  endDrawingMode,
  updateCoordinates,
  addNewShop,
  closeCompareModal,
  confirmAndSubmit,
  setIdleState,
  startGsearch,
  endGsearch,
  compareGooglePlaceData,
  startCompareModal
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 