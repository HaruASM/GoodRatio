import { firebasedb } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
 * @returns {Object} section 정보를 포함한 객체 또는 null
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
  
  // 이미지 처리 결과를 추적하기 위한 객체
  const processedImages = {
    main: null,
    sub: []
  };
  
  // mainImage 검증 및 처리
  if (processedData.mainImage) {
    // 문자열이고 내용이 있는지 확인
    if (typeof processedData.mainImage !== 'string' || processedData.mainImage.trim() === '') {
      console.log('mainImage가 유효하지 않아 빈 문자열로 설정');
      processedData.mainImage = '';
    } else {
      // tempsection인지 확인하고 처리
      const parsedId = parsePublicId(processedData.mainImage);
      if (parsedId && parsedId.section === 'tempsection') {
        try {
          console.log(`메인 이미지가 tempsection에 있습니다. 섹션 변경 시도: ${processedData.mainImage}`);
          const updated = await updateImageSection(processedData.mainImage, sectionName);
          processedData.mainImage = updated.newPublicId;
          processedImages.main = updated;
          console.log(`메인 이미지 섹션 변경 완료: ${updated.newPublicId}`);
        } catch (error) {
          console.error('메인 이미지 처리 중 오류:', error);
          // 에러가 발생해도 계속 진행
        }
      }
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
        // tempsection 이미지 처리를 위한 임시 배열
        const updatedSubImages = [...processedData.subImages];
        
        // 각 이미지 처리
        for (let i = 0; i < updatedSubImages.length; i++) {
          const img = updatedSubImages[i];
          
          // 유효한 이미지 URL인지 확인
          if (typeof img !== 'string' || img.trim() === '') {
            updatedSubImages[i] = '';
            continue;
          }
          
          // tempsection인지 확인하고 처리
          const parsedId = parsePublicId(img);
          if (parsedId && parsedId.section === 'tempsection') {
            try {
              console.log(`서브 이미지가 tempsection에 있습니다. 섹션 변경 시도: ${img}`);
              const updated = await updateImageSection(img, sectionName);
              updatedSubImages[i] = updated.newPublicId;
              processedImages.sub.push(updated);
              console.log(`서브 이미지 섹션 변경 완료: ${updated.newPublicId}`);
            } catch (error) {
              console.error(`서브 이미지 처리 중 오류 (${img}):`, error);
              // 에러가 발생해도 계속 진행
            }
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