import { createSlice } from '@reduxjs/toolkit';
import { getValidImageRefs } from '../../utils/imageHelpers';

// 초기 상태
const initialState = {
  // 모달 상태 관리
  isImageGalleryOpen: false,        // 일반 이미지 갤러리 모달 상태
  isImageSelectionMode: false,      // 이미지 선택 모달 상태
  isImageOrderEditorOpen: false,    // 이미지 순서 편집 모달 상태
  
  // 이미지 데이터 관리
  mainImage: null,                  // 메인 이미지 (photo_reference)
  subImages: [],                    // 서브 이미지 배열 (photo_reference 배열)
  selectedImages: [],               // 현재 선택된 이미지 배열
  editedImages: [],                 // 순서 편집 중인 이미지 배열
  availableImages: [],              // 선택 모달에 표시할 수 있는 모든 이미지 목록
  
  // 갤러리 뷰 상태
  currentImageIndex: 0,             // 갤러리에서 현재 보고 있는 이미지 인덱스
  
  // 소스 식별자 (어느 컴포넌트에서 호출되었는지)
  source: null,                     // 'rightSidebar' 또는 'compareBar'

  // 드래그 앤 드롭 상태
  draggedItemIndex: null            // 드래그 중인 아이템 인덱스
};

const imageManagerSlice = createSlice({
  name: 'imageManager',
  initialState,
  reducers: {
    // 일반 이미지 갤러리 열기
    openImageGallery: (state, action) => {
      const { index = 0, source, images } = action.payload;
      
      // 갤러리 상태 기본 설정
      state.isImageGalleryOpen = true;
      state.currentImageIndex = index;
      state.source = source;
      
      // 이미지 데이터 설정 (유효한 이미지만)
      if (images) {
        // 메인 이미지가 유효한 경우 설정
        if (images.mainImage && typeof images.mainImage === 'string' && images.mainImage.trim() !== '') {
          state.mainImage = images.mainImage;
        }
        
        // 서브 이미지가 유효한 경우 설정
        if (images.subImages && Array.isArray(images.subImages)) {
          state.subImages = images.subImages.filter(
            ref => ref && typeof ref === 'string' && ref.trim() !== ''
          );
        }
      }
    },
    
    // 이미지 갤러리 닫기
    closeImageGallery: (state) => {
      state.isImageGalleryOpen = false;
    },
    
    // 갤러리에서 이미지 인덱스 변경
    setCurrentImageIndex: (state, action) => {
      state.currentImageIndex = action.payload;
    },
    
    // 이미지 선택 모달 열기
    openImageSelectionMode: (state, action) => {
      const { source, mainImage, subImages, availableImages } = action.payload;
      
      // 상태 초기화 - 선택된 이미지 배열 비우기
      state.isImageSelectionMode = true;
      state.source = source;
      state.selectedImages = [];
      
      // 사용 가능한 이미지 목록 설정 (우선적으로 사용)
      if (availableImages && Array.isArray(availableImages) && availableImages.length > 0) {
        state.availableImages = availableImages;
      } else {
        // 유효한 이미지 설정 (기존 방식)
        state.availableImages = getValidImageRefs(mainImage, subImages);
      }
      
      // mainImage와 subImages도 설정 (다른 기능과의 호환성을 위해)
      if (mainImage && typeof mainImage === 'string' && mainImage.trim() !== '') {
        state.mainImage = mainImage;
      }
      
      if (subImages && Array.isArray(subImages)) {
        state.subImages = subImages.filter(img => 
          img && typeof img === 'string' && img.trim() !== ''
        );
      }
    },
    
    // 이미지 선택 모달 닫기
    closeImageSelectionMode: (state) => {
      // 상태 초기화
      state.isImageSelectionMode = false;
      
      // 선택 완료 후 선택된 이미지 배열 유지 (선택 모드 종료 후 콜백에서 사용)
      // 다음 선택 모드가 시작될 때 초기화될 것임
      
      // 디버깅 로그
      console.log('Redux: 이미지 선택 모드 종료됨', {
        selectedImagesCount: state.selectedImages?.length || 0
      });
    },
    
    // 이미지 토글 선택
    toggleImageSelection: (state, action) => {
      const imageRef = action.payload;
      
      if (state.selectedImages.includes(imageRef)) {
        // 이미지가 이미 선택된 경우 제거
        state.selectedImages = state.selectedImages.filter(ref => ref !== imageRef);
      } else {
        // 이미지가 선택되지 않은 경우 추가
        state.selectedImages.push(imageRef);
      }
    },
    
    // 이미지 선택 확인
    confirmImageSelection: (state) => {
      // 선택 모드 종료
      state.isImageSelectionMode = false;
      
      // 선택된 이미지 목록은 유지 (콜백에서 사용)
      
      // 디버깅 로그
      console.log('Redux: 이미지 선택 확인됨', {
        selectedImagesCount: state.selectedImages?.length || 0
      });
    },
    
    // 이미지 순서 편집기 열기
    openImageOrderEditor: (state, action) => {
      const { source, mainImage, subImages } = action.payload;
      
      state.isImageOrderEditorOpen = true;
      state.source = source;
      
      // 현재 이미지 목록 설정
      state.editedImages = getValidImageRefs(mainImage, subImages);
    },
    
    // 이미지 순서 편집기 닫기
    closeImageOrderEditor: (state) => {
      state.isImageOrderEditorOpen = false;
      state.editedImages = [];
      state.draggedItemIndex = null;
    },
    
    // 이미지 순서 편집 확인
    confirmImageOrder: (state) => {
      // 편집된 이미지가 없는 경우 작업 취소
      if (state.editedImages.length === 0) {
        state.isImageOrderEditorOpen = false;
        return;
      }
      
      // 소스와 상관없이 동일하게 처리 (첫 번째는 메인, 나머지는 서브)
      state.mainImage = state.editedImages[0];
      state.subImages = state.editedImages.slice(1);
      
      // 모달 상태 초기화
      state.isImageOrderEditorOpen = false;
      state.editedImages = [];
      state.draggedItemIndex = null;
    },
    
    // 드래그 시작 설정
    setDraggedItem: (state, action) => {
      state.draggedItemIndex = action.payload;
    },
    
    // 드래그 종료 초기화
    clearDraggedItem: (state) => {
      state.draggedItemIndex = null;
    },
    
    // 이미지 순서 변경
    moveImage: (state, action) => {
      const { fromIndex, toIndex } = action.payload;
      
      // 편집 모드에서만 작동
      if (!state.isImageOrderEditorOpen || state.editedImages.length <= 1) {
        return;
      }
      
      // 범위 체크
      if (
        fromIndex < 0 || 
        fromIndex >= state.editedImages.length || 
        toIndex < 0 || 
        toIndex >= state.editedImages.length
      ) {
        return;
      }
      
      // 이미지 순서 변경
      const [movedItem] = state.editedImages.splice(fromIndex, 1);
      state.editedImages.splice(toIndex, 0, movedItem);
    },
    
    // 이미지 데이터 초기화
    resetImageData: (state) => {
      state.mainImage = null;
      state.subImages = [];
      state.selectedImages = [];
      state.editedImages = [];
      state.availableImages = [];  // 사용 가능한 이미지 목록도 초기화
      state.isImageGalleryOpen = false;
      state.isImageSelectionMode = false;
      state.isImageOrderEditorOpen = false;
      state.currentImageIndex = 0;
      state.source = null;
      state.draggedItemIndex = null;
    }
  }
});

