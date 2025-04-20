/**
 * 이미지 관련 유틸리티 함수들
 * 
 * 이 모듈은 /api/place-photo API를 통해 이미지 URL을 생성하는 함수들을 제공합니다.
 * 모든 이미지는 API 엔드포인트를 통해 처리되며, 이는 보안, 캐싱, 변환 처리 등의 이점이 있습니다.
 */



/**
 * 중간 크기(400px)의 이미지 URL 생성
 * 목록 뷰, 카드 등 중간 크기의 이미지가 필요한 경우에 사용합니다.
 * 
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} 이미지 URL
 */
export const getNormalPhotoUrl = (publicId) => {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return '';
  }
  return `/api/place-photo?public_id=${encodeURIComponent(publicId)}&maxwidth=400`;
};

/**
 * 썸네일 크기의 이미지 URL 생성
 * 작은 크기의 이미지(썸네일)를 요청합니다.
 * 이미지 목록, 미리보기, 작은 아이콘 등에 사용됩니다.
 * 
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - 썸네일 너비 (기본값: 150)
 * @param {number} height - 썸네일 높이 (기본값: 150)
 * @returns {string} 썸네일 이미지 URL
 */
export const getThumbnailPhotoUrl = (publicId, width = 150, height = 150) => {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return '';
  }
  
  let url = `/api/place-photo?public_id=${encodeURIComponent(publicId)}&maxwidth=${width}`;
  
  // 높이가 지정된 경우 maxheight 파라미터 추가
  if (height) {
    url += `&maxheight=${height}`;
  }
  
  // 썸네일은 빠른 로딩을 위해 품질을 자동으로 설정
  url += '&quality=auto';
  
  return url;
};

/**
 * 원본 크기의 이미지 URL 생성
 * 원본 크기의 이미지를 요청합니다.
 * 이미지 상세보기, 갤러리 등 원본 크기가 필요한 경우에 사용됩니다.
 * 
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} 원본 크기 이미지 URL
 */
export const getOriginalSizePhotoUrl = (publicId) => {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return '';
  }
  return `/api/place-photo?public_id=${encodeURIComponent(publicId)}&original=true`;
}; 