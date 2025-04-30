/**
 * Cloudinary를 이용한 구글 Place Photo API 프록시 핸들러
 * 
 * ----------------------------------------------------------------
 * 구글 Maps Platform 이미지 정책 요약 (https://cloud.google.com/maps-platform/terms)
 * ----------------------------------------------------------------
 * 1. 일시적 캐싱 허용: 
 *    - 성능 향상 목적으로 최대 30일 정도의 일시적 캐싱 허용
 *    - 영구 저장 및 자체 DB 구축은 금지됨
 * 
 * 2. 속성 정보 유지:
 *    - 원작자 속성 정보(attribution)를 반드시 유지해야 함
 *    - 이미지 HTML 속성(html_attributions) 표시 의무 있음
 * 
 * 3. 프록시 서버 사용: 
 *    - 백엔드 서버가 Google API에서 이미지를 가져와 제공하는 방식 허용
 *    - 직접 URL 사용은 권장되지 않음
 * 
 * 4. 사용자 요청 기반 제공:
 *    - 최종 사용자의 요청이 있을 때만 이미지 제공 가능
 *    - 자동 수집 크롤링 금지
 * 
 * 5. 상업적 대체 서비스 금지:
 *    - 구글과 경쟁하는 서비스 구축에 이미지 사용 금지
 *    - 애플리케이션 내 보조적 용도로만 사용
 * ----------------------------------------------------------------
 * 
 * ----------------------------------------------------------------
 * 향후 구현 계획 (Cloudinary 기반)
 * ----------------------------------------------------------------
 * 
 * ## 3단계: 사용자 업로드 기능 추가 - 클라이언트에서 사용되는 이미지 업로드. 
 * - `/api/upload-image` 엔드포인트 구현: Cloudinary에 직접 업로드하지 않고, 서버 api의 업로드용 엔드포인트 사용
 * - 사용자/비즈니스별 폴더 구조 설계 (예: `/user-uploads/{userId}/`)
 * - 이미지 메타데이터 저장 (Cloudinary의 태그 기능 활용)
 * - 업로드 제한 및 파일 검증 로직 추가
 * - 업로드 진행률 표시 기능
 * 
 * ## 4단계: 통합 관리 시스템
 * - 구글 이미지와 사용자 업로드 이미지를 통합 관리하는 인터페이스
 * - DB에 이미지 메타데이터 저장 (Cloudinary ID, 출처, 태그 등)
 * - 태그 기반 이미지 검색 기능 구현
 * - 이미지 그룹화 및 컬렉션 관리 기능
 * - 이미지 모더레이션 및 승인 프로세스 (필요시)
 * 
 * ----------------------------------------------------------------
 
 
 */

import { 
  checkImageExists, 
  getPublicIdFromGoogleReference, 
  getCloudinaryUrl, 
  isImageExpired,
  getFullPublicId,
  generateSignedUrl
} from '../../lib/cloudinary';

// Cloudinary 템플릿 타입
const TEMPLATE_TYPES = {
  THUMBNAIL: 'thumbnail',
  NORMAL: 'normal',
  BANNER_WIDE: 'banner_wide',
  BANNER_TALL: 'banner_tall',
  CIRCLE: 'circle',
  SQUARE: 'square',
  SHARPENED: 'sharpened',
  ORIGINAL: 'original'
};

// imageHelpers.js와 일치하도록 이미지 크기 상수 정의
const NORMAL_WIDTH = 400;         // 일반 크기 (getNormalPhotoUrl)
const THUMBNAIL_WIDTH = 150;      // 썸네일 크기 (getThumbnailPhotoUrl)
const MAX_SAFE_ORIGINAL = 2000;   // 원본 이미지 안전 상한선 (getOriginalSizePhotoUrl)
const FALLBACK_WIDTH = 400;       // 실패 시 대체 크기 - 일반 크기와 동일

/**
 * 로깅을 위한 문자열 단축 유틸리티 함수
 * @param {string} str - 원본 문자열
 * @param {number} maxLength - 최대 길이
 * @returns {string} 최대 길이로 잘린 문자열
 */
const truncateForLogging = (str, maxLength = 40) => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

/**
 * Google Place 사진 또는 Cloudinary Public ID 처리 핸들러
 * 직접 Cloudinary URL을 반환하는 방식으로 변경됨
 */
