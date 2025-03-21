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
    },
    // 모달 UI 관련 설정 추가
    modalConfig: {
      title: '비교대상없음',
      button: {
        text: '',
        action: ''
      }
    },
    // 복사 버튼 표시 여부를 결정하는 플래그
    insertModeModal: false
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
      // 세 개의 인자 처리: reference, target, 추가 설정(insertMode, modalConfig)
      const [reference, target, options = {}] = action.payload;
      
      // options에서 값 추출
      const { insertMode = false, modalConfig = null } = options;
      
      // 레퍼런스 데이터 설정 [라벨, 데이터]
      if (Array.isArray(reference) && reference.length >= 2) {
        state.compareModalData.reference.label = reference[0] ;
        state.compareModalData.reference.data = reference[1] ;
      }
      
      state.compareModalData.target.label = target[0] ;
      if (target[1] === true) {
        state.compareModalData.target.data = state.editNewShopDataSet;
      } else {
        state.compareModalData.target.data = target[1] ;
      }

      
      // 모달 설정 적용
      if (modalConfig) {
        state.compareModalData.modalConfig = {
          ...state.compareModalData.modalConfig,
          ...modalConfig
        };
      }
      
      // 복사 버튼 표시 설정 (insertMode가 true면 복사 버튼 표시)
      state.compareModalData.insertModeModal = insertMode === true;
      
      // 모달창 표시
      state.isCompareModalVisible = true;
    },
    
    // 기존 confirmEdit 수정 - startCompareModal 액션 사용
    confirmEdit: (state) => {
      //AT 데이터 수정후 전송 확인용 비교 모달 표시 
      // 비교 모달 데이터 설정
      state.compareModalData = {
        reference: {
          label: '원본',
          data: state.originalShopData
        },
        target: {
          label: '수정본',
          // 직접 참조로 변경
          data: true
        },
        modalConfig: {
          title: '비교후 전송',
          button: {
            text: '확정전송',
            action: 'confirmComplete'
          }
        },
        // 일반 비교 모드에서는 복사 버튼 표시 안함
        insertModeModal: false
      };
      
      // 모달창 표시
      state.isCompareModalVisible = true;
    },
    
    // 모달 닫기 - 단순히 모달만 닫음
    closeCompareModal: (state) => {
      // 모달 닫기
      state.isCompareModalVisible = false;
      state.compareModalData = {
        reference: {
          label: '',
          data: null
        },
        target: {
          label: '',
          data: null
        },
        modalConfig: {
          title: '비교대상없음',
          button: {
            text: '',
            action: ''
          }
        },
        insertModeModal: false
      };
    },
    
    // 비교 모달의 타겟 데이터 업데이트
    updateCompareModalTarget: (state, action) => {
      if (state.compareModalData && state.compareModalData.target) {
        // 모달의 타겟 데이터 업데이트
        state.compareModalData.target.data = action.payload;
        
        // 실제 편집 중인 데이터도 함께 업데이트
        if (state.isEditing && state.editNewShopDataSet) {
          state.editNewShopDataSet = { ...action.payload };
        }
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
          
          // 비교 모달이 열려있는 경우 모달 데이터도 업데이트
          if (state.isCompareModalVisible && 
              state.compareModalData && 
              state.compareModalData.target && 
              state.compareModalData.target.data) {
            // 명시적 객체 복사 대신, 직접 참조 방식 사용
            state.compareModalData.target.data = state.editNewShopDataSet;
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
          
          // 비교 모달 데이터도 업데이트 (필요한 경우)
          if (state.isCompareModalVisible && 
              state.compareModalData?.target?.data) {
            state.compareModalData.target.data = state.editNewShopDataSet;
          }
        }
      }
    },
    
    // 필드 변경 추적
    trackField: (state, action) => {
      state.modifiedFields[action.payload.field] = true;
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
    
    // 구글 장소 검색 모드 시작 (구글 장소 검색 버튼 클릭 시)
    startGsearch: (state) => {
      state.googlePlaceData = null;
      state.isGsearch = true;
    },
    
    // 구글 장소 검색 모드 종료
    endGsearch: (state) => {
      state.googlePlaceData = null;
      state.isGsearch = false;
    },
    
    // 구글 장소 비교 데이터 설정
    compareGooglePlaceData: (state, action) => { //AT (작업중)set구글장소
   
      // googlePlaceData를 protoServerDataset으로 초기화 후 action.payload 값을 넣음
      state.googlePlaceData = { ...protoServerDataset };
          
      // 구글 플레이스 데이터를 앱 형식에 맞게 변환
      if (action.payload) {
        // 기본 필드 매핑
        state.googlePlaceData.storeName = action.payload.name || '';
        state.googlePlaceData.address = action.payload.formatted_address || '';
        state.googlePlaceData.googleDataId = action.payload.place_id || '';
        
        // 이미지 처리 - 구글은 photo_reference 배열을 제공
        // 모든 이미지를 subImages에 추가하고 mainImage는 비워둠
        if (action.payload.photos && Array.isArray(action.payload.photos)) {
          // mainImage는 빈 문자열로 설정
          state.googlePlaceData.mainImage = '';
          
          // 모든 사진을 subImages 배열에 추가
          state.googlePlaceData.subImages = action.payload.photos.map(photo => {
            if (photo.photo_reference) {
              return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photo.photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
            }
            return '';
          }).filter(url => url !== '');
        } else {
          // 사진이 없는 경우 빈 배열 설정
          state.googlePlaceData.mainImage = '';
          state.googlePlaceData.subImages = [];
        }
        
        // 위치 정보 처리 - string 형식으로 변환
        if (action.payload.geometry && action.payload.geometry.location) {
          // 직렬화 문제 해결: 함수 대신 값을 직접 추출
          const lat = typeof action.payload.geometry.location.lat === 'function' 
            ? action.payload.geometry.location.lat() 
            : action.payload.geometry.location.lat;
            
          const lng = typeof action.payload.geometry.location.lng === 'function' 
            ? action.payload.geometry.location.lng() 
            : action.payload.geometry.location.lng;
            
          // 직렬화 가능한 객체로 변환
          state.googlePlaceData.pinCoordinates = `${lat},${lng}`;
        }
        
        // 영업시간 처리 - 문자열 배열로 변환
        if (action.payload.opening_hours && action.payload.opening_hours.weekday_text) {
          state.googlePlaceData.businessHours = action.payload.opening_hours.weekday_text;
        } else if (action.payload.opening_hours) {
          // weekday_text가 없는 경우 빈 배열
          state.googlePlaceData.businessHours = [];
        }
        
        // 전화번호 처리
        if (action.payload.formatted_phone_number) {
          state.googlePlaceData.phone = action.payload.formatted_phone_number;
        }
        
        // 웹사이트 처리
        if (action.payload.website) {
          state.googlePlaceData.website = action.payload.website;
        }
        
        // 평점 처리
        if (action.payload.rating) {
          state.googlePlaceData.rating = action.payload.rating.toString();
        }
        
        // 가격 수준 처리
        if (action.payload.price_level) {
          state.googlePlaceData.priceLevel = action.payload.price_level.toString();
        }
      }
      
      // 비교 모달 데이터 설정
      // 기존 editNewShopDataSet(현재 편집 중인 데이터)와 구글 데이터를 비교하기 위한 설정
      state.compareModalData = {
        reference: {
          label: '구글데이터',
          data: state.googlePlaceData
        },
        target: {
          label: '현재데이터',
          // 직접 참조로 변경
          data: true
        },
        modalConfig: {
          title: '구글Place 데이터',
          button: {
            text: '',
            action: ''
          }
        },
        // 구글 검색 모드에서는 복사 버튼 표시함
        insertModeModal: true
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
  startCompareModal,
  updateCompareModalTarget
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 