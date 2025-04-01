import { createSlice } from '@reduxjs/toolkit';

// 초기 상태 정의
const initialState = {
  isOpen: false,           // 갤러리 열림 상태
  images: [],              // 갤러리에 표시할 이미지 배열
  currentIndex: 0,         // 현재 선택된 이미지 인덱스
  source: '',              // 갤러리 호출 출처 (선택적)
};

// 이미지 갤러리 슬라이스 생성
const imageGallerySlice = createSlice({
  name: 'imageGallery',
  initialState,
  reducers: {
    // 갤러리 열기
    openGallery: (state, action) => {
      // payload에서 필요한 값 추출
      const { images, index = 0, source = '' } = action.payload;
      
      // 상태 업데이트
      state.isOpen = true;
      state.images = Array.isArray(images) ? images : [];
      state.currentIndex = index;
      state.source = source;
    },
    
    // 갤러리 닫기
    closeGallery: (state) => {
      state.isOpen = false;
      state.currentIndex = 0;
      // images 배열은 유지하거나 초기화할 수 있음
      // 초기화하면 메모리 사용이 줄지만, 다시 열 때 새로 로드해야 함
      state.images = [];
    },
    
    // 이전 이미지로 이동
    prevImage: (state) => {
      if (state.images.length <= 1) return;
      
      state.currentIndex = state.currentIndex <= 0 
        ? state.images.length - 1 
        : state.currentIndex - 1;
    },
    
    // 다음 이미지로 이동
    nextImage: (state) => {
      if (state.images.length <= 1) return;
      
      state.currentIndex = state.currentIndex >= state.images.length - 1 
        ? 0 
        : state.currentIndex + 1;
    },
    
    // 특정 이미지로 이동
    goToImage: (state, action) => {
      const { index } = action.payload;
      
      // 인덱스가 유효 범위 내에 있는지 확인
      if (index >= 0 && index < state.images.length) {
        state.currentIndex = index;
      }
    }
  }
});

// 액션 생성자 내보내기
export const { 
  openGallery, 
  closeGallery, 
  prevImage, 
  nextImage, 
  goToImage 
} = imageGallerySlice.actions;

// 선택자 함수 내보내기
export const selectIsGalleryOpen = (state) => state.imageGallery.isOpen;
export const selectGalleryImages = (state) => state.imageGallery.images;
export const selectCurrentImageIndex = (state) => state.imageGallery.currentIndex;
export const selectCurrentImage = (state) => {
  const { images, currentIndex } = state.imageGallery;
  return images[currentIndex] || null;
};
export const selectGallerySource = (state) => state.imageGallery.source;

// 리듀서 내보내기
export default imageGallerySlice.reducer; 