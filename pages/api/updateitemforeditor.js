import { firebasedb } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { v2 as cloudinary } from 'cloudinary';
import { stripAssetFolder, getFullPublicId } from '../../lib/cloudinary'; // 유틸리티 함수 임포트

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
 * @returns {Object} section 정보를 포함한 객체 또는 null
 */
function parsePublicId(publicId) {
  if (!publicId) return null;
  
  // 로그 추가
  console.log(`parsePublicId 입력값: ${publicId}`);
  
  // 1. 먼저 asset 폴더(map-Images) 제거
  const assetFolder = process.env.CLOUDINARY_ASSET_FOLDER || 'map-Images';
  let parsablePath = publicId;
  if (parsablePath.startsWith(`${assetFolder}/`)) {
    parsablePath = parsablePath.substring(`${assetFolder}/`.length);
    console.log(`asset 폴더(${assetFolder}/) 제거 후: ${parsablePath}`);
  }
  
  // 2. placeImages/ 접두사가 있는 경우 제거 (BASE_FOLDER 제거)
  if (parsablePath.startsWith('placeImages/')) {
    parsablePath = parsablePath.substring('placeImages/'.length);
    console.log(`placeImages/ 접두사 제거 후: ${parsablePath}`);
  }
  
  // 3. 경로 분석 (section/filename 또는 section/subsection/filename)
  const parts = parsablePath.split('/');
  
  if (parts.length >= 2) {
    const result = {
      section: parts[0],
      filename: parts[parts.length - 1],
      hasBasePath: publicId.includes('placeImages/'),
      originalPath: publicId
    };
    console.log(`publicId 파싱 결과:`, result);
    return result;
  }
  
  console.log(`publicId 파싱 실패: ${publicId}`);
  return null;
}

/**
 * 이미지 publicId에서 sectionName을 명확하게 추출하는 함수
 * mainImage와 subImages에 대해 사용되며, 객체를 서버로 update 또는 create할 때만 사용됨
 * placeImages/ 다음 부분이 sectionName으로 인식됨
 * @param {string} publicId - Cloudinary 이미지 publicId
 * @returns {string|null} 추출된 sectionName 또는 null(추출 실패시)
 */
function getSectionNameFromPublicId(publicId) {
  if (!publicId || typeof publicId !== 'string') {
    console.log('유효하지 않은 publicId:', publicId);
    return null;
  }

  console.log(`publicId에서 섹션명 추출 시작: ${publicId}`);
  
  // 정규식을 사용하여 placeImages/ 다음 부분 추출
  const regex = /placeImages\/([^\/]+)/;
  const match = publicId.match(regex);
  
  if (match && match[1]) {
    console.log(`섹션명 추출 성공: ${match[1]}`);
    return match[1];
  }
  
  return null;
}

/**
 * Cloudinary의 이미지 section 업데이트
 * @param {string} publicId - 업데이트할 이미지의 publicId
 * @param {string} newSection - 새로운 section 이름
 * @param {string} itemId - 객체의 ID (파이어베이스 문서 ID)
 * @returns {Promise<Object>} 업데이트된 이미지 정보
 */
async function updateImageSection(publicId, newSection, itemId) {
  if (!publicId || !newSection) {
    throw new Error('PublicId와 새 섹션 이름이 필요합니다');
  }
  
  if (!itemId) {
    throw new Error('ItemId가 필요합니다');
  }
  
  try {
    console.log(`이미지 섹션 업데이트 시작: ${publicId} -> ${newSection}/${itemId}`);
    
    const parsedId = parsePublicId(publicId);
    if (!parsedId) throw new Error(`유효하지 않은 publicId 형식: ${publicId}`);
    
    // 새 publicId 생성 (논리적 경로만)
    let newLogicalPublicId;
    if (parsedId.hasBasePath) {
      // BASE_FOLDER 포함 경로 유지하고 itemId 추가
      newLogicalPublicId = `placeImages/${newSection}/${itemId}/${parsedId.filename}`;
    } else {
      // 기존 방식에 itemId 추가
      newLogicalPublicId = `${newSection}/${itemId}/${parsedId.filename}`;
    }
    
    // 원본 publicId는 그대로 사용 (asset 폴더 포함된 전체 경로)
    const originalFullPublicId = getFullPublicId(publicId);
    
    // 새 publicId에 asset 폴더 추가 (Cloudinary에 저장될 전체 경로)
    const newFullPublicId = getFullPublicId(newLogicalPublicId);
      
    console.log(`리네임 시도: ${originalFullPublicId} -> ${newFullPublicId}`);
    
    // 이미지 태그 및 메타데이터 업데이트와 함께 리네임
    const result = await cloudinary.uploader.rename(originalFullPublicId, newFullPublicId, {
      overwrite: true,
      invalidate: true,
      context: `section=${newSection},item_id=${itemId}`,
      tags: [newSection, `item_${itemId}`]
    });
    
    console.log(`이미지 섹션 업데이트 성공: ${originalFullPublicId} -> ${newFullPublicId}`);
    return { 
      oldPublicId: publicId, 
      newPublicId: newLogicalPublicId,  // 논리적 경로만 반환 (에셋 폴더 미포함)
      result: result 
    };
  } catch (error) {
    console.error(`이미지 섹션 업데이트 실패 (${publicId}):`, error);
    console.error('오류 상세:', error.message);
    throw error;
  }
}

