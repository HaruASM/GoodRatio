import { firebasedb } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * 서버 데이터셋 검증 및 가공 함수
 * 이미지 관련 필드를 검증하고 필요에 따라 데이터를 가공
 * @param {Object} dataset - 검증 및 가공할 서버 데이터셋
 * @returns {Object} 가공된 서버 데이터셋
 */
const validateAndProcessDataset = (dataset) => {
  if (!dataset) return dataset;
  
  // 깊은 복사를 통해 원본 데이터 보존
  const processedData = JSON.parse(JSON.stringify(dataset));
  
  // mainImage 검증
  if (processedData.mainImage) {
    // 문자열이고 내용이 있는지 확인
    if (typeof processedData.mainImage !== 'string' || processedData.mainImage.trim() === '') {
      console.log('mainImage가 유효하지 않아 빈 문자열로 설정');
      processedData.mainImage = '';
    }
  } else {
    // mainImage가 없으면 빈 문자열로 설정
    processedData.mainImage = '';
  }
  
  // subImages 검증
  if (processedData.subImages) {
    // 배열인지 확인
    if (Array.isArray(processedData.subImages)) {
      // 빈 배열이면 [""] 형태로 설정
      if (processedData.subImages.length === 0) {
        processedData.subImages = [''];
      } else {
        // 배열 내 각 항목 검증
        processedData.subImages = processedData.subImages.map(img => {
          // 유효한 이미지 URL인지 확인
          if (typeof img !== 'string' || img.trim() === '') {
            return '';
          }
          return img;
        });
        
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
    subImages: processedData.subImages.length > 1 || processedData.subImages[0] !== '' ? '설정됨' : '없음'
  });
  
  return processedData;
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
    
    // 데이터셋 검증 및 가공
    const processedDataset = validateAndProcessDataset(serverDataset);
    
    // 섹션명 확인
    const sectionName = processedDataset.sectionName || '반월당';
    
    // ID 존재 여부에 따라 처리 분기
    if (processedDataset.id) {
      // 업데이트 로직
      const itemId = processedDataset.id;
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
      await updateDoc(itemRef, processedDataset);
      
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
          ...processedDataset
        },
        userID
      });
    } else {
      // 생성 로직
      const itemsCollectionRef = collection(firebasedb, 'sections', sectionName, 'items');
      
      // 문서 추가
      const docRef = await addDoc(itemsCollectionRef, processedDataset);
      
      // ID 필드 추가
      const itemWithId = {
        ...processedDataset,
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