/**
 * 이미지 섹션 관리자 컴포넌트 (ImageSectionManager)
 * 
 * 역할:
 * - 메인 이미지와 서브 이미지 미리보기 UI 제공
 * - 이미지 추가/변경 및 순서 조정 기능 버튼 제공
 * - 실제 이미지 프리뷰 표시 (인라인 컴포넌트)
 * 
 * 이미지 갤러리 시스템 개요:
 * 
 * 1. 이미지 관련 갤러리 유형:
 *    - 이미지 확인 갤러리: 전체 화면 이미지 보기 (ImageGallery.js)
 *    - 이미지 선택 갤러리: 이미지 선택 기능
 *    - 이미지 순서 편집 갤러리: 순서 변경 기능
 * 
 * 2. 데이터 흐름:
 *    - Redux 액션을 통해 갤러리 열기/닫기 관리 (imageGallerySlice.js)
 *    - 부모 컴포넌트(RightSidebar/CompareBar)에서 props 전달 (mainImage, subImages)
 *    - 사용자 이벤트 발생 시 Redux 액션 디스패치 및 부모 콜백 호출
 * 
 * 3. 주요 상호작용:
 *    - 이미지 추가/변경 버튼 클릭 → openImageSelectionMode 액션 디스패치
 *    - 순서 변경 버튼 클릭 → openImageOrderEditor 액션 디스패치
 *    - 갤러리 이벤트 완료 → 부모 컴포넌트 콜백(onImageOrderChange) 호출
 * 
 * 참고: 이 컴포넌트는 ImageGallery.js와 분리되어 있으며, ImageGallery는 전체 화면 
 * 이미지 보기에 중점을 두는 반면, 이 컴포넌트는 이미지 관리에 중점을 둡니다.
 */

import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import styles from '../../pages/editor/styles.module.css';

// 이미지 갤러리 슬라이스에서 필요한 액션과 선택자만 가져오기
import {
  openImageOrderEditor,
  openImageSelectionMode,
  selectSelectedImages,
  openGallery
} from '../../lib/store/slices/imageGallerySlice';

