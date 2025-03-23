import { configureStore } from '@reduxjs/toolkit';
import rightSidebarReducer from './slices/rightSidebarSlice';
import compareBarReducer from './slices/compareBarSlice';

// Redux 스토어 구성
const store = configureStore({
  reducer: {
    rightSidebar: rightSidebarReducer,
    compareBar: compareBarReducer
  },
  // 개발 환경에서만 Redux DevTools 활성화
  devTools: process.env.NODE_ENV !== 'production',
});

export default store; 