// 액션 생성자 내보내기
export const {
  openImageGallery,
  closeImageGallery,
  setCurrentImageIndex,
  openImageSelectionMode,
  closeImageSelectionMode,
  toggleImageSelection,
  confirmImageSelection,
  openImageOrderEditor,
  closeImageOrderEditor,
  confirmImageOrder,
  setDraggedItem,
  clearDraggedItem,
  moveImage,
  resetImageData
} = imageManagerSlice.actions;

// 선택자 함수
export const selectIsImageGalleryOpen = (state) => state.imageManager.isImageGalleryOpen;
export const selectIsImageSelectionMode = (state) => state.imageManager.isImageSelectionMode;
export const selectIsImageOrderEditorOpen = (state) => state.imageManager.isImageOrderEditorOpen;
export const selectMainImage = (state) => state.imageManager.mainImage;
export const selectSubImages = (state) => state.imageManager.subImages;
export const selectSelectedImages = (state) => state.imageManager.selectedImages;
export const selectEditedImages = (state) => state.imageManager.editedImages;
export const selectCurrentImageIndex = (state) => state.imageManager.currentImageIndex;
export const selectImageSource = (state) => state.imageManager.source;
export const selectDraggedItemIndex = (state) => state.imageManager.draggedItemIndex;
export const selectAllImages = (state) => getValidImageRefs(state.imageManager.mainImage, state.imageManager.subImages);

export default imageManagerSlice.reducer; 