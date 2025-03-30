import { configureStore } from '@reduxjs/toolkit';
import rightSidebarReducer from './slices/rightSidebarSlice';
import compareBarReducer from './slices/compareBarSlice';
import imageManagerReducer from './slices/imageManagerSlice';

// Redux 스토어 구성
export const store = configureStore({
  reducer: {
    rightSidebar: rightSidebarReducer,
    compareBar: compareBarReducer,
    imageManager: imageManagerReducer
  },
  // 개발 환경에서만 Redux DevTools 활성화
  devTools: process.env.NODE_ENV !== 'production',
});

export default store; 