/**
 * Cloudinary 설정 및 유틸리티 함수
 * 구글 Place 이미지 캐싱에 Cloudinary를 활용하는 기능을 제공합니다.
 * 
 * ----------------------------------------------------------------
 * Cloudinary 이미지 템플릿 분류
 * ----------------------------------------------------------------
 * - Banner (tall): 300×600, 세로로 긴 형태의 광고용 배너
 * - Banner (wide): 970×250, 가로로 넓은 형태의 광고용 배너
 * - Circle: 1010×1010, 프로필 사진이나 아바타용 원형 이미지
 * - Sharpened: 1000×563, 선명도가 높아진 제품 또는 풍경 이미지
 * - Square: 1000×1000, 소셜미디어나 제품 목록용 정사각형 이미지
 * - Thumbnail: 200×267, 콘텐츠 미리보기용 작은 이미지
 * - Watermark: 저작권 보호를 위한 워터마크 추가 이미지
 * ----------------------------------------------------------------
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
import fetch from 'node-fetch';

// Cloudinary 설정 - CLOUDINARY_URL 환경 변수를 자동으로 감지합니다.
// 환경 변수가 제대로 설정되어 있다면 추가 설정이 필요하지 않습니다.
// 명시적으로 설정하려면 아래 주석을 해제하세요.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// 구글 플레이스 이미지 저장 기본 폴더
const BASE_FOLDER = 'placeImages';
// 환경변수가 없으면 기본값으로 'map-Images'를 사용 (이전에는 에러를 발생시켰음)
const ASSET_FOLDER_FOR_PLACE = process.env.CLOUDINARY_ASSET_FOLDER || 'map-Images';

/**
 * publicId에서 에셋 폴더 제거 함수 
 * 클라이언트에서 사용되는 ID와 Cloudinary에서 사용되는 ID 변환
 * @param {string} publicId - Cloudinary에서 반환된 publicId (에셋 폴더 포함될 수 있음)
 * @returns {string} 에셋 폴더가 제거된 논리적 publicId
 */
export function stripAssetFolder(publicId) {
  if (!publicId) return '';
  
  const assetFolder = ASSET_FOLDER_FOR_PLACE;
  
  // 에셋 폴더로 시작하는 경우 제거
  if (publicId.startsWith(`${assetFolder}/`)) {
    return publicId.substring(`${assetFolder}/`.length);
  }
  
  return publicId;
}

/**
 * Cloudinary에서 사용할 전체 publicId 생성 (에셋 폴더 포함)
 * @param {string} logicalPublicId - 에셋 폴더가 없는 논리적 publicId
 * @returns {string} 에셋 폴더가 포함된 전체 publicId
 */
export function getFullPublicId(logicalPublicId) {
  if (!logicalPublicId) return '';
  
  // 이미 에셋 폴더로 시작하면 그대로 반환
  if (logicalPublicId.startsWith(`${ASSET_FOLDER_FOR_PLACE}/`)) {
    return logicalPublicId;
  }
  
  // 에셋 폴더 추가
  return `${ASSET_FOLDER_FOR_PLACE}/${logicalPublicId}`;
}

/**
 * 구글 Place 이미지의 Cloudinary 공개 ID를 생성합니다.
 * 계층 구조: placeImages/tempsection/tempID/이미지해시
 * publicID는 물리적 경로(map-Images)를 제외하고 논리적 경로만 포함합니다.
 * 
 * @param {string} photoReference - 구글 Place 포토 레퍼런스
 * @returns {string} Cloudinary 공개 ID (논리적 폴더 구조 포함)
 */
export function getPublicIdFromGoogleReference(photoReference) {
  if (!photoReference) {
    throw new Error('유효한 photo_reference가 필요합니다');
  }
  
  // 구글 이미지는 항상 'tempsection'과 'tempID'를 사용
  const section = 'tempsection';
  const tempId = 'tempID';
  
  // photoReference를 해시하여 고유한 이미지 ID 생성
  const imageHash = crypto.createHash('md5')
    .update(photoReference)
    .digest('hex')
    .substring(0, 16);
  
  // 계층형 구조로 공개 ID 구성: BASE_FOLDER/tempsection/tempID/이미지해시
  // 참고: 물리적 저장은 ASSET_FOLDER_FOR_PLACE/BASE_FOLDER/tempsection/tempID/이미지해시
  const publicId = `${BASE_FOLDER}/${section}/${tempId}/${imageHash}`;
  
  return publicId;
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
  if (!publicId) return '';
  
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
  
  // publicId에 ASSET_FOLDER_FOR_PLACE를 추가 (이미 포함되어 있지 않은 경우에만)
  // 이를 통해 DB에는 asset 폴더 없이 저장하고, Cloudinary URL 생성시에만 자동으로 asset 폴더를 붙임
  let fullPublicId = publicId;
  if (ASSET_FOLDER_FOR_PLACE && !publicId.startsWith(`${ASSET_FOLDER_FOR_PLACE}/`)) {
    fullPublicId = `${ASSET_FOLDER_FOR_PLACE}/${publicId}`;
    console.log(`Cloudinary URL 생성: 논리적 publicId에 폴더 추가 (${publicId} → ${fullPublicId})`);
  }
  
  return cloudinary.url(fullPublicId, safeOptions);
}

