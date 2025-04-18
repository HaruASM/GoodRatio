import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styles from '../../pages/editor/styles.module.css';

// 이미지 갤러리 슬라이스에서 액션과 선택자 임포트
import {
  closeGallery,
  prevImage,
  nextImage,
  goToImage,
  selectIsGalleryOpen,
  selectGalleryImages,
  selectCurrentImageIndex,
  selectGallerySource
} from '../../lib/store/slices/imageGallerySlice';

// 이미지 URL 변환 유틸리티 임포트
import { getProxiedPhotoUrl, getThumbnailUrl, getOriginalSizeUrl } from '../../lib/utils/imageHelpers';

/**
 * 이미지 갤러리 컴포넌트
 * Cloudinary public ID 배열을 전체 화면 갤러리로 표시
 * 
 * @returns {React.ReactElement} 이미지 갤러리 UI 컴포넌트
 */
const ImageGallery = () => {
  // Redux 상태 및 디스패치 
  const dispatch = useDispatch();
  const isOpen = useSelector(selectIsGalleryOpen);
  const images = useSelector(selectGalleryImages); // public ID 배열
  const currentIndex = useSelector(selectCurrentImageIndex);
  const source = useSelector(selectGallerySource);
  
  // 로컬 상태
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [loadingImage, setLoadingImage] = useState(false);
  
  // 브라우저 환경 체크
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBrowserReady(true);
    }
  }, []);
  
  // 이미지 인덱스가 변경될 때마다 로딩 상태 초기화
  useEffect(() => {
    setLoadingImage(true);
  }, [currentIndex]);
  
  // 갤러리 닫기
  const handleClose = useCallback(() => {
    dispatch(closeGallery());
    document.body.style.overflow = '';
  }, [dispatch]);
  
  // 이전 이미지로 이동
  const handlePrev = useCallback(() => {
    dispatch(prevImage());
  }, [dispatch]);
  
  // 다음 이미지로 이동
  const handleNext = useCallback(() => {
    dispatch(nextImage());
  }, [dispatch]);
  
  // 특정 이미지로 이동
  const handleGoToImage = useCallback((index) => {
    dispatch(goToImage({ index }));
  }, [dispatch]);
  
  // 이미지 로드 에러 처리
  const handleImageError = useCallback((key) => {
    setImageErrors(prev => ({
      ...prev,
      [key]: true
    }));
    setLoadingImage(false);
  }, []);
  
  // 이미지 로드 완료 처리
  const handleImageLoad = useCallback(() => {
    setLoadingImage(false);
  }, []);
  
  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'Escape':
        handleClose();
        break;
      case 'ArrowLeft':
        handlePrev();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      default:
        break;
    }
  }, [handleClose, handlePrev, handleNext]);
  
  // 키보드 이벤트 리스너 등록/제거
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);
  
  // 갤러리가 열려있지 않거나 브라우저가 준비되지 않았으면 아무것도 렌더링하지 않음
  if (!isOpen || !isBrowserReady) {
    return null;
  }
  
  // 이미지가 없으면 아무것도 렌더링하지 않음
  if (!images || images.length === 0) {
    return null;
  }
  
  // 현재 이미지 public ID
  const currentPublicId = images[currentIndex];
  const hasError = imageErrors[`gallery-current`];
  
  // 갤러리 렌더링
  return (
    <div className={styles.galleryOverlay}>
      <div className={styles.galleryContentContainer}>
        <button 
          className={styles.galleryCloseButton} 
          onClick={handleClose}
          aria-label="닫기"
        >
          &times;
        </button>
        
        <div className={styles.galleryMainImageContainer}>
          <button 
            className={styles.galleryNavButton} 
            onClick={handlePrev}
            disabled={images.length <= 1}
          >
            &lt;
          </button>
          
          <div className={styles.galleryImageContainer}>
            {!hasError ? (
              <>
                {loadingImage && (
                  <div className={styles.imageLoadingContainer}>
                    <span>이미지 로딩 중...</span>
                  </div>
                )}
                <img 
                  src={getOriginalSizeUrl(currentPublicId)} 
                  alt={`이미지 ${currentIndex + 1}`}
                  className={`${styles.galleryImagePreview} ${loadingImage ? styles.imageLoading : ''}`}
                  onError={() => handleImageError('gallery-current')}
                  onLoad={handleImageLoad}
                  style={{ height: "100%", width: "auto" }}
                />
              </>
            ) : (
              <div className={styles.imageErrorPlaceholderContainer}>
                <span>이미지를 불러올 수 없습니다.</span>
              </div>
            )}
          </div>
          
          <button 
            className={styles.galleryNavButton} 
            onClick={handleNext}
            disabled={images.length <= 1}
          >
            &gt;
          </button>
        </div>
        
        <div className={styles.galleryThumbnailsContainer}>
          {images.map((publicId, index) => (
            <div 
              key={`gallery-thumb-${index}`}
              className={`${styles.galleryThumbnailItem} ${index === currentIndex ? styles.isActiveThumbnail : ''} ${imageErrors[`gallery-thumb-${index}`] ? styles.isErrorThumbnail : ''}`}
              onClick={() => handleGoToImage(index)}
            >
              {imageErrors[`gallery-thumb-${index}`] ? (
                <div className={styles.thumbnailErrorPlaceholderContainer}></div>
              ) : (
                <img 
                  src={getThumbnailUrl(publicId)} 
                  alt={`썸네일 ${index + 1}`}
                  onError={() => handleImageError(`gallery-thumb-${index}`)}
                  style={{ height: "100%", width: "auto" }}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className={styles.galleryCounterContainer}>
          {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : '0 / 0'}
        </div>
      </div>
    </div>
  );
};

export default ImageGallery; 