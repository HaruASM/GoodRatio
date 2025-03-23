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
  // 비교 모달 데이터 제거
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  // 드로잉 관련 상태 추가
  isDrawing: false,
  drawingType: null, // 'MARKER' 또는 'POLYGON'
  // 모달 창 관련 상태 제거
  // IDLE 상태 추가 (초기에는 IDLE 상태)
  isIdle: true,
  // 구글 장소 검색 관련 상태 추가
  isGsearch: false,
  isCompareBarActive: true,  // CompareBar 활성화 상태 (초기값은 true로 유지)
  // 임시 오버레이 상태 추가
  tempOverlays: {
    marker: null,
    polygon: null
  }
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
    // 일반 액션 디스패치 (최종 확인)
    dispatch(confirmAndSubmit());
    
    // 로딩 상태로 변경
    dispatch(setStatus('loading'));
    
    try {
      // 상태에서 폼 데이터 가져오기
      const state = getState();
      const formData = state.rightSidebar.formData;
      
      // 실제 API 호출 (예: API 호출 관련 코드)
      // const response = await api.saveShopData(formData);
      
      // 저장 성공 액션 디스패치
      dispatch(saveShopData.fulfilled(formData, 'saveShopData', formData));
      
      // 성공 상태로 변경
      dispatch(setStatus('succeeded'));
      
      return formData;
    } catch (error) {
      // 오류 상태로 변경
      dispatch(setStatus('failed'));
      dispatch(setError(error.message));
      
      throw error;
    }
  }
);

