import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Image from 'next/image';
import { createTemplateImageProps, IMAGE_TEMPLATES } from '../../lib/utils/imageHelpers';
import { 
  selectIsGalleryOpen, 
  selectGalleryImages, 
  selectCurrentImageIndex,
  closeGallery,
  prevImage,
  nextImage,
  goToImage
} from '../../lib/store/slices/imageGallerySlice';
import styles from '../../pages/editor/styles.module.css';

/**
 * 이미지 갤러리 컴포넌트
 * 선택된 이미지를 전체 화면으로 표시하는 갤러리 UI
 * 
 * @returns {React.ReactElement} 이미지 갤러리 UI 컴포넌트
 */
const ImageGallery = () => {
  // Redux 상태 가져오기
  const isOpen = useSelector(selectIsGalleryOpen);
  const images = useSelector(selectGalleryImages);
  const currentIndex = useSelector(selectCurrentImageIndex);
  const dispatch = useDispatch();
  
  // 브라우저 환경 체크
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  
  // 이미지 URL 상태 추가
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBrowserReady(true);
    }
  }, []);
  
  // 갤러리가 열릴 때 body 스타일 변경
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // 이미지 URL 로드
      loadImageUrls();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, images]);
  
  // 현재 이미지가 변경될 때 메인 이미지 URL 업데이트
  useEffect(() => {
    if (isOpen && images && images.length > 0 && currentIndex >= 0 && currentIndex < images.length) {
      loadMainImageUrl(images[currentIndex]);
    }
  }, [isOpen, currentIndex, images]);
  
  // 이미지 URL 로드 함수
  const loadImageUrls = async () => {
    if (!images || !images.length) return;
    
    // 메인 이미지 URL 로드
    await loadMainImageUrl(images[currentIndex]);
    
    // 썸네일 URL 로드
    const thumbnailPromises = images.map(async (publicId) => {
      try {
        const props = await createTemplateImageProps(publicId, IMAGE_TEMPLATES.THUMBNAIL, {
          alt: '썸네일',
          width: 100,
          height: 75
        });
        return [publicId, props.src];
      } catch (error) {
        console.error('썸네일 URL 생성 오류:', error);
        return [publicId, ''];
      }
    });
    
    const thumbnailEntries = await Promise.all(thumbnailPromises);
    setThumbnailUrls(Object.fromEntries(thumbnailEntries));
  };
  
  // 메인 이미지 URL 로드 함수
  const loadMainImageUrl = async (publicId) => {
    if (!publicId) return;
    
    try {
      const props = await createTemplateImageProps(publicId, IMAGE_TEMPLATES.ORIGINAL, {
        alt: '갤러리 이미지',
        priority: true
      });
      setMainImageUrl(props.src);
    } catch (error) {
      console.error('메인 이미지 URL 생성 오류:', error);
      setMainImageUrl('');
    }
  };
  
  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        dispatch(prevImage());
      } else if (e.key === 'ArrowRight') {
        dispatch(nextImage());
      } else if (e.key === 'Escape') {
        dispatch(closeGallery());
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dispatch]);
  
  // 닫기 핸들러
  const handleClose = () => {
    dispatch(closeGallery());
  };
  
  // 특정 이미지로 이동
  const handleGoToImage = (index) => {
    dispatch(goToImage({ index }));
  };
  
  // 갤러리가 열려있지 않거나 브라우저가 준비되지 않았으면 아무것도 렌더링하지 않음
  if (!isOpen || !isBrowserReady || !images || images.length === 0) {
    return null;
  }
  
  return (
    <div className={styles.galleryOverlay}>
      <div className={styles.galleryContentContainer}>
        <button className={styles.galleryCloseButton} onClick={handleClose}>×</button>
        
        <div className={styles.galleryMainImageContainer}>
          <div className={styles.galleryImageContainer}>
            {mainImageUrl ? (
              <img 
                src={mainImageUrl}
                alt={`갤러리 이미지 ${currentIndex + 1}`}
                className={styles.galleryImagePreview}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>이미지 로딩 중...</span>
              </div>
            )}
          </div>
          
          <button 
            className={styles.galleryNavButton}
            onClick={() => dispatch(prevImage())}
            disabled={images.length <= 1}
            style={{ left: '10px' }}
          >
            ‹
          </button>
          <button 
            className={styles.galleryNavButton}
            onClick={() => dispatch(nextImage())}
            disabled={images.length <= 1}
            style={{ right: '10px' }}
          >
            ›
          </button>
        </div>
        
        <div className={styles.galleryCounterContainer}>
          {currentIndex + 1} / {images.length}
        </div>
        
        <div className={styles.galleryThumbnailsContainer}>
          {images.map((publicId, index) => (
            <div 
              key={`gallery-thumb-${index}`}
              className={`${styles.galleryThumbnailItem} ${index === currentIndex ? styles.isActiveThumbnail : ''}`}
              onClick={() => handleGoToImage(index)}
            >
              {thumbnailUrls[publicId] ? (
                <img 
                  src={thumbnailUrls[publicId]}
                  alt={`썸네일 ${index + 1}`}
                  width={100}
                  height={75}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className={styles.emptyImagePlaceholder}>로딩 중...</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImageGallery; 