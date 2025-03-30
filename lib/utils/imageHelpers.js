/**
 * 이미지 갤러리 관련 유틸리티 함수 모음
 */

/**
 * 구글 Place Photo Reference를 이용해 서버 API 라우트를 통한 이미지 URL 생성
 * @param {string} photoReference - 구글 Place API 사진 참조 ID
 * @param {number} maxWidth - 이미지 최대 너비
 * @returns {string} 프록시된 이미지 URL
 */
export const getProxiedPhotoUrl = (photoReference, maxWidth = 500) => {
  if (!photoReference || typeof photoReference !== 'string' || photoReference.trim() === '') {
    return '';
  }
  
  try {
    return `/api/place-photo?photo_reference=${encodeURIComponent(photoReference)}&maxwidth=${maxWidth}`;
  } catch (error) {
    console.error('이미지 URL 생성 오류:', error);
    return '';
  }
};

/**
 * 유효한 이미지 참조만 필터링하여 반환
 * @param {string} mainImage - 메인 이미지 참조
 * @param {Array} subImages - 서브 이미지 참조 배열
 * @returns {Array} 유효한 이미지 참조 배열
 */
export const getValidImageRefs = (mainImage, subImages) => {
  const imageList = [];
  
  // 메인 이미지가 유효한 경우에만 추가
  if (mainImage && typeof mainImage === 'string' && mainImage.trim() !== '') {
    imageList.push(mainImage);
  } else {
    // 메인 이미지가 없을 경우 빈 슬롯을 표시하기 위해 undefined 추가
    // ImageSectionManager에서 이 값을 확인하여 빈 이미지 처리
    imageList.push(undefined);
  }
  
  // 서브 이미지가 유효한 경우 추가
  if (subImages && Array.isArray(subImages) && subImages.length > 0) {
    const validSubImages = subImages.filter(ref => 
      ref && typeof ref === 'string' && ref.trim() !== ''
    );
    imageList.push(...validSubImages);
  }
  
  return imageList;
};

/**
 * 이미지 로드 오류 처리를 위한 간소화된 함수
 * @param {number|string} index - 이미지 인덱스
 * @param {Array} imageRefs - 이미지 참조 배열
 * @returns {Object} 새 에러 상태 객체
 */
export const handleImageError = (index, imageRefs = []) => {
  const newErrors = {};
  
  // 유효한 인덱스인지 확인
  if (typeof index === 'number' && (index < 0 || index >= imageRefs.length)) {
    return newErrors;
  }
  
  // 에러 상태 업데이트
  newErrors[index] = true;
  return newErrors;
}; 