/**
 * Cloudinary context 객체를 API 요구 형식으로 변환
 * context 객체의 특수 문자(=, |)를 이스케이프 처리하고 문자열로 변환
 * @param {object} contextObject - 컨텍스트 객체
 * @returns {string} Cloudinary API용 변환된 컨텍스트 문자열 (key=value|key2=value2 형식)
 */
function prepareContextForCloudinary(contextObject) {
  if (!contextObject || typeof contextObject !== 'object') {
    return {};
  }

  // Cloudinary의 context는 "key=value|key2=value2" 형식의 문자열로 전달해야 함
  let contextString = '';
  
  for (const [key, value] of Object.entries(contextObject)) {
    // 값이 객체나 배열인 경우 JSON 문자열로 변환
    let processedValue = value;
    if (typeof value === 'object' && value !== null) {
      processedValue = JSON.stringify(value);
    }

    // 특수 문자 이스케이프
    if (typeof processedValue === 'string') {
      // '=' 문자와 '|' 문자를 이스케이프 처리
      processedValue = processedValue
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|');
    }
    
    // 문자열 연결
    if (contextString) {
      contextString += '|';
    }
    contextString += `${key}=${processedValue}`;
  }
  
  console.log('Cloudinary 컨텍스트 문자열 생성:', contextString);
  return contextString;
}

/**
 * Google Places API에서 이미지를 가져와 Cloudinary에 업로드
 * @param {string} photoReference - 구글 장소 사진 참조 ID
 * @param {number|null} maxWidth - 최대 이미지 너비 (기본값: 800, null인 경우 크기 제한 없음)
 * @param {string} apiKey - Google Maps API 키
 * @param {Array<string>} htmlAttributions - 이미지 저작권 속성 정보 (선택 사항)
 * @returns {Promise<object>} Cloudinary 업로드 결과
 */
