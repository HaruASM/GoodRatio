/**
 * Cloudinary 설정 및 유틸리티 함수
 * 구글 Place 이미지 캐싱에 Cloudinary를 활용하는 기능을 제공합니다.
 * 
 * ----------------------------------------------------------------
 * 구글 Maps Platform 이미지 정책 요약 (https://cloud.google.com/maps-platform/terms)
 * ----------------------------------------------------------------
 * 1. 일시적 캐싱 허용 (최대 30일)
 * 2. 원작자 속성 정보(attribution) 유지 필수
 * 3. 프록시 서버를 통한 이미지 제공 (직접 URL 사용 지양)
 * 4. 사용자 요청 기반 이미지 제공만 허용 (자동 수집 금지)
 * 5. 영구 저장 및 자체 데이터베이스 구축 금지
 * 6. 구글과 경쟁하는 서비스에 이미지 사용 금지
 * ----------------------------------------------------------------
 * 
 * 본 모듈 구현 원칙:
 * - 30일 만료 정책 준수
 * - 원본 photo_reference 정보 메타데이터로 보존
 * - 사용자 요청 시에만 이미지 제공
 * - 캐싱을 통한 Google API 요청 최소화
 */

import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// Cloudinary 설정 - CLOUDINARY_URL 환경 변수를 자동으로 감지합니다.
// 환경 변수가 제대로 설정되어 있다면 추가 설정이 필요하지 않습니다.
// 명시적으로 설정하려면 아래 주석을 해제하세요.
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// 구글 플레이스 이미지 저장 기본 폴더
const BASE_FOLDER = 'map-places';

/**
 * 구글 Place 이미지의 Cloudinary 공개 ID를 생성합니다.
 * 계층 구조: map-places/섹션/아이템ID/이미지해시
 * 
 * @param {string} photoReference - 구글 Place 포토 레퍼런스
 * @param {string} section - 섹션 이름 (지역명: '반월당', '세부', '앙헬레스', '말라떼' 등)
 * @param {string} itemId - 파이어베이스 서버의 아이템 ID (파이어베이스에 저장된 고유 문서 ID)
 * @returns {string} Cloudinary 공개 ID (폴더 포함)
 */
export function getCloudinaryPublicId(photoReference, section = 'default', itemId = null) {
  if (!photoReference) {
    throw new Error('유효한 photo_reference가 필요합니다');
  }
  
  // itemId가 제공되지 않은 경우 photoReference 해시를 임시 ID로 사용
  const effectiveItemId = itemId || getPlaceIdFromReference(photoReference);
  
  // photoReference를 해시하여 고유한 이미지 ID 생성
  const imageHash = crypto.createHash('md5')
    .update(photoReference)
    .digest('hex')
    .substring(0, 16);
  
  // 계층형 구조로 공개 ID 구성: map-places/지역명/아이템ID/이미지해시
  return `${BASE_FOLDER}/${section}/${effectiveItemId}/${imageHash}`;
}

/**
 * photoReference에서 placeId 생성 또는 추출 (placeId가 없을 때 사용)
 * @param {string} photoReference - 구글 포토 레퍼런스
 * @returns {string} placeId 또는 해시값
 */
function getPlaceIdFromReference(photoReference) {
  // 긴 레퍼런스는 MD5 해시로 변환
  if (photoReference.length > 50) {
    return crypto.createHash('md5').update(photoReference).digest('hex').substring(0, 16);
  }
  // 짧은 레퍼런스는 그대로 사용 (최대 16자)
  return photoReference.substring(0, 16);
}

/**
 * 이미지가 Cloudinary에 존재하는지 확인합니다.
 * @param {string} publicId - 확인할 이미지의 public_id
 * @param {boolean} includeMetadata - 메타데이터 포함 여부
 * @returns {Promise<boolean|object>} 이미지 존재 여부 또는 이미지 정보
 */
export async function checkImageExists(publicId, includeMetadata = false) {
  try {
    const result = await cloudinary.api.resource(publicId);
    return includeMetadata ? result : true;
  } catch (error) {
    if (error.error && error.error.http_code === 404) {
      return includeMetadata ? null : false;
    }
    // 다른 오류는 전파
    throw error;
  }
}

/**
 * Cloudinary 이미지 URL을 생성합니다.
 * @param {string} publicId - 이미지 public_id
 * @param {object} options - 변환 옵션
 * @returns {string} 최적화된 Cloudinary 이미지 URL
 */
