/**
 * 모듈 관리 시스템 가이드 요약
 * 
 * 기본 원칙:
 * 1. 관심사 분리: 모듈은 핵심 기능에만 집중, 모듈 관리는 ModuleManager가 전담
 * 2. 단순성: 모듈 사용법을 단순하게 유지
 * 3. 자원 효율성: 필요할 때만 모듈 로드, 사용하지 않을 때는 자원 해제
 * 
 * 모듈 사용 방법:
 * - 모듈 로드: ModuleManager.loadGlobalModule(moduleName)
 * 
 * 모듈 작성 가이드라인:
 * - 해야 할 것: 단일 책임 원칙, 순수 기능 구현
 * - 하지 말아야 할 것: 모듈 내부에 모듈 관리 코드 포함, 모듈 간 직접 참조
 * 
 * 일반적인 문제 해결:
 * 1. 모듈이 null/undefined: 모듈 사용 전 존재 여부 확인 필요
 * 2. 페이지 전환 시 모듈 unload: ROUTE_MODULE_MAP에 필요한 모든 경로 패턴 추가
 */

/**
 * 전역 모듈 관리자 (Module Manager)
 * 
 * 애플리케이션 전체에서 사용되는 모듈을 관리하는 싱글톤 객체
 * - 전역 모듈 관리: 모든 페이지에서 접근 가능한 공유 모듈 인스턴스를 제공
 * - 지연 초기화 (Lazy Initialization): 모듈이 실제로 필요할 때만 초기화
 * - 클라이언트/서버 렌더링 구분: SSR 환경에서도 안전하게 동작
 */

// 클라이언트 환경인지 확인하는 유틸리티 함수

'use client'

// 전역 모듈 저장소
const globalModules = {};

// 인스턴스 참조 카운트와 상태 저장
const moduleState = {
  refCounts: {},         // 모듈별 참조 카운트 
  suspendedInstances: {} // 일시 중단된 모듈 인스턴스
};

/**
 * ModuleManager - 모듈 관리자
 * 
 * cleanup과 suspend 기능의 주요 차이점:
 * 
 * 1. cleanup()
 *   - 모듈 인스턴스를 완전히 제거하고 메모리에서 해제
 *   - 모듈 내부의 정리 함수를 호출하여 리소스 해제 (이벤트 리스너 등)
 *   - 다음에 접근할 때 인스턴스를 새로 생성해야 함
 *   - 사용 사례: 애플리케이션 종료 시 메모리 완전 정리
 * 
 * 2. suspend()
 *   - 모듈 인스턴스를 메모리에 유지하되 비활성화(일시 중단)
 *   - 큰 메모리 사용 부분만 해제하고 인스턴스 자체는 유지
 *   - 재사용 시 완전 초기화 없이 빠르게 활성화
 *   - 사용 사례: 현재 페이지에서 사용하지 않는 모듈을 일시적으로 비활성화
 */
