import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import styles from '../styles.module.css';

import {
  selectIsImageGalleryOpen,
  selectIsImageSelectionMode,
  selectIsImageOrderEditorOpen,
  selectMainImage,
  selectSubImages,
  selectSelectedImages,
  selectEditedImages,
  selectCurrentImageIndex,
  selectDraggedItemIndex,
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
  removeImage
} from '../store/slices/imageManagerSlice';

// 유틸리티 함수 가져오기
import { getProxiedPhotoUrl, getValidImageRefs, handleImageError } from '../utils/imageHelpers';

/**
 * 이미지 관리 컴포넌트 - 메인 이미지와 서브 이미지를 출력하고 관리
 * 
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.mainImage - 메인 이미지 photo_reference
 * @param {string} props.subImages - 서브 이미지 photo_reference 배열
 * @param {Function} props.onImagesSelected - 이미지 선택 완료 시 호출될 콜백 함수
 * @param {Function} props.onCancelSelection - 이미지 선택 취소 시 호출될 콜백 함수
 * @param {boolean} props.isSelectionMode - 이미지 선택 모드 활성화 여부
 * @param {string} props.source - 컴포넌트 소스 식별자 ('rightSidebar' 또는 'compareBar')
 * @returns {React.ReactElement} 이미지 관리 UI 컴포넌트
 */
