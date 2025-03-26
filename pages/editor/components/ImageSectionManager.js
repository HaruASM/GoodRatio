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
 * @param {boolean} props.isEditMode - 이미지 순서 편집 모드 활성화 여부
 * @param {Array<string>} props.editImages - 편집할 이미지 배열 (순서 편집 모드에서 사용)
 * @returns {React.ReactElement} 이미지 관리 UI 컴포넌트
 */
const ImageSectionManager = ({ 
  mainImage, 
  subImages, 
  onImagesSelected, 
  onCancelSelection, 
  isSelectionMode = false,
  isEditMode = false,
  editImages = []
}) => {
  // photo_reference 배열 상태 관리
  const [imageRefs, setImageRefs] = useState([]);
  
  // 선택된 이미지 상태 관리
  const [selectedImages, setSelectedImages] = useState([]);

  // 이미지 순서 편집 상태 관리
  const [editedImages, setEditedImages] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);

  // 선택 모드 상태
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 순서 편집 모드 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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

  // 편집 모드에서 이미지 배열 초기화
  useEffect(() => {
    if (isEditMode && editImages && editImages.length > 0) {
      setEditedImages([...editImages]);
      setIsEditModalOpen(true);
    }
  }, [isEditMode, editImages]);

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
    if (isSelectionMode || isEditMode) return; // 선택 모드나 편집 모드에서는 갤러리 열지 않음
    
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

  // 이미지 드래그 시작
  const handleDragStart = (e, index) => {
    // 이미 드래그 중인 경우 무시
    if (draggedItem !== null) return;
    
    // 드래그할 아이템 인덱스 설정
    setDraggedItem(index);
    
    // 드래그 효과 및 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 드래그 이미지 설정 (드래그 시 표시되는 미리보기)
    try {
      // 로드 실패 이미지인지 확인
      const hasError = imageErrors[`edit-${index}`];
      
      if (!hasError && e.target.tagName === 'IMG') {
        e.dataTransfer.setDragImage(e.target, 20, 20);
      } else {
        // 이미지가 아니거나 로드 실패 상태인 경우
        // 해당 요소 자체를 드래그 이미지로 사용
        const element = document.querySelector(`[data-index="${index}"]`);
        if (element) {
          e.dataTransfer.setDragImage(element, 20, 20);
        }
      }
    } catch (err) {
      console.log('setDragImage 미지원 브라우저:', err);
    }
    
    // 드래그 중임을 시각적으로 표시 (setTimeout으로 실행 순서 문제 방지)
    setTimeout(() => {
      const draggableElement = document.querySelector(`[data-index="${index}"]`);
      if (draggableElement) {
        draggableElement.classList.add('dragging');
      }
    }, 0);
    
    console.log('Drag started:', index);
  };

  // 드래그 오버 이벤트 처리
  const handleDragOver = (e, index) => {
    // 기본 동작 방지 (필수)
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그한 아이템이 없거나 현재 위치와 동일하면 처리하지 않음
    if (draggedItem === null || draggedItem === index) {
      return;
    }
    
    try {
      // 새로운 순서로 이미지 배열 업데이트
      const newImageOrder = [...editedImages];
      const draggedImage = newImageOrder[draggedItem];
      
      // 원래 위치에서 제거하고 새 위치에 삽입
      newImageOrder.splice(draggedItem, 1);
      newImageOrder.splice(index, 0, draggedImage);
      
      // 현재 드래그 중인 아이템 인덱스 업데이트
      setDraggedItem(index);
      // 이미지 순서 업데이트
      setEditedImages(newImageOrder);
    } catch (error) {
      console.error('드래그 순서 변경 중 오류 발생:', error);
    }
  };

  // 드래그 엔터 이벤트 처리 (시각적 피드백 제공)
  const handleDragEnter = (e) => {
    e.preventDefault();
    
    // 시각적 피드백을 위해 drag-over 클래스 추가
    const target = e.currentTarget || e.target;
    if (target && target.classList) {
      target.classList.add('drag-over');
    }
  };

  // 드래그 리브 이벤트 처리 (시각적 피드백 제거)
  const handleDragLeave = (e) => {
    // 자식 요소로 이동할 때는 drag-over 유지
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    
    // 시각적 피드백 제거
    const target = e.currentTarget || e.target;
    if (target && target.classList) {
      target.classList.remove('drag-over');
    }
  };

  // 드래그 엔드 이벤트 처리
  const handleDragEnd = (e) => {
    // 모든 드래깅 관련 클래스 제거
    document.querySelectorAll('.dragging').forEach(item => {
      item.classList.remove('dragging');
    });
    
    document.querySelectorAll('.drag-over').forEach(item => {
      item.classList.remove('drag-over');
    });
    
    // 드래그 상태 초기화
    setDraggedItem(null);
    
    console.log('Drag ended');
  };

  // 드롭 이벤트 처리
  const handleDrop = (e, index) => {
    // 기본 동작 방지
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그 오버 스타일 제거
    const target = e.currentTarget || e.target;
    if (target && target.classList) {
      target.classList.remove('drag-over');
    }
    
    // 드래그 아이템이 없는 경우 처리하지 않음
    if (draggedItem === null) return;
    
    try {
      // 드롭 위치와 드래그 위치가 같으면 처리하지 않음
      if (draggedItem === index) return;
      
      // 현재 이미지 순서 확인
      console.log('최종 이미지 순서:', editedImages);
      
      // 순서 확인 및 필요시 마지막으로 순서 조정
      if (draggedItem !== index) {
        const finalOrder = [...editedImages];
        const movedImage = finalOrder[draggedItem];
        
        // 드래그한 아이템 제거 후 새 위치에 삽입
        finalOrder.splice(draggedItem, 1);
        finalOrder.splice(index, 0, movedImage);
        
        // 최종 순서 업데이트
        setEditedImages(finalOrder);
      }
    } catch (error) {
      console.error('드롭 처리 중 오류 발생:', error);
    }
    
    // 드래그 상태 초기화
    setDraggedItem(null);
    
    console.log('Drop 완료:', index);
  };

  // 이미지 제거
  const removeImage = (index) => {
    try {
      if (index < 0 || index >= editedImages.length) {
        console.warn('유효하지 않은 이미지 인덱스:', index);
        return;
      }
      
      // 이미지 배열에서 해당 인덱스 제거
      setEditedImages(prev => prev.filter((_, idx) => idx !== index));
      
      // 드래그 중인 아이템 인덱스 업데이트
      if (draggedItem !== null) {
        if (draggedItem === index) {
          // 드래그 중인 아이템이 제거되면 draggedItem 초기화
          setDraggedItem(null);
        } else if (draggedItem > index) {
          // 제거된 아이템보다 인덱스가 크면 조정
          setDraggedItem(draggedItem - 1);
        }
      }
    } catch (error) {
      console.error('이미지 제거 중 오류 발생:', error);
    }
  };

  // 편집 완료 처리
  const completeImageOrdering = () => {
    if (onImagesSelected && typeof onImagesSelected === 'function') {
      // 첫 번째 이미지는 메인 이미지, 나머지는 서브 이미지로 설정하여 콜백 호출
      onImagesSelected(editedImages);
    }
    setIsEditModalOpen(false);
  };

  // 편집 취소
  const cancelImageOrdering = () => {
    setEditedImages([]);
    setIsEditModalOpen(false);
    
    // 취소 콜백 호출
    if (onCancelSelection && typeof onCancelSelection === 'function') {
      onCancelSelection();
    }
  };
  
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

  // 이미지 순서 편집 모달 컴포넌트 (신규)
  const ImageOrderingModal = () => (
    <div className={styles.galleryOverlay} onClick={cancelImageOrdering}>
      <div className={styles.galleryContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.galleryCloseBtn} onClick={cancelImageOrdering}>
          &times;
        </button>
        
        <h3 className={styles.imageSelectionTitle}>이미지 순서 편집</h3>
        <p className={styles.imageSelectionSubtitle}>
          이미지를 드래그하여 순서를 변경하세요. 첫 번째 이미지가 메인 이미지가 됩니다.
        </p>
        
        <div className={styles.dragInstructions}>
          ↔️ 이미지를 원하는 위치로 드래그해서 순서를 변경하세요
        </div>
        
        <div className={styles.imageOrderingContainer}>
          {editedImages.length > 0 ? (
            <div className={styles.imageOrderingGrid}>
              {editedImages.map((imageRef, index) => {
                const hasError = imageErrors[`edit-${index}`];
                
                return (
                  <div 
                    key={index}
                    className={`${styles.imageOrderingGridItem} ${index === 0 ? styles.mainImageItem : ''} ${hasError ? styles.errorItem : ''}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    data-index={index}
                    data-error={hasError ? "true" : "false"}
                  >
                    <div className={styles.dragHandle} title="드래그하여 순서 변경">
                      ≡
                    </div>
                    
                    {index === 0 ? (
                      <div className={styles.imageOrderLabel}>메인 이미지</div>
                    ) : (
                      <div className={styles.imageOrderNumber}>{index + 1}</div>
                    )}
                    {hasError ? (
                      <div className={styles.imageErrorPlaceholder}>
                        <span>로드 실패</span>
                      </div>
                    ) : (
                      <img 
                        src={getProxiedPhotoUrl(imageRef)} 
                        alt={`이미지 ${index + 1}`}
                        onError={() => setImageErrors(prev => ({ ...prev, [`edit-${index}`]: true }))}
                      />
                    )}
                    <div className={styles.imageOrderingControls}>
                      <button 
                        className={styles.removeImageButton}
                        onClick={() => removeImage(index)}
                        title="이미지 제거"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyImageMessage}>편집할 이미지가 없습니다</div>
          )}
        </div>
        
        <div className={styles.imageSelectionActions}>
          <div className={styles.selectedCount}>
            {editedImages.length}개 이미지
          </div>
          <div className={styles.imageSelectionButtons}>
            <button 
              className={styles.cancelSelectionButton}
              onClick={cancelImageOrdering}
            >
              취소
            </button>
            <button 
              className={styles.completeSelectionButton}
              onClick={completeImageOrdering}
              disabled={editedImages.length === 0}
            >
              순서 저장
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
        
      {/* 이미지 순서 편집 모달 포털 (신규) */}
      {isBrowserReady && isEditModalOpen && 
        createPortal(<ImageOrderingModal />, document.body)}
    </>
  );
};

export default ImageSectionManager; 