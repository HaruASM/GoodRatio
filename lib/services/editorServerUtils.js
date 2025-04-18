//##파이어베이스 서버 Create, Update, Delete 는 서버에서 처리 
// DB로 Create Update용 서버 endPoint로 통신하는 유틸 함수

import { API_BASE_URL } from '../utils/constants';

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

// 레거시 서비스 객체 - 이전 코드와의 호환성을 위해 빈 객체로 유지
export const EditorServerService = {};

export const EditorServerServiceNew = {
  /**
   * 통합 항목 생성/업데이트 메서드
   * 새로운 API 엔드포인트를 사용해 ID 유무에 따라 생성 또는 업데이트 수행
   * @param {Object} serverDataset - 서버로 전송할 데이터셋
   * @param {string} userID - 사용자 ID (기본값: 'betaUser')
   * @returns {Promise<Object>} 서버 응답
   */
  updateItem: async (serverDataset, userID = 'betaUser') => {
    try {
      if (!serverDataset) {
        throw new Error('데이터셋이 제공되지 않았습니다');
      }
      
      console.log('항목 업데이트/생성 요청:', serverDataset.id ? '업데이트' : '생성');
      
      const response = await fetch(`${API_BASE_URL}/updateitemforeditor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverDataset,
          userID
        })
      });
      
      return handleApiResponse(response);
    } catch (error) {
      console.error('항목 업데이트/생성 오류:', error);
      throw error;
    }
  }
};

export default EditorServerService;
