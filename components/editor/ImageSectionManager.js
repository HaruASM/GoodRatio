import React, { useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from '../../pages/editor/styles.module.css';

// 이미지 매니저 슬라이스에서 필요한 액션과 선택자만 가져오기
import {
  openImageOrderEditor,
  openImageSelectionMode,
  selectIsImageSelectionMode,
  selectSelectedImages,
  closeImageSelectionMode,
  closeImageOrderEditor,
} from '../../lib/store/slices/imageManagerSlice';

/**
 * 이미지 관리 컴포넌트 - 이미지 배열을 출력하고 관리
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.mainImage - 메인 이미지 ID
 * @param {Array} props.subImages - 서브 이미지 ID 배열
 * @param {Function} props.onImageOrderChange - 이미지 순서 변경 콜백
 * @returns {React.ReactElement} 이미지 관리 UI 컴포넌트
 */
const ImageSectionManager = forwardRef(({ 
  mainImage, 
  subImages = [], 
  onImageOrderChange
}, ref) => {
  const dispatch = useDispatch();
  
  // Redux 상태 가져오기
  const isModalOpen = useSelector(selectIsImageSelectionMode);
  const selectedImages = useSelector(selectSelectedImages);
  
  // 유효한 메인 이미지와 서브 이미지 확인
  const validMainImage = mainImage && typeof mainImage === 'string' && mainImage.trim() !== '';
  const validSubImages = Array.isArray(subImages) 
    ? subImages.filter(img => img && typeof img === 'string' && img.trim() !== '') 
    : [];
    
  // 모든 이미지를 하나의 배열로 병합
  const allImages = [
    ...(validMainImage ? [mainImage] : []),
    ...validSubImages
  ];
  
  // ref를 통해 외부에서 접근 가능한 함수 노출
  useImperativeHandle(ref, () => ({
    openImageOrderEditor: () => {
      if (allImages.length === 0) return;
      
      // 이미지 순서 편집기 열기 - 단일 이미지 배열 전달
      dispatch(openImageOrderEditor({
        images: allImages
      }));
    }
  }));
  
  // 이미지 선택 완료 핸들러
  const handleImagesSelected = useCallback(() => {
    const selectedImageIds = selectedImages;
    
    if (selectedImageIds.length > 0) {
      // 첫 번째 이미지를 메인 이미지로, 나머지를 서브 이미지로 설정
      const mainImage = selectedImageIds[0];
      const subImages = selectedImageIds.slice(1);
      
      // 선택한 이미지로 항목 업데이트
      onImageOrderChange({
        mainImage,
        subImages
      });
      
      // 선택 모드 종료
      dispatch(closeImageSelectionMode());
    }
  }, [selectedImages, onImageOrderChange, dispatch]);

  // // 이미지 순서 편집 완료 핸들러
  // const handleOrderConfirmed = useCallback((orderedImages) => {
  //   if (Array.isArray(orderedImages) && orderedImages.length > 0) {
  //     // 첫 번째 이미지를 메인 이미지로, 나머지를 서브 이미지로 설정
  //     const mainImage = orderedImages[0];
  //     const subImages = orderedImages.slice(1);
      
  //     // 순서가 변경된 이미지로 항목 업데이트
  //     onImageOrderChange({
  //       mainImage,
  //       subImages
  //     });
      
  //     // 순서 편집 모드 종료
  //     dispatch(closeImageOrderEditor());
  //   }
  // }, [onImageOrderChange, dispatch]);

  return (
    <div className={styles.imageSectionManager}>
      <div className={styles.header}>
        <h5>이미지 섹션</h5>
        <div className={styles.buttonGroup}>
          <button 
            className={styles.button}
            onClick={() => dispatch(openImageSelectionMode({
              images: allImages
            }))}
          >
            {allImages.length === 0 ? '이미지 추가' : '이미지 변경'}
          </button>
          
          {allImages.length > 0 && (
            <button 
              className={styles.button}
              onClick={() => dispatch(openImageOrderEditor({
                images: allImages
              }))}
            >
              순서 변경
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.imagePreview}>
        {allImages.length === 0 && (
          <div className={styles.noImages}>
            이미지가 없습니다. '이미지 추가' 버튼을 클릭하여 이미지를 추가하세요.
          </div>
        )}
        
        {validMainImage && (
          <div className={styles.mainImageContainer}>
            <div className={styles.imageLabel}>메인 이미지</div>
            <img 
              src={`/api/place-photo?public_id=${encodeURIComponent(mainImage)}`}
              alt="메인 이미지"
              className={styles.mainImage}
            />
          </div>
        )}
        
        {validSubImages.length > 0 && (
          <div className={styles.subImagesContainer}>
            <div className={styles.imageLabel}>추가 이미지 ({validSubImages.length})</div>
            <div className={styles.subImagesGrid}>
              {validSubImages.map((imgRef, index) => (
                <img 
                  key={`sub-img-${index}`}
                  src={`/api/place-photo?public_id=${encodeURIComponent(imgRef)}`}
                  alt={`추가 이미지 ${index + 1}`}
                  className={styles.subImage}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ImageSectionManager;