import { 
  getPublicIdFromReference, 
  uploadGooglePlaceImage, 
  checkImageExists,
  stripAssetFolder,  // 에셋 폴더 제거 유틸리티 함수 임포트
  getPublicIdFromGoogleReference,
  getFullPublicId     // 에셋 폴더 포함 풀 경로 생성 함수 추가
} from '../../lib/cloudinary';

/**
 * 구글 이미지 배치 프리캐싱을 위한 API 핸들러
 * 
 * 요청 본문:
 * {
 *   imageInfoArray: [{ publicId, reference, placeId }, ...],
 *   placeId: 'defaultPlaceId' (각 이미지에 placeId가 없는 경우 사용)
 * }
 * 
 * 응답:
 * {
 *   cachedImageIds: ['public_id_1', 'public_id_2', ...],
 *   failedImages: [{ reference: 'ref', error: 'reason' }, ...]
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메소드' });
  }

  // 요청 본문 검증
  const { imageInfoArray, placeId: defaultPlaceId } = req.body;

  if (!imageInfoArray || !Array.isArray(imageInfoArray) || imageInfoArray.length === 0) {
    return res.status(400).json({ error: '유효한 이미지 정보 배열이 필요합니다' });
  }

  // 결과 저장 배열
  const cachedImageIds = [];
  const failedImages = [];

  // API 키 가져오기 
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  // 각 이미지 처리
  for (const imageInfo of imageInfoArray) {
    try {
      // 필수 정보 확인
      const { reference, publicId, html_attributions } = imageInfo;
      
      // 디버그 로그 추가
      console.log(`이미지 처리: reference=${reference?.substring(0, 10)}...`);
      
      if (!reference) {
        failedImages.push({ reference: imageInfo.reference || 'unknown', error: '이미지 참조 누락' });
        continue;
      }

      // 이미 캐시된 publicId가 있는 경우 먼저 확인
      if (publicId) {
        // [수정] 물리 경로로 publicId 변환 후 존재 여부 확인
        const fullPublicId = getFullPublicId(publicId);
        const exists = await checkImageExists(fullPublicId);
        if (exists) {
          // 에셋 폴더가 없는 논리적 경로만 클라이언트에 반환
          cachedImageIds.push(stripAssetFolder(publicId));
          console.log(`이미지가 이미 캐시됨 (publicId: ${publicId})`);
          continue;
        }
      }

      // 이미지 참조로 publicId 생성 (항상 tempsection과 tempID 사용)
      const computedPublicId = getPublicIdFromGoogleReference(reference);

      // [수정] 물리 경로로 computedPublicId 변환 후 존재 여부 확인
      const fullComputedId = getFullPublicId(computedPublicId);
      const imageExists = await checkImageExists(fullComputedId);

      if (imageExists) {
        // 에셋 폴더가 없는 논리적 경로만 클라이언트에 반환
        cachedImageIds.push(stripAssetFolder(computedPublicId));
        console.log(`이미지가 이미 존재함 (${computedPublicId})`);
      } else {
        // 이미지 업로드 - 기본 maxWidth 값으로 800 사용
        console.log(`이미지 업로드 시작: reference=${reference.substring(0, 10)}...`);
        
        // html_attributions 처리 개선
        let attributionsArray = [];
        
        // html_attributions가 존재하는지 확인하고 적절히 처리
        if (html_attributions) {
          if (Array.isArray(html_attributions)) {
            attributionsArray = html_attributions;
          } else if (typeof html_attributions === 'string') {
            try {
              // 문자열이 JSON 형식인 경우 파싱 시도
              attributionsArray = JSON.parse(html_attributions);
            } catch (e) {
              // 파싱 실패 시 단일 문자열로 처리
              attributionsArray = [html_attributions];
            }
          }
        }
        
        console.log(`Cloudinary에 저장할 html_attributions:`, attributionsArray);
        
        // 구글 이미지는 항상 tempsection과 tempID 사용 (함수 내부에서 처리)
        // html_attributions 정보도 함께 전달
        const result = await uploadGooglePlaceImage(
          reference, 
          800, 
          apiKey, 
          attributionsArray
        );
        
        if (result && result.public_id) {
          // 에셋 폴더가 없는 논리적 경로만 클라이언트에 반환
          cachedImageIds.push(stripAssetFolder(result.public_id));
          console.log(`이미지 성공적으로 업로드됨 (${result.public_id})`);
          
          
        } else {
          throw new Error('업로드 결과에 public_id가 없음');
        }
      }
    } catch (error) {
      console.error(`이미지 캐싱 실패:`, error);
      
      // Cloudinary API 오류 자세히 로깅
      if (error.response) {
        try {
          const errorData = error.response.data || error.response;
          console.error('Cloudinary API 오류 응답:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: errorData
          });
        } catch (e) {
          console.error('Cloudinary 오류 응답 파싱 실패:', e);
        }
      }
      
      // API 제한 관련 오류 감지
      const errorMessage = error.message || '이미지 캐싱 오류';
      const isRateLimitError = 
        errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests') ||
        errorMessage.includes('quota exceeded') || 
        errorMessage.includes('disabled api_key');
        
      if (isRateLimitError) {
        console.error('⚠️ Cloudinary API 제한 감지됨:', errorMessage);
      }
      
      failedImages.push({
        reference: imageInfo?.reference || 'unknown',
        error: errorMessage,
        isRateLimit: isRateLimitError
      });
    }
  }

  // 결과 반환
  res.status(200).json({
    cachedImageIds,
    failedImages
  });
} 