export function getCloudinaryUrl(publicId, options = {}) {
  const defaultOptions = {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  // 안전한 이미지 크기 제한 적용
  const safeOptions = { ...defaultOptions, ...options };
  
  // 최대 너비 및 높이 제한 (구글 Place Photos API 및 Cloudinary 제한 고려)
  const MAX_SAFE_WIDTH = 1000;
  const MAX_SAFE_HEIGHT = 1000;
  
  if (safeOptions.width && parseInt(safeOptions.width, 10) > MAX_SAFE_WIDTH) {
    console.log(`이미지 너비 제한 (${safeOptions.width} → ${MAX_SAFE_WIDTH}px)`);
    safeOptions.width = MAX_SAFE_WIDTH;
  }
  
  if (safeOptions.height && parseInt(safeOptions.height, 10) > MAX_SAFE_HEIGHT) {
    console.log(`이미지 높이 제한 (${safeOptions.height} → ${MAX_SAFE_HEIGHT}px)`);
    safeOptions.height = MAX_SAFE_HEIGHT;
  }
  
  return cloudinary.url(publicId, safeOptions);
}

/**
 * Google Places API에서 이미지를 가져와 Cloudinary에 업로드
 * @param {string} photoReference - 구글 장소 사진 참조 ID
 * @param {number|null} maxWidth - 최대 이미지 너비 (기본값: 800, null인 경우 크기 제한 없음)
 * @param {string} apiKey - Google Maps API 키
 * @param {string} placeId - 구글 장소 ID (구글 Place API의 place_id, 임시용)
 * @returns {Promise<object>} Cloudinary 업로드 결과
 */
 // 구글 장소 이미지 업로드 함수이다. 
export async function uploadGooglePlaceImage(photoReference, maxWidth = 800, apiKey, placeId ) {
  if (!photoReference) {
    throw new Error('유효한 photo_reference가 필요합니다');
  }

  try {
    // 이미지를 가져올 구글 Places API URL 구성
    const googleApiKey = apiKey || process.env.NEXT_PUBLIC_MAPS_API_KEY;
    if (!googleApiKey) {
      throw new Error('NEXT_PUBLIC_MAPS_API_KEY 환경 변수가 설정되지 않았습니다');
    }

  // (구글이미지 관련 섹션은 'tempsection' 사용. 서버DB로 업로드시, 서버에서 섹션 재배치 처리)
  //이  단계에서는 구글ID와, sectionName이 없다, 구글 이미지 업로드 전용함수이다. 
    const section = 'tempsection'; 
    const provider = 'google_place_api';
    const effectiveItemId = placeId || null;

    // 계층형 구조의 공개 ID 생성
    const publicId = getCloudinaryPublicId(photoReference, section, effectiveItemId);
  
    // 구글 API에서 이미지 가져오기
    let placesApiUrl = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${photoReference}&key=${googleApiKey}`;
    
    // maxWidth가 null이 아닌 경우에만 maxwidth 파라미터 추가
    if (maxWidth !== null) {
      placesApiUrl += `&maxwidth=${maxWidth}`;
      console.log(`구글 Place 이미지 가져오는 중 (제한 너비: ${maxWidth}px): ${photoReference.substring(0, 10)}...`);
    } else {
      console.log(`구글 Place 원본 이미지 가져오는 중: ${photoReference.substring(0, 10)}...`);
    }
    
    
    const response = await fetch(placesApiUrl);
    
    if (!response.ok) {
      throw new Error(`Google Places API 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    // 이미지 버퍼 가져오기
    const imageBuffer = await response.arrayBuffer();
    
    // 현재 날짜 기준 만료 시간 계산 (30일 후)
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(now.getDate() + 30);
    
    // 필수 태그 구성 (타입 태그 + 섹션 태그 + 아이템 ID + 캐시 타입)
    const tags = [
      `provider_${provider}`, 
      section, 
      effectiveItemId,
      'google_place',
      'cache_type_place_photo'
    ];
    
    // Cloudinary 업로드 옵션 구성 - 메타데이터와 태그 강화
    const uploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      tags: tags,
      context: {
        custom: {
          original_reference: photoReference,
          expiry_date: expiryDate.toISOString(),
          section_name: section,
          item_id:  '', // 파이어베이스 아이템 ID
          google_place_id: placeId || '', // 구글 placeID (임시용)
          cached_date: now.toISOString(),
          max_width: maxWidth ? maxWidth.toString() : "original",
          source: "google_place_api",
          provider: "google_place_api",
          cache_version: "1.0"
        }
      }
    };
    
    
    
    // 자동 포맷 최적화 활성화
    uploadOptions.fetch_format = 'auto';
    
    // Cloudinary에 업로드
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary 업로드 실패:', error);
            reject(error);
          } else {
            console.log(`Cloudinary 업로드 성공: ${publicId}`);
            resolve(result);
          }
        }
      );
      
      // 이미지 버퍼를 스트림에 쓰기
      uploadStream.write(Buffer.from(imageBuffer));
      uploadStream.end();
    });
  } catch (error) {
    console.error('Google Place 이미지 업로드 실패:', error);
    throw error;
  }
}

