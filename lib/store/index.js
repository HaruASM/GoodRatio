// Redux 툴킷 및 미들웨어 가져오기
import { configureStore } from '@reduxjs/toolkit';
import { createWrapper, HYDRATE } from 'next-redux-wrapper';
import rightSidebarReducer from './slices/rightSidebarSlice';
import compareBarReducer from './slices/compareBarSlice';
import imageManagerReducer from './slices/imageManagerSlice';
import imageGalleryReducer from './slices/imageGallerySlice';
import mapEventReducer from './slices/mapEventSlice';

// HYDRATE 액션을 위한 루트 리듀서
import { combineReducers } from '@reduxjs/toolkit';

// 리듀서 결합
const combinedReducer = combineReducers({
  rightSidebar: rightSidebarReducer,
  compareBar: compareBarReducer,
  imageManager: imageManagerReducer,
  imageGallery: imageGalleryReducer,
  mapEvent: mapEventReducer
});

// HYDRATE 액션 처리를 위한 루트 리듀서
const rootReducer = (state, action) => {
  if (action.type === HYDRATE) {
        
    const nextState = {
      ...state, // 기존 클라이언트 상태 유지
      // 서버 상태에서 특정 필드 병합
      compareBar: {
        ...state?.compareBar,
        ...action.payload?.compareBar,
        // 이 필드들이 확실히 유지되도록 명시적으로 설정
        isSyncGoogleSearchCompareBar: action.payload?.compareBar?.isSyncGoogleSearchCompareBar || state?.compareBar?.isSyncGoogleSearchCompareBar || false,
        isActiveCompareBar: action.payload?.compareBar?.isActiveCompareBar || state?.compareBar?.isActiveCompareBar || false
      }
    };
    
    return nextState;
  }
  return combinedReducer(state, action);
};

// 스토어 싱글톤 인스턴스 변수
let storeInstance;

// 스토어 생성 함수
export const makeStore = (context) => {
  const isServer = typeof window === 'undefined';
  
  // 서버사이드에서는 매번 새 스토어 생성
  if (isServer) {
    return configureStore({
      reducer: rootReducer,
      devTools: process.env.NODE_ENV !== 'production',
    });
  }
  
  // 클라이언트에서는 싱글톤 스토어 사용
  if (!storeInstance) {
    storeInstance = configureStore({
      reducer: rootReducer,
      devTools: process.env.NODE_ENV !== 'production',
    });
  }
  
  return storeInstance;
};

// next-redux-wrapper로 스토어 래핑
export const wrapper = createWrapper(makeStore, { debug: process.env.NODE_ENV !== 'production' });

// 클라이언트에서 사용할 스토어 인스턴스
const store = typeof window === 'undefined' ? makeStore() : makeStore();

// 스토어 내보내기
export default store; 