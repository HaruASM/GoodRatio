import admin from 'firebase-admin';

/**
 * 서버 전용 Firebase Admin SDK 설정
 * 서버 측 API에서 사용하는 Firebase Admin 인스턴스를 초기화합니다.
 */

// 이미 초기화된 앱이 없는 경우에만 초기화
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // 환경 변수에서 개행 문자 처리
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      // 데이터베이스 URL (필요한 경우)
      databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL,
      // 스토리지 버킷 (필요한 경우)
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin SDK 초기화 성공');
  } catch (error) {
    console.error('Firebase Admin SDK 초기화 오류:', error);
    
    // 대체 초기화 방법 (서비스 계정 키 파일이 있는 경우)
    try {
      const serviceAccount = require('../../firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('서비스 계정 파일로 Firebase Admin SDK 초기화 성공');
    } catch (fallbackError) {
      console.error('대체 초기화 방법도 실패:', fallbackError);
    }
  }
}

// Admin SDK 서비스 인스턴스
const adminDb = admin.firestore();
const adminAuth = admin.auth();
const adminStorage = admin.storage();

// 타임스탬프 유틸리티
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const increment = admin.firestore.FieldValue.increment;

export {
  admin,           // Firebase Admin SDK 기본 인스턴스
  adminDb,         // Firestore Admin 인스턴스
  adminAuth,       // Authentication Admin 인스턴스
  adminStorage,    // Storage Admin 인스턴스
  serverTimestamp, // 서버 타임스탬프 함수
  increment        // 필드 증가 함수
};
