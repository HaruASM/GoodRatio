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
 * 중간 크기의 이미지 URL 생성
 * NORMAL 템플릿이 Cloudinary에 정의되어 있지 않아 ORIGINAL을 활용합니다.
 * 템플릿 기반 접근법으로 최적화합니다.
 * 
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} 이미지 URL
 */
export const getNormalPhotoUrl = (publicId) => {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return '';
  }
  // Cloudinary 템플릿 사용 - ORIGINAL 활용 (너비 파라미터 제거)
  return getOriginalSizePhotoUrl(publicId);
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

/**
 * 템플릿을 사용하여 이미지 URL 생성 (개선된 방식)
 * Cloudinary 최적화 템플릿을 활용해 목적별 이미지 URL 생성
 * 
 * @param {string} publicId - Cloudinary public ID
 * @param {string} template - 템플릿 타입 (IMAGE_TEMPLATES 객체의 값)
 * @param {Object} options - 추가 옵션 (선택적)
 * @returns {Promise<string>} 템플릿 최적화된 이미지 URL
 */
export const getTemplatePhotoUrl = async (publicId, template, options = {}) => {
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
  
  try {
    const params = new URLSearchParams({
      public_id: publicId,
      template: template
    });
    
    // 추가 옵션 적용
    if (options.maxwidth) params.append('maxwidth', options.maxwidth);
    if (options.maxheight) params.append('maxheight', options.maxheight);
    if (options.mode) params.append('mode', options.mode);
    if (options.quality) params.append('quality', options.quality);
    
    // 서버 API에 요청
    const response = await fetch(`/api/place-photo?${params.toString()}`);
    
    if (!response.ok) {
      console.error('이미지 URL 요청 실패:', response.status);
      return '';
    }
    
    const data = await response.json();
    return data.url || '';
  } catch (error) {
    console.error('이미지 URL 생성 오류:', error);
    return '';
  }
};

/**
 * 배너 (가로형) 이미지 URL 생성
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} 배너 형식 이미지 URL
 */
export const getBannerWidePhotoUrl = (publicId) => {
  return getTemplatePhotoUrl(publicId, IMAGE_TEMPLATES.BANNER_WIDE);
};

/**
 * 배너 (세로형) 이미지 URL 생성
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} 배너 형식 이미지 URL
 */
export const getBannerTallPhotoUrl = (publicId) => {
  return getTemplatePhotoUrl(publicId, IMAGE_TEMPLATES.BANNER_TALL);
};

/**
 * 원형 이미지 URL 생성
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} 원형 이미지 URL
 */
export const getCirclePhotoUrl = (publicId) => {
  return getTemplatePhotoUrl(publicId, IMAGE_TEMPLATES.CIRCLE);
};

/**
 * 정사각형 이미지 URL 생성
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} 정사각형 이미지 URL
 */
export const getSquarePhotoUrl = (publicId) => {
  return getTemplatePhotoUrl(publicId, IMAGE_TEMPLATES.SQUARE);
};

/**
 * 선명도 강화 이미지 URL 생성
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<string>} 선명도 강화 이미지 URL
 */
export const getSharpenedPhotoUrl = (publicId) => {
  return getTemplatePhotoUrl(publicId, IMAGE_TEMPLATES.SHARPENED);
};

/**
 * Next.js Image 컴포넌트 속성을 생성하는 팩토리 함수
 * 
 * @param {string} publicId - 이미지 Public ID
 * @param {Object} options - 이미지 옵션
 * @returns {Object} Next.js Image 컴포넌트에 필요한 속성 객체
 */
export const createImageProps = (publicId, options = {}) => {
  const {
    width = 800,
    height = 600,
    layout = "responsive",
    objectFit = "contain",
    priority = false,
    alt = "이미지",
  } = options;

  // 오픈소스 블러 데이터 URL (저해상도 이미지 대체)
  const defaultBlurDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mN8//HLfwYiAOOoQvoqBABbWyZJf74GZgAAAABJRU5ErkJggg==';

  return {
    src: getOriginalSizePhotoUrl(publicId),
    width,
    height,
    layout,
    objectFit,
    loading: priority ? 'eager' : 'lazy',
    priority,
    alt,
    placeholder: "blur",
    blurDataURL: defaultBlurDataURL,
  };
};

/**
 * 썸네일 이미지 속성을 생성하는 팩토리 함수
 * 
 * @param {string} publicId - 이미지 Public ID
 * @param {Object} options - 썸네일 옵션
 * @returns {Object} 썸네일용 Image 컴포넌트 속성 객체
 */
export const createThumbnailImageProps = (publicId, options = {}) => {
  const {
    width = 100,
    height = 75,
    alt = "썸네일",
  } = options;

  return {
    src: getThumbnailPhotoUrl(publicId),
    width,
    height,
    layout: "responsive",
    objectFit: "cover",
    loading: 'lazy',
    alt,
  };
};

/**
 * 템플릿 기반 이미지 속성 생성 함수 (개선된 방식)
 * @param {string} publicId - 이미지 Public ID
 * @param {string} template - 템플릿 타입
 * @param {Object} options - 추가 옵션
 * @returns {Object} Image 컴포넌트 속성 객체
 */
export const createTemplateImageProps = async (publicId, template, options = {}) => {
  const {
    alt = "이미지",
    objectFit = "cover",
    priority = false,
    layout = "responsive",
    width = 400,
    height = 300
  } = options;
  
  // URL 생성 (비동기)
  const imageUrl = await getTemplatePhotoUrl(publicId, template, options);
  
  return {
    src: imageUrl,
    width,
    height,
    layout,
    objectFit,
    loading: priority ? 'eager' : 'lazy',
    priority,
    alt,
  };
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
 * 간소화된 구글 이미지 프리캐싱 함수
 * reference, publicId, placeId만 사용하여 Cloudinary에 이미지를 캐싱
 * 
 * @param {Array} imageInfoArray - 이미지 정보 객체 배열 (단순화된 형태: {reference, publicId, placeId})
 * @param {number} batchSize - 배치 크기 (기본값: 3)
 * @returns {Promise<Array>} - 캐싱된 이미지 publicId 배열
 */
export async function simpleBatchPreCacheImages(imageInfoArray, batchSize = 3) {
  if (!imageInfoArray || !imageInfoArray.length) return [];
  
  const cachedPublicIds = [];
  
  // 배치 단위로 처리하면서 동시 요청 제한
  for (let i = 0; i < imageInfoArray.length; i += batchSize) {
    const batch = imageInfoArray.slice(i, i + batchSize);
    
    try {
      // 현재 배치만 서버로 전송
      const response = await fetch('/api/batch-image-precache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageInfoArray: batch,
          placeId: 'unknown' // placeId 기본값 설정
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        // 실제로 캐싱된 ID만 추가
        if (result.cachedImageIds && Array.isArray(result.cachedImageIds)) {
          cachedPublicIds.push(...result.cachedImageIds);
        }
      } else {
        console.error('이미지 캐싱 요청 오류:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('배치 캐싱 요청 오류:', error);
    }
    
    // 다음 배치 처리 전에 지연 시간 추가 (API 할당량 제한 방지)
    if (i + batchSize < imageInfoArray.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms 지연
    }
  }
  
  return cachedPublicIds;
} 