import { createSlice } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../../lib/models/editorModels';

const initialState = {
  isActiveCompareBar: false,
  selectedCompareBarData: { ...protoServerDataset },
  isSyncGoogleSearchCompareBar: false, // true이면 구글 검색폼 검색시 setCompareBarActive가 호출됨됨
  isInserting: false // 삽입 모드 상태 추가
};

const compareBarSlice = createSlice({
  name: 'compareBar',
  initialState,
  reducers: {
    // protoServerDataSet객체를 넘겨받아, comparBar에 출력함. //1회성 출력. begin액션 없음
    setCompareBarActive: (state, action) => {
      
      if (action.payload) {
        // comparBar에 출력할 데이터형은 protoServerDataSet 
        state.selectedCompareBarData = { ...action.payload };
      } else { 
        state.selectedCompareBarData = { ...protoServerDataset };
      }
      
      if (state.isActiveCompareBar === false )  state.isActiveCompareBar = true;
    },

    // 구글 검색 동기화 상태 설정
    setSyncGoogleSearch: (state) => {
      state.isSyncGoogleSearchCompareBar = true; // 구글 검색폼 검색시 setCompareBarActive가 호출됨됨
    },

    endCompareBar: (state) => {
      state.isActiveCompareBar = false; 
      state.isSyncGoogleSearchCompareBar = false;
      state.isInserting = false; // 삽입 모드도 초기화
      state.selectedCompareBarData = { ...protoServerDataset };
    },
    
    // 삽입 모드 시작 액션 수정 - rightSidebar 편집 모드 활성화 위한 속성 업데이트
    beginInserting: (state) => {
      state.isInserting = true;
      state.isSyncGoogleSearchCompareBar = false; // 구글 검색 동기화 비활성화
      // 실제 rightSidebar의 startEdit과 beginEditor는 thunk 액션에서 호출
    },
    
    // 삽입 모드 종료 액션 추가 //endCompareBar와 동일한 로직이라서, endCompareBar를 사용중 
    endInserting: (state) => { 
      state.isInserting = false;
      state.isSyncGoogleSearchCompareBar = true;
    }
  }
}); 

// 액션 생성자 내보내기
export const {
  setCompareBarActive,
  setSyncGoogleSearch,
  endCompareBar,
  beginInserting,
  endInserting
} = compareBarSlice.actions;

// 선택자 함수
export const selectIsCompareBarActive = (state) => state.compareBar.isActiveCompareBar;
export const selectCompareBarData = (state) => state.compareBar.selectedCompareBarData;
export const selectisSyncGoogleSearchCompareBar = (state) => state.compareBar.isSyncGoogleSearchCompareBar;
export const selectIsInserting = (state) => state.compareBar.isInserting;

export default compareBarSlice.reducer; 