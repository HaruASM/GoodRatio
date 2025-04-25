import { createSlice, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../models/editorModels';
import { compareitemdata, updateFormDataFromShop, checkDataIsChanged, isEqual } from '../utils/rightSidebarUtils';
import { EditorServerService, EditorServerServiceNew } from '../../services/editorServerUtils';
import { endCompareBar } from './compareBarSlice';


// 초기 상태
const initialState = {
  isPanelVisible: true,
  isEditing: false,
  isEditorOn: false,  // 폼 데이터 입력 과정을 나타내는 상태 추가
  isConfirming: false,
  hasChanges: false,
  originalitemdata: null,
  editNewitemdataSet: null,
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
export const saveitemdata = createAsyncThunk( // 액션 생성자자
  'rightSidebar/shop/saved',
  async (itemdata, { rejectWithValue }) => {
    try {
      // 여기에 실제 API 호출 코드가 들어갈 수 있습니다.
      // 예: const response = await api.saveitemdata(itemdata);
      
      // 저장 성공 시 데이터 반환
      return itemdata;
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
      const { editNewitemdataSet } = state.rightSidebar;

      // 섹션 이름 가져오기
      const sectionName = state.rightSidebar.formData.sectionName || '반월당';
      if (!sectionName) {
        console.error('지정된 sectionName이 없습니다');
        return rejectWithValue('섹션 이름이 지정되지 않았습니다');
      }
      
      // 편집된 데이터 유효성 검사
      if (!editNewitemdataSet) {
        console.error('편집된 데이터가 없습니다');
        return rejectWithValue('편집된 데이터가 없습니다');
      }
      
      // 새로운 통합 API 서비스 사용 (섹션명 포함)
      const datasetWithSection = {
        ...editNewitemdataSet,
        sectionName
      };
      
      // 새로운 통합 API 호출
      const response = await EditorServerServiceNew.updateItem(datasetWithSection, 'betaUser');
      
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

// 이미지 배열을 subImages에 추가하는 액션
export const addImagesToSubImages = createAction('rightSidebar/addImagesToSubImages');

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
      const { itemdata } = action.payload;
      
      // null 체크
      if (!itemdata) {
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
      state.originalitemdata = {
        ...protoServerDataset, // 기본값으로 모든 필드 확보
        ...JSON.parse(JSON.stringify(itemdata)) // 서버 데이터로 덮어쓰기
      };
      
      // 편집용 복사본 설정 (동일한 방식으로)
      state.editNewitemdataSet = {
        ...protoServerDataset, // 기본값으로 모든 필드 확보
        ...JSON.parse(JSON.stringify(itemdata)) // 서버 데이터로 덮어쓰기
      };
      
      
      // formData UI 표시용으로 변환 (특별 필드만 UI 표시 형식으로 변환)
      const uiFormData = JSON.parse(JSON.stringify(state.editNewitemdataSet));
      
      // pinCoordinates 필드 UI 표시용 처리
      if (uiFormData.pinCoordinates) {
        if (typeof uiFormData.pinCoordinates === 'object' && uiFormData.pinCoordinates !== null) {
          // 유효한 좌표 객체인 경우에만 "등록됨"으로 표시
          // Proxy 객체 처리를 위해 안전하게 값에 접근
          const getCoordValue = (coord, prop) => {
            if (!coord) return 0;
            try {
              return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
            } catch (e) {
              console.error(`좌표 값 접근 오류 (${prop}):`, e);
              return 0;
            }
          };
          
          const lat = getCoordValue(uiFormData.pinCoordinates, 'lat');
          const lng = getCoordValue(uiFormData.pinCoordinates, 'lng');
          
          const hasPinCoordinates = lat !== 0 || lng !== 0;
          uiFormData.pinCoordinates = hasPinCoordinates ? "등록됨" : "";
        } else { // 좌표가 문자열인 경우는 있을 수가 없다. 모든 객체 초기화시 protoServerDatasetlat, lng 객체로 처리중. 
          // 그 외 경우 빈 문자열로 초기화
          uiFormData.pinCoordinates = "";
        }
      } else {
        uiFormData.pinCoordinates = "";
      }
      
      // path 필드 UI 표시용 처리
      if (Array.isArray(uiFormData.path) && uiFormData.path.length > 0) {
        // 기본값 여부 확인 함수
        const isDefaultPath = (pathArray) => {
          // 배열이 비어있거나 없는 경우
          if (!pathArray || pathArray.length === 0) return true;
          
          // 배열에 하나의 요소만 있고 해당 요소가 기본값인 경우
          if (pathArray.length === 1) {
            const point = pathArray[0];
            if (!point) return true;
            
            // Proxy 객체 처리를 위해 안전하게 값에 접근
            const getCoordValue = (coord, prop) => {
              if (!coord) return 0;
              try {
                return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
              } catch (e) {
                console.error(`경로 좌표 값 접근 오류 (${prop}):`, e);
                return 0;
              }
            };
            
            const lat = getCoordValue(point, 'lat');
            const lng = getCoordValue(point, 'lng');
            
            return lat === 0 && lng === 0;
          }
          
          return false;
        };
        
        // 기본값이 아닌 경우에만 "등록됨"으로 표시
        uiFormData.path = isDefaultPath(uiFormData.path) ? "" : "등록됨";
      } else {
        uiFormData.path = "";
      }
      
      // pictureIcon 필드 UI 표시용 처리
      if (uiFormData.pictureIcon && typeof uiFormData.pictureIcon === 'string' && uiFormData.pictureIcon.trim() !== '') {
        uiFormData.pictureIcon = "등록됨";
      } else {
        uiFormData.pictureIcon = "";
      }
      
      // UI 표시용 formData 설정
      state.formData = uiFormData;
    },
    
    
    
    // 편집 완료 (이름 변경: completeEdit -> completeEditor)
    completeEditor: (state) => {
      // 에디터 모드 종료
      state.isEditorOn = false;
      
      // 확인 상태로 변경
      state.isConfirming = true;
      
      
      // 원본과 현재 값을 비교하여 변경사항 필터링
      const filteredModifiedFields = {};
      
      // originalitemdata의 모든 필드에 대해 비교
      Object.keys(state.originalitemdata).forEach(field => {
        const originalValue = state.originalitemdata[field];
        const currentValue = state.editNewitemdataSet[field];
        
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
          // Proxy 객체 처리를 위해 안전하게 값에 접근
          const getCoordValue = (coord, prop) => {
            if (!coord) return 0;
            // Proxy 객체 또는 일반 객체 모두 처리 가능하게
            try {
              return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
            } catch (e) {
              console.error(`좌표 값 접근 오류 (${prop}):`, e);
              return 0;
            }
          };
          
          const origLat = getCoordValue(originalValue, 'lat');
          const origLng = getCoordValue(originalValue, 'lng');
          const currLat = getCoordValue(currentValue, 'lat');
          const currLng = getCoordValue(currentValue, 'lng');
          
          // 두 좌표 모두 기본값(0,0)인지 확인
          const isOriginalDefault = origLat === 0 && origLng === 0;
          const isCurrentDefault = currLat === 0 && currLng === 0;
          
          console.log(`핀 좌표 값 비교: 원본=(${origLat},${origLng}), 현재=(${currLat},${currLng})`);
          
          if (isOriginalDefault && !isCurrentDefault) {
            // 기본값에서 실제 좌표로 변경된 경우
            isDifferent = true;
            console.log(`필드 ${field}: 기본값에서 실제 좌표로 변경됨`);
          } else if (isOriginalDefault && isCurrentDefault) {
            // 두 좌표 모두 기본값인 경우
            isDifferent = false;
            console.log(`필드 ${field}: 원본과 현재 값 모두 기본값 - 변경 없음으로 처리`);
          } else {
            // 일반적인 좌표 비교 (lat 또는 lng 값이 변경된 경우)
            isDifferent = origLat !== currLat || origLng !== currLng;
            console.log(`필드 ${field}: 좌표 비교 결과 - isDifferent=${isDifferent}`);
          }
        }
        // 배열 비교 특별 처리
        else if (Array.isArray(originalValue) && Array.isArray(currentValue)) {
          // path 필드 특별 처리 - 기본값([{ lat: 0, lng: 0 }]) 여부 확인
          if (field === 'path') {
            // 기본값 여부 확인 함수
            const isDefaultPath = (pathArray) => {
              // 배열이 비어있거나 없는 경우
              if (!pathArray || pathArray.length === 0) return true;
              
              // 배열에 하나의 요소만 있고 해당 요소가 기본값인 경우
              if (pathArray.length === 1) {
                const point = pathArray[0];
                if (!point) return true;
                
                // Proxy 객체 처리를 위해 안전하게 값에 접근
                const getCoordValue = (coord, prop) => {
                  if (!coord) return 0;
                  try {
                    return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                  } catch (e) {
                    console.error(`경로 좌표 값 접근 오류 (${prop}):`, e);
                    return 0;
                  }
                };
                
                const lat = getCoordValue(point, 'lat');
                const lng = getCoordValue(point, 'lng');
                
                return lat === 0 && lng === 0;
              }
              
              return false;
            };
            
            // 원본과 현재 값이 모두 기본값이면 변경되지 않은 것으로 간주
            if (isDefaultPath(originalValue) && isDefaultPath(currentValue)) {
              isDifferent = false;
              console.log(`필드 ${field}: 원본과 현재 값 모두 기본값 - 변경 없음으로 처리`);
            }
            // 원본이 기본값이고 현재 값이 실제 경로인 경우 (새로운 경로 추가)
            else if (isDefaultPath(originalValue) && !isDefaultPath(currentValue)) {
              isDifferent = true;
              console.log(`필드 ${field}: 기본값에서 실제 경로로 변경됨`);
            }
            // 그 외의 경우 일반적인 배열 비교 수행
            else {
              isDifferent = JSON.stringify(originalValue) !== JSON.stringify(currentValue);
              console.log(`필드 ${field}: 경로 비교 결과 - isDifferent=${isDifferent}`);
            }
          }
          // 일반 배열 필드 처리 (path 외의 필드)
          else {
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
        } 
        // 객체 비교 (pinCoordinates와 같은 좌표 객체를 위한 처리)
        else if (typeof originalValue === 'object' && originalValue !== null && 
                typeof currentValue === 'object' && currentValue !== null) {
          // pinCoordinates 필드 특별 처리 - 빈 좌표 여부 확인
          if (field === 'pinCoordinates') {
            // 빈 좌표 여부 확인 함수
            const isEmptyCoordinates = (coords) => {
              if (!coords || Object.keys(coords).length === 0) return true;
              
              // Proxy 객체 처리를 위해 안전하게 값에 접근
              const getCoordValue = (coord, prop) => {
                if (!coord) return 0;
                try {
                  return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                } catch (e) {
                  console.error(`좌표 값 접근 오류 (${prop}):`, e);
                  return 0;
                }
              };
              
              const lat = getCoordValue(coords, 'lat');
              const lng = getCoordValue(coords, 'lng');
              
              return lat === 0 && lng === 0;
            };
            
            // 원본과 현재 값이 모두 빈 좌표이면 변경되지 않은 것으로 간주
            if (isEmptyCoordinates(originalValue) && isEmptyCoordinates(currentValue)) {
              isDifferent = false;
              console.log(`필드 ${field}: 원본과 현재 값 모두 빈 좌표 - 변경 없음으로 처리`);
            }
            // 원본이 빈 좌표이고 현재 값이 실제 좌표인 경우 (새로운 좌표 추가)
            else if (isEmptyCoordinates(originalValue) && !isEmptyCoordinates(currentValue)) {
              isDifferent = true;
              console.log(`필드 ${field}: 빈 좌표에서 실제 좌표로 변경됨`);
            }
            // 그 외의 경우 일반적인 객체 비교 수행
            else {
              isDifferent = !isEqual(originalValue, currentValue);
              console.log(`필드 ${field}: 좌표 비교 결과 - isDifferent=${isDifferent}`);
            }
          }
          // 일반 객체 필드 처리 (pinCoordinates 외의 필드)
          else {
            // isEqual 함수를 사용하여 객체 깊은 비교
            isDifferent = !isEqual(originalValue, currentValue);
          }
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
      
      // formData를 editNewitemdataSet으로 업데이트 ?? 
      state.formData = JSON.parse(JSON.stringify(state.editNewitemdataSet));
      
      // 변경 상태 설정
      state.hasChanges = hasChanges;
    },
    
    // 편집 취소
    cancelEdit: (state) => {
      // 원본 데이터가 있으면 그것을 사용, 없으면 protoServerDataset 사용
      const baseData = state.originalitemdata || { ...protoServerDataset };
      
      // 원본 데이터로 복원 (깊은 복사)
      const restoredData = JSON.parse(JSON.stringify(baseData));
      
      // editNewitemdataSet을 null 대신 초기 상태(protoServerDataset)로 설정
      state.editNewitemdataSet = { ...protoServerDataset };
      
      // formData를 UI 표시에 적합하게 변환 - updateFormDataFromShop 함수 사용
      state.formData = updateFormDataFromShop(restoredData, {});
      
      // 수정 필드 목록 초기화
      state.modifiedFields = {};
      
      // 모든 편집 관련 상태 명확히 리셋
      state.isEditorOn = false;
      state.isConfirming = false;
      
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
      if (!state.originalitemdata || !state.editNewitemdataSet) {
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
      if (!state.editNewitemdataSet) {
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
      state.originalitemdata = null;
      state.editNewitemdataSet = null;
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
        
        // 새로운 editNewitemdataSet 업데이트
        if (state.editNewitemdataSet) {
          let originalValue;
          
          // 원본 값 가져오기
          if (state.originalitemdata) {
            originalValue = state.originalitemdata[field];
          }
          
          // 변경사항 추적을 위해 원본 값과 비교
          let isDifferent = false;
          
          // 배열 비교 특별 처리
          if (Array.isArray(originalValue) && Array.isArray(value)) {
            // path 필드 특별 처리 - 기본값([{ lat: 0, lng: 0 }]) 여부 확인
            if (field === 'path') {
              // 기본값 여부 확인 함수
              const isDefaultPath = (pathArray) => {
                // 배열이 비어있거나 없는 경우
                if (!pathArray || pathArray.length === 0) return true;
                
                // 배열에 하나의 요소만 있고 해당 요소가 기본값인 경우
                if (pathArray.length === 1) {
                  const point = pathArray[0];
                  if (!point) return true;
                  
                  // Proxy 객체 처리를 위해 안전하게 값에 접근
                  const getCoordValue = (coord, prop) => {
                    if (!coord) return 0;
                    try {
                      return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                    } catch (e) {
                      console.error(`경로 좌표 값 접근 오류 (${prop}):`, e);
                      return 0;
                    }
                  };
                  
                  const lat = getCoordValue(point, 'lat');
                  const lng = getCoordValue(point, 'lng');
                  
                  return lat === 0 && lng === 0;
                }
                
                return false;
              };
              
              // 원본과 현재 값이 모두 기본값이면 변경되지 않은 것으로 간주
              if (isDefaultPath(originalValue) && isDefaultPath(value)) {
                isDifferent = false;
                console.log(`필드 ${field}: 원본과 현재 값 모두 기본값 - 변경 없음으로 처리`);
              }
              // 원본이 기본값이고 현재 값이 실제 경로인 경우 (새로운 경로 추가)
              else if (isDefaultPath(originalValue) && !isDefaultPath(value)) {
                isDifferent = true;
                console.log(`필드 ${field}: 기본값에서 실제 경로로 변경됨`);
              }
              // 그 외의 경우 일반적인 배열 비교 수행
              else {
                isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
                console.log(`필드 ${field}: 경로 비교 결과 - isDifferent=${isDifferent}`);
              }
            }
            // 일반 배열 필드 처리 (path 외의 필드)
            else {
              // JSON 문자열로 변환하여 비교 (깊은 비교)
              isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
            }
          } 
          // 객체 비교 (pinCoordinates와 같은 좌표 객체를 위한 처리)
          else if (typeof originalValue === 'object' && originalValue !== null && 
                  typeof value === 'object' && value !== null) {
            // pinCoordinates 필드 특별 처리 - 빈 좌표 여부 확인
            if (field === 'pinCoordinates') {
              // 빈 좌표 여부 확인 함수
              const isEmptyCoordinates = (coords) => {
                if (!coords || Object.keys(coords).length === 0) return true;
                
                // Proxy 객체 처리를 위해 안전하게 값에 접근
                const getCoordValue = (coord, prop) => {
                  if (!coord) return 0;
                  try {
                    return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                  } catch (e) {
                    console.error(`좌표 값 접근 오류 (${prop}):`, e);
                    return 0;
                  }
                };
                
                const lat = getCoordValue(coords, 'lat');
                const lng = getCoordValue(coords, 'lng');
                
                return lat === 0 && lng === 0;
              };
              
              // 원본과 현재 값이 모두 빈 좌표이면 변경되지 않은 것으로 간주
              if (isEmptyCoordinates(originalValue) && isEmptyCoordinates(value)) {
                isDifferent = false;
                console.log(`필드 ${field}: 원본과 현재 값 모두 빈 좌표 - 변경 없음으로 처리`);
              }
              // 원본이 빈 좌표이고 현재 값이 실제 좌표인 경우 (새로운 좌표 추가)
              else if (isEmptyCoordinates(originalValue) && !isEmptyCoordinates(value)) {
                isDifferent = true;
                console.log(`필드 ${field}: 빈 좌표에서 실제 좌표로 변경됨`);
              }
              // 그 외의 경우 일반적인 객체 비교 수행
              else {
                isDifferent = !isEqual(originalValue, value);
                console.log(`필드 ${field}: 좌표 비교 결과 - isDifferent=${isDifferent}`);
              }
            }
            // 일반 객체 필드 처리 (pinCoordinates 외의 필드)
            else {
              // isEqual 함수를 사용하여 객체 깊은 비교
              isDifferent = !isEqual(originalValue, value);
            }
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
          state.editNewitemdataSet[field] = value;
          
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
        
        // editNewitemdataSet도 함께 업데이트 (단일 경로 보장)
        if (state.editNewitemdataSet) {
          Object.entries(formUpdates).forEach(([field, value]) => {
            // 수정값 추적
            if (state.originalitemdata) {
              const originalValue = state.originalitemdata[field];
              
              let isDifferent = false;
              
              // 배열 비교 특별 처리
              if (Array.isArray(originalValue) && Array.isArray(value)) {
                // path 필드 특별 처리 - 기본값([{ lat: 0, lng: 0 }]) 여부 확인
                if (field === 'path') {
                  // 기본값 여부 확인 함수
                  const isDefaultPath = (pathArray) => {
                    // 배열이 비어있거나 없는 경우
                    if (!pathArray || pathArray.length === 0) return true;
                    
                    // 배열에 하나의 요소만 있고 해당 요소가 기본값인 경우
                    if (pathArray.length === 1) {
                      const point = pathArray[0];
                      if (!point) return true;
                      
                      // Proxy 객체 처리를 위해 안전하게 값에 접근
                      const getCoordValue = (coord, prop) => {
                        if (!coord) return 0;
                        try {
                          return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                        } catch (e) {
                          console.error(`경로 좌표 값 접근 오류 (${prop}):`, e);
                          return 0;
                        }
                      };
                      
                      const lat = getCoordValue(point, 'lat');
                      const lng = getCoordValue(point, 'lng');
                      
                      return lat === 0 && lng === 0;
                    }
                    
                    return false;
                  };
                  
                  // 원본과 현재 값이 모두 기본값이면 변경되지 않은 것으로 간주
                  if (isDefaultPath(originalValue) && isDefaultPath(value)) {
                    isDifferent = false;
                    console.log(`필드 ${field}: 원본과 현재 값 모두 기본값 - 변경 없음으로 처리`);
                  }
                  // 원본이 기본값이고 현재 값이 실제 경로인 경우 (새로운 경로 추가)
                  else if (isDefaultPath(originalValue) && !isDefaultPath(value)) {
                    isDifferent = true;
                    console.log(`필드 ${field}: 기본값에서 실제 경로로 변경됨`);
                  }
                  // 그 외의 경우 일반적인 배열 비교 수행
                  else {
                    isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
                    console.log(`필드 ${field}: 경로 비교 결과 - isDifferent=${isDifferent}`);
                  }
                }
                // 일반 배열 필드 처리 (path 외의 필드)
                else {
                  // JSON 문자열로 변환하여 비교 (깊은 비교)
                  isDifferent = JSON.stringify(originalValue) !== JSON.stringify(value);
                }
              } 
              // 객체 비교 (pinCoordinates와 같은 좌표 객체를 위한 처리)
              else if (typeof originalValue === 'object' && originalValue !== null && 
                      typeof value === 'object' && value !== null) {
                // pinCoordinates 필드 특별 처리 - 빈 좌표 여부 확인
                if (field === 'pinCoordinates') {
                  // 빈 좌표 여부 확인 함수
                  const isEmptyCoordinates = (coords) => {
                    if (!coords || Object.keys(coords).length === 0) return true;
                    
                    // Proxy 객체 처리를 위해 안전하게 값에 접근
                    const getCoordValue = (coord, prop) => {
                      if (!coord) return 0;
                      try {
                        return typeof coord[prop] === 'function' ? coord[prop]() : (coord[prop] || 0);
                      } catch (e) {
                        console.error(`좌표 값 접근 오류 (${prop}):`, e);
                        return 0;
                      }
                    };
                    
                    const lat = getCoordValue(coords, 'lat');
                    const lng = getCoordValue(coords, 'lng');
                    
                    return lat === 0 && lng === 0;
                  };
                  
                  // 원본과 현재 값이 모두 빈 좌표이면 변경되지 않은 것으로 간주
                  if (isEmptyCoordinates(originalValue) && isEmptyCoordinates(value)) {
                    isDifferent = false;
                    console.log(`필드 ${field}: 원본과 현재 값 모두 빈 좌표 - 변경 없음으로 처리`);
                  }
                  // 원본이 빈 좌표이고 현재 값이 실제 좌표인 경우 (새로운 좌표 추가)
                  else if (isEmptyCoordinates(originalValue) && !isEmptyCoordinates(value)) {
                    isDifferent = true;
                    console.log(`필드 ${field}: 빈 좌표에서 실제 좌표로 변경됨`);
                  }
                  // 그 외의 경우 일반적인 객체 비교 수행
                  else {
                    isDifferent = !isEqual(originalValue, value);
                    console.log(`필드 ${field}: 좌표 비교 결과 - isDifferent=${isDifferent}`);
                  }
                }
                // 일반 객체 필드 처리 (pinCoordinates 외의 필드)
                else {
                  // isEqual 함수를 사용하여 객체 깊은 비교
                  isDifferent = !isEqual(originalValue, value);
                }
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
            state.editNewitemdataSet[field] = value;
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
      if (state.isEditing ) { // 에디트 종료는 confirm까지 종료 이후 
        return;
      }
      
      
      // itemdata가 null인 경우에도 명시적 처리
      if (!action.payload || action.payload.itemdata === undefined) {
        // IDLE 상태로 설정하고 폼 데이터 초기화
        state.isIdle = true;
        state.formData = updateFormDataFromShop(null, {});
        return;
      }
    
      try {
        // 직접 데이터 사용 (protoServerDataset 구조)
        const itemdata = action.payload.itemdata;
        
        // IDLE 상태일 때만 폼 데이터 업데이트하도록 수정
        if (state.isIdle || (!state.isEditing && !state.isConfirming)) {
          // 여기서 폼 데이터 업데이트 (Editor 컴포넌트의 updateFormDataFromShop 로직 대체)
          state.formData = updateFormDataFromShop(itemdata, state.formData);
        }
        
        // 데이터가 있는 경우에만 IDLE 상태 해제
        if (itemdata) {
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
      state.originalitemdata = { ...protoServerDataset };
      state.editNewitemdataSet = { ...protoServerDataset };
      
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
      if (!state.isEditing || !state.editNewitemdataSet) {
        return;
      }
      
      if (type === 'MARKER') {
        // 1. 내부 데이터 저장 - 객체 형태 그대로 유지
        state.editNewitemdataSet.pinCoordinates = coordinates;
        
        // 2. UI 표시용 데이터 - 문자열로 변환
        state.formData.pinCoordinates = "등록됨";
        
        // 디버깅용 출력
        console.log('updateCoordinates - MARKER 업데이트:', coordinates);
        console.log('updateCoordinates 후 editNewitemdataSet.pinCoordinates:', 
                    typeof state.editNewitemdataSet.pinCoordinates, 
                    state.editNewitemdataSet.pinCoordinates);
        
        // 3. 필드 변경 추적
        state.modifiedFields.pinCoordinates = true;
        
        // 4. hasChanges 상태 업데이트 - 변경사항 있음으로 표시
        state.hasChanges = true;
      } else if (type === 'POLYGON') {
        // 1. 내부 데이터 저장 - 객체 배열 형태 그대로 유지
        state.editNewitemdataSet.path = coordinates;
        
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
      // 기존 saveitemdata reducer
      .addCase(saveitemdata.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(saveitemdata.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // 원본 데이터는 유지하고 업데이트하지 않음
        
        // 확인 모드 해제
        state.isConfirming = false;
        state.hasChanges = false;
        state.modifiedFields = {};
      })
      .addCase(saveitemdata.rejected, (state, action) => {
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
      })
      
      // addImagesToSubImages 액션 핸들러 추가
      .addCase(addImagesToSubImages, (state, action) => {
        const imagesToAdd = action.payload;
        
        // 유효성 검사
        if (!imagesToAdd || !Array.isArray(imagesToAdd) || imagesToAdd.length === 0) {
          return;
        }

        if ( ! state.isEditing ) {
          return;
        }
        
        // 현재 subImages 배열 가져오기
        const currentSubImages = Array.isArray(state.formData.subImages) ? 
          [...state.formData.subImages] : [];
        
        // 이미 존재하는 이미지는 추가하지 않도록 필터링
        const newImages = imagesToAdd.filter(img => 
          img && typeof img === 'string' && img.trim() !== '' && !currentSubImages.includes(img)
        );
        
        // 추가할 새 이미지가 없으면 return
        if (newImages.length === 0) {
          return;
        }
        
        // 새로 선택된 이미지를 기존 배열에 추가 (빈 문자열 요소 필터링)
        const updatedSubImages = [
          ...currentSubImages.filter(img => img && img.trim() !== ''), 
          ...newImages
        ];
        
        // UI 표시용 formData 업데이트
        state.formData.subImages = updatedSubImages;
        
        // 내부 데이터 업데이트 (편집 중인 경우)
        
        state.editNewitemdataSet.subImages = updatedSubImages;
        
        // 변경된 필드 추적
        state.modifiedFields.subImages = true;
        state.hasChanges = true;
        
        
        // changedFields 추적
        if (!state.changedFieldsList.includes('subImages')) {
          state.changedFieldsList.push('subImages');
        }
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
export const selectOriginalitemdata = (state) => state.rightSidebar.originalitemdata;
export const selectEditNewitemdataSet = (state) => state.rightSidebar.editNewitemdataSet;
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
  // 새 액션 추가
} = rightSidebarSlice.actions;

export default rightSidebarSlice.reducer; 