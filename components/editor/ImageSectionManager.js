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

import React, { forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from '../../pages/editor/styles.module.css';

// 이미지 갤러리 슬라이스에서 필요한 액션과 선택자만 가져오기
import {
  openImageOrderEditor,
  openImageSelectionMode,
  selectIsImageSelectionMode,
  selectSelectedImages
} from '../../lib/store/slices/imageGallerySlice';

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
  
  
  // 유효한 메인 이미지와 서브 이미지 확인
  const validMainImage = mainImage && typeof mainImage === 'string' && mainImage.trim() !== '';
  const validSubImages = Array.isArray(subImages) 
    ? subImages.filter(img => img && typeof img === 'string' && img.trim() !== '') 
    : [];
    
  // 모든 이미지를 하나의 배열로 병합
  const allImages = [
    ...(validMainImage ? [mainImage] : []),
    ...validSubImages
  ];
  
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

  // 서브 이미지가 있는지 확인
  const hasValidSubImages = validSubImages.length > 0;
  
  // 추가 이미지 개수 (4개 초과분)
  const additionalImages = validSubImages.length > 4 ? validSubImages.length - 4 : 0;

  return (
    <div className={styles.imageSectionManager}>
      <div className={styles.imagesPreviewContainer}>
        {/* 메인 이미지 */}
        <div className={styles.imageSection}>
          <div className={styles.mainImageContainer}>
            {validMainImage ? (
              <img 
                src={`/api/place-photo?public_id=${encodeURIComponent(mainImage)}`}
                alt="메인 이미지" 
                className={styles.mainImagePreview}
                style={{ height: "auto", width: "auto", maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
              />
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
                {validSubImages.slice(0, 4).map((subImageRef, imgIndex) => {
                  return (
                    <div 
                      key={`sub-${imgIndex}`}
                      className={styles.subImageItem}
                    >
                      {subImageRef && typeof subImageRef === 'string' && subImageRef.trim() !== '' ? (
                        <div className={imgIndex === 3 && additionalImages > 0 ? styles.subImageWithOverlay : ''}>
                          <img 
                            src={`/api/place-photo?public_id=${encodeURIComponent(subImageRef)}`}
                            alt={`서브 이미지 ${imgIndex + 1}`} 
                            className={styles.subImagePreview}
                            style={{ height: "auto", width: "auto", maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                          />
                          {imgIndex === 3 && additionalImages > 0 && (
                            <div className={styles.imageCountOverlay}>
                              +{additionalImages}
                            </div>
                          )}
                        </div>
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
    </div>
  );
});

export default ImageSectionManager; 