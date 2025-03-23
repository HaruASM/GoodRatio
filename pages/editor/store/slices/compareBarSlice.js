import { createSlice } from '@reduxjs/toolkit';
import { protoServerDataset } from '../../dataModels';

const initialState = {
  isActiveCompareBar: true, // FIXME 추후 false 초기화 
  selectedCompareBarData: { ...protoServerDataset },
  isSyncGoogleSearch: false
};

const compareBarSlice = createSlice({
  name: 'compareBar',
  initialState,
  reducers: {
    // protoServerDataSet객체를 넘겨받아, comparBar에 출력함. 
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
      state.isSyncGoogleSearch = true;
    },

    endCompareBar: (state) => {
      state.isActiveCompareBar = false; 
      state.isSyncGoogleSearch = false;
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
export const selectIsSyncGoogleSearch = (state) => state.compareBar.isSyncGoogleSearch;

export default compareBarSlice.reducer; 