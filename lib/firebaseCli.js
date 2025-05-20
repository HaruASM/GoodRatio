'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

/**
 * 클라이언트 전용 Firebase 설정
 * 클라이언트에서 사용하는 Firebase 인스턴스를 초기화합니다.
 * 앱의 기본 데이터베이스 자료를 위한 firebase 연결과 관련된 기능만 사용하는 목적 
 * /lib/services/serverUtils.js와 밀접하게 사용됨. 
 * 파이어베이스 관련 기능만 이 파일에 남기고, 기능은 serverUtils.js에서 구현
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,  // Firebase Auth 도메인 설정
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebase 앱 초기화 (이미 초기화된 경우 기존 앱 사용)
const firebaseapp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Firestore 초기화 (클라이언트 설정 포함)
const firebasedb = getFirestore(firebaseapp, 'goodrationapp', {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  experimentalAutoDetectLongPolling: true,
  experimentalHttpHeadersWhitelist: ['Accept', 'Accept-Encoding', 'Content-Type']
});

// Firebase Authentication 초기화
const firebaseAuth = getAuth(firebaseapp);

// Firebase Storage 초기화
const firebaseStorage = getStorage(firebaseapp);

export { 
  firebaseapp,   // Firebase 앱 인스턴스
  firebasedb,    // Firestore 데이터베이스 인스턴스
  firebaseAuth,  // Firebase 인증 인스턴스
  firebaseStorage // Firebase 스토리지 인스턴스
};
