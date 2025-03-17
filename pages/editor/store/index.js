import { configureStore } from '@reduxjs/toolkit';
import rightSidebarReducer from './slices/rightSidebarSlice';

// Redux 스토어 구성
const store = configureStore({
  reducer: {
    rightSidebar: rightSidebarReducer,
    // 추후 다른 리듀서들을 여기에 추가할 수 있습니다.
  },
  // 개발 환경에서만 Redux DevTools 활성화
  devTools: process.env.NODE_ENV !== 'production',
});

export default store; 