import { 
  IMAGE_TEMPLATES,
  createNextImageProps
} from '../../lib/utils/imageHelpers';

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
  subImages = []
}, ref) => {
  const dispatch = useDispatch();
  
  // 상태 추가
  const [mainImageProps, setMainImageProps] = useState(null);
  const [subImageProps, setSubImageProps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 이미지 로딩 상태 관리
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  
  // 모든 이미지를 하나의 배열로 병합
  const allImages = [
    ...(mainImage && typeof mainImage === 'string' && mainImage.trim() !== '' ? [mainImage] : []),
    ...Array.isArray(subImages) 
      ? subImages.filter(img => img && typeof img === 'string' && img.trim() !== '')
      : []
  ];
  
  // 이미지 props 로드
  useEffect(() => {
    // 이 useEffect에는 지역 변수나 파생된 값(validMainImage, validSubImages 등)을 의존성 배열에 추가하지 마세요.
    // 해당 변수들을 의존성 배열에 추가할 경우 무한 업데이트 루프가 발생합니다! (Maximum update depth exceeded 에러)
    // 이 부분은 이전에 문제가 되어 수정된 코드입니다.
    
    // 이미지 props 생성 함수
    const loadImageProps = async () => {
      setIsLoading(true);
      
      // 현재 scope 내에서 validMainImage와 validSubImages 계산
      // 의존성 배열에 추가하지 않고 useEffect 내부에서만 사용해야 함
      const validMainImage = mainImage && typeof mainImage === 'string' && mainImage.trim() !== '';
      const validSubImages = Array.isArray(subImages) 
        ? subImages.filter(img => img && typeof img === 'string' && img.trim() !== '') 
        : [];
      
      // 로딩 상태 초기화
      const initialLoadingStates = {};
      if (validMainImage) {
        initialLoadingStates[mainImage] = 'loading';
      }
      validSubImages.forEach(img => {
        initialLoadingStates[img] = 'loading';
      });
      setImageLoadingStates(initialLoadingStates);
      
      // 메인 이미지 props 생성
      if (validMainImage) {
        try {
          // createNextImageProps 함수 사용 (비동기)
          const props = await createNextImageProps(mainImage, IMAGE_TEMPLATES.THUMBNAIL, {
            alt: '메인 이미지',
            width: 300,
            height: 200,
            objectFit: 'contain'
          });
          setMainImageProps(props);
          setImageLoadingStates(prev => ({
            ...prev,
            [mainImage]: 'loaded'
          }));
        } catch (error) {
          console.error('메인 이미지 props 생성 오류:', error);
          setMainImageProps(null);
          setImageLoadingStates(prev => ({
            ...prev,
            [mainImage]: 'error'
          }));
        }
      } else {
        setMainImageProps(null);
      }
      
      // 서브 이미지 props 생성
      if (validSubImages.length > 0) {
        const propsPromises = validSubImages.map(async (publicId, index) => {
          try {
            // createNextImageProps 함수 사용 (비동기)
            const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.THUMBNAIL, {
              alt: `서브 이미지 ${index + 1}`,
              width: 150,
              height: 150,
              objectFit: 'contain'
            });
            setImageLoadingStates(prev => ({
              ...prev,
              [publicId]: 'loaded'
            }));
            return props;
          } catch (error) {
            console.error(`서브 이미지 props 생성 오류 (${publicId}):`, error);
            setImageLoadingStates(prev => ({
              ...prev,
              [publicId]: 'error'
            }));
            return null;
          }
        });
        
        const allProps = await Promise.all(propsPromises);
        // null 값 필터링 (오류가 발생한 이미지)
        const validProps = allProps.filter(Boolean);
        setSubImageProps(validProps);
      } else {
        setSubImageProps([]);
      }
      
      setIsLoading(false);
    };
    
    loadImageProps();
  }, [mainImage, subImages]); // validMainImage, validSubImages 등의 파생 값을 여기에 추가하지 말것. 
  
  // 이미지 로드 핸들러
  const handleImageLoad = (publicId) => {
    console.log(`이미지 로드 성공: ${publicId}`);
    setImageLoadingStates(prev => ({
      ...prev,
      [publicId]: 'loaded'
    }));
  };
  
  // 이미지 오류 핸들러
  const handleImageError = (publicId, e) => {
    console.error(`이미지 로드 실패: ${publicId}`, e);
    setImageLoadingStates(prev => ({
      ...prev,
      [publicId]: 'error'
    }));
    
    // 로드 실패 시 요소 숨기기
    if (e.target) {
      e.target.style.display = 'none';
    }
  };
  
  // 이미지 클릭 핸들러 - 갤러리 열기
  const handleImageClick = (index = 0) => {
    // 이미지가 없으면 실행하지 않음
    if (allImages.length === 0) return;
    
    // 이미지 갤러리 열기 액션 디스패치
    dispatch(openGallery({
      images: allImages,
      index: index
    }));
  };
  
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
  
  // 렌더링 부분을 위한 유효한 서브 이미지 배열 필터링
  const filteredSubImages = Array.isArray(subImages) 
    ? subImages.filter(img => img && typeof img === 'string' && img.trim() !== '') 
    : [];

  // 서브 이미지가 있는지 확인
  const hasValidSubImages = filteredSubImages.length > 0;
  
  // 추가 이미지 개수 (4개 초과분)
  const additionalImages = filteredSubImages.length > 4 ? filteredSubImages.length - 4 : 0;

  return (
    <div className={styles.imageSectionManager}>
      <div className={styles.imagesPreviewContainer}>
        {/* 메인 이미지 */}
        <div className={styles.imageSection}>
          <div className={styles.mainImageContainer}>
            {mainImage && typeof mainImage === 'string' && mainImage.trim() !== '' && mainImageProps ? (
              <Image 
                {...mainImageProps}
                className={styles.mainImagePreview}
                style={{ width: "auto", height: "auto", maxHeight: "100%", maxWidth: "100%", objectFit: "contain", cursor: "pointer" }}
                onLoad={() => handleImageLoad(mainImage)}
                onError={(e) => handleImageError(mainImage, e)}
                onClick={() => handleImageClick(0)}
              />
            ) : (
              <div className={styles.emptyImagePlaceholder}>
                <span>
                  {imageLoadingStates[mainImage] === 'error' 
                    ? '이미지 로드 실패' 
                    : imageLoadingStates[mainImage] === 'loading' 
                      ? '...' 
                      : '이미지 없음'}
                </span>
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
                {filteredSubImages.slice(0, 4).map((subImageRef, imgIndex) => {
                    const imageProps = subImageProps[imgIndex];
                    return (
                      <div 
                        key={`sub-${imgIndex}`}
                        className={styles.subImageItem}
                    >
                      {subImageRef && typeof subImageRef === 'string' && subImageRef.trim() !== '' && imageProps ? (
                            <div className={imgIndex === 3 && additionalImages > 0 ? styles.subImageWithOverlay : ''}>
                              <Image 
                                {...imageProps}
                                className={styles.subImagePreview}
                                style={{ height: "auto", width: "auto", maxHeight: "100%", maxWidth: "100%", objectFit: "contain", cursor: "pointer" }}
                                onLoad={() => handleImageLoad(subImageRef)}
                                onError={(e) => handleImageError(subImageRef, e)}
                                onClick={() => {
                                  // 메인 이미지 존재 여부에 따라 인덱스 조정
                                  const mainImageExists = mainImage && typeof mainImage === 'string' && mainImage.trim() !== '';
                                  const index = mainImageExists ? imgIndex + 1 : imgIndex;
                                  handleImageClick(index);
                                }}
                              />
                              {imgIndex === 3 && additionalImages > 0 && (
                                <div className={styles.imageCountOverlay}>
                                  +{additionalImages}
                                </div>
                              )}
                            </div>
                        ) : (
                          <div className={styles.emptyImagePlaceholder}>
                            <span>
                              {imageLoadingStates[subImageRef] === 'error' 
                                ? '이미지 로드 실패' 
                                : imageLoadingStates[subImageRef] === 'loading' 
                                  ? '...' 
                                  : ''}
                            </span>
                          </div>
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
    </div>
  );
});

export default ImageSectionManager; 