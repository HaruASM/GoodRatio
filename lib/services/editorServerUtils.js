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
  if (!shopData) {
    throw new Error('상점 데이터가 제공되지 않았습니다');
  }
  
  console.log('서버 데이터 검증 시작');
  
  const invalidFields = [];
  const undefinedFields = [];
  const missingFields = [];
  
  // 1. protoServerDataset에 있는 모든 필드가 shopData에 존재하는지 검증
  Object.keys(protoServerDataset).forEach(key => {
    if (!(key in shopData)) {
      missingFields.push(key);
    }
  });
  
  // 2. shopData의 모든 필드 타입 검증 및 undefined 검사
  Object.entries(shopData).forEach(([key, value]) => {
    // undefined 값 검사
    if (value === undefined) {
      undefinedFields.push(key);
      return;
    }
    
    // null 값 검사 (null도 허용하지 않는 경우)
    if (value === null) {
      undefinedFields.push(key);
      return;
    }
    
    // protoServerDataset에 정의된 필드인 경우만 타입 검증
    if (key in protoServerDataset) {
      const protoValue = protoServerDataset[key];
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
      
      // 배열이나 객체인 경우 빈 배열/객체 검사
      if (expectedType === 'array' && Array.isArray(value)) {
        // 배열의 경우 빈 배열이나 [""] 형태는 허용 
        // protoServerDataset에서 businessHours, mainImages, subImages 등이 [""] 형태임
        const isEmptyArray = value.length === 0;
        const isDefaultArray = value.length === 1 && value[0] === "";
        
        if (!isEmptyArray && !isDefaultArray) {
          // 배열 요소의 타입이 원형과 일치하는지 확인 (배열 내용이 있는 경우)
          if (Array.isArray(protoValue) && protoValue.length > 0) {
            const protoElementType = typeof protoValue[0];
            
            // 모든 요소 타입 검사
            const hasInvalidElement = value.some(element => {
              return typeof element !== protoElementType && element !== "";
            });
            
            if (hasInvalidElement) {
              invalidFields.push({
                field: key,
                expected: `array of ${protoElementType}`,
                actual: `array with invalid elements`
              });
            }
          }
        }
      } else if (expectedType === 'object' && value !== null) {
        // 특수 객체 형태 검사 (예: pinCoordinates)
        if (key === 'pinCoordinates') {
          if (!('lat' in value) || !('lng' in value)) {
            invalidFields.push({
              field: key,
              expected: 'object with lat/lng properties',
              actual: 'invalid coordinates object'
            });
          } else if (typeof value.lat !== 'number' || typeof value.lng !== 'number') {
            invalidFields.push({
              field: key,
              expected: 'object with numeric lat/lng',
              actual: `lat: ${typeof value.lat}, lng: ${typeof value.lng}`
            });
          }
        }
      }
    }
  });
  
  // 오류 메시지 구성
  const errorMessages = [];
  
  // 누락된 필드 오류
  if (missingFields.length > 0) {
    errorMessages.push(`누락된 필드: ${missingFields.join(', ')}`);
  }
  
  // undefined 필드 오류
  if (undefinedFields.length > 0) {
    errorMessages.push(`undefined 값 필드: ${undefinedFields.join(', ')}`);
  }
  
  // 타입 불일치 오류
  if (invalidFields.length > 0) {
    errorMessages.push(`타입 불일치: ${invalidFields.map(f => `${f.field}(${f.actual}→${f.expected})`).join(', ')}`);
  }
  
  // 오류가 있으면 예외 발생
  if (errorMessages.length > 0) {
    const errorMessage = errorMessages.join('\n');
    console.error('데이터 검증 오류:', errorMessage);
    throw new Error(errorMessage);
  }
  
  console.log('서버 데이터 검증 완료: 모든 필드가 유효함');
  return true;
};

/**
 * 카테고리 값에 따른 컬렉션 이름 결정 함수
 * @param {Object} shopData - 상점 데이터
 * @returns {string} 컬렉션 이름 (shops, landmarks, hotspots)
 */