/**
 * 단일 이미지의 section을 처리하는 함수
 * tempsection인 경우 새 섹션으로 변경하고, 그렇지 않은 경우 asset 폴더만 제거
 * 
 * @param {string} imagePublicId - 처리할 이미지 publicId
 * @param {string} targetSectionName - 변경할 섹션명
 * @param {string} itemId - 아이템의 ID (파이어베이스 문서 ID)
 * @param {string} imageType - 이미지 유형(로깅용: 'main' 또는 'sub')
 * @param {number|null} index - 서브 이미지 인덱스(로깅용, 메인 이미지는 null)
 * @returns {Promise<{processedPublicId: string, updated: Object|null}>} - 처리된 publicId와 업데이트 정보
 */
async function processImageSection(imagePublicId, targetSectionName, itemId, imageType, index = null) {
  // 유효하지 않은 이미지 URL 처리
  if (typeof imagePublicId !== 'string' || imagePublicId.trim() === '') {
    console.log(`${imageType} 이미지${index !== null ? `[${index}]` : ''}가 유효하지 않습니다`);
    return { processedPublicId: '', updated: null };
  }
  
  // 로그 출력
  console.log(`${imageType} 이미지${index !== null ? `[${index}]` : ''} 처리 시작: ${imagePublicId}`);
  
  // 섹션명 추출
  const imgSectionName = getSectionNameFromPublicId(imagePublicId);
  
  // tempsection인 경우 섹션 변경
  if (imgSectionName === 'tempsection') {
    try {
      console.log(`${imageType} 이미지${index !== null ? `[${index}]` : ''}가 tempsection에 있습니다. 섹션 변경 시도: ${imagePublicId}, 새 섹션: ${targetSectionName}, 아이템ID: ${itemId}`);
      
      const updated = await updateImageSection(imagePublicId, targetSectionName, itemId);
      // 이미 updateImageSection에서 논리적 경로를 반환하므로 stripAssetFolder 불필요
      const processedPublicId = updated.newPublicId;
      
      console.log(`${imageType} 이미지${index !== null ? `[${index}]` : ''} 섹션 변경 완료: ${processedPublicId}`);
      return { processedPublicId, updated };
    } catch (error) {
      console.error(`${imageType} 이미지${index !== null ? `[${index}]` : ''} 처리 중 오류:`, error);
      console.error('오류 상세:', error.message);
      // 에러가 발생해도 원본 이미지 반환
      return { processedPublicId: stripAssetFolder(imagePublicId), updated: null };
    }
  } else {
    // tempsection이 아니면 폴더명만 제거
    const processedPublicId = stripAssetFolder(imagePublicId);
    console.log(`${imageType} 이미지${index !== null ? `[${index}]` : ''}는 tempsection이 아니거나 섹션명 추출 실패: ${imgSectionName}`);
    return { processedPublicId, updated: null };
  }
}

/**
 * 서버 데이터셋 검증 및 가공 함수
 * 이미지 관련 필드를 검증하고 필요에 따라 데이터를 가공
 * @param {Object} dataset - 검증 및 가공할 서버 데이터셋
 * @returns {Object} 가공된 서버 데이터셋
 */
