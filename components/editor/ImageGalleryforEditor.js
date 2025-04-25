import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import { createImageProps, createThumbnailImageProps } from '../../lib/utils/imageHelpers';
import { 
  toggleImageSelection,
  confirmImageSelection,
  resetImageSelection,
  closeImageSelectionMode,
  selectIsImageSelectionMode,
  selectImages,
  selectSelectedImages
} from '../../lib/store/slices/imageGallerySlice';
import styles from '../../pages/editor/styles.module.css';

/**
 * 이미지 선택 갤러리 컴포넌트
 * 이미지를 선택하고 확인할 수 있는 UI
 * 
 * @returns {React.ReactElement} 이미지 선택 갤러리 UI 컴포넌트
 */
const ImageGalleryForEditor = () => {
  const dispatch = useDispatch();
  
  // Redux 상태 구독
  const isActive = useSelector(selectIsImageSelectionMode);
  const galleryImages = useSelector(selectImages);
  const selectedImagesFromRedux = useSelector(selectSelectedImages);
  
  // 선택된 이미지 로컬 상태
  const [selectedImages, setSelectedImages] = useState([]);
  
  // 툴팁 상태 (마우스 오버 시 이미지 확대 보기)
  const [tooltipImage, setTooltipImage] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // 브라우저 환경 체크
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBrowserReady(true);
    }
  }, []);
  
  // 갤러리가 열릴 때 body 스타일 변경 (ImageGallery와 동일한 방식)
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
      // 상태 초기화
      setSelectedImages(selectedImagesFromRedux || []);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive, selectedImagesFromRedux]);
  
  // 이미지 선택 토글
  const handleImageSelect = (imageId) => {
    setSelectedImages(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        return [...prev, imageId];
      }
    });
    dispatch(toggleImageSelection({ imageId }));
  };
  
  // 툴팁 관련 핸들러
  const handleMouseEnter = (imageId, e) => {
    setTooltipImage(imageId);
    updateTooltipPosition(e);
  };
  
  const handleMouseLeave = () => {
    setTooltipImage(null);
  };
  
  const handleMouseMove = (e) => {
    if (tooltipImage) {
      updateTooltipPosition(e);
    }
  };
  
  const updateTooltipPosition = (e) => {
    setTooltipPosition({
      x: e.clientX,
      y: e.clientY
    });
  };
  
  // 확인 버튼 클릭
  const handleConfirm = () => {
    dispatch(confirmImageSelection());
  };
  
  // 취소 버튼 클릭
  const handleCancel = () => {
    dispatch(resetImageSelection());
    dispatch(closeImageSelectionMode());
    setSelectedImages([]);
  };
  
  // 갤러리가 열려있지 않거나 브라우저가 준비되지 않았으면 아무것도 렌더링하지 않음
  if (!isActive || !isBrowserReady || !galleryImages || galleryImages.length === 0) {
    return null;
  }
  
  return (
    <div className={styles.galleryOverlay}>
      <div className={styles.galleryContentContainer}>
        <div className={styles.galleryHeader}>
          <h3>이미지 선택</h3>
          <button className={styles.galleryCloseButton} onClick={handleCancel}>×</button>
        </div>
        
        <div className={styles.imageSelectionGridContainer} onMouseMove={handleMouseMove}>
          {galleryImages.map((publicId, index) => (
            <div 
              key={`select-image-${index}`}
              className={`${styles.imageSelectionItem} ${selectedImages.includes(publicId) ? styles.isSelectedImage : ''}`}
              onClick={() => handleImageSelect(publicId)}
              onMouseEnter={(e) => handleMouseEnter(publicId, e)}
              onMouseLeave={handleMouseLeave}
            >
              <div className={styles.imageContainerItem}>
                <Image 
                  {...createThumbnailImageProps(publicId, {
                    alt: `이미지 ${index + 1}`
                  })}
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* 이미지 확대 툴팁 */}
        {tooltipImage && (
          <div 
            className={styles.galleryImageTooltip}
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`
            }}
          >
            <Image
              {...createImageProps(tooltipImage, {
                width: 300,
                height: 200,
                alt: "이미지 미리보기",
                objectFit: "contain"
              })}
            />
          </div>
        )}
        
        <div className={styles.galleryButtonContainer}>
          <button 
            className={styles.galleryButton}
            onClick={handleCancel}
          >
            취소
          </button>
          <button 
            className={`${styles.galleryButton} ${styles.primaryButton}`}
            onClick={handleConfirm}
            disabled={selectedImages.length === 0}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 이미지 순서 편집 갤러리 컴포넌트
 * 이미지 순서를 편집할 수 있는 UI
 * 
 * 향후 구현 예정
 */
const ImageOrderEditor = () => {
  return null;
};

// 컴포넌트 내보내기
export { ImageOrderEditor };
export default ImageGalleryForEditor; 