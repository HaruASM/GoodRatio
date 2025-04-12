/**
 * Cloudinary를 이용한 구글 Place Photo API 프록시 핸들러
 * 
 * ----------------------------------------------------------------
 * 향후 구현 계획 (Cloudinary 기반)
 * ----------------------------------------------------------------
 * 
 * ## 3단계: 사용자 업로드 기능 추가
 * - `/api/upload-image` 엔드포인트 구현: Cloudinary에 직접 업로드
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
 * 참고: Cloudinary SDK를 별도 설치해야 함
 * `npm install cloudinary`
 * ----------------------------------------------------------------
 */

import { 
  checkImageExists, 
  getCloudinaryPublicId, 
  getCloudinaryUrl, 
  uploadGooglePlaceImage, 
  isImageExpired
} from '../../lib/cloudinary';
import fetch from 'node-fetch';

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

// 최대 이미지 너비 기본값
const DEFAULT_MAX_WIDTH = 800;

/**
 * Google Place 사진 요청 처리 핸들러
 */
export default async function handler(req, res) {
  console.log('Place Photo API 호출됨');
  const { photo_reference, maxwidth = DEFAULT_MAX_WIDTH, metadata = false } = req.query;

  // API 키 검증
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey) {
    console.error('NEXT_PUBLIC_MAPS_API_KEY가 설정되지 않았습니다');
    return res.status(500).json({ error: 'API key is not configured' });
  }

  // photo_reference 검증
  if (!photo_reference) {
    return res.status(400).json({ error: 'photo_reference is required' });
  }

  try {
    // 1. Cloudinary 공개 ID 생성
    const publicId = getCloudinaryPublicId(photo_reference);
    
    // 2. Cloudinary에서 이미지 확인 (메타데이터 포함)
    const imageInfo = await checkImageExists(publicId, true);
    
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
        
        return res.status(200).json({
          exists: true,
          url: getCloudinaryUrl(publicId),
          created_at: imageInfo.created_at,
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          original_reference: parsedContext.photo_reference || photo_reference,
          is_expired: isImageExpired(imageInfo)
        });
      } else {
        return res.status(404).json({
          exists: false,
          message: 'Image not found in Cloudinary'
        });
      }
    }
    
    // 4. 이미지 존재 여부 확인 및 만료 체크
    let imageUrl;
    
    if (imageInfo && !isImageExpired(imageInfo)) {
      // 기존 이미지 사용
      console.log(`Cloudinary에서 기존 이미지 사용: ${publicId}`);
      console.log(`🔵 [캐시 사용] photo_reference: ${photo_reference.substring(0, 15)}...`);
      imageUrl = getCloudinaryUrl(publicId, { width: maxwidth });
    } else {
      // 이미지가 없거나 만료된 경우 새로 업로드
      console.log(`Google API에서 이미지 가져와 Cloudinary에 업로드: ${photo_reference}`);
      try {
        const uploadResult = await uploadGooglePlaceImage(photo_reference, maxwidth, apiKey);
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary 업로드 실패, 직접 Google API 호출로 대체:', uploadError);
        // 업로드 실패 시 Google API 직접 호출로 대체
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photo_reference}&key=${apiKey}`;
      }
    }
    
    // 5. 이미지 리디렉션 또는 프록시
    if (process.env.USE_IMAGE_REDIRECT === 'true') {
      // 리디렉션 방식
      res.redirect(imageUrl);
    } else {
      // 프록시 방식 - 이미지 데이터를 직접 전달
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`이미지 가져오기 실패: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      const buffer = await imageResponse.buffer();
      const contentType = imageResponse.headers.get('content-type');
      
      // 캐싱 헤더 설정 (1주일)
      res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');
      res.setHeader('Content-Type', contentType);
      // 원본 photo_reference 정보 포함
      res.setHeader('X-Original-Photo-Reference', photo_reference);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Place Photo API 오류:', error);
    res.status(500).json({ error: '이미지를 가져오는 중 오류가 발생했습니다' });
  }
} 