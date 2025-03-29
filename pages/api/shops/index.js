import { firebasedb } from '../../../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * 상점 데이터 관리 API 핸들러
 * - GET: 상점 목록 조회
 * - POST: 새 상점 생성
 * - PUT: 기존 상점 업데이트
 * - DELETE: 상점 삭제
 */
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET 요청 처리 (상점 목록 조회)
  if (req.method === 'GET') {
    try {
      // 쿼리 파라미터 추출
      const { 
        sectionName, 
        pageSize = 20, 
        lastVisible = null,
        category = null,
        sortBy = 'createdAt',
        sortDirection = 'desc'
      } = req.query;
      
      // 섹션 이름 검증
      if (!sectionName) {
        return res.status(400).json({ 
          success: false, 
          message: '섹션 이름이 필요합니다' 
        });
      }
      
      // Firestore 컬렉션 참조
      const shopsCollectionRef = collection(firebasedb, 'sections', sectionName, 'shops');
      
      // 쿼리 조건 구성
      let queryConstraints = [];
      
      // 카테고리 필터링
      if (category) {
        queryConstraints.push(where('category', '==', category));
      }
      
      // 정렬 방식 설정
      queryConstraints.push(orderBy(sortBy, sortDirection));
      
      // 페이지 크기 제한
      queryConstraints.push(limit(parseInt(pageSize)));
      
      // 마지막으로 조회한 문서 이후부터 조회 (페이지네이션)
      if (lastVisible) {
        // 마지막 문서 스냅샷을 가져오는 로직 필요
        // 실제 구현에서는 lastVisible을 사용하여 문서 스냅샷을 가져와야 함
        queryConstraints.push(startAfter(lastVisible));
      }
      
      // 쿼리 실행
      const q = query(shopsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      // 결과 데이터 구성
      const shops = [];
      querySnapshot.forEach((doc) => {
        shops.push(doc.data());
      });
      
      // 페이지네이션 정보
      const pagination = {
        pageSize: parseInt(pageSize),
        hasMore: shops.length === parseInt(pageSize),
        lastVisible: shops.length > 0 ? shops[shops.length - 1].id : null
      };
      
      return res.status(200).json({ 
        success: true,
        message: '상점 목록 조회 성공', 
        data: shops,
        pagination
      });
    } catch (error) {
      console.error('상점 목록 조회 오류:', error);
      return res.status(500).json({ 
        success: false,
        message: '서버 오류', 
        error: error.message
      });
    }
  }
  
  // 요청 본문과 섹션명 추출 (POST, PUT, DELETE 메서드용)
  let shopData, sectionName;
  
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    try {
      if (req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        shopData = body.shopData;
        sectionName = body.sectionName;
      }
      
      // 필수 데이터 검증
      if (!shopData) {
        return res.status(400).json({ 
          success: false, 
          message: '상점 데이터가 누락되었습니다' 
        });
      }
      
      if (!sectionName) {
        return res.status(400).json({ 
          success: false, 
          message: '섹션 이름이 누락되었습니다' 
        });
      }
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: '요청 형식이 잘못되었습니다',
        error: error.message
      });
    }
  }
  
  // POST 요청 처리 (상점 생성)
  if (req.method === 'POST') {
    try {
      // 데이터 검증
      if (!shopData.storeName) {
        return res.status(400).json({ 
          success: false, 
          message: '상점 이름은 필수 항목입니다' 
        });
      }
      
      // Firestore 컬렉션 참조
      const shopsCollectionRef = collection(firebasedb, 'sections', sectionName, 'shops');
      
      // 타임스탬프 추가
      const shopWithTimestamp = {
        ...shopData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // 문서 추가 (ID 자동 생성)
      const docRef = await addDoc(shopsCollectionRef, shopWithTimestamp);
      
      // ID를 포함한 데이터 업데이트
      const shopWithId = {
        ...shopWithTimestamp,
        id: docRef.id
      };
      
      // ID 필드 업데이트
      await updateDoc(docRef, { id: docRef.id });
      
      return res.status(201).json({ 
        success: true,
        message: '상점 생성 성공', 
        data: {
          id: docRef.id,
          ...shopData
        }
      });
    } catch (error) {
      console.error('상점 생성 오류:', error);
      return res.status(500).json({ 
        success: false,
        message: '서버 오류', 
        error: error.message
      });
    }
  }
  
  // PUT 요청 처리 (상점 업데이트)
  else if (req.method === 'PUT') {
    try {
      // ID가 필요함
      if (!shopData.id) {
        return res.status(400).json({ 
          success: false, 
          message: '상점 ID가 필요합니다' 
        });
      }
      
      const shopId = shopData.id;
      
      // Firestore 문서 참조
      const shopRef = doc(firebasedb, 'sections', sectionName, 'shops', shopId);
      
      // 문서가 존재하는지 확인
      const docSnapshot = await getDoc(shopRef);
      if (!docSnapshot.exists()) {
        return res.status(404).json({ 
          success: false, 
          message: '상점을 찾을 수 없습니다' 
        });
      }
      
      // 타임스탬프 추가
      const updatedShopData = {
        ...shopData,
        updatedAt: serverTimestamp()
      };
      
      // 문서 업데이트
      await updateDoc(shopRef, updatedShopData);
      
      return res.status(200).json({ 
        success: true,
        message: '상점 업데이트 성공', 
        data: updatedShopData
      });
    } catch (error) {
      console.error('상점 업데이트 오류:', error);
      return res.status(500).json({ 
        success: false,
        message: '서버 오류', 
        error: error.message
      });
    }
  }
  
  // DELETE 요청 처리 (상점 삭제)
  else if (req.method === 'DELETE') {
    try {
      const shopId = shopData.id;
      
      if (!shopId) {
        return res.status(400).json({ 
          success: false, 
          message: '상점 ID가 필요합니다' 
        });
      }
      
      // Firestore 문서 참조
      const shopRef = doc(firebasedb, 'sections', sectionName, 'shops', shopId);
      
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
      
      return res.status(200).json({ 
        success: true,
        message: '상점 삭제 성공', 
        id: shopId
      });
    } catch (error) {
      console.error('상점 삭제 오류:', error);
      return res.status(500).json({ 
        success: false,
        message: '서버 오류', 
        error: error.message
      });
    }
  }
  
  // 지원하지 않는 메서드
  else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    return res.status(405).json({ 
      success: false,
      message: `메서드 ${req.method}는 지원되지 않습니다` 
    });
  }
} 