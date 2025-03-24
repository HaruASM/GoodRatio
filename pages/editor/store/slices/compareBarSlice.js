import { createSlice } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../dataModels';

const initialState = {
  isActiveCompareBar: false,
  selectedCompareBarData: { ...protoServerDataset },
  isSyncGoogleSearchCompareBar: false // true이면 구글 검색폼 검색시 setCompareBarActive가 호출됨됨
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
      state.selectedCompareBarData = { ...protoServerDataset };

    }
  }
}); 

// 액션 생성자 내보내기
export const {
  setCompareBarActive,
  setSyncGoogleSearch,
  endCompareBar,
} = compareBarSlice.actions;

// 선택자 함수
export const selectIsCompareBarActive = (state) => state.compareBar.isActiveCompareBar;
export const selectCompareBarData = (state) => state.compareBar.selectedCompareBarData;
export const selectisSyncGoogleSearchCompareBar = (state) => state.compareBar.isSyncGoogleSearchCompareBar;

export default compareBarSlice.reducer; 