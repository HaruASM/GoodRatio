/**
 * AI 개발 가이드: 이미지 로딩 및 관리 시스템
 * -----------------------------------------------------
 * 주요 설계 원칙:
 * 1. 구글 이미지 정책 준수: 모든 이미지는 최대 30일 동안만 임시 캐싱되며 원 저작자 속성 정보 유지
 * 2. 보안 모델: 모든 이미지는 직접 URL 대신 API 엔드포인트를 통해 제공
 * 3. 효율성: Cloudinary 템플릿 활용해 다양한 크기와 형태로 이미지 최적화
 * 4. 캐싱 메커니즘: 중복 요청 방지를 위한 이미지 캐싱 시스템 구현
 * 
 * 핵심 처리 흐름:
 * 1. 이미지 식별: photo_reference 또는 public_id를 통해 이미지 식별
 * 2. URL 직접 생성: public_id를 기반으로 Cloudinary URL 직접 생성
 * 3. 변환 처리: 템플릿에 따른 이미지 크기/형태 변환
 * 4. URL 생성: 서명된 보안 URL 생성 및 반환
 * 
 * Admin API 호출 최소화: 이미지 존재 여부 확인없이 URL 직접 생성
 * -----------------------------------------------------
 */

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
 */

import { 
  getPublicIdFromGoogleReference, 
  getCloudinaryUrl,
  getFullPublicId,
  generateSignedUrl,
  checkImageExists
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
 * Google Place 사진 또는 Cloudinary Public ID 처리 핸들러
 * 직접 Cloudinary URL을 반환하는 방식으로 변경됨
 * Admin API 호출을 제거하고 Delivery API 방식으로 URL 직접 생성
 */
export default async function handler(req, res) {
  
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
    
    if (public_id) {
      // public_id가 제공된 경우, 직접 사용
      publicId = public_id;
      
    } else if (photo_reference) {
      // photo_reference가 제공된 경우, publicId 생성
      // 구글 이미지는 항상 tempsection과 tempID를 사용 (함수 내부에서 처리)
      publicId = getPublicIdFromGoogleReference(photo_reference);
      
    } else {
      // 둘 다 없는 경우, 에러 반환
      return res.status(400).json({ error: 'photo_reference or public_id is required' });
    }
    
    
    // 2. 메타데이터 요청 처리
    let metadataResponse = {};
    if (metadata === 'true' || metadata === '1') {
      //TODO 메타데이터 저장 및 조회에 비용이 많이 드니, 이에 대해서 이미지 메타데이터 저장 DB와 인메모리캐싱(redis) 도입
      try {
        // cloudinary.js에서 제공하는 checkImageExists 함수 사용
        const fullPublicId = getFullPublicId(publicId);
        const result = await checkImageExists(fullPublicId, true);

        // 필요한 최소 메타데이터만 추출
        if (result) {
          metadataResponse = {
            created_at: result.created_at,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height
          };
          
          // 속성 정보(attribution)가 있으면 포함
          if (result.context && result.context.custom) {
            // 컨텍스트는 키-값 쌍 문자열 형식일 수 있으므로 파싱 시도
            let contextData = result.context.custom;
            
            // html_attributions이 JSON 문자열로 저장되어 있으면 파싱
            if (contextData.html_attributions) {
              try {
                const attributions = JSON.parse(contextData.html_attributions);
                metadataResponse.html_attributions = attributions;
              } catch (e) {
                metadataResponse.html_attributions = [contextData.html_attributions];
              }
            }
            
            metadataResponse.source = contextData.source || '';
          }
        }
      } catch (error) {
        console.error('Cloudinary 메타데이터 요청 오류:', error);
        // 오류가 발생해도 이미지 URL은 계속 제공
        metadataResponse = {
          error: 'metadata_fetch_failed',
          message: '메타데이터를 가져오는 중 오류가 발생했습니다.'
        };
      }
    }
    
    // 3. 템플릿 타입에 따른 Cloudinary 변환 옵션 설정
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
    
    // 4. Cloudinary URL 직접 생성 (존재 여부 확인 없이)
    const imageUrl = generateSignedUrl(publicId, transformationOptions);
    
    // 5. 클라이언트에 URL 반환 (필요시 메타데이터 포함)
    res.status(200).json({ 
      url: imageUrl,
      template: templateType,
      public_id: publicId,
      ...metadataResponse
    });
    
  } catch (error) {
    console.error('Place Photo API 오류:', error);
    res.status(500).json({ error: '이미지 URL 생성 중 오류가 발생했습니다' });
  }
}

// 문자열에서 이스케이프되지 않은 특정 문자의 위치 찾기
function findUnescapedChar(str, char) {
  let inEscape = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && !inEscape) {
      inEscape = true;
    } else if (str[i] === char && !inEscape) {
      return i;
    } else {
      inEscape = false;
    }
  }
  return -1; // 찾지 못한 경우
} 