// 임시 오버레이 정리 thunk 액션
export const cleanupTempOverlaysThunk = createAsyncThunk(
  'rightSidebar/cleanupTempOverlaysThunk',
  async (_, { dispatch, getState }) => {
    // 먼저 상태 업데이트
    dispatch(cleanupOverlays());

    // 실제 DOM 정리 로직은 컴포넌트에서 처리됨 - 상태 변화에 반응해서
    return true;
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
    completeEdit: (state, action) => {
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
    cancelEdit: (state, action) => {
      // 임시 오버레이 정리 함수 호출 (액션에서 받은 핸들러 사용)
      // 액션 페이로드로 mapOverlayHandlers가 전달되었다면 사용
      const mapOverlayHandlers = action.payload?.mapOverlayHandlers;
      if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
        mapOverlayHandlers.cleanupTempOverlays();
        console.log('cancelEdit에서 임시 오버레이 정리됨');
      }
      
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
    },
    
    // 확인 액션 추가 (최종 확인 단계로 진행)
    confirmEdit: (state, action) => {
      // 임시 오버레이 정리 함수 호출 (액션에서 받은 핸들러 사용)
      const mapOverlayHandlers = action.payload?.mapOverlayHandlers;
      if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
        mapOverlayHandlers.cleanupTempOverlays();
        console.log('confirmEdit에서 임시 오버레이 정리됨');
      }

      // null 체크 강화
      if (!state.originalShopData || !state.editNewShopDataSet) {
        state.isEditing = false;
        state.isConfirming = false;
        state.hasChanges = false;
        return;
      }
      
      // modifiedFields에 기록된 필드가 있는지 먼저 확인
      const hasChanges = Object.keys(state.modifiedFields).length > 0;
      
      // 상태 업데이트
      state.isEditing = false;
      state.isConfirming = true; // 확인 상태로 전환
      state.hasChanges = hasChanges;
      
      // modifiedFields는 유지 (재수정 시 수정된 필드 표시를 위해)
    },
    
    // 비교 모달 관련 액션 제거
    
    // 최종 확인 및 전송 액션 추가 (리듀서 내부에만 있는 버전)
    confirmAndSubmit: (state, action) => {
      // 임시 오버레이 정리 함수 호출 (액션에서 받은 핸들러 사용)
      const mapOverlayHandlers = action.payload?.mapOverlayHandlers;
      if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
        mapOverlayHandlers.cleanupTempOverlays();
        console.log('confirmAndSubmit에서 임시 오버레이 정리됨');
      }

      // 상태 초기화
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = null;
      state.editNewShopDataSet = null;
      state.modifiedFields = {};
      // compareModal 관련 상태 제거
      
      // 폼 데이터 초기화
      state.formData = updateFormDataFromShop(null, {});
    },

    button1: (state, action) => {
      console.log('button1 called', action.payload);
    },
    
    // 최종 확인 완료 액션 추가
    confirmComplete: (state, action) => {
      console.log('confirmComplete 액션 호출됨', action.payload);
      
      // 임시 오버레이 정리 함수 호출 (액션에서 받은 핸들러 사용)
      const mapOverlayHandlers = action.payload?.mapOverlayHandlers;
      if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
        mapOverlayHandlers.cleanupTempOverlays();
        console.log('confirmComplete에서 임시 오버레이 정리됨');
      }
      
      // 여기서 필요한 최종 확인 및 데이터 처리 로직 구현
      // 예: API 호출, 데이터 검증 등
      
      // 상태 초기화 로직은 confirmAndSubmit과 유사
      state.isEditing = false;
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = null;
      state.editNewShopDataSet = null;
      state.modifiedFields = {};
      // compareModal 관련 상태 제거
      
      // 폼 데이터 초기화
      state.formData = updateFormDataFromShop(null, {});
      
      // IDLE 상태로 되돌림
      state.isIdle = true;
    },
    
    // 필드 업데이트 - 단일 업데이트 경로
    updateField: (state, action) => {
      // 단일 필드 업데이트 경우
      if (action.payload.field) {
        const { field, value } = action.payload;
        
        // 새로운 editNewShopDataSet 업데이트
        if (state.editNewShopDataSet) {
          let originalValue;
          
          // 원본 값 가져오기
          if (state.originalShopData) {
            originalValue = state.originalShopData[field];
          }
          
          // 새 값 설정
          // 변경사항 추적을 위해 원본 값과 비교
          if (value !== originalValue) {
            state.modifiedFields[field] = true;
          } else {
            // 값이 원래대로 되돌아왔다면 수정된 필드에서 제거
            delete state.modifiedFields[field];
          }
          
          // 값 업데이트
          state.editNewShopDataSet[field] = value;
          
          // formData도 함께 업데이트 - 단일 경로 보장
          if (state.formData) {
            state.formData[field] = value;
          }
        }
      } 
      // 여러 필드 업데이트 경우 (기존 updateFormData 기능 통합)
      else if (action.payload) {
        // 전달된 모든 필드에 대해 처리
        const formUpdates = action.payload;
        
        // formData 업데이트
        if (state.formData) {
          state.formData = {
            ...state.formData,
            ...formUpdates
          };
        }
        
        // editNewShopDataSet도 함께 업데이트 (단일 경로 보장)
        if (state.editNewShopDataSet) {
          Object.entries(formUpdates).forEach(([field, value]) => {
            // 수정값 추적
            if (state.originalShopData && value !== state.originalShopData[field]) {
              state.modifiedFields[field] = true;
            } else {
              delete state.modifiedFields[field];
            }
            
            // 값 업데이트
            state.editNewShopDataSet[field] = value;
          });
        }
      }
    },
    
    // 필드 변경 추적
    trackField: (state, action) => {
      state.modifiedFields[action.payload.field] = true;
    },
    
    // 상태 초기화
    resetState: (state, action) => {
      // 임시 오버레이 정리 함수 호출 (액션에서 받은 핸들러 사용)
      const mapOverlayHandlers = action.payload?.mapOverlayHandlers;
      if (mapOverlayHandlers && typeof mapOverlayHandlers.cleanupTempOverlays === 'function') {
        mapOverlayHandlers.cleanupTempOverlays();
        console.log('resetState에서 임시 오버레이 정리됨');
      }
      
      // 초기 상태로 되돌림
      return initialState;
    },
    
    // 오버레이 정리 액션 추가
    cleanupOverlays: (state) => {
      // 상태 초기화만 수행 (실제 DOM 조작은 thunk에서 수행)
      state.tempOverlays = {
        marker: null,
        polygon: null
      };
    },
    
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
      state.isIdle = action.payload;
      
      // 구글 검색 상태 초기화
      state.isGsearch = false;
    },
    
    // 구글 장소 검색 모드 시작 (구글 장소 검색 버튼 클릭 시)
    startGsearch: (state) => {
      state.isGsearch = true;
    },
    
    // 구글 장소 검색 모드 종료
    endGsearch: (state) => {
      state.isGsearch = false;
    },
    
    // CompareBar 토글 액션
    toggleCompareBar: (state) => {
      state.isCompareBarActive = !state.isCompareBarActive;
    },
    
    // CompareBar 활성화 상태 설정 액션
    setCompareBarActive: (state, action) => {
      state.isCompareBarActive = action.payload;
    },
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

// 구글 장소 검색 관련 셀렉터
export const selectIsGsearch = (state) => state.rightSidebar.isGsearch;

// CompareBar 활성화 상태 셀렉터
export const selectIsCompareBarActive = (state) => state.rightSidebar.isCompareBarActive;

export const {
  togglePanel,
  startEdit,
  completeEdit,
  cancelEdit,
  updateField,
  trackField,
  resetState,
  syncExternalShop,
  startDrawingMode,
  endDrawingMode,
  updateCoordinates,
  addNewShop,
  setIdleState,
  startGsearch,
  endGsearch,
  toggleCompareBar,
  setCompareBarActive,
  confirmAndSubmit,
  confirmEdit,
  cleanupOverlays
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 