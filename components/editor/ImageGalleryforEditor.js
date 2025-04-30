import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import { 
  IMAGE_TEMPLATES,
  createNextImageProps
} from '../../lib/utils/imageHelpers';
import { 
  toggleImageSelection,
  confirmImageSelection,
  resetImageSelection,
  closeImageSelectionMode,
  selectIsImageSelectionMode,
  selectImages,
  selectSelectedImages,
  closeImageOrderEditor,
  confirmImageOrder,
  selectIsImageOrderEditorOpen,
  selectImageOrderSource,
  selectOrderedImages,
  selectHasMainImage
} from '../../lib/store/slices/imageGallerySlice';
import styles from '../../pages/editor/styles.module.css';

// 공통 함수: 툴팁 위치 업데이트
const updateTooltipPosition = (e, setTooltipPosition) => {
  setTooltipPosition({
    x: e.clientX,
    y: e.clientY
  });
};

/**
 * 이미지 선택 갤러리 컴포넌트
 * 이미지를 선택하고 확인할 수 있는 UI
 * 
 * @returns {React.ReactElement} 이미지 선택 갤러리 UI 컴포넌트
 */
const ImageSelectionGallery = () => {
  const dispatch = useDispatch();
  
  // Redux 상태 구독
  const isActive = useSelector(selectIsImageSelectionMode);
  const galleryImages = useSelector(selectImages);
  const selectedImagesFromRedux = useSelector(selectSelectedImages);
  
  // 선택된 이미지 로컬 상태
  const [selectedImages, setSelectedImages] = useState([]);
  
  // 이미지 props 상태 추가
  const [imageProps, setImageProps] = useState({});
  const [tooltipImageProps, setTooltipImageProps] = useState(null);
  
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
      
      // 이미지 props 로드
      loadImageProps();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive, selectedImagesFromRedux]);
  
  // 이미지 props 로드 함수
  const loadImageProps = async () => {
    if (!galleryImages || !galleryImages.length) return;
    
    // 이미지 props 매핑 생성
    const propsPromises = galleryImages.map(async (publicId) => {
      try {
        const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.THUMBNAIL, {
          alt: '이미지',
          width: 150,
          height: 150
        });
        return [publicId, props];
      } catch (error) {
        console.error('이미지 props 생성 오류:', error);
        return [publicId, null];
      }
    });
    
    const propsEntries = await Promise.all(propsPromises);
    setImageProps(Object.fromEntries(propsEntries));
  };
  
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
  const handleMouseEnter = async (imageId, e) => {
    setTooltipImage(imageId);
    updateTooltipPosition(e, setTooltipPosition);
    
    // 툴팁 이미지 props 로드
    try {
      const props = await createNextImageProps(imageId, IMAGE_TEMPLATES.NORMAL, {
        width: 300, 
        height: 200, 
        alt: "이미지 미리보기",
        objectFit: "contain"
      });
      setTooltipImageProps(props);
    } catch (error) {
      console.error('툴팁 이미지 props 생성 오류:', error);
      setTooltipImageProps(null);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltipImage(null);
    setTooltipImageProps(null);
  };
  
  const handleMouseMove = (e) => {
    if (tooltipImage) {
      updateTooltipPosition(e, setTooltipPosition);
    }
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
                {imageProps[publicId] ? (
                  <Image 
                    {...imageProps[publicId]}
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className={styles.emptyImagePlaceholder}>로딩 중...</div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* 이미지 확대 툴팁 */}
        {tooltipImage && tooltipImageProps && (
          <div 
            className={styles.galleryImageTooltip}
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`
            }}
          >
            <Image
              {...tooltipImageProps}
              style={{ objectFit: 'contain' }}
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
 * 이미지 순서를 드래그 앤 드롭으로 편집할 수 있는 UI
 * 
 * @returns {React.ReactElement} 이미지 순서 편집 갤러리 UI 컴포넌트
 */
const ImageOrderEditorGallery = () => {
  const dispatch = useDispatch();
  
  // Redux 상태 구독
  const isOpen = useSelector(selectIsImageOrderEditorOpen);
  const storeOrderedImages = useSelector(selectOrderedImages);
  const hasMainImage = useSelector(selectHasMainImage);
  
  // 로컬 상태
  const [orderedImages, setOrderedImages] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [renderKey, setRenderKey] = useState(0); // 강제 리렌더링을 위한 키
  const [localHasMainImage, setLocalHasMainImage] = useState(hasMainImage); // 로컬 hasMainImage 상태
  
  // 이미지 props 상태 추가
  const [imageProps, setImageProps] = useState({});
  
  // 이미지 컨테이너 ref
  const containerRef = useRef(null);
  
  // 갤러리가 열릴 때 이미지 초기화
  useEffect(() => {
    if (!isOpen) return;
    
    document.body.style.overflow = 'hidden';
    
    // storeOrderedImages를 가져와서 로컬 상태 초기화
    let newOrderedImages = [];
    
    if (storeOrderedImages && storeOrderedImages.length > 0) {
      newOrderedImages = [...storeOrderedImages];
    }
    
    // hasMainImage가 false이면 첫 번째 인덱스가 'blank'인 상태로 설정
    if (!hasMainImage && newOrderedImages.length > 0) {
      newOrderedImages = ['blank', ...newOrderedImages];
    }
    
    setOrderedImages(newOrderedImages);
    setLocalHasMainImage(hasMainImage);
    setRenderKey(prev => prev + 1); // 초기화 시 렌더링 키 업데이트
    
    // 이미지 props 로드
    loadImageProps(newOrderedImages);
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, storeOrderedImages, hasMainImage]);
  
  // 이미지 props 로드 함수
  const loadImageProps = async (images) => {
    if (!images || !images.length) return;
    
    // 이미지 props 매핑 생성 - 'blank'는 제외
    const validImages = images.filter(img => img !== 'blank');
    const propsPromises = validImages.map(async (publicId) => {
      try {
        const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.NORMAL, {
          alt: '이미지',
          width: 100,
          height: 100
        });
        return [publicId, props];
      } catch (error) {
        console.error('이미지 props 생성 오류:', error);
        return [publicId, null];
      }
    });
    
    const propsEntries = await Promise.all(propsPromises);
    setImageProps(Object.fromEntries(propsEntries));
  };
  
  // orderedImages 변경 시 DOM 갱신을 위한 useEffect
  useEffect(() => {
    if (orderedImages.length > 0) {
      console.log("orderedImages 변경됨:", orderedImages);
      
      // 이미지 props 업데이트
      loadImageProps(orderedImages);
      
      // DOM 업데이트를 위한 강제 리렌더링 트리거
      const timer = setTimeout(() => {
        setRenderKey(prev => prev + 1);
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [orderedImages]);
  
  // 이미지 삭제 핸들러 추가
  const handleDeleteImage = (indexToDelete) => {
    console.log("이미지 삭제 요청:", indexToDelete);
    
    // 새 배열 생성 (깊은 복사)
    const newOrderedImages = [...orderedImages];
    
    // 메인 이미지(0번)가 삭제되는 경우
    if (indexToDelete === 0 && localHasMainImage) {
      // 다른 이미지가 있는 경우 첫 번째 이미지를 'blank'로 대체
      if (newOrderedImages.length > 1) {
        // 'blank' 추가하고 나머지 이미지 유지
        newOrderedImages[0] = 'blank';
        
        // hasMainImage를 false로 설정
        setLocalHasMainImage(false);
      } 
      // 이미지가 하나뿐인 경우 빈 배열 설정
      else {
        setOrderedImages([]);
        setLocalHasMainImage(false);
        return; // 빈 배열로 설정했으므로 더 이상 처리하지 않음
      }
    } 
    // 서브 이미지가 삭제되는 경우 또는 메인 이미지가 없는 상태에서 삭제
    else {
      // 해당 인덱스 제거
      newOrderedImages.splice(indexToDelete, 1);
    }
    
    // 새 배열 설정
    setOrderedImages(newOrderedImages);
    
    // 강제 리렌더링 트리거
    setTimeout(() => {
      setRenderKey(prev => prev + 1);
    }, 10);
    
    console.log("이미지 삭제 후 배열:", newOrderedImages);
  };

  // 드래그 시작 핸들러
  const handleDragStart = (e, index) => {
    // 'blank' 이미지는 드래그 불가능
    if (orderedImages[index] === 'blank') {
      e.preventDefault();
      return false;
    }
    
    // dataTransfer 객체에 드래그 중인 이미지 인덱스 정보 저장
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', index.toString());
      e.dataTransfer.effectAllowed = 'move';
    }
    
    setDraggedIndex(index);
    e.currentTarget.style.opacity = '0.6';
  };
  
  // 드래그 종료 핸들러
  const handleDragEnd = (e) => {
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedIndex(null);
  };
  
  // 드래그 오버 핸들러
  const handleDragOver = (e) => {
    // 기본 동작 방지 (필수)
    e.preventDefault();
    
    // 드래그 효과 설정
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    // 드래그 오버 시 시각적 피드백 추가
    if (!e.currentTarget.classList.contains(styles.dragOver)) {
      e.currentTarget.classList.add(styles.dragOver);
    }
    
    return false;
  };
  
  // 드래그 떠남 핸들러 (추가)
  const handleDragLeave = (e) => {
    // 드래그 오버 시각적 피드백 제거
    e.currentTarget.classList.remove(styles.dragOver);
  };
  
  // 드롭 핸들러
  const handleDrop = (e, dropIndex) => {
    // 기본 동작 방지 (필수)
    e.preventDefault();
    
    // 드래그 오버 시각적 피드백 제거
    e.currentTarget.classList.remove(styles.dragOver);
    
    // dataTransfer에서 드래그된 인덱스 가져오기
    let dragIndex = draggedIndex;
    
    // dataTransfer에서 드래그된 인덱스를 직접 읽어오는 방식도 병행
    if (e.dataTransfer && e.dataTransfer.getData('text/plain')) {
      const transferIndex = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(transferIndex)) {
        dragIndex = transferIndex;
      }
    }
    
    // 드래그 인덱스가 없거나 동일한 위치면 처리하지 않음
    if (dragIndex === null || dragIndex === dropIndex) {
      console.log("드롭 취소: 같은 위치거나 드래그 인덱스 없음", { dragIndex, dropIndex });
      return;
    }
    
    console.log("드롭 전 이미지 배열:", JSON.stringify(orderedImages));
    
    // 새 배열 만들기 (깊은 복사)
    const newOrderedImages = [...orderedImages];
    const draggedImage = newOrderedImages[dragIndex];
    
    console.log("드래그된 이미지:", draggedImage, "드래그 인덱스:", dragIndex, "드롭 인덱스:", dropIndex);
    
    // target 인덱스가 0번이고 현재 'blank'이면 특수 처리
    if (dropIndex === 0 && orderedImages[0] === 'blank') {
      console.log("특수 케이스: blank 위치로 드롭");
      
      // 'blank' 제거하고 드래그된 이미지가 첫 번째가 되는 새 배열 생성
      const result = [];
      
      // 첫 번째 위치에 드래그된 이미지 추가
      result.push(draggedImage);
      
      // 나머지 이미지 추가 (드래그된 이미지와 'blank' 제외)
      for (let i = 0; i < newOrderedImages.length; i++) {
        if (i !== dragIndex && newOrderedImages[i] !== 'blank') {
          result.push(newOrderedImages[i]);
        }
      }
      
      console.log("특수 처리 후 새 배열:", JSON.stringify(result));
      
      // 새 배열로 설정
      setOrderedImages(result);
      
      // 이제 메인 이미지가 있으므로 hasMainImage 상태 업데이트
      setLocalHasMainImage(true);
    } else {
      // 일반적인 드래그 앤 드롭 처리
      newOrderedImages.splice(dragIndex, 1); // 드래그 아이템 제거
      newOrderedImages.splice(dropIndex, 0, draggedImage); // 드롭 위치에 추가
      
      // 새 배열 설정 (완전히 새로운 참조)
      setOrderedImages([...newOrderedImages]);
      console.log("일반 처리 후 새 배열:", JSON.stringify(newOrderedImages));
    }
    
    // 드래그 인덱스 초기화
    setDraggedIndex(null);
    
    // 강제 리렌더링 트리거
    setTimeout(() => {
      setRenderKey(prev => prev + 1);
    }, 10);
    
    // 브라우저 콘솔에 로그 출력 (디버깅용)
    console.log(`이미지 이동 완료: ${dragIndex} -> ${dropIndex}`);
  };
  
  // 메인 이미지와 서브 이미지로 포맷팅하는 함수
  const formatImagesForSubmission = (images) => {
    if (!images || images.length === 0) {
      return { mainImage: '', subImages: [] };
    }
    
    if (localHasMainImage) {
      return {
        mainImage: images[0],
        subImages: images.slice(1)
      };
    } else {
      // 'blank'가 있으면 제거하고 모두 subImages로 반환
      const filteredImages = images.filter(img => img !== 'blank');
      return {
        mainImage: '',
        subImages: filteredImages
      };
    }
  };
  
  // 확인 버튼 클릭
  const handleConfirm = () => {
    const { mainImage, subImages } = formatImagesForSubmission(orderedImages);
    
    console.log("이미지 순서 편집 확인 버튼 클릭:", {
      orderedImages,
      formattedMainImage: mainImage,
      formattedSubImages: subImages,
      localHasMainImage
    });
    
    // 이미지 순서 확인 액션 디스패치
    dispatch(confirmImageOrder({
      mainImage,
      subImages,
      hasMainImage: localHasMainImage
    }));
    
    // 갤러리 닫기
    dispatch(closeImageOrderEditor());
  };
  
  // 취소 버튼 클릭
  const handleCancel = () => {
    dispatch(closeImageOrderEditor());
  };
  
  // 갤러리가 열려있지 않으면 아무것도 렌더링하지 않음
  if (!isOpen) {
    return null;
  }
  
  // 이미지 목록 렌더링
  return (
    <div className={styles.galleryOverlay}>
      <div className={styles.galleryContentContainer}>
        <div className={styles.galleryHeader}>
          <h3>이미지 순서 편집</h3>
          <button className={styles.galleryCloseButton} onClick={handleCancel}>×</button>
        </div>
        
        {/* 이미지 목록 컨테이너 - renderKey를 key로 사용하여 강제 리렌더링 */}
        <div 
          ref={containerRef}
          className={styles.imageOrderEditContainer}
          key={`container-${renderKey}`}
        >
          {/* 메인 이미지 슬롯 - 항상 첫 번째 위치에 표시 */}
          {localHasMainImage || (orderedImages.length > 0 && orderedImages[0] !== 'blank') ? (
            <div 
              key={`main-image-${orderedImages[0] || 'empty'}-${renderKey}`}
              className={`${styles.imageOrderItem} ${styles.mainImageItem} ${draggedIndex === 0 ? styles.isDragging : ''}`}
              style={{ gridRow: 1, gridColumn: 1 }}
              draggable={orderedImages.length > 0 && orderedImages[0] !== 'blank'}
              onDragStart={(e) => handleDragStart(e, 0)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 0)}
            >
              <div className={styles.imageContainerItem}>
                {orderedImages.length > 0 && orderedImages[0] !== 'blank' ? (
                  <>
                    {imageProps[orderedImages[0]] ? (
                      <Image 
                        {...imageProps[orderedImages[0]]}
                        style={{ objectFit: 'contain' }}
                      />
                    ) : (
                      <div className={styles.emptyImagePlaceholder}>로딩 중...</div>
                    )}
                    <button 
                      className={styles.imageDeleteButton}
                      onClick={() => handleDeleteImage(0)}
                      title="이미지 삭제"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className={styles.emptyImageOrderPlaceholder}>
                    <span>비어 있음</span>
                  </div>
                )}
                <div className={styles.mainImageBadge}>메인</div>
              </div>
            </div>
          ) : (
            <div 
              key={`empty-main-slot-${renderKey}`}
              className={`${styles.imageOrderItem} ${styles.mainImageItem}`}
              style={{ gridRow: 1, gridColumn: 1 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 0)}
            >
              <div className={styles.imageContainerItem}>
                <div className={styles.emptyImageOrderPlaceholder}>
                  <span>메인 이미지 없음</span>
                </div>
                <div className={styles.mainImageBadge}>메인</div>
              </div>
            </div>
          )}
          
          {/* 서브 이미지 목록 - 메인 이미지 다음 위치부터 표시 */}
          {orderedImages.map((publicId, index) => {
            // 메인 이미지와 'blank' 이미지는 건너뜀
            if ((localHasMainImage && index === 0) || publicId === 'blank') return null;
            
            // 실제 표시될 인덱스 (UI 표시용)
            const displayIndex = localHasMainImage ? index : index;
            
            // 그리드 열 위치 계산 - 메인 이미지 다음부터 순서대로
            const gridColumn = localHasMainImage ? index + 1 : index + 2;
            
            return (
              <div 
                key={`order-image-${publicId}-${index}-${renderKey}`}
                className={`${styles.imageOrderItem} ${draggedIndex === index ? styles.isDragging : ''}`}
                style={{ gridRow: 1, gridColumn: gridColumn }}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className={styles.imageContainerItem}>
                  {imageProps[publicId] ? (
                    <Image 
                      {...imageProps[publicId]}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <div className={styles.emptyImagePlaceholder}>로딩 중...</div>
                  )}
                  <button 
                    className={styles.imageDeleteButton}
                    onClick={() => handleDeleteImage(index)}
                    title="이미지 삭제"
                  >
                    ✕
                  </button>
                  <div className={styles.subImageBadge}>
                    서브 {displayIndex}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 버튼 영역 */}
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
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// 컴포넌트 내보내기
export { ImageSelectionGallery, ImageOrderEditorGallery }; 