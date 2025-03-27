// 이미지 선택 모드 열기
openImageSelectionMode: (state, action) => {
  console.log('[ImageManagerSlice] 이미지 선택 모드 열기 액션 실행', action.payload);
  
  // 페이로드 유효성 검사
  const { source, mainImage, subImages } = action.payload || {};
  
  if (!source) {
    console.error('[ImageManagerSlice] 이미지 선택 모드 열기 실패: 소스 정보 누락');
    return;
  }
  
  // 이미지 데이터 유효성 검사
  const validMainImage = mainImage && typeof mainImage === 'string' && mainImage.trim() !== '' ? mainImage : null;
  
  let validSubImages = [];
  if (subImages && Array.isArray(subImages)) {
    validSubImages = subImages.filter(img => img && typeof img === 'string' && img.trim() !== '');
  }
  
  const hasValidImages = validMainImage || validSubImages.length > 0;
  
  console.log('[ImageManagerSlice] 이미지 데이터 유효성 검사 결과:', {
    validMainImage: validMainImage ? '유효함' : '없음',
    validSubImagesCount: validSubImages.length,
    hasValidImages: hasValidImages
  });
  
  // 유효한 이미지가 없는 경우 경고 로그만 출력하고 계속 진행
  if (!hasValidImages) {
    console.warn('[ImageManagerSlice] 유효한 이미지가 없지만, 이미지 선택 모드는 계속 열림');
  }
  
  // 이미지 선택 모드 상태 설정
  state.isSelectionMode = true;
  state.selectionSource = source;
  
  // 유효한 이미지가 있는 경우 갤러리 이미지 설정
  if (validMainImage) {
    state.galleryMainImage = validMainImage;
  }
  
  if (validSubImages.length > 0) {
    state.gallerySubImages = validSubImages;
  }
  
  console.log('[ImageManagerSlice] 이미지 선택 모드 열기 완료:', {
    isSelectionMode: state.isSelectionMode,
    selectionSource: state.selectionSource,
    galleryMainImage: state.galleryMainImage ? '설정됨' : '없음',
    gallerySubImagesCount: state.gallerySubImages?.length || 0
  });
},

// 이미지 선택 모드 닫기
closeImageSelectionMode: (state) => {
  console.log('[ImageManagerSlice] 이미지 선택 모드 닫기');
  
  // 모드 및 소스 초기화
  state.isSelectionMode = false;
  state.selectionSource = null;
  
  // 이미지 데이터 유지 (다음 사용을 위해)
  // state.galleryMainImage = null;
  // state.gallerySubImages = [];
  
  console.log('[ImageManagerSlice] 이미지 선택 모드 닫기 완료');
}, 