export async function uploadGooglePlaceImage(photoReference, maxWidth = 800, apiKey, htmlAttributions = []) {
  if (!photoReference) {
    throw new Error('유효한 photo_reference가 필요합니다');
  }

  try {
    // 이미지를 가져올 구글 Places API URL 구성
    const googleApiKey = apiKey || process.env.NEXT_PUBLIC_MAPS_API_KEY;
    if (!googleApiKey) {
      throw new Error('NEXT_PUBLIC_MAPS_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    // 구글 이미지는 항상 'tempsection'과 'tempID'를 사용
    const section = 'tempsection'; 
    const tempId = 'tempID';
    const provider = 'google_place_api';

    // 계층형 구조의 공개 ID 생성
    const publicId = getPublicIdFromGoogleReference(photoReference);
  
    // 구글 API에서 이미지 가져오기
    let placesApiUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${encodeURIComponent(photoReference)}&key=${googleApiKey}`;
    
    // maxWidth가 null이 아닌 경우에만 maxwidth 파라미터 추가
    if (maxWidth !== null) {
      placesApiUrl += `&maxwidth=${maxWidth}`;
      
    } else {
      // maxWidth가 null이면 기본값 800 사용
      placesApiUrl += '&maxwidth=800';
      
    }
    
    // 이미지 요청
    const response = await fetch(placesApiUrl);
    
    // 오류 처리
    if (!response.ok) {
      console.error(`Google API 오류: ${response.status} ${response.statusText}`);
      throw new Error(`Google Places API 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    // 이미지 데이터 가져오기
    const imageBuffer = await response.buffer();
    
    // 현재 날짜 기준 만료 시간 계산 (30일 후)
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(now.getDate() + 30);
    
    // 필수 태그 구성
    const tags = [
      `provider_${provider}`, 
      section, 
      tempId,
      'google_place',
      'cache_type_place_photo',
      `google_reference_${photoReference.substring(0, 20)}`
    ];
    
    // html_attributions 처리 개선
    // 배열이 아닌 경우 빈 배열로 기본값 설정
    const attributionsArray = Array.isArray(htmlAttributions) ? htmlAttributions : [];
    
    // 디버깅용 로그
    console.log('저장할 html_attributions:', attributionsArray);
    
    // 문자열로 변환하여 저장 (HTML 태그와 특수문자가 포함된 문자열이므로 JSON으로 직렬화)
    const attributionsString = JSON.stringify(attributionsArray);
    console.log('JSON으로 변환된 html_attributions:', attributionsString);
    
    // Cloudinary context는 중첩 객체를 직접 지원하지 않음
    // 평면화된 구조로 변환
    const customContext = {
      original_reference: photoReference,
      expiry_date: expiryDate.toISOString(),
      section_name: section,
      temp_id: tempId,
      cached_date: now.toISOString(),
      max_width: maxWidth ? maxWidth.toString() : "800",
      source: "google_place_api",
      provider: "google_place_api",
      cache_version: "1.0",
      html_attributions: attributionsString,
    };
    
    // 디버그 로그
    console.log('Cloudinary에 저장할 컨텍스트:', customContext);
    
    // 컨텍스트 파라미터 준비 (특수 문자 이스케이프)
    const processedContext = prepareContextForCloudinary(customContext);
    console.log('변환된 컨텍스트 파라미터:', processedContext);
    
    // Cloudinary 업로드 옵션 구성
    const uploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      tags: tags,
      context: processedContext,
      folder: ASSET_FOLDER_FOR_PLACE
    };
    
    
    // 자동 포맷 최적화 활성화
    uploadOptions.fetch_format = 'auto';
    
    // Cloudinary에 업로드하고 응답 반환
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary 업로드 실패:', error);
            reject(error);
          } else {
            console.log(`Cloudinary 업로드 성공: ${publicId}`);
            // 결과 객체에 원본 레퍼런스 정보 추가
            result.originalReference = photoReference;
            resolve(result);
          }
        }
      );
      
      // 이미지 버퍼를 스트림에 쓰기
      uploadStream.write(Buffer.from(imageBuffer));
      uploadStream.end();
    });
    
    // 업로드 결과 반환
    return uploadResult;
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
 * 서명된 Cloudinary URL을 생성합니다.
 * 클라이언트가 직접 Cloudinary에 접근할 수 있는 보안 URL 생성
 * 
 * @param {string} publicId - Cloudinary 공개 ID
 * @param {object} options - 변환 옵션
 * @param {number} validitySeconds - URL 유효 시간 (초 단위, 기본 1시간)
 * @returns {string} 서명된 Cloudinary URL
 */
export function generateSignedUrl(publicId, options = {}, validitySeconds = 3600) {
  if (!publicId) return '';
  
  const defaultOptions = {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto'
  };
  
  // 안전한 이미지 크기 제한 적용
  const safeOptions = { ...defaultOptions, ...options };
  
  // 최대 너비 및 높이 제한
  const MAX_SAFE_WIDTH = 1000;
  const MAX_SAFE_HEIGHT = 1000;
  
  if (safeOptions.width && parseInt(safeOptions.width, 10) > MAX_SAFE_WIDTH) {
    safeOptions.width = MAX_SAFE_WIDTH;
  }
  
  if (safeOptions.height && parseInt(safeOptions.height, 10) > MAX_SAFE_HEIGHT) {
    safeOptions.height = MAX_SAFE_HEIGHT;
  }
  
  // 유효 시간 설정
  const timestamp = Math.round(new Date().getTime() / 1000) + validitySeconds;
  safeOptions.timestamp = timestamp;
  
  // URL 생성 시 에셋 폴더 추가
  let fullPublicId = publicId;
  if (ASSET_FOLDER_FOR_PLACE && !publicId.startsWith(`${ASSET_FOLDER_FOR_PLACE}/`)) {
    fullPublicId = `${ASSET_FOLDER_FOR_PLACE}/${publicId}`;
  }
  
  // 서명 생성을 위한 파라미터 설정
  const signatureParams = { ...safeOptions, public_id: fullPublicId };
  
  // URL 서명 생성
  const signature = cloudinary.utils.api_sign_request(
    signatureParams, 
    process.env.CLOUDINARY_API_SECRET
  );
  
  // 기본 URL 생성
  const baseUrl = cloudinary.url(fullPublicId, safeOptions);
  
  // URL에 서명 추가
  return `${baseUrl}&signature=${signature}&timestamp=${timestamp}`;
}

// Cloudinary 인스턴스 기본 내보내기
export default cloudinary; 