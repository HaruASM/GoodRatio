import { createSlice } from '@reduxjs/toolkit';

// 초기 상태
const initialState = {
  isSelectionMode: false,
  isOrderEditorOpen: false,
  isGalleryOpen: false,
  selectedImages: [],
  images: [], // 단일 이미지 배열로 변경
  galleryImages: [],
  galleryIndex: 0,
  section: null,
  imagesToEdit: [],
};

const imageManagerSlice = createSlice({
  name: 'imageManager',
  initialState,
  reducers: {
    // 이미지 선택 모드 열기
    openImageSelectionMode: (state, action) => {
      // 단일 이미지 배열만 받도록 수정
      const { images, section } = action.payload;
      
      state.isSelectionMode = true;
      state.selectedImages = [];
      state.section = section || null;
      state.images = Array.isArray(images) ? images : [];
    },
    
    // 이미지 선택 모드 닫기
    closeImageSelectionMode: (state) => {
      state.isSelectionMode = false;
      state.images = [];
      state.selectedImages = [];
      state.section = null;
    },
    
    // 이미지 순서 편집기 열기
    openImageOrderEditor: (state, action) => {
      // 단일 이미지 배열만 받도록 수정
      const { images } = action.payload;
      
      if (Array.isArray(images) && images.length > 0) {
        state.isOrderEditorOpen = true;
        state.imagesToEdit = images;
      }
    },
    
    // 이미지 순서 편집기 닫기
    closeImageOrderEditor: (state) => {
      state.isOrderEditorOpen = false;
      state.imagesToEdit = [];
    },
    
    // 갤러리 열기
    openGallery: (state, action) => {
      const { images = [], index = 0 } = action.payload || {};
      
      // 유효한 이미지만 필터링
      const validImages = Array.isArray(images)
        ? images.filter(img => img && typeof img === 'string' && img.trim() !== '')
        : [];
        
      state.isGalleryOpen = true;
      state.galleryImages = validImages;
      state.galleryIndex = Math.min(Math.max(0, index), validImages.length - 1);
    },
    
    // 갤러리 닫기
    closeGallery: (state) => {
      state.isGalleryOpen = false;
      state.galleryImages = [];
      state.galleryIndex = 0;
    },
    
    // 이미지 선택 토글
    toggleImageSelection: (state, action) => {
      const { imageId } = action.payload || {};
      
      if (!imageId) return;
      
      const imageIndex = state.selectedImages.indexOf(imageId);
      
      if (imageIndex === -1) {
        // 이미지가 선택되지 않은 경우 추가
        state.selectedImages.push(imageId);
      } else {
        // 이미지가 이미 선택된 경우 제거
        state.selectedImages.splice(imageIndex, 1);
      }
    },
    
    // 이미지 선택 확인
    confirmImageSelection: (state) => {
      state.isSelectionMode = false;
    },
    
    // 이미지 선택 초기화
    resetImageSelection: (state) => {
      state.selectedImages = [];
    },
    
    // 이미지 순서 업데이트
    updateImageOrder: (state, action) => {
      const { images } = action.payload || {};
      
      if (Array.isArray(images)) {
        state.images = images;
      }
    },
    
    // 이미지 순서 확인
    confirmImageOrder: (state) => {
      state.isOrderEditorOpen = false;
    },
  }
});

// 액션 생성자 내보내기
export const {
  openImageSelectionMode,
  closeImageSelectionMode,
  openImageOrderEditor,
  closeImageOrderEditor,
  openGallery,
  closeGallery,
  toggleImageSelection,
  confirmImageSelection,
  resetImageSelection,
  updateImageOrder,
  confirmImageOrder,
} = imageManagerSlice.actions;

// 선택자 함수
export const selectIsImageSelectionMode = (state) => state.imageManager.isSelectionMode;
export const selectIsImageOrderEditorMode = (state) => state.imageManager.isOrderEditorOpen;
export const selectImages = (state) => state.imageManager.images;
export const selectSelectedImages = (state) => state.imageManager.selectedImages;
export const selectGalleryImages = (state) => state.imageManager.galleryImages;
export const selectGalleryIndex = (state) => state.imageManager.galleryIndex;
export const selectActiveSection = (state) => state.imageManager.section;

export default imageManagerSlice.reducer; 