const ModuleManager = {
  /**
   * 모듈 등록 (지연 초기화)
   * @param {string} name - 모듈 이름
   * @param {Function} factory - 모듈 생성 팩토리 함수
   */
  register: function(name, factory) {
    
    
    // 모듈 정의만 등록 (실제 인스턴스는 나중에 생성)
    Object.defineProperty(globalModules, name, {
      configurable: true,
      enumerable: true,
      get: function() {
        // 일시 중단된 인스턴스가 있는지 확인
        if (moduleState.suspendedInstances[name]) {
          const instance = moduleState.suspendedInstances[name];
          delete moduleState.suspendedInstances[name];
          
          // 모듈에 resume 메서드가 있으면 호출
          if (typeof instance.resume === 'function') {
            instance.resume();
          }
          
          console.log(`[ModuleManager] 모듈 '${name}' 재개`);
          
          // 참조 카운트 증가
          moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
          
          return instance;
        }
        
        // 최초 접근 시 팩토리 함수를 통해 인스턴스 생성 (지연 초기화)
        const instance = factory();
        
        // 참조 카운트 추가
        moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
        
        // getter를 값으로 교체 (다음 접근 시 재생성 방지)
        Object.defineProperty(globalModules, name, {
          value: instance,
          configurable: true,
          enumerable: true,
          writable: false
        });
        
        return instance;
      }
    });
  },
  
  /**
   * 모듈 가져오기 - 참조 카운트 관리 포함
   * @param {string} name - 모듈 이름
   * @returns {Object} 모듈 인스턴스
   */
  loadGlobalModule: function(name) {
    
    
    const moduleInstance = globalModules[name] || null;
    
    // 참조 카운트 증가
    if (moduleInstance) {
      moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
      console.log(`[ModuleManager] 모듈 '${name}' 참조 카운트 증가: ${moduleState.refCounts[name]}`);
    }
    
    return moduleInstance;
  },
  
  /**
   * 모듈 정리 (cleanup) - 모듈 인스턴스를 완전히 제거하고 메모리에서 해제
   * 앱 종료 시에만 사용해야 함
   */
  cleanup: function(name) {
    
    
    console.log(`[ModuleManager] cleanup 실행 (모듈: ${name || 'all'})`);
    
    // 특정 모듈만 정리
    if (name && globalModules[name]) {
      const module = globalModules[name];
      
      if (module && typeof module.cleanup === 'function') {
        try {
          module.cleanup();
          console.log(`[ModuleManager] 모듈 '${name}' 정리 완료`);
        } catch (error) {
          console.error(`[ModuleManager] 모듈 '${name}' 정리 중 오류:`, error);
        }
      }
      
      // 참조 카운트 삭제
      delete moduleState.refCounts[name];
      delete globalModules[name];
    }
  },
  
  /**
   * 모듈 일시 중단 (suspend) - 인스턴스는 유지하되 메모리 사용을 최소화
   * 현재 페이지에서 사용하지 않는 모듈에 사용
   * @param {string} name - 모듈 이름
   * @returns {boolean} 성공 여부
   */
  suspend: function(name) {
    
    
    console.log(`[ModuleManager] suspend 실행: ${name}`);
    
    // 모듈 인스턴스 찾기
    const moduleInstance = globalModules[name];
    
    // 모듈이 없으면 실패
    if (!moduleInstance) {
      console.warn(`[ModuleManager] 모듈 '${name}'을(를) 찾을 수 없어 일시 중단 실패`);
      return false;
    }
    
    // 모듈에 suspend 메서드가 없으면 경고
    if (typeof moduleInstance.suspend !== 'function') {
      console.warn(`[ModuleManager] 모듈 '${name}'에 suspend 메서드가 없어 기본 동작으로 일시 중단`);
    } else {
      // 모듈의 suspend 메서드 호출
      try {
        moduleInstance.suspend();
      } catch (error) {
        console.error(`[ModuleManager] 모듈 '${name}' 일시 중단 중 오류:`, error);
        return false;
      }
    }
    
    // 참조 카운트 감소
    if (moduleState.refCounts[name]) {
      moduleState.refCounts[name] = 0;
    }
    
    // 일시 중단된 인스턴스 저장
    moduleState.suspendedInstances[name] = moduleInstance;
    
    // 속성 재정의 (다음 접근 시 일시 중단된 인스턴스 사용)
    Object.defineProperty(globalModules, name, {
      configurable: true,
      enumerable: true,
      get: function() {
        // 이 getter는 다시 호출될 때 일시 중단된 인스턴스를 복원함
        // ModuleManager의 register 메서드에서 처리됨
        return ModuleManager.loadGlobalModule(name);
      }
    });
    
    console.log(`[ModuleManager] 모듈 '${name}' 일시 중단 완료`);
    return true;
  },
  
  /**
   * 모든 모듈 정리 (앱 종료 시에만 사용)
   */
  cleanupAll: function() {
    
    
    console.log('[ModuleManager] 모든 모듈 정리 시작 (앱 종료)');
    
    // 전역 모듈 정리
    Object.keys(globalModules).forEach(moduleName => {
      const module = globalModules[moduleName];
      if (module && typeof module.cleanup === 'function') {
        try {
          module.cleanup();
          console.log(`[ModuleManager] 전역 모듈 '${moduleName}' 정리 완료`);
        } catch (error) {
          console.error(`[ModuleManager] 전역 모듈 '${moduleName}' 정리 중 오류:`, error);
        }
      }
      delete globalModules[moduleName];
      delete moduleState.refCounts[moduleName];
    });
    
    // 일시 중단된 모듈도 모두 정리
    Object.keys(moduleState.suspendedInstances).forEach(moduleKey => {
      const module = moduleState.suspendedInstances[moduleKey];
      if (module && typeof module.cleanup === 'function') {
        try {
          module.cleanup();
          console.log(`[ModuleManager] 일시 중단된 모듈 '${moduleKey}' 정리 완료`);
        } catch (error) {
          console.error(`[ModuleManager] 일시 중단된 모듈 '${moduleKey}' 정리 중 오류:`, error);
        }
      }
    });
    
    // 모듈 상태 초기화
    moduleState.suspendedInstances = {};
    moduleState.refCounts = {};
    
    console.log('[ModuleManager] 모든 모듈 정리 완료');
  },
  
  /**
   * 모듈이 이미 초기화되었는지 확인
   * @param {string} name - 모듈 이름
   * @returns {boolean} 초기화 여부
   */
  isInitialized: function(name) {
    
    
    // 속성 디스크립터를 확인하여 실제 값인지 getter인지 구분
    const getDescriptor = (obj, prop) => {
      if (!obj) return null;
      return Object.getOwnPropertyDescriptor(obj, prop);
    };
    
    // 일시 중단된 모듈도 초기화된 것으로 간주
    if (moduleState.suspendedInstances[name]) {
      return true;
    }
    
    const descriptor = getDescriptor(globalModules, name);
    return descriptor && !descriptor.get;
  },
  
  /**
   * 모듈의 참조 횟수 가져오기
   * @param {string} name - 모듈 이름
   * @returns {number} 참조 횟수
   */
  getRefCount: function(name) {
    
    return moduleState.refCounts[name] || 0;
  }
};

// SSR 환경에서 안전하게 내보내기
export default ModuleManager; 