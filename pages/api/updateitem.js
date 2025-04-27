import { EditorServerServiceNew } from '../../lib/services/editorServerUtils';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * 이미지의 publicId에서 section 정보 추출
 * @param {string} publicId - Cloudinary 이미지 publicId
 * @returns {Object} section 정보를 포함한 객체
 */
function parsePublicId(publicId) {
  if (!publicId) return null;
  
  // publicId 형식: 'section/filename' 또는 'section/subsection/filename'
  const parts = publicId.split('/');
  
  if (parts.length >= 2) {
    return {
      section: parts[0],
      filename: parts[parts.length - 1]
    };
  }
  
  return null;
}

/**
 * Cloudinary의 이미지 section 업데이트
 * @param {string} publicId - 업데이트할 이미지의 publicId
 * @param {string} newSection - 새로운 section 이름
 * @returns {Promise<Object>} 업데이트된 이미지 정보
 */
async function updateImageSection(publicId, newSection) {
  if (!publicId || !newSection) {
    throw new Error('PublicId와 새 섹션 이름이 필요합니다');
  }
  
  try {
    const parsedId = parsePublicId(publicId);
    if (!parsedId) throw new Error(`유효하지 않은 publicId 형식: ${publicId}`);
    
    // 새 publicId 생성
    const newPublicId = `${newSection}/${parsedId.filename}`;
    
    // 이미지 태그 및 메타데이터 업데이트와 함께 리네임
    const result = await cloudinary.uploader.rename(publicId, newPublicId, {
      overwrite: true,
      invalidate: true,
      context: `section=${newSection}`,
      tags: [newSection]
    });
    
    console.log(`이미지 섹션 업데이트 성공: ${publicId} -> ${newPublicId}`);
    return { 
      oldPublicId: publicId, 
      newPublicId: newPublicId,
      result: result 
    };
  } catch (error) {
    console.error(`이미지 섹션 업데이트 실패 (${publicId}):`, error);
    throw error;
  }
}

/**
 * 이미지 배열에서 tempsection 이미지 필터링
 * @param {Array} images - 이미지 publicId 배열
 * @returns {Array} tempsection 이미지 목록
 */
function filterTempSectionImages(images) {
  if (!images || !Array.isArray(images)) return [];
  
  return images.filter(publicId => {
    const parsed = parsePublicId(publicId);
    return parsed && parsed.section === 'tempsection';
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메서드입니다' });
  }

  try {
    const { serverDataset, userID = 'betaUser' } = req.body;
    
    if (!serverDataset) {
      return res.status(400).json({ message: '유효한 데이터셋이 제공되지 않았습니다' });
    }
    
    // 객체의 필드 검증
    if (!serverDataset.sectionName) {
      return res.status(400).json({ message: 'sectionName 필드가 필요합니다' });
    }
    
    const newSectionName = serverDataset.sectionName;
    const updatedDataset = { ...serverDataset };
    
    // tempsection 이미지 처리
    const processedImages = {
      main: null,
      sub: []
    };
    
    // 메인 이미지 처리
    if (updatedDataset.mainImage && parsePublicId(updatedDataset.mainImage)?.section === 'tempsection') {
      try {
        const updated = await updateImageSection(updatedDataset.mainImage, newSectionName);
        updatedDataset.mainImage = updated.newPublicId;
        processedImages.main = updated;
      } catch (error) {
        console.error('메인 이미지 처리 중 오류:', error);
        // 에러가 발생해도 계속 진행
      }
    }
    
    // 서브 이미지 처리
    if (updatedDataset.subImages && Array.isArray(updatedDataset.subImages)) {
      const tempImages = filterTempSectionImages(updatedDataset.subImages);
      
      for (let i = 0; i < tempImages.length; i++) {
        try {
          const publicId = tempImages[i];
          const updated = await updateImageSection(publicId, newSectionName);
          
          // 원래 배열에서 해당 이미지 publicId 업데이트
          const index = updatedDataset.subImages.indexOf(publicId);
          if (index !== -1) {
            updatedDataset.subImages[index] = updated.newPublicId;
          }
          
          processedImages.sub.push(updated);
        } catch (error) {
          console.error(`서브 이미지 처리 중 오류 (${tempImages[i]}):`, error);
          // 에러가 발생해도 계속 진행
        }
      }
    }
    
    // EditorServerServiceNew의 updateItem 메서드를 사용하여 업데이트
    const result = await EditorServerServiceNew.updateItem(updatedDataset, userID);
    
    // 응답에 이미지 처리 결과 추가
    return res.status(200).json({
      ...result,
      processedImages: processedImages
    });
    
  } catch (error) {
    console.error('업데이트 중 오류 발생:', error);
    return res.status(500).json({ 
      message: '서버 오류가 발생했습니다', 
      error: error.message 
    });
  }
} 