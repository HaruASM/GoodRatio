/**
 * DIV 요소에 로딩 오버레이를 생성하고 관리하는 유틸리티 함수
 * @param {string|HTMLElement} target - 로딩 오버레이가 적용될 대상 요소 (CSS 선택자 또는 DOM 요소)
 * @param {Object} options - 로딩 오버레이 옵션
 * @returns {Object} - 로딩 오버레이 컨트롤 객체 (show, hide, update 메서드 포함)
 */
export const createLoadingOverlayforDIV = (target, options = {}) => {
  // 기본 옵션 설정
  const {
    message = '...',
    color = '#4CAF50',
    backgroundColor = 'rgba(255, 255, 255, 0.9)',
    zIndex = 10,
    spinnerSize = 30,
    fontSize = 13
  } = options;
  
  // 타겟 요소 찾기
  const targetElement = typeof target === 'string' 
    ? document.querySelector(target) 
    : target;
    
  if (!targetElement) {
    console.error('로딩 오버레이 타겟 요소를 찾을 수 없습니다:', target);
    return { show: () => {}, hide: () => {} };
  }
  
  let overlayElement = null;
  
  // 오버레이 생성 및 표시 함수
  const show = () => {
    // 이미 생성된 경우 반환
    if (overlayElement) return;
    
    // 오버레이 요소 생성
    overlayElement = document.createElement('div');
    
    // 오버레이 스타일 설정
    Object.assign(overlayElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor,
      zIndex,
      borderRadius: targetElement.style.borderRadius || '0',
    });
    
    // SVG 스피너와 메시지 추가
    overlayElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <svg width="${spinnerSize}" height="${spinnerSize}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <style>
            .spinner {
              transform-origin: center;
              animation: spin 1.5s linear infinite;
            }
            @keyframes spin {
              100% { transform: rotate(360deg); }
            }
            .circle {
              stroke: ${color};
              stroke-dasharray: 80;
              stroke-dashoffset: 60;
              animation: dash 1.5s ease-in-out infinite;
            }
            @keyframes dash {
              0% { stroke-dashoffset: 60; }
              50% { stroke-dashoffset: 20; }
              100% { stroke-dashoffset: 60; }
            }
          </style>
          <circle class="spinner" cx="12" cy="12" r="10" fill="none" stroke="#e6e6e6" stroke-width="2" />
          <circle class="circle" cx="12" cy="12" r="10" fill="none" stroke-width="2" stroke-linecap="round" />
        </svg>
        <div style="margin-top: 8px; font-size: ${fontSize}px;">${message}</div>
      </div>
    `;
    
    // 타겟 요소에 상대적 위치 설정
    if (getComputedStyle(targetElement).position === 'static') {
      targetElement.style.position = 'relative';
    }
    
    // 오버레이 추가
    targetElement.appendChild(overlayElement);
    
    return overlayElement;
  };
  
  // 오버레이 제거 함수
  const hide = () => {
    if (overlayElement && overlayElement.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
      overlayElement = null;
    }
  };
  
  // 오버레이 업데이트 함수 (메시지 변경 등)
  const update = (newOptions = {}) => {
    if (!overlayElement) return;
    
    // 메시지 업데이트
    if (newOptions.message) {
      const messageElement = overlayElement.querySelector('div > div');
      if (messageElement) {
        messageElement.textContent = newOptions.message;
      }
    }
  };
  
  return {
    show,
    hide,
    update
  };
};

/**
 * 비동기 함수 실행 중 로딩 오버레이를 표시하는 고차 함수
 * @param {Function} asyncFunction - 실행할 비동기 함수
 * @param {string|HTMLElement} target - 로딩 오버레이가 적용될 대상 요소
 * @param {Object} options - 로딩 오버레이 옵션
 * @returns {Function} - 래핑된 함수
 */
export const withLoadingOverlay = (asyncFunction, target, options = {}) => {
  return async (...args) => {
    const loadingOverlay = createLoadingOverlayforDIV(target, options);
    loadingOverlay.show();
    
    try {
      const result = await asyncFunction(...args);
      loadingOverlay.hide();
      return result;
    } catch (error) {
      loadingOverlay.hide();
      throw error;
    }
  };
}; 