const ImageSectionManager = forwardRef(({ 
  mainImage: propMainImage, 
  subImages: propSubImages, 
  onImagesSelected, 
  onCancelSelection, 
  isSelectionMode = false,
  source = 'rightSidebar'
}, ref) => {
  const dispatch = useDispatch();
  
  // Redux 상태 가져오기
  const isGalleryOpen = useSelector(selectIsImageGalleryOpen);
  const isModalOpen = useSelector(selectIsImageSelectionMode);
  const isOrderEditorOpen = useSelector(selectIsImageOrderEditorOpen);
  const reduxMainImage = useSelector(selectMainImage);
  const reduxSubImages = useSelector(selectSubImages);
  const selectedImages = useSelector(selectSelectedImages);
  const availableImages = useSelector(state => state.imageManager.availableImages);
  const editedImages = useSelector(selectEditedImages);
  const currentImageIndex = useSelector(selectCurrentImageIndex);
  const draggedItem = useSelector(selectDraggedItemIndex);
  const reduxSource = useSelector(state => state.imageManager.source);
  
  // 이전 모달 상태를 추적하는 ref 추가
  const prevModalOpenRef = useRef(false);
  
  // 로컬 상태 (Redux로 관리하지 않는 상태)
  const [imageRefs, setImageRefs] = useState([]);
  const [imageErrors, setImageErrors] = useState({});
  const [isBrowserReady, setIsBrowserReady] = useState(false);
  
  // 편의를 위한 별칭 (props에서 전달받은 값 또는 Redux 상태 사용)
  const mainImage = propMainImage !== undefined ? propMainImage : reduxMainImage;
  const subImages = propSubImages !== undefined ? propSubImages : reduxSubImages;
  
  // ref를 통해 외부에서 접근 가능한 함수 노출
  useImperativeHandle(ref, () => ({
    openImageOrderEditor: () => {
      dispatch(openImageOrderEditor({
        source,
        mainImage,
        subImages
      }));
    }
  }));
  
  // 초기 이미지 데이터 설정
  useEffect(() => {
    // 유효한 이미지 참조만 필터링하여 설정
    const initialImageRefs = getValidImageRefs(mainImage, subImages);
    setImageRefs(initialImageRefs);
    
    // 이미지 에러 상태 초기화
    setImageErrors({});
  }, [mainImage, subImages]);

  // 서브 이미지 관련 계산
  const hasValidSubImages = imageRefs.length > 1;
  const totalSubImages = hasValidSubImages ? imageRefs.length - 1 : 0;
  const additionalImages = totalSubImages > 4 ? totalSubImages - 3 : 0;

  // 브라우저 준비 상태 설정
  useEffect(() => {
    // 브라우저 환경이면 준비 상태 설정
    if (typeof window !== 'undefined') {
    setIsBrowserReady(true);
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      // 모달이 열려있는 상태로 컴포넌트가 언마운트될 때 정리
      if (isModalOpen) {
        dispatch(closeImageSelectionMode());
      }
    };
  }, [dispatch]);
  
  // 이미지 선택 모드가 활성화되면 모달 열기
  useEffect(() => {
    if (isSelectionMode && !isModalOpen) {
      dispatch(openImageSelectionMode({
        source,
        mainImage,
        subImages
      }));
    }
  }, [isSelectionMode, isModalOpen, dispatch, source, mainImage, subImages]);

  // 이미지 선택 완료 이벤트 핸들러 - 무한 루프 방지를 위한 정교한 조건 추가
  useEffect(() => {
    // 모달이 닫힌 경우에만 처리 (이전에는 열려있었지만 지금은 닫힌 경우)
    const wasModalOpen = prevModalOpenRef.current;
    const isModalClosed = !isModalOpen;
    
    if (wasModalOpen && isModalClosed) {
      // console.log('모달 닫힘 감지: 이미지 처리 시작', {
      //   selectedImagesCount: selectedImages?.length || 0
      // });
      
      // 선택된 이미지가 있는 경우
      if (selectedImages && selectedImages.length > 0) {
        // 선택된 이미지 유효성 검증
        const validSelectedImages = selectedImages.filter(
          img => img && typeof img === 'string' && img.trim() !== ''
        );
        
        if (validSelectedImages.length > 0 && typeof onImagesSelected === 'function') {
          // 콜백 한 번만 호출하도록 ref 설정
          prevModalOpenRef.current = false;
          onImagesSelected(validSelectedImages);
        }
      } else if (typeof onCancelSelection === 'function') {
        // 선택된 이미지가 없으면 취소로 간주
        prevModalOpenRef.current = false;
        onCancelSelection();
      }
    } else {
      // 현재 모달 상태를 ref에 저장
      prevModalOpenRef.current = isModalOpen;
    }
  }, [isModalOpen, selectedImages, onImagesSelected, onCancelSelection]);

  // 이미지 로드 오류 처리
  const handleImageLoadError = useCallback((index) => {
    // 이미지 오류 처리
    setImageErrors(prev => ({
      ...prev,
      ...handleImageError(index, imageRefs)
    }));
  }, [imageRefs]);

  // 갤러리 제어 함수들
  const openGallery = useCallback((index) => {
    // 선택 모드나 편집 모드에서는 갤러리 열지 않음
    if (isSelectionMode || isOrderEditorOpen) return;
    
    // 유효한 이미지가 있는지 확인
    const validImageRefs = getValidImageRefs(mainImage, subImages);
    if (validImageRefs.length === 0) return;
    
    // 갤러리 열기
    dispatch(openImageGallery({
      index,
      source,
      images: { mainImage, subImages }
    }));
  }, [isSelectionMode, isOrderEditorOpen, mainImage, subImages, dispatch, source]);
  
  const closeGallery = useCallback(() => {
    dispatch(closeImageGallery());
    document.body.style.overflow = '';
  }, [dispatch]);
  
  const prevImage = useCallback(() => {
    // 갤러리에 표시할 이미지 배열
    const galleryImages = imageRefs.length > 0 ? imageRefs : 
      getValidImageRefs(reduxMainImage, reduxSubImages);
    
    if (galleryImages.length <= 1) return;
    
    const newIndex = currentImageIndex <= 0 ? galleryImages.length - 1 : currentImageIndex - 1;
    dispatch(setCurrentImageIndex(newIndex));
  }, [imageRefs, reduxMainImage, reduxSubImages, currentImageIndex, dispatch]);
  
  const nextImage = useCallback(() => {
    // 갤러리에 표시할 이미지 배열
    const galleryImages = imageRefs.length > 0 ? imageRefs : 
      getValidImageRefs(reduxMainImage, reduxSubImages);
    
    if (galleryImages.length <= 1) return;
    
    const newIndex = currentImageIndex >= galleryImages.length - 1 ? 0 : currentImageIndex + 1;
    dispatch(setCurrentImageIndex(newIndex));
  }, [imageRefs, reduxMainImage, reduxSubImages, currentImageIndex, dispatch]);
  
  const goToImage = useCallback((index) => {
    // 갤러리에 표시할 이미지 배열
    const galleryImages = imageRefs.length > 0 ? imageRefs : 
      getValidImageRefs(reduxMainImage, reduxSubImages);
    
    // 인덱스 범위 확인
    if (index < 0 || index >= galleryImages.length) return;
    
    dispatch(setCurrentImageIndex(index));
  }, [imageRefs, reduxMainImage, reduxSubImages, dispatch]);
  
  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e) => {
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
  }, [isGalleryOpen, closeGallery, prevImage, nextImage]);
  
  useEffect(() => {
    if (isGalleryOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isGalleryOpen, handleKeyDown]);

  // 이미지 선택 처리 함수
  const handleToggleImageSelection = useCallback((imageRef) => {
    dispatch(toggleImageSelection(imageRef));
  }, [dispatch]);

  // 이미지 선택 완료 처리
  const completeImageSelection = useCallback(() => {
    // 선택된 이미지가 없는 경우 선택 취소
    if (!selectedImages || selectedImages.length === 0) {
      dispatch(closeImageSelectionMode());
      return;
    }
    
    // Redux 액션 디스패치
    dispatch(confirmImageSelection());
    
    // 콜백 호출
    if (onImagesSelected && typeof onImagesSelected === 'function') {
      onImagesSelected(selectedImages);
    }
  }, [dispatch, onImagesSelected, selectedImages]);

  // 이미지 선택 취소
  const cancelImageSelection = useCallback(() => {
    dispatch(closeImageSelectionMode());
    
    // 선택 취소 콜백 호출
    if (onCancelSelection && typeof onCancelSelection === 'function') {
      onCancelSelection();
    }
  }, [dispatch, onCancelSelection]);

  // 이미지 드래그 시작
  const handleDragStart = useCallback((e, index) => {
    // 이미 드래그 중인 경우 무시
    if (draggedItem !== null) return;
    
    // 드래그할 아이템 인덱스 설정
    dispatch(setDraggedItem(index));
    
    // 드래그 효과 및 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 드래그 이미지 설정 (드래그 시 표시되는 미리보기)
    try {
      // 로드 실패 이미지인지 확인
      const hasError = imageErrors[`edit-${index}`];
      
      if (!hasError && e.target.querySelector('img')) {
        // 이미지 요소를 찾아 드래그 이미지로 설정
        const imgElement = e.target.querySelector('img');
        e.dataTransfer.setDragImage(imgElement, 20, 20);
      } else {
        // 이미지가 아니거나 로드 실패 상태인 경우
        // 해당 요소 자체를 드래그 이미지로 사용
        const element = document.querySelector(`[data-index="${index}"]`);
        if (element) {
          e.dataTransfer.setDragImage(element, 20, 20);
        }
      }
    } catch (err) {
      console.log('드래그 이미지 설정 실패:', err);
    }
    
    // 드래그 중임을 시각적으로 표시
    setTimeout(() => {
      const draggableElement = document.querySelector(`[data-index="${index}"]`);
      if (draggableElement) {
        draggableElement.classList.add(styles.isImageDragging);
      }
    }, 0);
  }, [draggedItem, dispatch, imageErrors]);

  // 드래그 오버 이벤트 처리
  const handleDragOver = useCallback((e, index) => {
    // 기본 동작 방지 (필수)
    e.preventDefault();
    
    // 드래그 중인 아이템이 없는 경우 무시
    if (draggedItem === null) return;
    
    // 동일한 위치로 드래그하는 경우 무시
    if (draggedItem === index) return;
    
    // 드롭 효과 설정
    e.dataTransfer.dropEffect = 'move';
    
    // 그리드 레이아웃에서 시각적 피드백 강화
    const items = document.querySelectorAll(`.${styles.imageOrderEditorItem}`);
    items.forEach(item => {
      const itemIndex = parseInt(item.getAttribute('data-index'), 10);
      if (itemIndex === index) {
        item.style.borderStyle = 'dashed';
        item.style.borderColor = '#4CAF50';
        item.style.background = 'rgba(76, 175, 80, 0.1)';
      } else if (itemIndex !== draggedItem) {
        item.style.borderStyle = '';
        item.style.borderColor = '';
        item.style.background = '';
      }
    });
  }, [draggedItem]);

  // 드롭 이벤트 처리
  const handleDrop = useCallback((e, toIndex) => {
    // 기본 동작 방지
    e.preventDefault();
    
    // 드래그 중인 아이템이 없는 경우 무시
    if (draggedItem === null) return;
    
    // 동일한 위치로 드래그하는 경우 무시
    if (draggedItem === toIndex) {
      // 드래그 상태 초기화
      dispatch(clearDraggedItem());
      return;
    }
    
    // 이미지 순서 변경
    dispatch(moveImage({
      fromIndex: draggedItem,
      toIndex
    }));
    
    // 스타일 초기화
    const items = document.querySelectorAll(`.${styles.imageOrderEditorItem}`);
    items.forEach(item => {
      item.style.borderStyle = '';
      item.style.borderColor = '';
      item.style.background = '';
    });
    
    // 드래그 상태 초기화
    dispatch(clearDraggedItem());
  }, [draggedItem, dispatch]);

  // 드래그 종료 처리
  const handleDragEnd = useCallback(() => {
    // 모든 드래그 관련 상태 초기화
    dispatch(clearDraggedItem());
    
    // 드래그 중 CSS 클래스 및 인라인 스타일 제거
    document.querySelectorAll(`.${styles.imageOrderEditorItem}`).forEach(el => {
      el.classList.remove(styles.isImageDragging);
      el.style.borderStyle = '';
      el.style.borderColor = '';
      el.style.background = '';
    });
  }, [dispatch]);

  // 이미지 순서 편집 확인
  const confirmImageOrderEdit = useCallback(() => {
    // 이미지 순서 확정 처리
    dispatch(confirmImageOrder());
    
    // 콜백 함수가 제공된 경우 호출
    if (onImagesSelected && typeof onImagesSelected === 'function') {
      if (editedImages && editedImages.length > 0) {
        // 편집된 이미지가 있으면 그 이미지 배열 전달
        onImagesSelected(editedImages);
      } else {
        // 편집된 이미지가 없으면 빈 문자열과 빈 배열을 전달
        // 이는 protoServerDataset 초기값과 일치하도록 함
        onImagesSelected([]);
      }
    }
  }, [dispatch, onImagesSelected, editedImages]);

  // 이미지 순서 편집 취소
  const cancelImageOrderEdit = useCallback(() => {
    // Redux 상태 초기화
    dispatch(closeImageOrderEditor());
    
    // 스타일 초기화
    setTimeout(() => {
      document.querySelectorAll(`.${styles.imageOrderEditorItem}`).forEach(el => {
        el.classList.remove(styles.isImageDragging);
        el.style.borderStyle = '';
        el.style.borderColor = '';
        el.style.background = '';
      });
    }, 0);
  }, [dispatch]);

  // 이미지 삭제 처리
  const handleRemoveImage = useCallback((imageIndex) => {
    // 이미지 삭제 액션 디스패치
    dispatch(removeImage(imageIndex));
  }, [dispatch]);

  // 이미지 선택 모달 렌더링
  const renderImageSelectionModal = () => {
    if (!isModalOpen || !isBrowserReady) {
      return null;
    }

    // 모달에서 사용할 이미지 목록 가져오기
    let imageRefsToShow = [];
    
    // 1. availableImages가 있으면 우선적으로 사용
    if (availableImages && availableImages.length > 0) {
      imageRefsToShow = availableImages;
    } 
    // 2. 아니면 로컬 상태의 imageRefs 사용 
    else if (imageRefs.length > 0) {
      imageRefsToShow = imageRefs;
    }
    // 3. 마지막으로 Redux 상태에서 가져오기
    else {
      imageRefsToShow = getValidImageRefs(reduxMainImage, reduxSubImages);
    }
    
    // 마우스 이벤트 핸들러
    const handleMouseMove = (e, index) => {
      const tooltip = e.currentTarget.querySelector(`.${styles.imageTooltip}`);
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY}px`;
      }
    };
    
    // 터치 이벤트 핸들러
    const handleTouchStart = (e, imageRef) => {
      // 현재 터치된 요소에 클래스 추가
      e.currentTarget.classList.add(styles.isImageTouched);
      
      // 터치 이벤트의 위치 계산
      const touch = e.touches[0];
      if (touch) {
        const tooltip = e.currentTarget.querySelector(`.${styles.imageTooltip}`);
        if (tooltip) {
          tooltip.style.left = `${touch.clientX}px`;
          tooltip.style.top = `${touch.clientY}px`;
        }
      }
    };
    
    const handleTouchEnd = (e, imageRef) => {
      // 터치 종료 시 클래스 제거
      e.currentTarget.classList.remove(styles.isImageTouched);
      // 이미지 선택 토글
      handleToggleImageSelection(imageRef);
    };

    // 모달 렌더링
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContentContainer}>
          <div className={styles.modalHeaderContainer}>
            <h3>이미지 선택</h3>
            <button 
              className={styles.modalCloseButton} 
              onClick={cancelImageSelection}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          
          <div className={styles.modalBodyContainer}>
            <div className={styles.imageSelectionGridContainer}>
              {imageRefsToShow.length > 0 ? (
                imageRefsToShow.map((imageRef, index) => {
                  const isSelected = selectedImages.includes(imageRef);
                  const hasError = imageErrors[`selection-${index}`];
                  
                  return (
                    <div 
                      key={`select-${index}-${imageRef}`} 
                      className={`${styles.imageSelectionItem} ${isSelected ? styles.isSelectedImage : ''}`}
                      onClick={() => handleToggleImageSelection(imageRef)}
                      onMouseMove={(e) => handleMouseMove(e, index)}
                      onTouchStart={(e) => handleTouchStart(e, imageRef)}
                      onTouchEnd={(e) => handleTouchEnd(e, imageRef)}
                    >
                      <div className={styles.imageContainerItem}>
                        {!hasError ? (
                          <img 
                            src={getProxiedPhotoUrl(imageRef, 200)} 
                            alt={`이미지 ${index + 1}`}
                            onError={() => handleImageLoadError(`selection-${index}`)}
                          />
                        ) : (
                          <div className={styles.imageErrorPlaceholderContainer}>
                            <span>로드 실패</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className={styles.selectedOverlayContainer}>
                            <span className={styles.checkmarkIcon}>✓</span>
                          </div>
                        )}
                      </div>
                      {/* 툴팁(미리보기) 추가 */}
                      <div className={styles.imageTooltip}>
                        {!hasError ? (
                          <img 
                            src={getProxiedPhotoUrl(imageRef, 400)} 
                            alt={`이미지 ${index + 1} 미리보기`}
                            onError={() => handleImageLoadError(`tooltip-${index}`)}
                          />
                        ) : (
                          <div className={styles.imageErrorTooltip}>
                            <span>이미지를 불러올 수 없습니다</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.noImagesMessage}>
                  <p>선택 가능한 이미지가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.modalFooterContainer}>
            <span className={styles.selectionCountText}>
              {selectedImages.length}개 선택됨
            </span>
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelButton} 
                onClick={cancelImageSelection}
              >
                취소
              </button>
              <button 
                className={styles.confirmButton} 
                onClick={completeImageSelection}
                disabled={selectedImages.length === 0}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 이미지 갤러리 모달 렌더링
  const renderGallery = () => {
    if (!isGalleryOpen || !isBrowserReady) {
      return null;
    }

    // 갤러리에 표시할 이미지 목록 가져오기
    let galleryImages = imageRefs;
    
    // 이미지 목록이 없으면 Redux 상태에서 가져오기
    if (galleryImages.length === 0) {
      galleryImages = getValidImageRefs(reduxMainImage, reduxSubImages);
    }
    
    // 현재 선택된 이미지
    const currentImageRef = galleryImages[currentImageIndex];
    const hasGalleryError = imageErrors[`gallery-current`];

    // 갤러리 모달 렌더링
    return (
      <div className={styles.galleryOverlay}>
        <div className={styles.galleryContentContainer}>
          <button 
            className={styles.galleryCloseButton} 
            onClick={closeGallery}
            aria-label="닫기"
          >
            &times;
          </button>
          
          <div className={styles.galleryMainImageContainer}>
            <button className={styles.galleryNavButton} onClick={prevImage}>
              &lt;
            </button>
            
            <div className={styles.galleryImageContainer}>
              {!hasGalleryError ? (
                <img 
                  src={getProxiedPhotoUrl(currentImageRef, 800)} 
                alt={`이미지 ${currentImageIndex + 1}`}
                  className={styles.galleryImagePreview}
                  onError={() => handleImageLoadError('gallery-current')}
              />
              ) : (
                <div className={styles.imageErrorPlaceholderContainer}>
                  <span>이미지를 불러올 수 없습니다.</span>
                </div>
            )}
            </div>
            
            <button className={styles.galleryNavButton} onClick={nextImage}>
              &gt;
            </button>
          </div>
          
          <div className={styles.galleryThumbnailsContainer}>
            {galleryImages.map((ref, index) => (
              <div 
                key={`gallery-thumb-${index}`}
                className={`${styles.galleryThumbnailItem} ${index === currentImageIndex ? styles.isActiveThumbnail : ''} ${imageErrors[`gallery-thumb-${index}`] ? styles.isErrorThumbnail : ''}`}
                onClick={() => goToImage(index)}
              >
                {imageErrors[`gallery-thumb-${index}`] ? (
                  <div className={styles.thumbnailErrorPlaceholderContainer}></div>
              ) : (
                <img 
                  src={getProxiedPhotoUrl(ref, 100)} 
                  alt={`썸네일 ${index + 1}`}
                    onError={() => handleImageLoadError(`gallery-thumb-${index}`)}
                />
              )}
              </div>
            ))}
          </div>
          
          <div className={styles.galleryCounterContainer}>
            {galleryImages.length > 0 ? `${currentImageIndex + 1} / ${galleryImages.length}` : '0 / 0'}
        </div>
      </div>
    </div>
  );
  };

  // 이미지 순서 편집 모달 렌더링
  const renderOrderEditor = () => {
    if (!isOrderEditorOpen || !isBrowserReady) {
      return null;
    }

    // 순서 편집 모달 렌더링
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContentContainer} style={{ width: '95%', maxWidth: '900px' }}>
          <div className={styles.modalHeaderContainer}>
            <h3>이미지 순서 편집</h3>
            <button 
              className={styles.modalCloseButton} 
              onClick={cancelImageOrderEdit}
              aria-label="닫기"
            >
              ×
        </button>
          </div>
          
          <div className={styles.modalBodyContainer}>
            <p className={styles.orderInstructions}>
              이미지를 드래그하여 순서를 변경하세요. 첫 번째 이미지가 메인 이미지로 사용됩니다.
              <br />
              <small>각 이미지를 드래그하여 원하는 위치로 옮길 수 있습니다. 이미지 우측 상단의 화살표 아이콘을 활용하세요.</small>
            </p>
            
            <div className={styles.imageOrderEditorListContainer}>
              {editedImages.map((imageRef, index) => (
                <div
                  key={`order-${index}-${imageRef}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  data-index={index}
                  className={`${styles.imageOrderEditorItem} ${draggedItem === index ? styles.isImageDragging : ''}`}
                  onMouseMove={(e) => {
                    const tooltip = e.currentTarget.querySelector(`.${styles.imageTooltip}`);
                    if (tooltip) {
                      tooltip.style.left = `${e.clientX}px`;
                      tooltip.style.top = `${e.clientY}px`;
                    }
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.classList.add(styles.isImageTouched);
                    
                    // 터치 이벤트의 위치 계산
                    const touch = e.touches[0];
                    if (touch) {
                      const tooltip = e.currentTarget.querySelector(`.${styles.imageTooltip}`);
                      if (tooltip) {
                        tooltip.style.left = `${touch.clientX}px`;
                        tooltip.style.top = `${touch.clientY}px`;
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.classList.remove(styles.isImageTouched);
                  }}
                >
                  <div className={styles.imageOrderNumberContainer}></div>
                  <div className={styles.imageOrderThumbnailContainer}>
                    <img 
                      src={getProxiedPhotoUrl(imageRef, 180)} 
                      alt={`이미지 ${index + 1}`}
                      onError={() => handleImageLoadError(`edit-${index}`)}
                    />
                  </div>
                  <div className={styles.imageOrderDragHandleButton} title="드래그하여 순서 변경">
                    <span>↕</span>
                  </div>
                  <div 
                    className={styles.imageRemoveButton} 
                    title="이미지 삭제"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <span>×</span>
                  </div>
                  {/* 툴팁(미리보기) 추가 */}
                  <div className={styles.imageTooltip}>
                    {!imageErrors[`edit-${index}`] ? (
                      <img 
                        src={getProxiedPhotoUrl(imageRef, 400)} 
                        alt={`이미지 ${index + 1} 미리보기`}
                        onError={() => handleImageLoadError(`tooltip-edit-${index}`)}
                      />
                    ) : (
                      <div className={styles.imageErrorTooltip}>
                        <span>이미지를 불러올 수 없습니다</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
        </div>
          </div>
          
          <div className={styles.modalFooterContainer}>
            <div className={styles.buttonGroup}>
            <button 
                className={styles.cancelButton} 
                onClick={cancelImageOrderEdit}
            >
              취소
            </button>
            <button 
                className={styles.confirmButton} 
                onClick={confirmImageOrderEdit}
            >
                확인
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  };

  // 이미지 섹션 렌더링 - 기존 디자인 복원
  return (
    <>
      <div className={styles.imagesPreviewContainer}>
        {/* 메인 이미지 */}
        <div className={styles.imageSection}>
          <div 
            className={styles.mainImageContainer}
            onClick={() => {
              if (imageRefs.length > 0 && imageRefs[0] && !imageErrors[0]) {
                openGallery(0);
              }
            }}
            style={{ cursor: imageRefs.length > 0 && imageRefs[0] && !imageErrors[0] ? 'pointer' : 'default' }}
          >
            {imageRefs.length > 0 && imageRefs[0] ? (
              imageErrors[0] ? (
                <div className={styles.imageErrorPlaceholderContainer}>
                  <span>이미지를 불러올 수 없습니다.</span>
                </div>
              ) : (
                <img 
                  src={getProxiedPhotoUrl(imageRefs[0])} 
                alt="메인 이미지" 
                className={styles.mainImagePreview}
                  onError={() => handleImageLoadError(0)}
                />
              )
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>이미지 없음</span>
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
                {[1, 2, 3, 4].map((index) => {
                  // 배열 범위를 벗어나는지 확인
                  const isInRange = index < imageRefs.length;
                  const hasImage = isInRange && imageRefs[index];
                  const hasError = isInRange && imageErrors[index];
                  
                  return (
                <div 
                    key={index}
                  className={styles.subImageItem}
                      onClick={() => {
                        if (hasImage && !hasError) {
                          openGallery(index);
                        }
                      }}
                      style={{ cursor: hasImage && !hasError ? 'pointer' : 'default' }}
                    >
                      {hasImage ? (
                        hasError ? (
                          <div className={styles.imageErrorPlaceholderContainer}>
                          <span>로드 실패</span>
                </div>
                      ) : (
                        <div className={index === 4 && additionalImages > 0 ? styles.subImageWithOverlay : ''}>
                          <img 
                            src={getProxiedPhotoUrl(imageRefs[index])} 
                            alt={`서브 이미지 ${index}`} 
                      className={styles.subImagePreview}
                              onError={() => handleImageLoadError(index)}
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
                  );
                })}
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
      
      {/* 모달 렌더링 */}
      {renderGallery()}
      {renderImageSelectionModal()}
      {renderOrderEditor()}
    </>
  );
});

export default ImageSectionManager; 