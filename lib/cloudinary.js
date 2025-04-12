/**
 * Cloudinary 설정 및 유틸리티 함수
 * 구글 Place 이미지 캐싱에 Cloudinary를 활용하는 기능을 제공합니다.
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

// 구글 플레이스 이미지 저장 폴더
const GOOGLE_PLACE_FOLDER = 'google-places';

/**
 * 구글 Place 이미지의 Cloudinary 공개 ID를 생성합니다.
 * 긴 photo reference를 MD5 해시로 변환하여 길이 제한 문제를 해결합니다.
 * 
 * @param {string} photoReference - 구글 Place 포토 레퍼런스
 * @returns {string} Cloudinary 공개 ID (폴더 포함)
 */
export function getCloudinaryPublicId(photoReference) {
  // 너무 긴 레퍼런스는 MD5 해시로 변환 (Cloudinary 공개 ID 제한)
  if (photoReference.length > 100) {
    const hash = crypto.createHash('md5').update(photoReference).digest('hex');
    return `${GOOGLE_PLACE_FOLDER}/${hash}`;
  }
  return `${GOOGLE_PLACE_FOLDER}/${photoReference}`;
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
  
  return cloudinary.url(publicId, {
    ...defaultOptions,
    ...options
  });
}

/**
 * Google Places API에서 이미지를 가져와 Cloudinary에 업로드
 * @param {string} photoReference - 구글 장소 사진 참조 ID
 * @param {number} maxWidth - 최대 이미지 너비 (기본값: 800)
 * @param {boolean} forceRefresh - 기존 이미지가 있어도 강제 새로고침 여부
 * @returns {Promise<object>} Cloudinary 업로드 결과
 */
export async function uploadGooglePlaceImage(photoReference, maxWidth = 800, forceRefresh = false) {
  if (!photoReference) {
    throw new Error('유효한 photo_reference가 필요합니다');
  }

  try {
    // 이미지를 가져올 구글 Places API URL 구성
    const googleApiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
    if (!googleApiKey) {
      throw new Error('NEXT_PUBLIC_MAPS_API_KEY 환경 변수가 설정되지 않았습니다');
    }

    const publicId = getCloudinaryPublicId(photoReference);
    
    // 기존 이미지 확인
    if (!forceRefresh) {
      const existingImage = await checkImageExists(publicId);
      if (existingImage && !isImageExpired(existingImage)) {
        console.log(`기존 Cloudinary 이미지 사용: ${publicId}`);
        return existingImage;
      }
    }

    // 구글 API에서 이미지 가져오기
    const placesApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${googleApiKey}`;
    
    console.log(`구글 Place 이미지 가져오는 중: ${photoReference.substring(0, 10)}...`);
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
    
    // Cloudinary 업로드 옵션 구성
    const uploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      context: `photo_reference=${photoReference}|upload_date=${now.toISOString()}|expiry_date=${expiryDate.toISOString()}`,
      tags: ['google_place_photo']
    };
    
    // 서비스 메타데이터 추가 옵션
    if (process.env.INCLUDE_METADATA === 'true') {
      uploadOptions.context = {
        custom: {
          photo_reference: photoReference,
          upload_date: now.toISOString(),
          expiry_date: expiryDate.toISOString(),
          source: 'google_places_api'
        }
      };
    }
    
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
    // 이미지 생성일로부터 정해진 일수가 지났으면 만료로 처리
    const createdAt = new Date(imageInfo.created_at);
    const now = new Date();
    
    // 환경 변수로 만료 기간 설정 가능
    const configuredExpiryDays = process.env.IMAGE_EXPIRY_DAYS ? 
      parseInt(process.env.IMAGE_EXPIRY_DAYS, 10) : expiryDays;
    
    const diffTime = now - createdAt;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    // 개발 환경에서는 더 짧은 만료 기간 적용 가능
    if (process.env.NODE_ENV === 'development' && process.env.DEV_IMAGE_EXPIRY_DAYS) {
      const devExpiryDays = parseInt(process.env.DEV_IMAGE_EXPIRY_DAYS, 10);
      return diffDays > devExpiryDays;
    }
    
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
  
  if (height) {
    options.height = height;
  }
  
  return getCloudinaryUrl(publicId, options);
}

/**
 * 직접 Binary에서 Cloudinary에 업로드 (Buffer 또는 Stream 지원)
 * @param {Buffer|Stream} fileBuffer - 파일 버퍼 또는 스트림
 * @param {string} filename - 원본 파일명
 * @param {string} folder - 저장할 폴더
 * @param {object} metadata - 추가 메타데이터
 * @returns {Promise<object>} 업로드 결과
 */
export async function uploadFromBuffer(fileBuffer, filename, folder = 'uploads', metadata = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        filename_override: filename,
        context: metadata ? `custom=${JSON.stringify(metadata)}` : undefined
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    
    // 버퍼일 경우 스트림으로 변환
    if (Buffer.isBuffer(fileBuffer)) {
      const { Readable } = require('stream');
      const readableStream = new Readable();
      readableStream.push(fileBuffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    } else {
      // 이미 스트림일 경우
      fileBuffer.pipe(uploadStream);
    }
  });
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