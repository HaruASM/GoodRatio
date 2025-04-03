//##파이어베이스 서버 Create, Update, Delete 는 이 파일에서 구현

// ServerUtilsforEditor.js
// 서버와 통신하여 상점 데이터를 관리하는 유틸리티 함수

import { API_BASE_URL } from '../utils/constants';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase';
import { protoServerDataset } from '../models/editorModels';

/**
 * 데이터 타입 감지 함수 - 단순화 버전
 * @param {*} value - 타입을 감지할 값
 * @returns {string} 데이터 타입 문자열 ('string', 'array' 등)
 */
const detectDataType = (value) => {
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

/**
 * 서버 전송 전 데이터 형식 검증
 * @param {Object} shopData - 검증할 상점 데이터
 * @throws {Error} 데이터 형식 오류 시 예외 발생
 */
const validateServerData = (shopData) => {
  if (!shopData) return;
  
  console.log('서버 데이터 검증 시작');
  
  // 깊은 복사 없이 데이터만 검증
  const invalidFields = [];
  
  // 모든 필드 검증
  Object.entries(shopData).forEach(([key, value]) => {
    // 값이 null이거나 undefined라면 검증 건너뛰기
    if (value === null || value === undefined) return;
    
    // protoServerDataset에 해당 필드가 있는 경우에만 검증
    if (key in protoServerDataset) {
      const protoValue = protoServerDataset[key];
      // 프로토 값과 실제 값의 타입 비교
      const expectedType = detectDataType(protoValue);
      const actualType = detectDataType(value);
      
      // 타입이 다르면 오류로 기록
      if (expectedType !== actualType) {
        invalidFields.push({
          field: key,
          expected: expectedType,
          actual: actualType
        });
      }
    }
  });
  
  // 오류 있으면 예외 발생
  if (invalidFields.length > 0) {
    console.error('데이터 형식 오류:', invalidFields);
    throw new Error(`데이터 형식 오류: ${invalidFields.map(f => `${f.field}(${f.actual}→${f.expected})`).join(', ')}`);
  }
  
  return true;
};

/**
 * API 응답 처리 헬퍼 함수
 * @param {Response} response - Fetch API 응답 객체
 * @returns {Promise<Object>} 처리된 응답 데이터
 */
const handleApiResponse = async (response) => {
  if (!response.ok) {
    let errorData;
    try {
      // JSON 형식으로 오류 응답 파싱 시도
      errorData = await response.json();
    } catch (e) {
      // JSON 파싱 실패 시 기본 오류 메시지 생성
      throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
    }
    
    // 서버에서 제공한 오류 메시지가 있으면 사용
    throw new Error(errorData.message || `서버 오류: ${response.status}`);
  }
  
  // 응답이 비어있는 경우 처리
  if (response.status === 204) {
    return { success: true };
  }
  
  // JSON 응답 파싱
  return response.json();
};

/**
 * 상점 데이터 관리 서비스
 * CRUD 작업을 위한 함수들을 제공
 */
export const ShopService = {
  /**
   * 상점 목록 조회
   * @param {string} sectionName - 섹션 이름 (기본값: '반월당')
   * @param {Object} options - 추가 옵션 (페이징, 정렬 등)
   * @returns {Promise<Object>} 상점 목록 데이터
   */
  getList: async (sectionName = '반월당', options = {}) => {
    // 쿼리 파라미터 구성
    const queryParams = new URLSearchParams({
      sectionName,
      ...options
    });
    
    const response = await fetch(`${API_BASE_URL}/shops?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return handleApiResponse(response);
  },
  
  /**
   * 개별 상점 조회
   * @param {string} shopId - 조회할 상점 ID
   * @param {string} sectionName - 섹션 이름 (기본값: '반월당')
   * @returns {Promise<Object>} 상점 데이터
   */
  getOne: async (shopId, sectionName = '반월당') => {
    // 쿼리 파라미터 구성 (섹션 이름)
    const queryParams = new URLSearchParams({ sectionName });
    
    const response = await fetch(`${API_BASE_URL}/shops/${shopId}?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return handleApiResponse(response);
  },
  
  /**
   * 새 상점 데이터 생성
   * @param {Object} shopData - 생성할 상점 데이터
   * @param {string} sectionName - 섹션 이름 (기본값: '반월당')
   * @returns {Promise<Object>} 생성된 상점 데이터
   */
  create: async (shopData, sectionName = '') => {
    try {
      console.log('상점 생성 요청:', sectionName);
      
      // 데이터 형식 검증
      validateServerData(shopData);
      
      const response = await fetch(`${API_BASE_URL}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData,
          sectionName
        })
      });
      
      return handleApiResponse(response);
    } catch (error) {
      console.error('상점 생성 오류:', error);
      throw error;
    }
  },
  
  /**
   * 기존 상점 데이터 업데이트
   * @param {Object} shopData - 업데이트할 상점 데이터
   * @param {string} sectionName - 섹션 이름 (기본값: '반월당')
   * @returns {Promise<Object>} 업데이트된 상점 데이터
   */
  update: async (shopData, sectionName = '반월당') => {
    try {
      if (!shopData) {
        throw new Error('상점 데이터가 제공되지 않았습니다');
      }
      
      if (!sectionName) {
        throw new Error('섹션 이름이 제공되지 않았습니다');
      }
      
      // ID 필드 검증
      if (!shopData.id) {
        console.error('상점 ID 없음:', shopData);
        throw new Error('상점 ID가 없습니다. 마이그레이션된 데이터인지 확인하세요');
      }
      
      const shopId = shopData.id;
      
      // 데이터 형식 검증
      validateServerData(shopData);
      
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData,
          sectionName
        })
      });
      
      return handleApiResponse(response);
    } catch (error) {
      console.error('상점 업데이트 오류:', error);
      throw error;
    }
  },
  
  /**
   * 상점 데이터 삭제
   * @param {string} shopId - 삭제할 상점 ID
   * @param {string} sectionName - 섹션 이름 (기본값: '반월당')
   * @returns {Promise<Object>} 삭제 결과
   */
  delete: async (shopId, sectionName = '반월당') => {
    try {
      if (!shopId) {
        throw new Error('상점 ID가 제공되지 않았습니다');
      }
      
      if (!sectionName) {
        throw new Error('섹션 이름이 제공되지 않았습니다');
      }
      
      console.log('상점 삭제 요청:', shopId, sectionName);
      
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData: { id: shopId },
          sectionName
        })
      });
      
      return handleApiResponse(response);
    } catch (error) {
      console.error('상점 삭제 오류:', error);
      throw error;
    }
  }
};

export default ShopService;