export default async function handler(req, res) {
  console.log('Place Photo API 호출됨');
  const { 
    photo_reference, 
    public_id,
    maxwidth, 
    maxheight,
    mode = 'fill',
    quality = 'auto',
    metadata = false,
    original = false,
    template = '',  // 템플릿 타입 (thumbnail, normal, banner_wide 등)
    section = 'default',
    place_id = null,
    image_index = 1
  } = req.query;

  // 원본 이미지 요청 여부 확인
  const isOriginalRequest = original === 'true' || original === '1' || template === TEMPLATE_TYPES.ORIGINAL;
  
  // 템플릿 타입 확인
  let templateType = '';
  if (template) {
    templateType = template.toLowerCase();
  } else if (isOriginalRequest) {
    templateType = TEMPLATE_TYPES.ORIGINAL;
  } else if (parseInt(maxwidth, 10) <= THUMBNAIL_WIDTH || maxwidth === undefined) {
    templateType = TEMPLATE_TYPES.THUMBNAIL;
  } else {
    templateType = TEMPLATE_TYPES.NORMAL;
  }

  try {
    // 1. Cloudinary 공개 ID 결정
    let publicId;
    let originalReference;
    
    if (public_id) {
      // public_id가 제공된 경우, 직접 사용
      publicId = public_id;
      console.log(`클라이언트가 제공한 public_id 사용: ${truncateForLogging(publicId)}`);
    } else if (photo_reference) {
      // photo_reference가 제공된 경우, publicId 생성
      // 구글 이미지는 항상 tempsection과 tempID를 사용 (함수 내부에서 처리)
      publicId = getPublicIdFromGoogleReference(photo_reference);
      originalReference = photo_reference;
      console.log(`photo_reference로 public_id 생성: ${truncateForLogging(publicId)}`);
    } else {
      // 둘 다 없는 경우, 에러 반환
      return res.status(400).json({ error: 'photo_reference or public_id is required' });
    }
    
    // Cloudinary에서 이미지 확인 시 에셋 폴더 추가
    const cloudinaryPublicId = getFullPublicId(publicId);
    console.log(`Cloudinary 이미지 확인: ${truncateForLogging(publicId)} → ${truncateForLogging(cloudinaryPublicId)}`);
    
    // 2. Cloudinary에서 이미지 확인 (메타데이터 포함)
    const imageInfo = await checkImageExists(cloudinaryPublicId, true);
    
    // 3. 메타데이터 요청 처리
    if (metadata === 'true' || metadata === '1') {
      if (imageInfo) {
        // Cloudinary 메타데이터에서 원본 photo_reference 추출
        const contextData = imageInfo.context?.custom || {};
        let parsedContext = {};
        
        try {
          if (typeof contextData === 'string') {
            parsedContext = JSON.parse(contextData);
          } else if (typeof contextData === 'object') {
            parsedContext = contextData;
          }
        } catch (e) {
          console.warn('컨텍스트 데이터 파싱 오류:', e);
        }
        
        // 원본 레퍼런스 추출 (메타데이터에서 찾거나 제공된 값 사용)
        const foundReference = parsedContext.original_reference || originalReference || '';
        
        return res.status(200).json({
          exists: true,
          url: getCloudinaryUrl(publicId),
          created_at: imageInfo.created_at,
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          original_reference: foundReference,
          is_expired: isImageExpired(imageInfo)
        });
      } else {
        return res.status(404).json({
          exists: false,
          message: 'Image not found in Cloudinary'
        });
      }
    }
    
    // 4. 이미지 존재 여부 확인
    if (!imageInfo) {
      // 이미지가 Cloudinary에 없는 경우 404 반환 대신 200 상태 코드로 imageNotFound 플래그 전송
      return res.status(200).json({ 
        imageNotFound: true,
        public_id: publicId,
        template: templateType,
        message: '이미지를 찾을 수 없습니다. 이미지를 먼저 batch-image-precache API를 통해 업로드해주세요.'
      });
    }
    
    // 이미지가 만료된 경우
    if (isImageExpired(imageInfo)) {
      return res.status(200).json({
        imageExpired: true,
        public_id: publicId,
        template: templateType,
        message: '이미지가 만료되었습니다. batch-image-precache API를 통해 다시 업로드해주세요.'
      });
    }
    
    // 5. 템플릿 타입에 따른 Cloudinary 변환 옵션 설정
    let transformationOptions = {};
    
    switch(templateType) {
      case TEMPLATE_TYPES.THUMBNAIL:
        transformationOptions = {
          width: parseInt(maxwidth, 10) || THUMBNAIL_WIDTH,
          height: parseInt(maxheight, 10) || parseInt(maxwidth, 10) || THUMBNAIL_WIDTH,
          crop: mode,
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.NORMAL:
        transformationOptions = {
          width: parseInt(maxwidth, 10) || NORMAL_WIDTH,
          crop: mode,
          quality: quality
        };
        if (maxheight) {
          transformationOptions.height = parseInt(maxheight, 10);
        }
        break;
        
      case TEMPLATE_TYPES.BANNER_WIDE:
        transformationOptions = {
          width: 970,
          height: 250,
          crop: 'fill',
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.BANNER_TALL:
        transformationOptions = {
          width: 300,
          height: 600,
          crop: 'fill',
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.CIRCLE:
        transformationOptions = {
          width: 1010,
          height: 1010,
          crop: 'fill',
          radius: 'max',
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.SQUARE:
        transformationOptions = {
          width: 1000,
          height: 1000,
          crop: 'fill',
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.SHARPENED:
        transformationOptions = {
          width: 1000,
          height: 563,
          crop: 'fill',
          effect: 'sharpen',
          quality: quality
        };
        break;
        
      case TEMPLATE_TYPES.ORIGINAL:
      default:
        // 원본 크기에 대해서도 적절한 제한 적용
        transformationOptions = {
          quality: quality
        };
        break;
    }
    
    // 6. Cloudinary URL 생성 (서명된 URL)
    const signedUrl = generateSignedUrl(publicId, transformationOptions);
    
    // 7. 직접 URL을 응답으로 반환
    res.status(200).json({ 
      url: signedUrl,
      template: templateType,
      public_id: publicId
    });
    
  } catch (error) {
    console.error('Place Photo API 오류:', error);
    res.status(500).json({ error: '이미지 URL 생성 중 오류가 발생했습니다' });
  }
} 