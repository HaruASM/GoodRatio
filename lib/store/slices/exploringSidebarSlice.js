import { createSlice } from '@reduxjs/toolkit';

// 초기 상태 정의
const initialState = {
  // 하이라이트된 아이템 ID
  highlightedItemId: null,
  // 사이드바 가시성 상태
  isSidebarVisible: true,
};

const exploringSidebarSlice = createSlice({
  name: 'exploringSidebar',
  initialState,
  reducers: {
    // 아이템 하이라이트 액션
    highlightItem: (state, action) => {
      state.highlightedItemId = action.payload;
    },
    
    // 하이라이트 초기화 액션
    clearHighlight: (state) => {
      state.highlightedItemId = null;
    },
    
    // 사이드바 가시성 토글 액션
    toggleSidebarVisibility: (state) => {
      state.isSidebarVisible = !state.isSidebarVisible;
    },
    
    // 사이드바 가시성 설정 액션
    setSidebarVisibility: (state, action) => {
      state.isSidebarVisible = action.payload;
    }
  }
});

// 액션 생성자 export
export const {
  highlightItem,
  clearHighlight,
  toggleSidebarVisibility,
  setSidebarVisibility
} = exploringSidebarSlice.actions;

// 셀렉터 함수 export
export const selectHighlightedItemId = (state) => state.exploringSidebar.highlightedItemId;
export const selectIsSidebarVisible = (state) => state.exploringSidebar.isSidebarVisible;

// 리듀서 export
export default exploringSidebarSlice.reducer; 