const getCollectionNameFromCategory = (shopData) => {
  // category 필드가 존재하고 유효한 값인 경우
  if (shopData && shopData.category) {
    // 허용된 카테고리 값인지 확인
    if (['shops', 'landmarks', 'hotspots'].includes(shopData.category)) {
      return shopData.category;
    }
  }
  
  // 기본값은 'shops'
  return 'shops';
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
   * @param {Array<string>} categories - 조회할 카테고리 목록 (기본값: ['shops'])
   * @param {Object} options - 추가 옵션 (페이징, 정렬 등)
   * @returns {Promise<Object>} 상점 목록 데이터
   */
  getList: async (sectionName = '반월당', categories = ['shops'], options = {}) => {
    // 카테고리 유효성 검사 및 기본값 설정
    const validCategories = Array.isArray(categories) && categories.length > 0 ? 
      categories.filter(cat => ['shops', 'landmarks', 'hotspots'].includes(cat)) : ['shops'];
    
    // 쿼리 파라미터 구성
    const queryParams = new URLSearchParams({
      sectionName,
      categories: validCategories.join(','),
      ...options
    });
    
    console.log('상점 목록 조회 요청:', sectionName, `컬렉션: ${validCategories.join(', ')}`);
    
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
   * @param {string} category - 상점이 속한 카테고리 (기본값: 'shops')
   * @returns {Promise<Object>} 상점 데이터
   */
  getOne: async (shopId, sectionName = '반월당', category = 'shops') => {
    // 카테고리 유효성 검사 및 기본값 설정
    const collectionName = ['shops', 'landmarks', 'hotspots'].includes(category) ? category : 'shops';
    
    // 쿼리 파라미터 구성 (섹션 이름)
    const queryParams = new URLSearchParams({ 
      sectionName,
      collectionName
    });
    
    console.log('상점 개별 조회 요청:', shopId, sectionName, `컬렉션: ${collectionName}`);
    
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
      // 원본 객체를 복사하여 새 객체 생성 (불변성 유지)
      const newShopData = { ...shopData };
      
      // ID 검증 - ID가 있으면 오류
      if (newShopData.id) {
        throw new Error('신규 생성 시에는 ID가 없어야 합니다. 업데이트를 사용하세요.');
      }
      
      // 카테고리가 비어있으면 기본값으로 'shops' 설정
      if (!newShopData.category || newShopData.category.trim() === '') {
        newShopData.category = 'shops';
        console.log('카테고리가 비어있어 기본값 "shops"로 설정됨');
      }
      
      // 데이터 형식 검증
      validateServerData(newShopData);
      
      const collectionName = getCollectionNameFromCategory(newShopData);
      
      console.log('상점 생성 요청:', sectionName, `컬렉션: ${collectionName}`);
      
      const response = await fetch(`${API_BASE_URL}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData: newShopData,
          sectionName,
          collectionName
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
      
      // 원본 객체를 복사하여 새 객체 생성 (불변성 유지)
      const newShopData = { ...shopData };
      
      // ID 필드 검증
      if (!newShopData.id) {
        console.log('ID가 없는 상점 데이터 감지 - 신규 생성으로 전환');
        return ShopService.create(newShopData, sectionName);
      }
      
      // 카테고리 검증 - ID가 있는데 카테고리가 비어있으면 오류
      if (!newShopData.category || newShopData.category.trim() === '') {
        throw new Error('ID가 있는 상점 데이터의 카테고리가 비어있습니다. 카테고리를 지정해주세요.');
      }
      
      // 데이터 형식 검증
      validateServerData(newShopData);
      
      const collectionName = getCollectionNameFromCategory(newShopData);
      
      console.log('상점 업데이트 요청:', newShopData.id, sectionName, `컬렉션: ${collectionName}`);
      
      const response = await fetch(`${API_BASE_URL}/shops/${newShopData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData: newShopData,
          sectionName,
          collectionName
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
   * @param {string} category - 카테고리 이름 (기본값: 'shops')
   * @returns {Promise<Object>} 삭제 결과
   */
  delete: async (shopId, sectionName = '반월당', category = 'shops') => {
    try {
      if (!shopId) {
        throw new Error('상점 ID가 제공되지 않았습니다');
      }
      
      if (!sectionName) {
        throw new Error('섹션 이름이 제공되지 않았습니다');
      }
      
      const collectionName = ['shops', 'landmarks', 'hotspots'].includes(category) ? category : 'shops';
      
      console.log('상점 삭제 요청:', shopId, sectionName, `컬렉션: ${collectionName}`);
      
      const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopData: { id: shopId },
          sectionName,
          collectionName
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