/**
 * 이미지가 만료되었는지 확인 (서비스 로직에 따라 구현)
 * @param {object} imageInfo - Cloudinary에서 가져온 이미지 정보
 * @param {number} expiryDays - 만료 일수 (기본값: 30일)
 * @returns {boolean} 이미지 만료 여부
 */
export function isImageExpired(imageInfo, expiryDays = 30) {
  if (!imageInfo || !imageInfo.created_at) return true;
  
  try {
    // 컨텍스트에서 만료일 확인 시도
    if (imageInfo.context && imageInfo.context.custom) {
      let contextData = imageInfo.context.custom;
      
      // 문자열인 경우 파싱 시도
      if (typeof contextData === 'string') {
        try {
          contextData = JSON.parse(contextData);
        } catch (e) {
          // 파싱 실패 시 기본 created_at 기반 만료 검사
          console.warn('컨텍스트 데이터 파싱 실패, 생성일 기준으로 만료 확인');
        }
      }
      
      // expiry_date가 있으면 직접 비교
      if (contextData.expiry_date) {
        const expiryDate = new Date(contextData.expiry_date);
        const now = new Date();
        return now > expiryDate;
      }
    }
    
    // 만료일 메타데이터가 없으면 생성일 기준으로 판단
    const createdAt = new Date(imageInfo.created_at);
    const now = new Date();
    
    // 환경 변수로 만료 기간 설정 가능
    const configuredExpiryDays = process.env.IMAGE_EXPIRY_DAYS ? 
      parseInt(process.env.IMAGE_EXPIRY_DAYS, 10) : expiryDays;
    
    const diffTime = now - createdAt;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    return diffDays > configuredExpiryDays;
  } catch (error) {
    console.error('이미지 만료 확인 오류:', error);
    return true; // 오류 발생 시 만료된 것으로 처리
  }
}

/**
 * 구글 사진 URL이나 photoReference 문자열에서 순수한 photo_reference 값을 추출합니다.
 * 
 * @param {string} input - 구글 사진 URL이나 photoReference 값
 * @returns {string|null} 추출된 photo_reference 값, 추출 실패 시 null 반환
 */
export function extractPhotoReference(input) {
  if (!input || typeof input !== 'string') return null;
  
  // URL인지 확인하고 photo_reference 파라미터 추출 시도
  if (input.includes('photo_reference=') || input.includes('photoreference=')) {
    try {
      const url = new URL(input);
      const photoRef = url.searchParams.get('photo_reference') || 
                      url.searchParams.get('photoreference');
      if (photoRef) return photoRef;
    } catch (error) {
      // URL 파싱 실패 시 정규식으로 추출 시도
      const photoRefMatch = input.match(/[?&](photo_?reference)=([^&]+)/i);
      if (photoRefMatch && photoRefMatch[2]) return photoRefMatch[2];
    }
  }
  
  // URL이 아니거나 파라미터 추출 실패한 경우 입력값을 그대로 반환
  // (이미 순수 photo_reference인 경우)
  return input;
}

/**
 * Cloudinary를 사용한 이미지 리사이징 URL 생성
 * @param {string} publicId - Cloudinary 공개 ID
 * @param {number} width - 타겟 너비
 * @param {number} height - 타겟 높이 (옵션)
 * @param {string} crop - 크롭 방식 (기본값: fill)
 * @returns {string} 리사이징된 이미지 URL
 */
export function getResizedImageUrl(publicId, width, height = null, crop = 'fill') {
  const options = {
    width,
    crop,
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  
  return getCloudinaryUrl(publicId, options);
}

/**
 * photo_reference로부터 Cloudinary public_id를 생성합니다.
 * 이 함수는 getCloudinaryPublicId와 동일하지만 명확한 이름으로 구분합니다.
 * 
 * @param {string} photoReference - 구글 Place 포토 레퍼런스
 * @returns {string} Cloudinary 공개 ID (폴더 포함)
 */
export function getPublicIdFromReference(photoReference) {
  return getCloudinaryPublicId(photoReference);
}

// Cloudinary 인스턴스 기본 내보내기
export default cloudinary; 