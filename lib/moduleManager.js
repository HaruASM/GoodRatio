

'use client';

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

// 전역 모듈 저장소
const globalModules = {};

// 인스턴스 참조 카운트와 상태 저장
const moduleState = {
  refCounts: {},         // 모듈별 참조 카운트 
  suspendedInstances: {}, // 일시 중단된 모듈 인스턴스
  isInitialized: false,   // 모듈 관리자 초기화 상태
  isInitializing: false,  // 초기화 진행 중 상태
  initializingPromise: null, // 초기화 Promise
  currentPath: '',        // 현재 경로
  prevRequiredModules: [] // 이전 경로에서 필요한 모듈
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
   * 모듈 매니저 초기화 - 비동기 지원 및 락 메커니즘 추가
   * @returns {Promise} 초기화 완료 Promise
   */
  initialize: async function() {
    // 이미 초기화 완료된 경우
    if (moduleState.isInitialized) return Promise.resolve();
    
    // 초기화 진행 중인 경우 진행 중인 Promise 반환
    if (moduleState.isInitializing) return moduleState.initializingPromise;
    
    // 초기화 락 설정
    moduleState.isInitializing = true;
    
    // 초기화 Promise 생성
    moduleState.initializingPromise = new Promise(async (resolve) => {
      console.log('[ModuleManager] 전역 모듈 초기화 시작');
      
      // MapOverlayManager 모듈 등록 (지연 초기화)
      ModuleManager.register('mapOverlayManager', async () => {
        console.log('[ModuleManager] MapOverlayManager 모듈 동적 로드 시작');
        // 동적으로 MapOverlayManager 가져오기
        const { default: MapOverlayManager } = await import('../lib/components/map/MapOverlayManager');
        console.log('[ModuleManager] MapOverlayManager 모듈 동적 로드 완료');
        // 모듈 인스턴스 반환
        return MapOverlayManager;
      });
      
      // communityAPI 모듈 등록 (지연 초기화)
      ModuleManager.register('communityAPI', async () => {
        console.log('[ModuleManager] communityAPI 모듈 동적 로드 시작');
        // 동적으로 communityAPI 가져오기
        const communityAPI = await import('../components/travelCommunity/communityAPI');
        console.log('[ModuleManager] communityAPI 모듈 동적 로드 완료');
        
        // 모듈 인스턴스 반환 - 인터페이스 호환성을 위한 래퍼
        return {
          ...communityAPI,
          // ModuleManager와 호환성을 위한 메서드
          cleanup: () => {
            if (typeof communityAPI.cleanup === 'function') {
              communityAPI.cleanup();
            }
            console.log('[ModuleManager] communityAPI 모듈 정리 완료');
          },
          suspend: () => {
            console.log('[ModuleManager] communityAPI 모듈 일시 중단');
            return true;
          },
          resume: () => {
            console.log('[ModuleManager] communityAPI 모듈 재개');
            return true;
          }
        };
      });
      
      // SectionDBManager 모듈 등록 (지연 초기화)
      ModuleManager.register('sectionDBManager', async () => {
        console.log('[ModuleManager] SectionDBManager 모듈 동적 로드 시작');
        // 동적으로 SectionDBManager 가져오기
        const { default: SectionDBManager } = await import('../lib/components/data/SectionDBManager');
        console.log('[ModuleManager] SectionDBManager 모듈 동적 로드 완료');
        // 모듈 초기화 후 인스턴스 반환
        return SectionDBManager.initialize();
      });
      
      // communityAPI 모듈 등록 (지연 초기화) - CommunityDBManager 대체
      ModuleManager.register('communityDBManager', async () => {
        console.log('[ModuleManager] communityAPI 모듈 동적 로드 시작');
        // 동적으로 communityAPI 및 listenerManager 가져오기
        const communityAPI = await import('../components/travelCommunity/communityAPI');
        const { cleanup } = await import('../lib/services/listenerManager');
        console.log('[ModuleManager] communityAPI 모듈 동적 로드 완료');
        
        // 함수형 API를 모듈 인터페이스로 래핑
        const communityAPIWrapper = {
          // 기존 ModuleManager 호환 메서드
          initialize: () => console.log('[communityAPI] 초기화됨'),
          cleanup: () => {
            // 모든 인스턴스의 리스너 정리
            cleanup('global_instance');
            console.log('[communityAPI] 정리됨');
          },
          suspend: () => {
            // 모든 인스턴스의 리스너 정리
            cleanup('global_instance');
            console.log('[communityAPI] 일시 중단됨');
            return true;
          },
          resume: () => {
            console.log('[communityAPI] 재개됨');
            return true;
          },
          
          // API 함수들을 모듈 인터페이스에 노출
          ...communityAPI,
          
          // 인스턴스 ID 설정 (전역 인스턴스용)
          instanceId: 'global_instance'
        };
        
        return communityAPIWrapper;
      });
      
      // GoogleMapManager 모듈 등록 (동적 임포트로 변경)
      ModuleManager.register('googleMapManager', async () => {
        console.log('[ModuleManager] GoogleMapManager 모듈 동적 로드 시작');
        // 동적으로 GoogleMapManager 가져오기
        const GoogleMapManager = await import('../lib/map/GoogleMapManager');
        console.log('[ModuleManager] GoogleMapManager 모듈 동적 로드 완료');
        // 구글 맵 API 스크립트 로드 보장
        if (GoogleMapManager.loadGoogleMapsScript) {
          await GoogleMapManager.loadGoogleMapsScript();
          console.log('[ModuleManager] GoogleMapManager 모듈 동적 로드 및 API 초기화 완료');
        } else {
          console.log('[ModuleManager] GoogleMapManager 모듈 동적 로드 완료');
        }
        return GoogleMapManager;
      });
      
      // MapViewMarking 모듈 등록 (지연 초기화)
      ModuleManager.register('mapViewMarking', () => {
        console.log('[ModuleManager] MapViewMarking 모듈 동적 로드');
        // 모듈 인스턴스 생성
        const mapViewMarking = {
          mapInstance: null,
          eventListeners: [], // 이벤트 리스너 추적용
          
          // 초기화 메서드
          initialize: function(mapInstance) {
            console.log('[MapViewMarking] 모듈 초기화');
            this.mapInstance = mapInstance;
            this.eventListeners = [];
            return this;
          },
          
          // 맵 인스턴스 가져오기
          getMapInstance: function() {
            return this.mapInstance;
          },
          
          // 이벤트 리스너 추가 및 추적
          addMapEventListener: function(eventName, handler) {
            if (!this.mapInstance) return null;
            
            const listener = google.maps.event.addListener(
              this.mapInstance, 
              eventName, 
              handler
            );
            
            this.eventListeners.push({
              eventName,
              listener
            });
            
            console.log(`[MapViewMarking] '${eventName}' 이벤트 리스너 추가`);
            return listener;
          },
          
          // 일시 중단 시 호출 (페이지 전환 시) - 비동기 함수로 변경
          suspend: async function() {
            console.log('[MapViewMarking] 모듈 일시 중단 시작');
            
            // 맵 이벤트 리스너 정리
            if (this.mapInstance && window.google && google.maps) {
              // 등록된 이벤트 리스너 제거
              this.eventListeners.forEach(({ eventName }) => {
                console.log(`[MapViewMarking] '${eventName}' 이벤트 리스너 제거`);
              });
              
              // 모든 이벤트 리스너 제거
              google.maps.event.clearInstanceListeners(this.mapInstance);
              this.eventListeners = [];
              
              // GoogleMapManager 상태 확인 - 비동기 처리
              try {
                const GoogleMapManager = await ModuleManager.loadGlobalModule('googleMapManager');
                if (GoogleMapManager?.isMapInitialized) {
                  console.log('[MapViewMarking] 맵 인스턴스 유지 확인');
                }
              } catch (error) {
                console.warn('[MapViewMarking] GoogleMapManager 확인 중 오류:', error);
              }
            }
            
            console.log('[MapViewMarking] 모듈 일시 중단 완료');
            return true;
          },
          
          // 정리 시 호출 (앱 종료 시) - 비동기 함수로 변경
          cleanup: async function() {
            console.log('[MapViewMarking] 모듈 정리 시작');
            
            // 맵 이벤트 리스너 정리
            if (this.mapInstance && window.google && google.maps) {
              google.maps.event.clearInstanceListeners(this.mapInstance);
              this.eventListeners = [];
            }
            
            // GoogleMapManager 정리 호출 - 비동기 처리
            try {
              const GoogleMapManager = await ModuleManager.loadGlobalModule('googleMapManager');
              if (GoogleMapManager?.clearMap) {
                console.log('[MapViewMarking] GoogleMapManager.clearMap 호출');
                GoogleMapManager.clearMap();
              }
            } catch (error) {
              console.warn('[MapViewMarking] GoogleMapManager 정리 중 오류:', error);
            }
            
            this.mapInstance = null;
            console.log('[MapViewMarking] 모듈 정리 완료');
            return true;
          },
          
          // 모듈 재개 시 호출
          resume: function() {
            console.log('[MapViewMarking] 모듈 재개');
            return true;
          }
        };
        
        return mapViewMarking;
      });
      
      // 브라우저 종료 이벤트 리스너 등록 (cleanup 호출)
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          console.log('[ModuleManager] 앱 종료 감지, 모든 모듈 정리');
          ModuleManager.cleanupAll();
        });
      }
      
      // 초기화 완료 표시
      moduleState.isInitialized = true;
      moduleState.isInitializing = false;
      
      // Promise 해결
      resolve();
    });
    
    return moduleState.initializingPromise;
    
  },
  
  /**
   * 라우팅 경로 변경 처리
   * 현재 경로에 필요한 모듈만 활성화하고 나머지는 일시 중단
   * @param {string} pathname - 현재 라우팅 경로
   * @param {Object} routeModuleMap - 경로 패턴별 필요한 모듈 정의 객체
   */
  handleRouteChange: function(pathname, routeModuleMap) {
    if (!moduleState.isInitialized) return;
    
    // 동일한 경로면 처리 안함
    if (moduleState.currentPath === pathname) return;
    
    console.log(`[ModuleManager] 경로 변경 처리: ${moduleState.currentPath || '(초기)'} -> ${pathname}`);
    
    // 현재 경로에 필요한 모듈 목록 가져오기
    const currentRequiredModules = [];
    
    if (routeModuleMap && pathname) {
      Object.entries(routeModuleMap).forEach(([pattern, modules]) => {
        if (new RegExp(pattern).test(pathname)) {
          currentRequiredModules.push(...modules);
        }
      });
    }
    
    // 중복 제거
    const uniqueRequiredModules = [...new Set(currentRequiredModules)];
    
    console.log(`[ModuleManager] 현재 경로 필요 모듈: ${uniqueRequiredModules.join(', ') || '없음'}`);
    
    // 이전 경로에서 사용했지만 현재 경로에서는 필요 없는 모듈 suspend
    const modulesToSuspend = moduleState.prevRequiredModules.filter(
      module => !uniqueRequiredModules.includes(module)
    );
    
    // 사용하지 않는 모듈 일시 중단
    modulesToSuspend.forEach(moduleName => {
      if (ModuleManager.isInitialized(moduleName)) {
        console.log(`[ModuleManager] 모듈 일시 중단 요청: ${moduleName}`);
        ModuleManager.suspend(moduleName);
      }
    });
    
    // 상태 업데이트
    moduleState.currentPath = pathname;
    moduleState.prevRequiredModules = uniqueRequiredModules;
  },
  
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
        // 일시 중단된 인스턴스가 있는 경우 복원
        if (moduleState.suspendedInstances[name]) {
          const instance = moduleState.suspendedInstances[name];
          delete moduleState.suspendedInstances[name];
          
          // resume 메서드가 있으면 호출
          if (typeof instance.resume === 'function') {
            instance.resume();
          }
          
          console.log(`[ModuleManager] 모듈 '${name}' 재개`);
          
          // 참조 카운트 증가
          moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
          
          return instance;
        }
        
        // 팩토리 함수 호출하여 인스턴스 생성
        const instancePromise = factory();
        
        // 비동기 팩토리 함수 처리
        if (instancePromise instanceof Promise) {
          console.log(`[ModuleManager] 모듈 '${name}' 비동기 로드 시작`);
          
          // Promise 반환 (비동기 처리)
          return instancePromise.then(resolvedInstance => {
            // 참조 카운트 증가
            moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
            
            // 속성 재정의 (다음 접근 시 인스턴스 직접 반환)
            Object.defineProperty(globalModules, name, {
              value: resolvedInstance,
              configurable: true,
              enumerable: true,
              writable: false
            });
            
            console.log(`[ModuleManager] 모듈 '${name}' 비동기 로드 완료`);
            return resolvedInstance;
          });
        }
        
        // 동기 팩토리 함수 처리
        const instance = instancePromise;
        
        // 참조 카운트 증가
        moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
        
        // 속성 재정의 (다음 접근 시 인스턴스 직접 반환)
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
  loadGlobalModule: async function(name) {
    try {
      // SSR 환경 체크
      if (typeof window === 'undefined') {
        console.warn(`[ModuleManager] 모듈 '${name}'은 SSR 환경에서 로드할 수 없습니다`);
        return null;
      }
      
      // 일시 중단된 인스턴스가 있는 경우 복원
      if (moduleState.suspendedInstances[name]) {
        const moduleInstance = moduleState.suspendedInstances[name];
        delete moduleState.suspendedInstances[name];
        
        // resume 메서드가 있으면 호출
        if (typeof moduleInstance.resume === 'function') {
          moduleInstance.resume();
        }
        
        console.log(`[ModuleManager] 모듈 '${name}' 복원`);
        
        // 참조 카운트 증가
        moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
        
        return moduleInstance;
      }
      
      // 모듈 인스턴스 가져오기
      const moduleInstance = globalModules[name] || null;
      
      if (!moduleInstance) {
        console.error(`[ModuleManager] 모듈 '${name}'을 찾을 수 없습니다`);
        return null;
      }
      
      // Promise 인스턴스인 경우 비동기 처리
      const resolvedInstance = moduleInstance instanceof Promise ? await moduleInstance : moduleInstance;
      
      // 참조 카운트 증가
      moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
      console.log(`[ModuleManager] 모듈 '${name}' 참조 카운트 증가: ${moduleState.refCounts[name]}`);
      
      return resolvedInstance;
    } catch (error) {
      console.error(`[ModuleManager] 모듈 '${name}' 로드 중 오류:`, error);
      return null;
    }
  },
  
  /**
   * 전역 모듈 비동기 로드 - 비동기적으로 모듈을 로드하고 Promise 반환
   * @param {string} name - 모듈 이름
   * @returns {Promise<Object|null>} 모듈 인스턴스를 포함한 Promise 또는 null을 포함한 Promise
   */
  loadGlobalModuleAsync: async function(name) {
    if (!moduleState.isInitialized) {
      console.warn('[ModuleManager] 모듈 관리자가 초기화되지 않았습니다. 자동 초기화를 시도합니다.');
      await this.initialize();
    }
    
    try {
      // 모듈 인스턴스 가져오기
      let moduleInstance = globalModules[name];
      
      if (!moduleInstance) {
        console.error(`[ModuleManager] 모듈 '${name}'을 찾을 수 없습니다`);
        return null;
      }
      
      // Promise인 경우 기다림
      if (moduleInstance instanceof Promise) {
        moduleInstance = await moduleInstance;
      }
      
      // 참조 카운트 증가
      moduleState.refCounts[name] = (moduleState.refCounts[name] || 0) + 1;
      console.log(`[ModuleManager] 모듈 '${name}' 참조 카운트 증가: ${moduleState.refCounts[name]}`);
      
      return moduleInstance;
    } catch (error) {
      console.error(`[ModuleManager] 모듈 '${name}' 비동기 로드 중 오류:`, error);
      return null;
    }
  },
  
  /**
   * 모듈 정리 (cleanup) - 모듈 인스턴스를 완전히 제거하고 메모리에서 해제
   * 앱 종료 시에만 사용해야 함
   * @param {string} name - 모듈 이름 (선택적)
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
          
          // GoogleMapManager의 경우 clearMap 함수 명시적 호출
          if (name === 'googleMapManager' && module.clearMap) {
            console.log(`[ModuleManager] GoogleMapManager.clearMap 명시적 호출`);
            module.clearMap();
          }
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
   * 모든 모듈 정리 (cleanupAll) - 모든 모듈 인스턴스를 완전히 제거하고 메모리에서 해제
   * 앱 종료 시에만 사용해야 함
   */
  cleanupAll: function() {
    console.log('[ModuleManager] 모든 모듈 정리 시작');
    
    // 모든 모듈 정리
    Object.keys(globalModules).forEach(moduleName => {
      const module = globalModules[moduleName];
      if (module) {
        try {
          // cleanup 함수가 있는 경우 호출
          if (typeof module.cleanup === 'function') {
            module.cleanup();
            console.log(`[ModuleManager] 모듈 '${moduleName}' 정리 완료`);
          }
          
          // GoogleMapManager의 경우 clearMap 함수 명시적 호출
          if (moduleName === 'googleMapManager' && module.clearMap) {
            console.log(`[ModuleManager] GoogleMapManager.clearMap 명시적 호출`);
            module.clearMap();
          }
        } catch (error) {
          console.error(`[ModuleManager] 전역 모듈 '${moduleName}' 정리 중 오류:`, error);
        }
      }
      
      // 모듈 제거
      delete globalModules[moduleName];
      delete moduleState.refCounts[moduleName];
    });
    
    // 일시 중단된 모듈 상태 초기화
    moduleState.suspendedInstances = {};
    moduleState.refCounts = {};
    
    console.log('[ModuleManager] 모든 모듈 정리 완료');
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
   * 모듈 사용 중단 처리 - 컴포넌트 단위 참조 관리용
   * 참조 카운트를 감소시키고, 참조가 없으면 모듈을 일시 중단
   * @param {string} name - 모듈 이름
   * @returns {boolean} 성공 여부
   */
  unloadGlobalModule: function(name) {
    if (moduleState.refCounts[name]) {
      moduleState.refCounts[name]--;
      console.log(`[ModuleManager] 모듈 '${name}' 참조 카운트 감소: ${moduleState.refCounts[name]}`);
      if (moduleState.refCounts[name] <= 0) {
        return ModuleManager.suspend(name);
      }
      return true;
    }
    return false;
  },
  
  /**
   * 현재 모듈 상태 로깅 - 디버깅용
   * @returns {Object} 현재 모듈 상태 정보
   */
  logModuleState: function() {
    const state = {
      initialized: moduleState.isInitialized,
      initializing: moduleState.isInitializing,
      modules: Object.keys(globalModules),
      refCounts: moduleState.refCounts,
      suspended: Object.keys(moduleState.suspendedInstances),
      currentPath: moduleState.currentPath,
      prevRequiredModules: moduleState.prevRequiredModules
    };
    
    console.log('[ModuleManager] 현재 모듈 상태:', state);
    return state;
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


