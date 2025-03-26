import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles.module.css';

/**
 * 구글 Place Photo Reference를 이용해 서버 API 라우트를 통한 이미지 URL 생성
 * @param {string} photoReference - 구글 Place API 사진 참조 ID
 * @param {number} maxWidth - 이미지 최대 너비
 * @returns {string} 프록시된 이미지 URL
 */
const getProxiedPhotoUrl = (photoReference, maxWidth = 500) => {
  if (!photoReference) return '';
  return `/api/place-photo?photo_reference=${photoReference}&maxwidth=${maxWidth}`;
};

/**
 * 이미지 관리 컴포넌트 - 메인 이미지와 서브 이미지를 출력하고 관리
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.mainImage - 메인 이미지 photo_reference
 * @param {Array<string>} props.subImages - 서브 이미지 photo_reference 배열
 * @param {Function} props.onImagesSelected - 이미지 선택 완료 시 호출될 콜백 함수
 * @param {Function} props.onCancelSelection - 이미지 선택 취소 시 호출될 콜백 함수
 * @param {boolean} props.isSelectionMode - 이미지 선택 모드 활성화 여부
 * @returns {React.ReactElement} 이미지 관리 UI 컴포넌트
 */
const ImageSectionManager = ({ mainImage, subImages, onImagesSelected, onCancelSelection, isSelectionMode = false }) => {
  // photo_reference 배열 상태 관리
  const [imageRefs, setImageRefs] = useState([]);
  
  // 선택된 이미지 상태 관리
  const [selectedImages, setSelectedImages] = useState([]);

  // 선택 모드 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 이미지 로드 오류 상태
  const [imageErrors, setImageErrors] = useState({});
  
  // 초기 이미지 데이터 설정
  useEffect(() => {
    // mainImage와 subImages가 photo_reference인 경우 직접 병합
    const initialImageRefs = [];
    
    if (mainImage) {
      initialImageRefs.push(mainImage);
    }
    
    if (subImages && Array.isArray(subImages) && subImages.length > 0) {
      initialImageRefs.push(...subImages);
    }
    
    setImageRefs(initialImageRefs);
  }, [mainImage, subImages]);

  // 서브 이미지 관련 계산
  const hasValidSubImages = imageRefs.length > 1;
  const totalSubImages = hasValidSubImages ? imageRefs.length - 1 : 0;
  const additionalImages = totalSubImages > 4 ? totalSubImages - 3 : 0;

  // 갤러리 상태 관리
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  
  useEffect(() => {
    setIsBrowserReady(true);
  }, []);
  
  // 이미지 선택 모드가 활성화되면 모달 열기
  useEffect(() => {
    if (isSelectionMode && !isModalOpen) {
      setIsModalOpen(true);
      setSelectedImages([]);
    }
  }, [isSelectionMode, isModalOpen]);

  // 이미지 로드 오류 처리
  const handleImageError = (index) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
    console.error(`이미지 로드 실패: 인덱스 ${index}`);
  };

  // 갤러리 제어 함수들
  const openGallery = (index) => {
    if (isSelectionMode) return; // 선택 모드에서는 갤러리 열지 않음
    
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
    document.body.style.overflow = 'hidden';
  };
  
  const closeGallery = () => {
    setIsGalleryOpen(false);
    document.body.style.overflow = '';
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? imageRefs.length - 1 : prevIndex - 1
    );
  };
  
  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === imageRefs.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };
  
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
  
  useEffect(() => {
    if (isGalleryOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen]);

  // 이미지 선택 처리 함수
  const toggleImageSelection = useCallback((imageRef) => {
    setSelectedImages(prev => {
      if (prev.includes(imageRef)) {
        return prev.filter(ref => ref !== imageRef);
      } else {
        return [...prev, imageRef];
      }
    });
  }, []);

  // 이미지 선택 완료 처리
  const completeImageSelection = useCallback(() => {
    if (onImagesSelected && typeof onImagesSelected === 'function') {
      onImagesSelected(selectedImages);
    }
    setIsModalOpen(false);
  }, [selectedImages, onImagesSelected]);

  // 이미지 선택 취소
  const cancelImageSelection = useCallback(() => {
    setSelectedImages([]);
    setIsModalOpen(false);
    
    // 선택 취소 콜백 호출
    if (onCancelSelection && typeof onCancelSelection === 'function') {
      onCancelSelection();
    }
  }, [onCancelSelection]);
  
  // 갤러리 모달 컴포넌트
  const GalleryModal = () => (
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
            {imageErrors[currentImageIndex] ? (
              <div className={styles.imageErrorPlaceholder}>
                이미지를 불러올 수 없습니다.
              </div>
            ) : (
              <img 
                src={getProxiedPhotoUrl(imageRefs[currentImageIndex])} 
                alt={`이미지 ${currentImageIndex + 1}`}
                className={styles.galleryImage}
                onError={() => handleImageError(currentImageIndex)}
              />
            )}
            </div>
            
            <button className={styles.galleryNavBtn} onClick={nextImage}>
              &gt;
            </button>
          </div>
          
          <div className={styles.galleryThumbnails}>
          {imageRefs.map((ref, index) => (
              <div 
                key={index}
              className={`${styles.galleryThumbnail} ${index === currentImageIndex ? styles.activeThumbnail : ''} ${imageErrors[index] ? styles.errorThumbnail : ''}`}
                onClick={() => goToImage(index)}
              >
              {imageErrors[index] ? (
                <div className={styles.thumbnailErrorPlaceholder}></div>
              ) : (
                <img 
                  src={getProxiedPhotoUrl(ref, 100)} 
                  alt={`썸네일 ${index + 1}`}
                  onError={() => handleImageError(index)}
                />
              )}
              </div>
            ))}
          </div>
          
          <div className={styles.galleryCounter}>
          {currentImageIndex + 1} / {imageRefs.length}
        </div>
      </div>
    </div>
  );

  // 이미지 선택 모달 컴포넌트
  const ImageSelectionModal = () => (
    <div className={styles.galleryOverlay} onClick={cancelImageSelection}>
      <div className={styles.galleryContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.galleryCloseBtn} onClick={cancelImageSelection}>
          &times;
        </button>
        
        <h3 className={styles.imageSelectionTitle}>이미지 선택</h3>
        <p className={styles.imageSelectionSubtitle}>사용할 이미지를 선택하세요</p>
        
        <div className={styles.imageSelectionGrid}>
          {imageRefs.length > 0 ? (
            imageRefs.map((ref, index) => (
              <div 
                key={index}
                className={`${styles.imageSelectionItem} ${selectedImages.includes(ref) ? styles.selectedImage : ''} ${imageErrors[index] ? styles.errorItem : ''}`}
                onClick={() => !imageErrors[index] && toggleImageSelection(ref)}
              >
                <div className={styles.imageSelectionOverlay}>
                  {imageErrors[index] ? (
                    <div className={styles.imageErrorPlaceholder}>로드 실패</div>
                  ) : (
                    <img 
                      src={getProxiedPhotoUrl(ref)} 
                      alt={`이미지 ${index + 1}`}
                      onError={() => handleImageError(index)}
                    />
                  )}
                  {selectedImages.includes(ref) && !imageErrors[index] && (
                    <div className={styles.imageSelectedIcon}>✓</div>
                  )}
                </div>
                <div className={styles.imageSelectionMeta}>
                  {index === 0 ? '메인 이미지' : `서브 이미지 ${index}`}
                  {imageErrors[index] && ' (로드 실패)'}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyImageMessage}>선택할 이미지가 없습니다</div>
          )}
        </div>
        
        <div className={styles.imageSelectionActions}>
          <div className={styles.selectedCount}>
            {selectedImages.length}개 선택됨
          </div>
          <div className={styles.imageSelectionButtons}>
            <button 
              className={styles.cancelSelectionButton}
              onClick={cancelImageSelection}
            >
              취소
            </button>
            <button 
              className={styles.completeSelectionButton}
              onClick={completeImageSelection}
              disabled={selectedImages.length === 0}
            >
              최종 결정
            </button>
          </div>
          </div>
        </div>
      </div>
    );

  return (
    <>
      <div className={styles.imagesPreviewContainer}>
        {/* 메인 이미지 */}
        <div className={styles.imageSection}>
          <div 
            className={styles.mainImageContainer}
            onClick={() => imageRefs[0] && !imageErrors[0] && openGallery(0)}
            style={{ cursor: imageRefs[0] && !imageErrors[0] ? 'pointer' : 'default' }}
          >
            {imageRefs[0] ? (
              imageErrors[0] ? (
                <div className={styles.imageErrorPlaceholder}>
                  <span>이미지를 불러올 수 없습니다.</span>
                </div>
              ) : (
                <img 
                  src={getProxiedPhotoUrl(imageRefs[0])} 
                alt="메인 이미지" 
                className={styles.mainImagePreview}
                  onError={() => handleImageError(0)}
                />
              )
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>메인 이미지</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 서브 이미지 */}
        <div className={styles.imageSection}>
          <div 
            className={styles.subImagesContainer} 
            style={{ gap: '5px', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}
          >
            {hasValidSubImages ? (
              <>
                {[1, 2, 3, 4].map((index) => (
                <div 
                    key={index}
                  className={styles.subImageItem}
                    onClick={() => imageRefs[index] && !imageErrors[index] && openGallery(index)}
                    style={{ cursor: imageRefs[index] && !imageErrors[index] ? 'pointer' : 'default' }}
                  >
                    {imageRefs[index] ? (
                      imageErrors[index] ? (
                        <div className={styles.imageErrorPlaceholder}>
                          <span>로드 실패</span>
                </div>
                      ) : (
                        <div className={index === 4 && additionalImages > 0 ? styles.subImageWithOverlay : ''}>
                          <img 
                            src={getProxiedPhotoUrl(imageRefs[index])} 
                            alt={`서브 이미지 ${index}`} 
                      className={styles.subImagePreview}
                            onError={() => handleImageError(index)}
                          />
                          {index === 4 && additionalImages > 0 && (
                        <div className={styles.imageCountOverlay}>
                          +{additionalImages}
                        </div>
                      )}
                    </div>
                      )
                  ) : (
                    <div className={styles.emptyImagePlaceholder}></div>
                  )}
                </div>
                ))}
              </>
            ) : (
              Array(4).fill(null).map((_, index) => (
                <div key={index} className={styles.subImageItem}>
                  <div className={styles.emptyImagePlaceholder}></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 갤러리 모달 포털 */}
      {isBrowserReady && isGalleryOpen && imageRefs.length > 0 && 
        createPortal(<GalleryModal />, document.body)}
        
      {/* 이미지 선택 모달 포털 */}
      {isBrowserReady && isModalOpen && 
        createPortal(<ImageSelectionModal />, document.body)}
    </>
  );
};

export default ImageSectionManager; 