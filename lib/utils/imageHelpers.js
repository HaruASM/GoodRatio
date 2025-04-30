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
 * @param {number} batchSize - 배치당 처리할 이미지 수 (기본값: 10)
 * @returns {Promise<Array>} 캐시된 이미지 ID 배열
 */
export async function batchPreCacheImagesForGoggleReferece(imageInfoArray, defaultPlaceId, batchSize = 10) {
  if (!imageInfoArray || !Array.isArray(imageInfoArray) || imageInfoArray.length === 0) {
    return [];
  }

  // 유효한 이미지만 필터링 (한 번에 처리)
  const validImageInfos = imageInfoArray.filter(img => img && img.reference);
  
  if (validImageInfos.length === 0) {
    return [];
  }

  // 중복 제거 (참조가 같은 이미지는 한 번만 처리)
  const uniqueImageInfos = [];
  const seenReferences = new Set();
  
  for (const img of validImageInfos) {
    if (!seenReferences.has(img.reference)) {
      seenReferences.add(img.reference);
      uniqueImageInfos.push(img);
    }
  }

  console.log(`${uniqueImageInfos.length}개 고유 이미지 프리캐싱 요청`);
  
  const allCachedIds = [];
  const processingErrors = [];
  const batches = [];

  // 이미지를 배치로 나누기
  for (let i = 0; i < uniqueImageInfos.length; i += batchSize) {
    batches.push(uniqueImageInfos.slice(i, i + batchSize));
  }

  // 모든 배치를 병렬로 처리
  await Promise.all(
    batches.map(async (batch) => {
      try {
        // 이 요청은 실제 이미지 데이터를 로드하지 않고, 이미지 존재 여부 확인 및 업로드만 수행
        const response = await fetch('/api/batch-image-precache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageInfoArray: batch,
            placeId: defaultPlaceId,
            skipImageData: true // 이미지 데이터 스킵 플래그 (서버 지원 시 추가)
          }),
        });

        if (!response.ok) {
          throw new Error(`API 응답 오류 (${response.status})`);
        }

        const result = await response.json();
        
        if (result.cachedImageIds && Array.isArray(result.cachedImageIds)) {
          // 동시 접근으로 인한 경쟁 상태 방지를 위해 동기화 필요
          allCachedIds.push(...result.cachedImageIds);
        }

        if (result.failedImages && result.failedImages.length > 0) {
          processingErrors.push(...result.failedImages);
        }
      } catch (error) {
        // 최소한의 오류 로깅
        console.error(`배치 프리캐싱 오류:`, error.message);
      }
    })
  );

  if (processingErrors.length > 0) {
    console.warn(`이미지 프리캐싱: ${allCachedIds.length}개 성공, ${processingErrors.length}개 실패`);
  }

  // 프리캐싱된 이미지 ID 목록 반환
  // 이 목록은 이미지 갤러리에서 사용되지만, 실제 이미지 데이터는 갤러리 내에서
  // 개별 Image 컴포넌트를 통해 api/place-photo.js로 요청됨
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
    maintainAspectRatio = true, // 종횡비 유지 여부 (기본값: true)
  } = options;
  
  try {
    // API 호출하여 실제 Cloudinary URL 가져오기
    const apiUrl = `/api/place-photo?public_id=${encodeURIComponent(publicId)}&template=${template}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.log(`이미지 URL 가져오기 실패 (${response.status}): ${publicId}`);
      // 빈 이미지 반환 (투명 1x1 픽셀)
      return getEmptyImageProps(width, height, objectFit, alt, priority);
    }
    
    const data = await response.json();
    
    // 이미지가 존재하지 않는 경우 빈 이미지 반환
    if (data.imageNotFound || data.imageExpired) {
      console.log(`이미지 없음 - ${data.imageNotFound ? '존재하지 않음' : '만료됨'}: ${publicId}`);
      return getEmptyImageProps(width, height, objectFit, alt, priority);
    }
    
    if (!data.url) {
      console.log(`이미지 URL 누락: ${publicId}`);
      return getEmptyImageProps(width, height, objectFit, alt, priority);
    }
    
    // 종횡비 유지를 위한 스타일 설정
    const imageStyle = {
      objectFit,
    };
    
    // maintainAspectRatio가 true이면 width: "auto" 또는 height: "auto" 추가
    if (maintainAspectRatio) {
      // 세로형 이미지는 height를 auto로, 가로형 이미지는 width를 auto로 설정
      // 기본적으로는 width를 auto로 설정 (대부분의 경우에 적합)
      imageStyle.width = "auto";
    }
    
    // Next.js Image 컴포넌트 Props 반환 (Next.js 13+ 호환)
    return {
      src: data.url,
      width,
      height,
      style: imageStyle,
      loading: priority ? 'eager' : 'lazy',
      priority,
      alt,
      crossOrigin: "anonymous", // CORS 설정 추가
    };
  } catch (error) {
    console.log('이미지 props 생성 오류:', error.message);
    // 오류 발생 시 빈 이미지 반환
    return getEmptyImageProps(width, height, objectFit, alt, priority);
  }
};

/**
 * 이미지가 없을 때 빈 이미지 props 반환
 * 투명한 1x1 픽셀 데이터 URI를 사용하고 영역이 표시되지 않도록 함
 */
function getEmptyImageProps(width, height, objectFit = "cover", alt = "이미지 없음", priority = false) {
  // 투명 1x1 픽셀 데이터 URI
  const emptyImageSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  
  return {
    src: emptyImageSrc,
    width: 1,  // 최소 너비
    height: 1, // 최소 높이
    style: {
      width: 0,
      height: 0,
      display: 'none', // 완전히 숨김
      visibility: 'hidden',
      position: 'absolute',
      opacity: 0,
    },
    alt,
    loading: 'lazy',
    priority: false, // 우선순위 항상 낮게 설정
  };
} 