import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Image from 'next/image';
import { 
  IMAGE_TEMPLATES,
  createNextImageProps
} from '../../lib/utils/imageHelpers';
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
  
  // 이미지 props 상태 추가
  const [mainImageProps, setMainImageProps] = useState(null);
  const [thumbnailProps, setThumbnailProps] = useState({});
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBrowserReady(true);
    }
  }, []);
  
  // 갤러리가 열릴 때 body 스타일 변경
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // 이미지 props 로드
      loadImageProps();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, images]);
  
  // 현재 이미지가 변경될 때 메인 이미지 props 업데이트
  useEffect(() => {
    if (isOpen && images && images.length > 0 && currentIndex >= 0 && currentIndex < images.length) {
      loadMainImageProps(images[currentIndex]);
    }
  }, [isOpen, currentIndex, images]);
  
  // 이미지 props 로드 함수
  const loadImageProps = async () => {
    if (!images || !images.length) return;
    
    // 메인 이미지 props 로드
    await loadMainImageProps(images[currentIndex]);
    
    // 썸네일 props 로드
    const thumbnailPromises = images.map(async (publicId) => {
      try {
        const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.THUMBNAIL, {
          alt: '썸네일',
          width: 100,
          height: 75
        });
        return [publicId, props];
      } catch (error) {
        console.error('썸네일 props 생성 오류:', error);
        return [publicId, null];
      }
    });
    
    const thumbnailEntries = await Promise.all(thumbnailPromises);
    setThumbnailProps(Object.fromEntries(thumbnailEntries));
  };
  
  // 메인 이미지 props 로드 함수
  const loadMainImageProps = async (publicId) => {
    if (!publicId) return;
    
    try {
      const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.ORIGINAL, {
        alt: '갤러리 이미지',
        priority: true,
        objectFit: 'contain',
        width: 800,
        height: 600
      });
      
      // 이미지 속성 정보(html_attributions) 가져오기 시도
      try {
        console.log(`[디버깅] 이미지 속성 정보 요청: public_id=${publicId}`);
        const response = await fetch(`/api/place-photo?public_id=${publicId}&metadata=true`);
        console.log(`[디버깅] 응답 상태코드:`, response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[디버깅] 응답 데이터:`, JSON.stringify(data, null, 2));
          
          if (data.html_attributions && data.html_attributions.length > 0) {
            console.log(`[디버깅] html_attributions 찾음:`, data.html_attributions);
            
            // 원본 HTML 저작권 정보 저장 (링크 새 탭 열기 설정)
            props.html_attributions = data.html_attributions.map(attribution => {
              return attribution.replace(/<a\s+(?=[^>]*href)/gi, '<a target="_blank" rel="noopener noreferrer" ');
            });
            
            // 저작권자 텍스트 추출 (HTML 태그 제거)
            props.copyrightTexts = data.html_attributions.map(attribution => {
              // 임시 DOM 요소를 사용하여 HTML에서 텍스트만 추출
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = attribution;
              const text = tempDiv.textContent || tempDiv.innerText || '';
              return text.trim();
            });
          } else {
            console.log(`[디버깅] html_attributions 없거나 비어있음`);
          }
        }
      } catch (error) {
        console.error('[디버깅] 이미지 속성 정보 로드 오류:', error);
      }
      
      console.log(`[디버깅] 최종 props:`, props);
      setMainImageProps(props);
    } catch (error) {
      console.error('메인 이미지 props 생성 오류:', error);
      setMainImageProps(null);
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
  
  // JSX 반환 전에 링크 스타일을 위한 스타일 태그 생성
  const linkStyleId = 'copyright-link-style';
  
  // 컴포넌트가 마운트될 때 스타일 태그 추가
  useEffect(() => {
    // 이미 존재하는 스타일 태그가 있는지 확인
    if (!document.getElementById(linkStyleId) && typeof window !== 'undefined') {
      const styleTag = document.createElement('style');
      styleTag.id = linkStyleId;
      styleTag.innerHTML = `
        .copyright-attribution-container a {
          color: white !important;
          text-decoration: none !important;
        }
        .copyright-attribution-container a:visited {
          color: white !important;
        }
        .copyright-attribution-container a:hover {
          color: #f0f0f0 !important;
        }
      `;
      document.head.appendChild(styleTag);
    }
    
    // 컴포넌트가 언마운트될 때 스타일 태그 제거
    return () => {
      const styleTag = document.getElementById(linkStyleId);
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, []);
  
  // 갤러리가 열려있지 않거나 브라우저가 준비되지 않았으면 아무것도 렌더링하지 않음
  if (!isOpen || !isBrowserReady || !images || images.length === 0) {
    return null;
  }
  
  return (
    <div className={styles.galleryOverlay}>
      <div className={styles.galleryContentContainer}>
        <button className={styles.galleryCloseButton} onClick={handleClose}>×</button>
        
        {/* 저작권 정보를 이미지 바깥, 상단에 배치 - 클릭 가능한 링크 포함 */}
        {mainImageProps && mainImageProps.html_attributions && mainImageProps.html_attributions.length > 0 && (
          <div 
            className="copyright-attribution-container"
            style={{
              
              borderRadius: '4px',
              color: 'white',
              fontSize: '11px',
              textAlign: 'left',
              alignSelf: 'flex-start'
            }}
          >
            <span style={{ marginRight: '5px' }}>copyright(by Google) :</span>
            <span 
              dangerouslySetInnerHTML={{ 
                __html: mainImageProps.html_attributions.join(' ') 
              }}
            />
          </div>
        )}
        
        <div className={styles.galleryMainImageContainer}>
          <div className={styles.galleryImageContainer}>
            {mainImageProps ? (
              <Image 
                {...mainImageProps}
                className={styles.galleryImagePreview}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', width: 'auto', height: 'auto' }}
              />
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>...</span>
              </div>
            )}
          </div>
          
          {/* html_attributions가 없을 경우 디버깅 표시 (개발 중에만 사용) */}
          {mainImageProps && (!mainImageProps.html_attributions || mainImageProps.html_attributions.length === 0) && (
            <div className={styles.imageAttributionsContainer} style={{ backgroundColor: 'rgba(255, 0, 0, 0.5)' }}>
              <div className={styles.imageAttributions}>
                이미지 속성 정보가 없습니다 (html_attributions 누락)
              </div>
            </div>
          )}
          
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
              {thumbnailProps[publicId] ? (
                <Image 
                  {...thumbnailProps[publicId]}
                  style={{ objectFit: 'cover', width: 'auto', height: 'auto' }}
                />
              ) : (
                <div className={styles.emptyImagePlaceholder}>...</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImageGallery; 