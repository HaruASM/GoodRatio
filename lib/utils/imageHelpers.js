/**
 * 이미지 관련 유틸리티 함수들
 * 
 * 이 모듈은 /api/place-photo API를 통해 이미지 URL을 생성하는 함수들을 제공합니다.
 * 모든 이미지는 API 엔드포인트를 통해 처리되며, 이는 보안, 캐싱, 변환 처리 등의 이점이 있습니다.
 */

// Cloudinary 템플릿 타입 (place-photo.js와 동일하게 유지)
export const IMAGE_TEMPLATES = {
  THUMBNAIL: 'thumbnail',
  NORMAL: 'normal',
  BANNER_WIDE: 'banner_wide',
  BANNER_TALL: 'banner_tall',
  CIRCLE: 'circle',
  SQUARE: 'square',
  SHARPENED: 'sharpened',
  ORIGINAL: 'original'
};

/**
 * 템플릿을 사용하여 이미지 URL 생성 (개선된 방식)
 * Cloudinary 최적화 템플릿을 활용해 목적별 이미지 URL 생성
 * 
 * @param {string} publicId - Cloudinary public ID
 * @param {string} template - 템플릿 타입 (IMAGE_TEMPLATES 객체의 값)
 * @param {Object} options - 추가 옵션 (선택적)
 * @returns {string} 템플릿 최적화된 이미지 URL
 */
export const getTemplatePhotoUrl = (publicId, template ) => {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return '';
  }
  
  // NORMAL 템플릿은 Cloudinary에 정의되어 있지 않으므로, ORIGINAL로 대체
  if (template === IMAGE_TEMPLATES.NORMAL) {
    template = IMAGE_TEMPLATES.ORIGINAL;
  } else if (!template || !Object.values(IMAGE_TEMPLATES).includes(template)) {
    // 유효하지 않은 템플릿인 경우 기본값(ORIGINAL) 사용
    template = IMAGE_TEMPLATES.ORIGINAL;
  }
  
  // 기본 URL 구성
  let url = `/api/place-photo?public_id=${encodeURIComponent(publicId)}&template=${template}`;
  
  return url;
};

/**
 * 구글 이미지 참조에 대한 이미지를 배치로 프리캐싱합니다.
 * 이미지를 지정된 배치 크기로 처리하고 API 요청을 수행합니다.
 * 
 * @param {Array} imageInfoArray - 각 객체가 {publicId, reference, placeId}인 배열
 * @param {string} defaultPlaceId - 기본 Google 장소 ID (각 이미지에 placeId가 없는 경우 사용)
 * @param {number} batchSize - 배치당 처리할 이미지 수 (기본값: 3)
 * @returns {Promise<Array>} 캐시된 이미지 ID 배열
 */
export async function batchPreCacheImagesForGoggleReferece(imageInfoArray, defaultPlaceId, batchSize = 3) {
  if (!imageInfoArray || !Array.isArray(imageInfoArray) || imageInfoArray.length === 0) {
    console.warn('프리캐싱할 이미지가 없습니다.');
    return [];
  }

  // 유효한 이미지만 필터링
  const validImageInfos = imageInfoArray.filter(img => img && img.reference);
  
  if (validImageInfos.length === 0) {
    console.warn('유효한 이미지 참조가 없습니다.');
    return [];
  }

  console.log(`${validImageInfos.length}개 이미지 프리캐싱 시작 (배치 크기: ${batchSize})`);
  
  const allCachedIds = [];
  const processingErrors = [];

  // 이미지를 배치로 나누어 처리
  for (let i = 0; i < validImageInfos.length; i += batchSize) {
    const batch = validImageInfos.slice(i, i + batchSize);
    
    try {
      console.log(`배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(validImageInfos.length / batchSize)} 처리 중...`);
      
      const response = await fetch('/api/batch-image-precache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageInfoArray: batch,
          placeId: defaultPlaceId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '응답 파싱 실패' }));
        throw new Error(`API 응답 오류 (${response.status}): ${errorData.error || '알 수 없는 오류'}`);
      }

      const result = await response.json();
      
      if (result.cachedImageIds && Array.isArray(result.cachedImageIds)) {
        allCachedIds.push(...result.cachedImageIds);
        console.log(`배치 ${Math.floor(i / batchSize) + 1} 성공: ${result.cachedImageIds.length}개 이미지 캐시됨`);
      }

      if (result.failedImages && result.failedImages.length > 0) {
        console.warn(`배치 ${Math.floor(i / batchSize) + 1}에서 ${result.failedImages.length}개 이미지 실패`);
        processingErrors.push(...result.failedImages);
      }
    } catch (error) {
      console.error(`배치 ${Math.floor(i / batchSize) + 1} 처리 오류:`, error.message);
      // 실패한 배치의 이미지를 오류 목록에 추가
      batch.forEach(img => {
        processingErrors.push({
          reference: img.reference,
          error: `배치 처리 실패: ${error.message}`
        });
      });
    }
  }

  // 결과 요약
  if (processingErrors.length > 0) {
    console.warn(`이미지 프리캐싱 완료: ${allCachedIds.length} 성공, ${processingErrors.length} 실패`);
  } else {
    console.log(`이미지 프리캐싱 완료: ${allCachedIds.length}개 모두 성공`);
  }

  return allCachedIds;
}

/**
 * Next.js Image 컴포넌트를 위한 이미지 props 생성 함수
 * 이 함수는 API URL 대신 실제 Cloudinary URL을 가져와 사용합니다
 * 
 * @param {string} publicId - 이미지 Public ID
 * @param {string} template - 템플릿 타입 (IMAGE_TEMPLATES 값 중 하나)
 * @param {Object} options - 이미지 옵션
 * @returns {Promise<Object>} Image 컴포넌트용 props 객체
 */
export async function createNextImageProps(publicId, template = IMAGE_TEMPLATES.ORIGINAL, options = {}) {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    throw new Error('유효한 publicId가 필요합니다');
  }
  
  const {
    width = 400,
    height = 300,
    objectFit = "cover",
    alt = "이미지",
    priority = false,
  } = options;
  
  try {
    // API 호출하여 실제 Cloudinary URL 가져오기
    const apiUrl = `/api/place-photo?public_id=${encodeURIComponent(publicId)}&template=${template}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`이미지 URL 가져오기 실패 (${response.status})`);
    }
    
    const data = await response.json();
    
    if (!data.url) {
      throw new Error('API 응답에 URL이 없습니다');
    }
    
    // Next.js Image 컴포넌트 Props 반환 (Next.js 13+ 호환)
    return {
      src: data.url,
      width,
      height,
      style: {
        objectFit: objectFit,  // style 속성으로 이동
      },
      loading: priority ? 'eager' : 'lazy',
      priority,
      alt,
      crossOrigin: "anonymous", // CORS 설정 추가
    };
  } catch (error) {
    console.error('이미지 props 생성 오류:', error);
    throw error;
  }
}; 