// Redux 툴킷 및 미들웨어 가져오기
import { configureStore } from '@reduxjs/toolkit';
import { createWrapper } from 'next-redux-wrapper';
import rightSidebarReducer from './slices/rightSidebarSlice';
import compareBarReducer from './slices/compareBarSlice';
import imageManagerReducer from './slices/imageManagerSlice';

// HYDRATE 액션을 위한 루트 리듀서
import { combineReducers } from '@reduxjs/toolkit';

// 리듀서 결합
const combinedReducer = combineReducers({
  rightSidebar: rightSidebarReducer,
  compareBar: compareBarReducer,
  imageManager: imageManagerReducer
});

// HYDRATE 액션 처리를 위한 루트 리듀서
const rootReducer = (state, action) => {
  if (action.type === 'HYDRATE') {
    return {
      ...state, // 기존 클라이언트 상태 유지
      ...action.payload // 서버에서 받은 상태 적용
    };
  }
  return combinedReducer(state, action);
};

// 스토어 생성 함수
const makeStore = () => 
  configureStore({
    reducer: rootReducer,
    devTools: process.env.NODE_ENV !== 'production',
  });

// next-redux-wrapper로 스토어 래핑
export const wrapper = createWrapper(makeStore);

// 기존 코드와의 호환성을 위해 스토어 직접 내보내기
const store = makeStore();
export default store; 