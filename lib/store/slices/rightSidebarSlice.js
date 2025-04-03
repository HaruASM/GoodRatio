import { createSlice, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../models/editorModels';
import { compareShopData, updateFormDataFromShop, checkDataIsChanged, isEqual } from '../utils/rightSidebarUtils';
import { ShopService } from '../../services/editorServerUtils';
import { endCompareBar } from './compareBarSlice';

// isFieldModified 유틸리티 함수 추가 //FIXME 사용여부확인후후 삭제검토
const isFieldModified = (modifiedFields, fieldName) => {
  return modifiedFields && modifiedFields[fieldName] === true;
};

// 초기 상태
const initialState = {
  isPanelVisible: true,
  isEditing: false,
  isEditorOn: false,  // 폼 데이터 입력 과정을 나타내는 상태 추가
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

// 최종 서버 제출 thunk. // create와 update를 모두 포함하는 상황. 
export const finalSubmitToServer = createAsyncThunk(
  'rightSidebar/finalSubmitToServer',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const { editNewShopDataSet } = state.rightSidebar;

      // 섹션 이름 가져오기
      const sectionName = state.rightSidebar.formData.locationMap || '반월당';
      if (!sectionName) {
        console.error('지정된 sectionName이 없습니다');
        return rejectWithValue('섹션 이름이 지정되지 않았습니다');
      }
      
      // 편집된 데이터 유효성 검사
      if (!editNewShopDataSet) {
        console.error('편집된 데이터가 없습니다');
        return rejectWithValue('편집된 데이터가 없습니다');
      }
      
      let response;
      
      // 기존 데이터 유무에 따라 create/update 결정 (originalShopData 대신 editNewShopDataSet.id 사용)
      // TODO ID 존재유무로 생성, 업데이트를 결정짓는것은 이후 소지 
      if (editNewShopDataSet.id) {
        // 업데이트: ID가 있으면 기존 데이터 업데이트
        response = await ShopService.update(editNewShopDataSet, sectionName);
      } else {
        // 신규 생성: ID가 없으면 새 데이터 생성 // 재확인인
        response = await ShopService.create(editNewShopDataSet, sectionName);
      }
      
      // CompareBar 종료 및 초기화
      dispatch(endCompareBar());
      
      // 성공 시 completeConfirm 액션 호출
      dispatch(completeConfirm());
      return response;
    } catch (error) {
      // 실패 처리
      return rejectWithValue(error.message || '서버 데이터 전송 실패');
    }
  }
);