const validateAndProcessDataset = async (dataset) => {
  if (!dataset) return dataset;
  
  // 깊은 복사를 통해 원본 데이터 보존
  const processedData = JSON.parse(JSON.stringify(dataset));
  const sectionName = processedData.sectionName || '반월당';
  const itemId = processedData.id || 'temp-' + Date.now(); // ID가 없으면 임시 ID 생성
  
  // 이미지 처리 결과를 추적하기 위한 객체
  const processedImages = {
    main: null,
    sub: []
  };
  
  // mainImage 검증 및 처리
  if (processedData.mainImage) {
    // 메인 이미지 처리
    const { processedPublicId, updated } = await processImageSection(
      processedData.mainImage, 
      sectionName, 
      itemId,
      'main'
    );
    
    processedData.mainImage = processedPublicId;
    if (updated) {
      processedImages.main = updated;
    }
  } else {
    // mainImage가 없으면 빈 문자열로 설정
    processedData.mainImage = '';
  }
  
  // subImages 검증 및 처리
  if (processedData.subImages) {
    // 배열인지 확인
    if (Array.isArray(processedData.subImages)) {
      // 빈 배열이면 [""] 형태로 설정
      if (processedData.subImages.length === 0) {
        processedData.subImages = [''];
      } else {
        // 서브 이미지 처리를 위한 임시 배열
        const updatedSubImages = [...processedData.subImages];
        
        // 각 이미지 처리
        for (let i = 0; i < updatedSubImages.length; i++) {
          const img = updatedSubImages[i];
          
          // 이미지 섹션 처리
          const { processedPublicId, updated } = await processImageSection(
            img, 
            sectionName, 
            itemId,
            'sub', 
            i
          );
          
          updatedSubImages[i] = processedPublicId;
          if (updated) {
            processedImages.sub.push(updated);
          }
        }
        
        // 처리된 이미지 배열 적용
        processedData.subImages = updatedSubImages;
        
        // 모든 항목이 빈 문자열이면 하나만 남기기
        const hasValidImage = processedData.subImages.some(img => img.trim() !== '');
        if (!hasValidImage) {
          processedData.subImages = [''];
        }
      }
    } else {
      // 배열이 아니면 [""] 형태로 초기화
      console.log('subImages가 배열이 아니어서 초기화');
      processedData.subImages = [''];
    }
  } else {
    // subImages가 없으면 [""] 형태로 초기화
    processedData.subImages = [''];
  }
  
  console.log('이미지 데이터 검증 완료:', {
    mainImage: processedData.mainImage ? '설정됨' : '없음',
    subImages: processedData.subImages.length > 1 || processedData.subImages[0] !== '' ? '설정됨' : '없음',
    processedImages: processedImages.main || processedImages.sub.length > 0 ? '이미지 처리됨' : '처리된 이미지 없음'
  });
  
  return {
    processedData,
    processedImages
  };
};

/**
 * 에디터에서 상점 데이터 생성/업데이트를 위한 통합 API 엔드포인트
 * - POST: 상점 생성 또는 업데이트
 */
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // POST 요청만 처리
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ 
      success: false,
      message: `메서드 ${req.method}는 지원되지 않습니다` 
    });
  }
  
  try {
    // 요청 본문 파싱
    const { serverDataset, userID = 'betaUser' } = req.body;
    
    // 필수 데이터 검증
    if (!serverDataset) {
      return res.status(400).json({ 
        success: false, 
        message: '서버 데이터셋이 누락되었습니다' 
      });
    }
    
    // 데이터셋 검증 및 가공 (이미지 처리 포함)
    const { processedData, processedImages } = await validateAndProcessDataset(serverDataset);
    
    // 섹션명 확인
    const sectionName = processedData.sectionName || '반월당';
    
    // ID 존재 여부에 따라 처리 분기
    if (processedData.id) {
      // 업데이트 로직
      const itemId = processedData.id;
      const itemRef = doc(firebasedb, 'sections', sectionName, 'items', itemId);
      
      // 문서 존재 확인
      const docSnap = await getDoc(itemRef);
      if (!docSnap.exists()) {
        return res.status(404).json({
          success: false,
          message: '업데이트할 항목을 찾을 수 없습니다'
        });
      }
      
      // 데이터 업데이트
      await updateDoc(itemRef, processedData);
      
      // 섹션 문서 lastUpdated 필드 업데이트
      const sectionRef = doc(firebasedb, 'sections', sectionName);
      await updateDoc(sectionRef, {
        lastUpdated: serverTimestamp()
      });
      
      // 성공 응답
      return res.status(200).json({
        success: true,
        message: '항목이 성공적으로 업데이트되었습니다',
        data: {
          id: itemId,
          ...processedData
        },
        processedImages,
        userID
      });
    } else {
      // 생성 로직
      const itemsCollectionRef = collection(firebasedb, 'sections', sectionName, 'items');
      
      // 문서 추가
      const docRef = await addDoc(itemsCollectionRef, processedData);
      
      // ID 필드 추가
      const itemWithId = {
        ...processedData,
        id: docRef.id
      };
      
      // ID 필드 업데이트
      await updateDoc(docRef, { id: docRef.id });
      
      // 섹션 문서 lastUpdated 필드 업데이트
      const sectionRef = doc(firebasedb, 'sections', sectionName);
      await updateDoc(sectionRef, {
        lastUpdated: serverTimestamp()
      });
      
      // 성공 응답
      return res.status(201).json({
        success: true,
        message: '새 항목이 성공적으로 생성되었습니다',
        data: itemWithId,
        processedImages,
        userID
      });
    }
  } catch (error) {
    console.error('API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류',
      error: error.message
    });
  }
} 