import { getPublicIdFromReference, uploadGooglePlaceImage, checkImageExists } from '../../lib/cloudinary';

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

  // API 키 가져오기 (image-proxy.js와 동일)
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  // 각 이미지 처리
  for (const imageInfo of imageInfoArray) {
    try {
      // 필수 정보 확인
      const { reference, publicId, placeId } = imageInfo;
      const itemId = placeId || defaultPlaceId;
      
      // 디버그 로그 추가
      console.log(`이미지 처리: reference=${reference?.substring(0, 10)}..., placeId=${placeId}, defaultPlaceId=${defaultPlaceId}, 최종 itemId=${itemId}`);
      
      if (!reference) {
        failedImages.push({ reference: imageInfo.reference || 'unknown', error: '이미지 참조 누락' });
        continue;
      }
      
      if (!itemId) {
        failedImages.push({ reference: imageInfo.reference || 'unknown', error: '유효한 placeId가 필요합니다' });
        continue;
      }

      // 이미 캐시된 publicId가 있는 경우 먼저 확인
      if (publicId) {
        const exists = await checkImageExists(publicId);
        if (exists) {
          cachedImageIds.push(publicId);
          console.log(`이미지가 이미 캐시됨 (publicId: ${publicId})`);
          continue;
        }
      }

      // 이미지 참조로 publicId 생성
      const computedPublicId = getPublicIdFromReference(reference, 'tempsection', itemId);

      // 이미지가 이미 클라우드에 존재하는지 확인
      const imageExists = await checkImageExists(computedPublicId);

      if (imageExists) {
        cachedImageIds.push(computedPublicId);
        console.log(`이미지가 이미 존재함 (${computedPublicId})`);
      } else {
        // 이미지 업로드 - 기본 maxWidth 값으로 800 사용 (null 대신)
        // image-proxy.js와 동일한 방식으로 apiKey 전달
        console.log(`이미지 업로드 시작: reference=${reference.substring(0, 10)}..., itemId=${itemId}`);
        const result = await uploadGooglePlaceImage(reference, 800, apiKey, itemId);
        
        if (result && result.public_id) {
          cachedImageIds.push(result.public_id);
          console.log(`이미지 성공적으로 업로드됨 (${result.public_id})`);
        } else {
          throw new Error('업로드 결과에 public_id가 없음');
        }
      }
    } catch (error) {
      console.error(`이미지 캐싱 실패:`, error);
      failedImages.push({
        reference: imageInfo?.reference || 'unknown',
        error: error.message || '이미지 캐싱 오류'
      });
    }
  }

  // 결과 반환
  res.status(200).json({
    cachedImageIds,
    failedImages
  });
} 