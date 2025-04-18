import { firebasedb } from '../../../firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

/**
 * 개별 상점 관리 API 핸들러
 * - GET: 상점 조회
 * - PUT: 상점 업데이트
 * - DELETE: 상점 삭제
 */
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // 경로에서 ID 추출
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: '상점 ID가 필요합니다' 
      });
    }
    
    // 요청 본문에서 섹션명 추출
    let sectionName;
    if (req.method !== 'GET') {
      if (req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        sectionName = body.sectionName;
      }
      
      if (!sectionName) {
        return res.status(400).json({ 
          success: false, 
          message: '섹션 이름이 필요합니다' 
        });
      }
    } else {
      // GET 요청의 경우 쿼리 파라미터에서 섹션명 추출
      sectionName = req.query.sectionName;
      
      if (!sectionName) {
        return res.status(400).json({ 
          success: false, 
          message: '섹션 이름이 필요합니다 (쿼리 파라미터로 제공)' 
        });
      }
    }
    
    // Firestore 문서 참조
    const shopRef = doc(firebasedb, 'sections', sectionName, 'shops', id);
    
    // 1. GET 요청 처리 (상점 조회)
    if (req.method === 'GET') {
      const docSnapshot = await getDoc(shopRef);
      
      if (!docSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          message: '상점을 찾을 수 없습니다' 
        });
      }
      
      return res.status(200).json({ 
        success: true,
        message: '상점 조회 성공', 
        data: docSnapshot.data()
      });
    }
    
    // 2. PUT 요청 처리 (상점 업데이트)
    else if (req.method === 'PUT') {
      // 요청 본문에서 업데이트할 데이터 추출
      let itemdata;
      if (req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        itemdata = body.itemdata;
      }
      
      if (!itemdata) {
        return res.status(400).json({ 
          success: false, 
          message: '업데이트할 상점 데이터가 필요합니다' 
        });
      }
      
      // 문서가 존재하는지 확인
      const docSnapshot = await getDoc(shopRef);
      if (!docSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          message: '상점을 찾을 수 없습니다' 
        });
      }
      
      // 타임스탬프 없이 원본 데이터 그대로 사용
      const updateditemdata = {
        ...itemdata
      };
      
      // ID가 URL의 ID와 일치하는지 확인
      if (itemdata.id && itemdata.id !== id) {
        return res.status(400).json({ 
          success: false, 
          message: '상점 ID가 URL의 ID와 일치하지 않습니다' 
        });
      }
      
      // ID 필드 추가/보존
      updateditemdata.id = id;
      
      // 문서 업데이트
      await updateDoc(shopRef, updateditemdata);
      
      // 섹션 문서의 lastUpdated 필드 업데이트
      const sectionRef = doc(firebasedb, 'sections', sectionName);
      await updateDoc(sectionRef, {
        lastUpdated: serverTimestamp()
      });
      
      return res.status(200).json({ 
        success: true,
        message: '상점 업데이트 성공', 
        data: updateditemdata
      });
    }
    
    // 3. DELETE 요청 처리 (상점 삭제)
    else if (req.method === 'DELETE') {
      // 문서가 존재하는지 확인
      const docSnapshot = await getDoc(shopRef);
      if (!docSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          message: '상점을 찾을 수 없습니다' 
        });
      }
      
      // 문서 삭제
      await deleteDoc(shopRef);
      
      // 섹션 문서의 lastUpdated 필드 업데이트
      const sectionRef = doc(firebasedb, 'sections', sectionName);
      await updateDoc(sectionRef, {
        lastUpdated: serverTimestamp()
      });
      
      return res.status(200).json({ 
        success: true,
        message: '상점 삭제 성공', 
        id
      });
    }
    
    // 지원하지 않는 메서드
    else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE', 'OPTIONS']);
      return res.status(405).json({ 
        success: false,
        message: `메서드 ${req.method}는 지원되지 않습니다` 
      });
    }
  } catch (error) {
    console.error('상점 API 오류:', error);
    return res.status(500).json({ 
      success: false,
      message: '서버 오류', 
      error: error.message
    });
  }
} 