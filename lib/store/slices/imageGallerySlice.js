import { createSlice } from '@reduxjs/toolkit';

// 초기 상태 정의 - 통합된 상태
const initialState = {
  // 이미지 확인 갤러리 상태
  gallery: {
    isOpen: false,           // 갤러리 열림 상태
    images: [],              // 갤러리에 표시할 이미지 배열
    currentIndex: 0,         // 현재 선택된 이미지 인덱스
    source: '',              // 갤러리 호출 출처 (선택적)
  },
  
  // 이미지 선택 갤러리 상태
  selection: {
    isActive: false,         // 선택 모드 활성화 상태
    images: [],              // 선택 가능한 이미지 배열
    selectedImages: [],      // 선택된 이미지 ID 배열
    section: null,           // 선택 관련 섹션 정보
  },
  
  // 이미지 순서 편집 갤러리 상태
  orderEditor: {
    isOpen: false,           // 순서 편집기 열림 상태
    imagesToEdit: [],        // 편집할 이미지 배열
  }
};

// 통합된 이미지 갤러리 슬라이스 생성
const imageGallerySlice = createSlice({
  name: 'imageGallery',
  initialState,
  reducers: {
    // === 이미지 확인 갤러리 액션 ===
    
    // 갤러리 열기
    openGallery: (state, action) => {
      // payload에서 필요한 값 추출
      const { images, index = 0, source = '' } = action.payload;
      
      // 상태 업데이트
      state.gallery.isOpen = true;
      state.gallery.images = Array.isArray(images) ? images : [];
      state.gallery.currentIndex = index;
      state.gallery.source = source;
    },
    
    // 갤러리 닫기
    closeGallery: (state) => {
      state.gallery.isOpen = false;
      state.gallery.currentIndex = 0;
      state.gallery.images = [];
    },
    
    // 이전 이미지로 이동
    prevImage: (state) => {
      if (state.gallery.images.length <= 1) return;
      
      state.gallery.currentIndex = state.gallery.currentIndex <= 0 
        ? state.gallery.images.length - 1 
        : state.gallery.currentIndex - 1;
    },
    
    // 다음 이미지로 이동
    nextImage: (state) => {
      if (state.gallery.images.length <= 1) return;
      
      state.gallery.currentIndex = state.gallery.currentIndex >= state.gallery.images.length - 1 
        ? 0 
        : state.gallery.currentIndex + 1;
    },
    
    // 특정 이미지로 이동
    goToImage: (state, action) => {
      const { index } = action.payload;
      
      // 인덱스가 유효 범위 내에 있는지 확인
      if (index >= 0 && index < state.gallery.images.length) {
        state.gallery.currentIndex = index;
      }
    },
    
    // === 이미지 선택 갤러리 액션 ===
    
    // 이미지 선택 모드 열기
    openImageSelectionMode: (state, action) => {
      console.log('openImageSelectionMode is called 2');
      // payload에서 필요한 값 추출
      const { images } = action.payload;
      console.log('openImageSelectionMode', images );
      // 상태 업데이트
      state.selection.isActive = true;
      state.selection.selectedImages = [];
      state.selection.images = Array.isArray(images) ? images : [];
    },
    
    // 이미지 선택 모드 닫기
    closeImageSelectionMode: (state) => {
      state.selection.isActive = false;
      state.selection.images = [];
      state.selection.selectedImages = [];
      
    },
    
    // 이미지 선택 토글
    toggleImageSelection: (state, action) => {
      const { imageId } = action.payload || {};
      
      if (!imageId) return;
      
      const imageIndex = state.selection.selectedImages.indexOf(imageId);
      
      if (imageIndex === -1) {
        // 이미지가 선택되지 않은 경우 추가
        state.selection.selectedImages.push(imageId);
      } else {
        // 이미지가 이미 선택된 경우 제거
        state.selection.selectedImages.splice(imageIndex, 1);
      }
    },
    
    // 이미지 선택 확인
    confirmImageSelection: (state) => {
      state.selection.isActive = false;
    },
    
    // 이미지 선택 초기화
    resetImageSelection: (state) => {
      state.selection.selectedImages = [];
    },
    
    // === 이미지 순서 편집 갤러리 액션 ===
    
    // 이미지 순서 편집기 열기
    openImageOrderEditor: (state, action) => {
      const { images } = action.payload;
      
      if (Array.isArray(images) && images.length > 0) {
        state.orderEditor.isOpen = true;
        state.orderEditor.imagesToEdit = images;
      }
    },
    
    // 이미지 순서 편집기 닫기
    closeImageOrderEditor: (state) => {
      state.orderEditor.isOpen = false;
      state.orderEditor.imagesToEdit = [];
    },
    
    // 이미지 순서 업데이트
    updateImageOrder: (state, action) => {
      const { images } = action.payload || {};
      
      if (Array.isArray(images)) {
        state.orderEditor.imagesToEdit = images;
      }
    },
    
    // 이미지 순서 확인
    confirmImageOrder: (state) => {
      state.orderEditor.isOpen = false;
    },
  }
});

// 액션 생성자 내보내기
export const { 
  // 이미지 확인 갤러리 액션
  openGallery, 
  closeGallery, 
  prevImage, 
  nextImage, 
  goToImage,
  
  // 이미지 선택 갤러리 액션
  openImageSelectionMode,
  closeImageSelectionMode,
  toggleImageSelection,
  confirmImageSelection,
  resetImageSelection,
  
  // 이미지 순서 편집 갤러리 액션
  openImageOrderEditor,
  closeImageOrderEditor,
  updateImageOrder,
  confirmImageOrder
} = imageGallerySlice.actions;

// 선택자 함수 내보내기 - 이미지 확인 갤러리
export const selectIsGalleryOpen = (state) => state.imageGallery.gallery.isOpen;
export const selectGalleryImages = (state) => state.imageGallery.gallery.images;
export const selectCurrentImageIndex = (state) => state.imageGallery.gallery.currentIndex;
export const selectCurrentImage = (state) => {
  const { images, currentIndex } = state.imageGallery.gallery;
  return images[currentIndex] || null;
};
export const selectGallerySource = (state) => state.imageGallery.gallery.source;

// 선택자 함수 내보내기 - 이미지 선택 갤러리
export const selectIsImageSelectionMode = (state) => state.imageGallery.selection.isActive;
export const selectImages = (state) => state.imageGallery.selection.images;
export const selectSelectedImages = (state) => state.imageGallery.selection.selectedImages;

// 선택자 함수 내보내기 - 이미지 순서 편집 갤러리
export const selectIsImageOrderEditorMode = (state) => state.imageGallery.orderEditor.isOpen;
export const selectImagesToEdit = (state) => state.imageGallery.orderEditor.imagesToEdit;

// 리듀서 내보내기
export default imageGallerySlice.reducer; 