// 사이드바 슬라이스 생성 //AT Slice 리듀서, 액션 선언부. 기능 변경시,단계를 더 세분화 필요. editing, editor, confirm, idel, explore 단계 구분  
const rightSidebarSlice = createSlice({
  name: 'rightSidebar',
  initialState,
  reducers: {
    // 패널 토글
    togglePanel: (state) => {
      state.isPanelVisible = !state.isPanelVisible;
    },
    
    // 에디터 시작 (isEditorOn만 변경하는 새로운 액션)
    beginEditor: (state) => {
      state.isEditorOn = true;
      // 모순 상태 방지
      state.isConfirming = false;
    },
    
    // 편집 시작
    startEdit: (state, action) => {
      const { shopData } = action.payload;
      
      // null 체크
      if (!shopData) {
        return;
      }
      
      // 상태 초기화
      state.hasChanges = false;
      state.modifiedFields = {};
      
      // 모든 상태 명확히 설정
      state.isEditing = true;
      state.isEditorOn = true;
      state.isConfirming = false;
      state.isIdle = false;
      
      // 원본 데이터 설정 (원래 객체 형태 그대로 유지하되, protoServerDataset에서 누락된 필드 보완)
      state.originalShopData = {
        ...protoServerDataset, // 기본값으로 모든 필드 확보
        ...JSON.parse(JSON.stringify(shopData)) // 서버 데이터로 덮어쓰기
      };
      
      // 편집용 복사본 설정 (동일한 방식으로)
      state.editNewShopDataSet = {
        ...protoServerDataset, // 기본값으로 모든 필드 확보
        ...JSON.parse(JSON.stringify(shopData)) // 서버 데이터로 덮어쓰기
      };
      
      
      // formData UI 표시용으로 변환 (특별 필드만 UI 표시 형식으로 변환)
      const uiFormData = JSON.parse(JSON.stringify(state.editNewShopDataSet));
      
      // pinCoordinates 필드 UI 표시용 처리
      if (uiFormData.pinCoordinates) {
        if (typeof uiFormData.pinCoordinates === 'object' && uiFormData.pinCoordinates !== null) {
          // 유효한 좌표 객체인 경우에만 "등록됨"으로 표시
          const hasPinCoordinates = uiFormData.pinCoordinates.lat !== 0 || uiFormData.pinCoordinates.lng !== 0;
          uiFormData.pinCoordinates = hasPinCoordinates ? "등록됨" : "";
        } else if (typeof uiFormData.pinCoordinates === 'string' && uiFormData.pinCoordinates.trim() !== '') {
          // 이미 문자열이고 내용이 있는 경우 유지
          uiFormData.pinCoordinates = "등록됨";
        } else {
          // 그 외 경우 빈 문자열로 초기화
          uiFormData.pinCoordinates = "";
        }
      } else {
        uiFormData.pinCoordinates = "";
      }
      
      // path 필드 UI 표시용 처리
      if (Array.isArray(uiFormData.path) && uiFormData.path.length > 0) {
        // 기본값이 아닌 경우에만 "등록됨"으로 표시
        const isDefaultPath = uiFormData.path.length === 1 && 
                             uiFormData.path[0].lat === 0 && 
                             uiFormData.path[0].lng === 0;
        uiFormData.path = isDefaultPath ? "" : "등록됨";
      } else {
        uiFormData.path = "";
      }
      
      // UI 표시용 formData 설정
      state.formData = uiFormData;
    },
    
    // 내부적으로 현재 formData를 사용하여 편집 시작하는 액션 추가
    startEditYourself: (state) => {
      // 상태 초기화
      state.hasChanges = false;
      state.modifiedFields = {};
      
      // 모든 상태 명확히 설정
      state.isEditing = true;
      state.isEditorOn = true;
      state.isConfirming = false;
      state.isIdle = false;
      
      // 현재 formData를 원본 및 편집 데이터로 사용
      state.originalShopData = JSON.parse(JSON.stringify(state.formData));
      state.editNewShopDataSet = JSON.parse(JSON.stringify(state.formData));
    },
    
    // 편집 완료 (이름 변경: completeEdit -> completeEditor)
    completeEditor: (state) => {
      // 에디터 모드 종료
      state.isEditorOn = false;
      
      // 확인 상태로 변경
      state.isConfirming = true;
      
      
      // 원본과 현재 값을 비교하여 변경사항 필터링
      const filteredModifiedFields = {};
      
      // originalShopData의 모든 필드에 대해 비교
      Object.keys(state.originalShopData).forEach(field => {
        const originalValue = state.originalShopData[field];
        const currentValue = state.editNewShopDataSet[field];
        
        // 값이 실제로 다른 경우에만 변경된 필드로 유지
        let isDifferent = false;
        
        // 핀 좌표 필드 특별 처리 - 디버깅용
        if (field === 'pinCoordinates') {
          console.log(`핀 좌표 비교: 원본=`, originalValue, `타입=${typeof originalValue}, 현재=`, currentValue, `타입=${typeof currentValue}`);
        }
        
        // 특수 비교 케이스: originalValue가 undefined이고 currentValue가 존재하는 경우
        if (originalValue === undefined && currentValue !== undefined) {
          isDifferent = true;
          console.log(`필드 ${field}: 원본이 undefined이고 현재값이 존재함 - 변경으로 처리`);
        }
        // 특수 비교 케이스: 좌표 객체 비교 (lat, lng 값이 다른 경우)
        else if (field === 'pinCoordinates' && 
                 typeof originalValue === 'object' && originalValue !== null && 
                 typeof currentValue === 'object' && currentValue !== null) {
          
          // 좌표값이 실제로 변경되었는지 확인 (기본값이 아닌 실제 좌표로 변경된 경우)
          const isOriginalDefault = originalValue.lat === 0 && originalValue.lng === 0;
          const isCurrentDefault = currentValue.lat === 0 && currentValue.lng === 0;
          
          if (isOriginalDefault && !isCurrentDefault) {
            // 기본값에서 실제 좌표로 변경된 경우
            isDifferent = true;
            console.log(`필드 ${field}: 기본값에서 실제 좌표로 변경됨`);
          } else {
            // 일반적인 좌표 비교 (lat 또는 lng 값이 변경된 경우)
            isDifferent = originalValue.lat !== currentValue.lat || originalValue.lng !== currentValue.lng;
            console.log(`필드 ${field}: 좌표 비교 결과 - isDifferent=${isDifferent}`);
          }
        }
        // 배열 비교 특별 처리
        else if (Array.isArray(originalValue) && Array.isArray(currentValue)) {
          // 빈 배열과 내용이 있는 배열 비교
          if (originalValue.length === 0 && currentValue.length > 0) {
            isDifferent = true;
            console.log(`필드 ${field}: 빈 배열에서 내용이 있는 배열로 변경됨`);
          } else {
            // JSON 문자열로 변환하여 비교 (깊은 비교)
            isDifferent = JSON.stringify(originalValue) !== JSON.stringify(currentValue);
            console.log(`필드 ${field}: 배열 비교 결과 - isDifferent=${isDifferent}`);
          }
        } 
        // 객체 비교
        else if (typeof originalValue === 'object' && originalValue !== null && 
                typeof currentValue === 'object' && currentValue !== null) {
          // 깊은 비교를 통해 객체 내용이 다른지 확인
          isDifferent = JSON.stringify(originalValue) !== JSON.stringify(currentValue);
          console.log(`필드 ${field}: 객체 비교 결과 - isDifferent=${isDifferent}`);
        } 
        else {
          // 일반 값 비교
          isDifferent = currentValue !== originalValue;
        }
        
        if (isDifferent) {
          filteredModifiedFields[field] = true;
          // 디버깅 - 변경된 필드 출력
          console.log(`변경된 필드: ${field}, 원본=`, originalValue, `현재=`, currentValue);
        }
      });
      
      // 필터링된 modifiedFields로 업데이트
      state.modifiedFields = filteredModifiedFields;
      
      // 변경된 필드가 있는지 확인
      const hasChanges = Object.keys(filteredModifiedFields).length > 0;
      
      // 디버깅 로그 추가
      console.log('최종 변경여부:', hasChanges);
      console.log('변경된 필드들:', filteredModifiedFields);
      
      // formData를 editNewShopDataSet으로 업데이트 ?? 
      state.formData = JSON.parse(JSON.stringify(state.editNewShopDataSet));
      
      // 변경 상태 설정
      state.hasChanges = hasChanges;
    },
    
    // 편집 취소
    cancelEdit: (state) => {
      // 편집 취소 - 저장된 원본 데이터로 복원
      state.formData = state.originalShopData ? JSON.parse(JSON.stringify(state.originalShopData)) : { ...protoServerDataset };
      
      // 수정 필드 목록 초기화
      state.modifiedFields = {};
      
      // 모든 편집 관련 상태 명확히 리셋
      state.isEditorOn = false;
      state.isConfirming = false;
      state.editNewShopDataSet = null; //TODO protoServerDataset 으로 빈값을 초기화 해야 하지 않을까?
      
      // 드로잉 모드 종료
      state.isDrawing = false;
      state.drawingType = null;
    },
    
    // 편집 종료 (공통 액션)
    endEdit: (state) => {
      state.isEditing = false;
      // isEditorOn 상태와 모순 방지
      state.isEditorOn = false;
    },
    
    // 확인 액션 추가 (최종 확인 단계로 진행)
    startConfirm: (state) => {
      // null 체크
      if (!state.originalShopData || !state.editNewShopDataSet) {
        state.isConfirming = false;
        state.isEditorOn = false;
        state.hasChanges = false;
        return;
      }
      
      // modifiedFields에 기록된 필드가 있는지 확인
      const hasChanges = Object.keys(state.modifiedFields).length > 0;
      
      // 상태 명확히 업데이트
      state.isEditorOn = false;  // 에디터 비활성화
      state.isConfirming = true; // 확인 상태로 전환
      state.hasChanges = hasChanges;
    },
    
    // 최종 확인 및 전송 준비 액션
    confirmAndSubmit: (state) => {
      // 서버 제출 준비 상태로 변경
      state.status = 'loading';
      state.error = null;
      
      // 편집된 데이터가 없으면 처리하지 않음
      if (!state.editNewShopDataSet) {
        state.error = '편집된 데이터가 없습니다';
        state.status = 'failed';
        return;
      }
      
      // 검증 로직 제거 - EditorServerUtils.js에서만 수행하도록 변경
      console.log('confirmAndSubmit - 서버 전송 준비 완료');
    },

    // 최종 확인 완료 액션
    completeConfirm: (state) => {
      // 상태 초기화
      state.isEditorOn = false;  // 에디터 비활성화
      state.isConfirming = false;
      state.hasChanges = false;
      state.originalShopData = null;
      state.editNewShopDataSet = null;
      state.modifiedFields = {};
      
      // 폼 데이터 초기화
      state.formData = updateFormDataFromShop(null, {});
      
      // IDLE 상태로 되돌림
      state.isIdle = true;
      
      // 상태 초기화
      state.status = 'idle';
      state.error = null;
    },

    // status와 error를 직접 설정하는 액션 추가
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    
    setError: (state, action) => {
      state.error = action.payload;
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
          
          // 변경사항 추적을 위해 원본 값과 비교
          let isDifferent = false;
          
          // 배열 비교 특별 처리
          if (Array.isArray(originalValue) && Array.isArray(value)) {
            // JSON 문자열로 변환하여 비교 (깊은 비교)
            isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
          } 
          // 객체 비교 (pinCoordinates와 같은 좌표 객체를 위한 처리)
          else if (typeof originalValue === 'object' && originalValue !== null && 
                  typeof value === 'object' && value !== null) {
            // isEqual 함수를 사용하여 객체 깊은 비교
            isDifferent = !isEqual(originalValue, value);
          }
          else {
            // 일반 값 비교
            isDifferent = value !== originalValue;
          }
          
          // 새 값 설정
          if (isDifferent) {
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
            if (state.originalShopData) {
              const originalValue = state.originalShopData[field];
              
              let isDifferent = false;
              
              // 배열 비교 특별 처리
              if (Array.isArray(originalValue) && Array.isArray(value)) {
                // JSON 문자열로 변환하여 비교 (깊은 비교)
                isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
              } 
              // 객체 비교 (pinCoordinates와 같은 좌표 객체를 위한 처리)
              else if (typeof originalValue === 'object' && originalValue !== null && 
                      typeof value === 'object' && value !== null) {
                // isEqual 함수를 사용하여 객체 깊은 비교
                isDifferent = !isEqual(originalValue, value);
              }
              else {
                // 일반 값 비교
                isDifferent = value !== originalValue;
              }
              
              if (isDifferent) {
                state.modifiedFields[field] = true;
              } else {
                delete state.modifiedFields[field];
              }
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
    resetState: (state) => {
      // console.log('resetState에서 임시 오버레이 정리됨');
      return initialState;
    },
    
    // 외부 상점 데이터와 동기화
    syncExternalShop: (state, action) => {
      
      // 편집 모드나 확인 모드일 경우 폼 데이터 동기화 스킵
      // isEditing = true: 편집 중일 때는 폼 데이터를 사용자 입력으로 유지
      // isConfirming = true: 확인 단계일 때는 편집 데이터 유지
      if (state.isEditing ) {
        return;
      }
      
      
      // shopData가 null인 경우에도 명시적 처리
      if (!action.payload || action.payload.shopData === undefined) {
        // IDLE 상태로 설정하고 폼 데이터 초기화
        state.isIdle = true;
        state.formData = updateFormDataFromShop(null, {});
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
        // console.error('syncExternalShop 처리 중 오류 발생:', error);
      }
    },
    
    // 새 상점 추가
    addNewShop: (state) => {
      // 상태 초기화
      state.isEditing = true;
      state.isEditorOn = true;  // 에디터 활성화
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
        // 1. 내부 데이터 저장 - 객체 형태 그대로 유지
        state.editNewShopDataSet.pinCoordinates = coordinates;
        
        // 2. UI 표시용 데이터 - 문자열로 변환
        state.formData.pinCoordinates = "등록됨";
        
        // 디버깅용 출력
        console.log('updateCoordinates - MARKER 업데이트:', coordinates);
        console.log('updateCoordinates 후 editNewShopDataSet.pinCoordinates:', 
                    typeof state.editNewShopDataSet.pinCoordinates, 
                    state.editNewShopDataSet.pinCoordinates);
        
        // 3. 필드 변경 추적
        state.modifiedFields.pinCoordinates = true;
        
        // 4. hasChanges 상태 업데이트 - 변경사항 있음으로 표시
        state.hasChanges = true;
      } else if (type === 'POLYGON') {
        // 1. 내부 데이터 저장 - 객체 배열 형태 그대로 유지
        state.editNewShopDataSet.path = coordinates;
        
        // 2. UI 표시용 데이터 - 문자열로 변환
        state.formData.path = "등록됨";
        
        // 디버깅용 출력
        console.log('updateCoordinates - POLYGON 업데이트:', coordinates);
        
        // 3. 필드 변경 추적
        state.modifiedFields.path = true;
        
        // 4. hasChanges 상태 업데이트 - 변경사항 있음으로 표시
        state.hasChanges = true;
      }
    },
    
    // IDLE 상태 설정 액션 추가
    setRightSidebarIdleState: (state, action) => {
      state.isIdle = action.payload;
    },
  },
  
  extraReducers: (builder) => {
    builder
      // 기존 saveShopData reducer
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
      })
      
      // finalSubmitToServer reducer 추가
      .addCase(finalSubmitToServer.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(finalSubmitToServer.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 서버에서 업데이트된 데이터는 사용하지 않음 (요구사항대로)
        // completeConfirm에서 상태 초기화가 이루어짐
      })
      .addCase(finalSubmitToServer.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || '서버 데이터 전송 실패';
      });
  }
});

// 셀렉터 함수들
export const selectRightSidebarState = (state) => state.rightSidebar;
export const selectIsPanelVisible = (state) => state.rightSidebar.isPanelVisible;
export const selectIsEditing = (state) => state.rightSidebar.isEditing;
export const selectIsEditorOn = (state) => state.rightSidebar.isEditorOn;
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

export const {
  togglePanel,
  beginEditor,
  startEdit,
  startEditYourself,
  completeEditor,
  cancelEdit,
  endEdit,
  updateField,
  trackField,
  resetState,
  syncExternalShop,
  startDrawingMode,
  endDrawingMode,
  updateCoordinates,
  addNewShop,
  setRightSidebarIdleState,
  startGsearch,
  endGsearch,
  toggleCompareBar,
  confirmAndSubmit,
  startConfirm,
  completeConfirm,
  setStatus,
  setError,
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 