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
  getCloudinaryPublicId, 
  getCloudinaryUrl, 
  uploadGooglePlaceImage, 
  isImageExpired
} from '../../lib/cloudinary';
import fetch from 'node-fetch';

// 상단에 일관된 이미지 사이즈 상수 정의
const DEFAULT_MAX_WIDTH = 800; // 기본 이미지 너비
const THUMBNAIL_WIDTH = 400;   // 썸네일 크기
const MEDIUM_WIDTH = 800;      // 중간 크기
const FALLBACK_WIDTH = 600;    // 실패 시 대체 크기
const MAX_SAFE_ORIGINAL = 2000; // 원본 이미지 안전 상한선

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
 */
export default async function handler(req, res) {
  console.log('Place Photo API 호출됨');
  const { 
    photo_reference, 
    public_id,
    maxwidth, 
    maxheight,
    mode = 'scale',
    quality = 'auto',
    metadata = false,
    original = false,
    section = 'default',
    place_id = null,
    image_index = 1
  } = req.query;

  // 원본 이미지 요청 여부 확인
  const isOriginalRequest = original === 'true' || maxwidth === undefined;
  // 기본 최대 너비 (원본 요청이 아닌 경우에만 사용)
  const effectiveMaxWidth = isOriginalRequest ? null : (maxwidth || DEFAULT_MAX_WIDTH);
  
  // API 키 검증
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey) {
    console.error('NEXT_PUBLIC_MAPS_API_KEY가 설정되지 않았습니다');
    return res.status(500).json({ error: 'API key is not configured' });
  }

  try {
    // 1. Cloudinary 공개 ID 결정 (public_id 파라미터가 있으면 그것을 사용, 없으면 photo_reference로 생성)
    let publicId;
    let originalReference;
    
    if (public_id) {
      // public_id가 제공된 경우, 직접 사용
      publicId = public_id;
      console.log(`클라이언트가 제공한 public_id 사용: ${truncateForLogging(publicId)}`);
      console.log(`요청 타입: ${isOriginalRequest ? '원본 크기' : `${effectiveMaxWidth}px 크기`}`);
    } else if (photo_reference) {
      // photo_reference가 제공된 경우, publicId 생성
      publicId = getCloudinaryPublicId(photo_reference, section, place_id, image_index);
      originalReference = photo_reference;
      console.log(`photo_reference로 public_id 생성: ${truncateForLogging(publicId)}`);
      console.log(`섹션: ${section}, 장소ID: ${place_id || '없음'}, 이미지 번호: ${image_index}`);
    } else {
      // 둘 다 없는 경우, 에러 반환
      return res.status(400).json({ error: 'photo_reference or public_id is required' });
    }
    
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
    
    // 4. 이미지 존재 여부 확인 및 만료 체크
    let imageUrl;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dzjjy5oxi';

    if (imageInfo && !isImageExpired(imageInfo)) {
      // 기존 이미지 사용
      console.log(`Cloudinary에서 기존 이미지 사용: ${publicId}`);
      
      if (photo_reference) {
        console.log(`🔵 [캐시 사용] photo_reference: ${photo_reference.substring(0, 15)}...`);
      } else {
        console.log(`🔵 [캐시 사용] public_id: ${truncateForLogging(publicId)}`);
      }
      
      if (!isOriginalRequest) {
        // 썸네일 이미지 요청 - 변환 파라미터 사용
        const imageOptions = {
          width: parseInt(effectiveMaxWidth, 10),
          crop: mode,
          quality: quality,
          fetch_format: 'auto'
        };
        
        // maxheight가 제공된 경우 추가
        if (maxheight) {
          imageOptions.height = parseInt(maxheight, 10);
        }
        
        imageUrl = getCloudinaryUrl(publicId, imageOptions);
      } else {
        // 원본 이미지 요청인 경우
        // 원본 요청은 Cloudinary에서 직접 가져옴
        imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
      }
    } else if (photo_reference) {
      // 이미지가 없거나 만료되었지만 photo_reference가 있는 경우 Google API에서 가져옴
      console.log(`Cloudinary 캐시 없음 - Google API에서 이미지 가져와 업로드: ${photo_reference}`);
      try {
        // 업로드 옵션 구성
        const uploadOptions = {
          section,
          placeId: place_id,
          imageIndex: image_index,
          mode,
          quality,
          provider: 'google'
        };
        
        if (maxheight) {
          uploadOptions.maxheight = maxheight;
        }
        
        // 썸네일 요청인 경우
        if (!isOriginalRequest) {
          const uploadResult = await uploadGooglePlaceImage(photo_reference, effectiveMaxWidth, apiKey, uploadOptions);
          imageUrl = uploadResult.secure_url;
        } else {
          // 원본 이미지 요청인 경우
          console.log('원본 크기로 구글 API 이미지 요청 및 Cloudinary에 업로드');
          // 원본 요청 시에도 안전한 최대 크기를 적용 (너무 큰 이미지 방지)
          const uploadResult = await uploadGooglePlaceImage(photo_reference, MAX_SAFE_ORIGINAL, apiKey, uploadOptions);
          // 직접 URL 구성 (버전 정보 없이)
          imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
        }
      } catch (uploadError) {
        console.error('Cloudinary 업로드 실패, 직접 Google API 호출로 대체:', uploadError.message);
        // 업로드 실패 시 Google API 직접 호출로 대체
        if (isOriginalRequest) {
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${photo_reference}&key=${apiKey}`;
        } else {
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${effectiveMaxWidth}&photo_reference=${photo_reference}&key=${apiKey}`;
          
          if (maxheight) {
            imageUrl += `&maxheight=${maxheight}`;
          }
        }
      }
    } else {
      // public_id만 있고 Cloudinary에 이미지가 없는 경우 404 반환
      return res.status(404).json({ error: 'Image not found in Cloudinary and no photo_reference provided' });
    }
    
    // 5. 이미지 리디렉션 또는 프록시
    if (process.env.USE_IMAGE_REDIRECT === 'true') {
      // 리디렉션 방식
      res.redirect(imageUrl);
    } else {
      // 프록시 방식 - 이미지 데이터를 직접 전달
      const MAX_RETRY = 1; // 재시도 횟수

      try {
        const fetchImage = async (url) => {
          console.log(`이미지 가져오기 시도: ${url.substring(0, 100)}...`);
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`이미지 가져오기 실패: ${response.status} ${response.statusText}`);
          }
          
          return {
            buffer: await response.buffer(),
            contentType: response.headers.get('content-type')
          };
        };
        
        let imageData;
        let retryCount = 0;
        
        // 첫 시도
        try {
          imageData = await fetchImage(imageUrl);
        } catch (fetchError) {
          console.warn(`이미지 가져오기 실패 (${isOriginalRequest ? '원본' : effectiveMaxWidth + 'px'}): ${fetchError.message}`);
          
          // 이미지 가져오기 실패 처리 로직
          if (isOriginalRequest) {
            // 1. Cloudinary에 이미지가 있는 경우 (캐시는 있으나 URL 접근 실패)
            if (imageInfo) {
              console.log('Cloudinary에 이미지가 있으나 원본 접근 실패, 대체 방식으로 시도');
              try {
                // 1차 시도: 기본 SDK를 통한 URL 생성
                console.log('1차 시도: SDK로 기본 URL 생성');
                const fallbackUrl = getCloudinaryUrl(publicId, { quality: 'auto' });
                imageData = await fetchImage(fallbackUrl);
              } catch (sdkError) {
                console.warn('SDK URL 방식으로도 실패, 다른 Cloudinary 접근 방식 시도');
                try {
                  // 2차 시도: 버전 없이 접근
                  console.log('2차 시도: 버전 정보 없이 접근');
                  const noVersionUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
                  imageData = await fetchImage(noVersionUrl);
                } catch (noVersionError) {
                  try {
                    // 3차 시도: 썸네일 변환으로 접근 (원본과 거의 동일한 크기)
                    console.log('3차 시도: 대용량 이미지로 접근 (원본에 근접한 크기)');
                    const largeImageUrl = getCloudinaryUrl(publicId, { width: MAX_SAFE_ORIGINAL, height: MAX_SAFE_ORIGINAL, crop: 'limit', quality: 'auto' });
                    imageData = await fetchImage(largeImageUrl);
                  } catch (largeError) {
                    console.warn('모든 Cloudinary 접근 방식 실패, 중간 크기 이미지로 대체');
                    // 최종 대체: 중간 크기 이미지로 대체 (실패 방지)
                    const mediumImageUrl = getCloudinaryUrl(publicId, { width: MEDIUM_WIDTH, crop: 'scale', quality: 'auto' });
                    try {
                      imageData = await fetchImage(mediumImageUrl);
                    } catch (finalError) {
                      console.error('모든 Cloudinary 접근 방식 실패, 기본 이미지 사용');
                      // 기본 이미지 URL (애플리케이션에 기본 이미지가 있다면 사용)
                      const defaultImage = '/images/default-photo.jpg';
                      throw new Error('이미지를 가져올 수 없습니다');
                    }
                  }
                }
              }
            } 
            // 2. Cloudinary에 이미지가 없는 경우 (새로 업로드 시도 실패)
            else {
              console.log('Cloudinary에 이미지가 없음, 구글 API에서 직접 가져오기 시도');
              try {
                const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${photo_reference}&key=${apiKey}`;
                imageData = await fetchImage(googleUrl);
              } catch (googleError) {
                console.warn('구글 API 원본 이미지 가져오기 실패, 기본 이미지로 대체');
                // 기본 이미지로 대체 (중간 크기 이미지)
                const fallbackUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${MEDIUM_WIDTH}&photo_reference=${photo_reference}&key=${apiKey}`;
                imageData = await fetchImage(fallbackUrl);
              }
            }
          } 
          // 썸네일 이미지 가져오기 실패 처리 (원래 로직과 유사)
          else if (retryCount < MAX_RETRY && parseInt(effectiveMaxWidth, 10) > FALLBACK_WIDTH) {
            retryCount++;
            
            // 이미지 크기 줄이기
            if (imageInfo) {
              // Cloudinary 이미지가 있으면 더 작은 크기로 생성
              const fallbackOptions = {
                width: FALLBACK_WIDTH,
                crop: 'scale',
                quality: 'auto',
                fetch_format: 'auto'
              };
              
              const fallbackUrl = getCloudinaryUrl(publicId, fallbackOptions);
              console.log(`대체 이미지 요청 시도 (${FALLBACK_WIDTH}px)`);
              imageData = await fetchImage(fallbackUrl);
            } else {
              // 구글 API 직접 호출로 더 작은 크기 요청
              const fallbackUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${FALLBACK_WIDTH}&photo_reference=${photo_reference}&key=${apiKey}`;
              console.log(`Google API에서 대체 이미지 요청 (${FALLBACK_WIDTH}px)`);
              imageData = await fetchImage(fallbackUrl);
            }
          } else {
            // 모든 시도 실패
            throw fetchError;
          }
        }
        
        // 캐싱 헤더 설정 (1주일)
        res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');
        res.setHeader('Content-Type', imageData.contentType);
        // 원본 photo_reference 정보 포함
        res.setHeader('X-Original-Photo-Reference', photo_reference);
        res.setHeader('X-Image-Width', retryCount > 0 ? FALLBACK_WIDTH.toString() : effectiveMaxWidth);
        res.send(imageData.buffer);
      } catch (error) {
        console.error('이미지 프록시 처리 오류:', error);
        // 실패 시 오류 응답 반환
        res.status(500).json({ error: '이미지를 가져오는 중 오류가 발생했습니다', detail: error.message });
      }
    }
  } catch (error) {
    console.error('Place Photo API 오류:', error);
    res.status(500).json({ error: '이미지를 가져오는 중 오류가 발생했습니다' });
  }
} 