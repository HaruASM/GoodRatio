import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles.module.css';

/**
 * 이미지 관리 컴포넌트 - 메인 이미지와 서브 이미지를 출력하고 관리
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.mainImage - 메인 이미지 URL
 * @param {Array<string>} props.subImages - 서브 이미지 URL 배열
 * @returns {React.ReactElement} 이미지 관리 UI 컴포넌트
 */
const ImageSectionManager = ({ mainImage, subImages }) => {
  // 서브 이미지 배열이 존재하고 유효한지 확인
  const hasValidSubImages = subImages && Array.isArray(subImages) && subImages.length > 0 && subImages[0] !== "";
  // 서브 이미지 총 개수
  const totalSubImages = hasValidSubImages ? subImages.length : 0;
  // 추가 이미지 개수 (4개 초과 시)
  const additionalImages = totalSubImages > 4 ? totalSubImages - 3 : 0;

  // 갤러리 상태 관리
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // 모든 이미지 배열 생성 (메인 이미지 + 서브 이미지)
  const allImages = mainImage 
    ? [mainImage, ...(hasValidSubImages ? subImages : [])]
    : hasValidSubImages 
      ? subImages 
      : [];
  
  // DOM에 갤러리 포털을 렌더링할 준비가 되었는지 확인
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  
  // 브라우저 환경인지 확인 (SSR 대비)
  useEffect(() => {
    setIsBrowserReady(true);
  }, []);
  
  // 갤러리 열기 함수
  const openGallery = (index) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
    // 스크롤 방지
    document.body.style.overflow = 'hidden';
  };
  
  // 갤러리 닫기 함수
  const closeGallery = () => {
    setIsGalleryOpen(false);
    // 스크롤 복원
    document.body.style.overflow = '';
  };
  
  // 이전 이미지 보기
  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? allImages.length - 1 : prevIndex - 1
    );
  };
  
  // 다음 이미지 보기
  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === allImages.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  // 특정 이미지로 이동
  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };
  
  // 키보드 이벤트 핸들러
  const handleKeyDown = (e) => {
    if (!isGalleryOpen) return;
    
    switch (e.key) {
      case 'Escape':
        closeGallery();
        break;
      case 'ArrowLeft':
        prevImage();
        break;
      case 'ArrowRight':
        nextImage();
        break;
      default:
        break;
    }
  };
  
  // 키보드 이벤트 리스너 등록/해제
  useEffect(() => {
    if (isGalleryOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGalleryOpen]);
  
  // 갤러리 모달 컴포넌트
  const GalleryModal = () => {
    return (
      <div className={styles.galleryOverlay} onClick={closeGallery}>
        <div className={styles.galleryContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.galleryCloseBtn} onClick={closeGallery}>
            &times;
          </button>
          
          <div className={styles.galleryMainImage}>
            <button className={styles.galleryNavBtn} onClick={prevImage}>
              &lt;
            </button>
            
            <div className={styles.galleryImageContainer}>
              <img 
                src={allImages[currentImageIndex]} 
                alt={`이미지 ${currentImageIndex + 1}`}
                className={styles.galleryImage}
                onError={(e) => {
                  e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                  e.target.alt = "이미지 로드 실패";
                  e.target.style.backgroundColor = "#f0f0f0";
                }}
              />
            </div>
            
            <button className={styles.galleryNavBtn} onClick={nextImage}>
              &gt;
            </button>
          </div>
          
          {/* 썸네일 네비게이션 */}
          <div className={styles.galleryThumbnails}>
            {allImages.map((img, index) => (
              <div 
                key={index}
                className={`${styles.galleryThumbnail} ${index === currentImageIndex ? styles.activeThumbnail : ''}`}
                onClick={() => goToImage(index)}
              >
                <img 
                  src={img} 
                  alt={`썸네일 ${index + 1}`}
                  onError={(e) => {
                    e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                    e.target.style.backgroundColor = "#f0f0f0";
                  }}
                />
              </div>
            ))}
          </div>
          
          <div className={styles.galleryCounter}>
            {currentImageIndex + 1} / {allImages.length}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.imagesPreviewContainer}>
        {/* 메인 이미지 */}
        <div className={styles.imageSection}>
          <div 
            className={styles.mainImageContainer}
            onClick={() => mainImage && openGallery(0)}
            style={{ cursor: mainImage ? 'pointer' : 'default' }}
          >
            {mainImage ? (
              <img 
                src={mainImage} 
                alt="메인 이미지" 
                className={styles.mainImagePreview}
                onError={(e) => {
                  e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                  e.target.alt = "이미지 로드 실패";
                  e.target.style.backgroundColor = "#f0f0f0";
                }}
              />
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>메인 이미지</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 서브 이미지 - 2x2 그리드 형태 유지 */}
        <div className={styles.imageSection}>
          <div 
            className={styles.subImagesContainer} 
            style={{ gap: '5px', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}
          >
            {hasValidSubImages ? (
              <>
                {/* 첫 번째 행 (2개 이미지) */}
                <div 
                  className={styles.subImageItem}
                  onClick={() => openGallery(1)}
                  style={{ cursor: 'pointer' }}
                >
                  <img 
                    src={subImages[0]} 
                    alt="서브 이미지 1" 
                    className={styles.subImagePreview}
                    onError={(e) => {
                      e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                      e.target.alt = "이미지 로드 실패";
                      e.target.style.backgroundColor = "#f0f0f0";
                    }}
                  />
                </div>
                <div 
                  className={styles.subImageItem}
                  onClick={() => subImages.length > 1 && openGallery(2)}
                  style={{ cursor: subImages.length > 1 ? 'pointer' : 'default' }}
                >
                  {subImages.length > 1 ? (
                    <img 
                      src={subImages[1]} 
                      alt="서브 이미지 2" 
                      className={styles.subImagePreview}
                      onError={(e) => {
                        e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                        e.target.alt = "이미지 로드 실패";
                        e.target.style.backgroundColor = "#f0f0f0";
                      }}
                    />
                  ) : (
                    <div className={styles.emptyImagePlaceholder}></div>
                  )}
                </div>
                
                {/* 두 번째 행 (2개 이미지) */}
                <div 
                  className={styles.subImageItem}
                  onClick={() => subImages.length > 2 && openGallery(3)}
                  style={{ cursor: subImages.length > 2 ? 'pointer' : 'default' }}
                >
                  {subImages.length > 2 ? (
                    <img 
                      src={subImages[2]} 
                      alt="서브 이미지 3" 
                      className={styles.subImagePreview}
                      onError={(e) => {
                        e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                        e.target.alt = "이미지 로드 실패";
                        e.target.style.backgroundColor = "#f0f0f0";
                      }}
                    />
                  ) : (
                    <div className={styles.emptyImagePlaceholder}></div>
                  )}
                </div>
                <div 
                  className={styles.subImageItem}
                  onClick={() => subImages.length > 3 && openGallery(4)}
                  style={{ cursor: subImages.length > 3 ? 'pointer' : 'default' }}
                >
                  {subImages.length > 3 ? (
                    <div className={styles.subImageWithOverlay}>
                      <img 
                        src={subImages[3]} 
                        alt="서브 이미지 4" 
                        className={styles.subImagePreview}
                        onError={(e) => {
                          e.target.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                          e.target.alt = "이미지 로드 실패";
                          e.target.style.backgroundColor = "#f0f0f0";
                        }}
                      />
                      {additionalImages > 0 && (
                        <div className={styles.imageCountOverlay}>
                          +{additionalImages}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.emptyImagePlaceholder}></div>
                  )}
                </div>
              </>
            ) : (
              // 빈 서브 이미지 2x2 그리드 표시
              <>
                <div className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}></div>
                </div>
                <div className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}></div>
                </div>
                <div className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}></div>
                </div>
                <div className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* 이미지 갤러리 모달 - createPortal을 사용하여 document.body에 직접 렌더링 */}
      {isBrowserReady && isGalleryOpen && allImages.length > 0 && 
        createPortal(<GalleryModal />, document.body)}
    </>
  );
};

export default ImageSectionManager; 