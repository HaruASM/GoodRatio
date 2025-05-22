// travelCommunity컴포넌트 UI - CommunityDBManager 커뮤니티의 채널/채팅/메세지 데이터 관리 - realtimeChatUtilsFB는 유틸리티 컴포넌트. fireBase서버 기능담당
// travelCommunity 컴포넌트가 메인 로직에서 사용되고, travelCommunity 내부에서 CommunityDBManager와 realtimeChatUtilsFB를 사용한다. 
// travelCommunity컴포넌트 <-> communityDBManager.js <-> realtimeChatUtilsFB.js

// 코드 구조 분석
// index.js (TravelCommunity):
// UI 렌더링 담당(채팅방 목록, 메시지, 입력창 등).
// CommunityDBManager의 데이터 변경을 구독(subscribe)하여 UI를 갱신.
// 사용자 입력(메시지 전송, 채팅방 선택)을 처리하며, CommunityDBManager에 데이터 작업을 위임.
// CommunityDBManager.js:
// 데이터 로드(getChatRooms, getChatMessages), 업데이트(sendMessage, updateTypingStatus), 실시간 리스너(setupChatListener) 관리.
// 데이터 변경 시 구독자(index.js)에게 알림(notifySubscribers).
// 데이터 흐름:
// CommunityDBManager가 데이터를 관리하고 변경 사항을 발행(publish).
// index.js(travelCommunity컴포넌트)가 이를 구독(subscribe)하여 UI를 업데이트.
// 이는 발행-구독(Publish-Subscribe, Pub-Sub) 패턴을 기반으로 합니다.



import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';
import { createMessage, createChatRoom, CommunityEventTypes } from '../../lib/models/communityModels.js';

const TravelCommunity = () => {
  // 통합된 채팅 상태 관리
  const [chatState, setChatState] = useState({
    // 채팅 UI 상태
    chatType: 'public',
    theme: 'dark',
    inputMessage: '',
    
    // 채팅 데이터 상태
    messages: {
      public: [],
      private: []
    },
    chatRooms: [],
    currentRoomId: null,
    
    // 로딩 상태
    isLoadingRoom: false,
    isLoadingRoomList: false,
    
    // 타이핑 상태
    typingUsers: {},
    isTyping: false,
    
    // 파일 업로드 상태
    selectedFile: null,
    isUploading: false
  });
  
  // chatState 업데이트 헬퍼 함수
  const updateChatState = useCallback((updater) => {
    setChatState(prevState => {
      const newState = typeof updater === 'function' ? updater(prevState) : updater;
      return { ...prevState, ...newState };
    });
  }, []); // setChatState는 안정적이므로 빈 배열

  // 사용자 정보 (실제 애플리케이션에서는 로그인 시스템에서 가져옴)
  const [userInfo, setUserInfo] = useState({
    userId: 'user-1', // 사용자 ID 추가
    username: '사용자1',
    profileImage: 'https://via.placeholder.com/40'
  });

  // Helper function to validate the event target
  const validateEventTarget = (target, functionName) => {
    if (!target || !(target instanceof EventTarget)) {
      console.error(`[TravelCommunity/${functionName}] Invalid or missing event target. Operation aborted.`);
      return false;
    }
    return true;
  };
  
  // communityDBManager 참조
  const [communityDBManager, setCommunityDBManager] = useState(null);

  // 메시지 영역 스크롤 참조
  const messagesEndRef = useRef(null);
  
  // 타이밍 관련 참조
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageListenerUnsubscribeRef = useRef(null);
  const typingListenerUnsubscribeRef = useRef(null);
  
  // 테마 전환 함수
  const toggleTheme = () => {
    const newTheme = chatState.theme === 'light' ? 'dark' : 'light';
    updateChatState({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // 메시지 추가 시 스크롤 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // --- 이벤트 핸들러 정의 (useCallback 적용) ---
  const handleChatRoomsLoaded = useCallback((event) => {
    const { rooms, roomId, messages } = event.detail;
    const roomType = roomId && roomId.startsWith('public-') ? 'public' : 'private';
    
    updateChatState(prevState => ({
      chatRooms: rooms,
      currentRoomId: roomId,
      messages: {
        ...prevState.messages,
        [roomType]: messages
      },
      isLoadingRoomList: false,
      isLoadingRoom: false
    }));
  }, [updateChatState]);

  const handleMessagesUpdated = useCallback((event) => {
    const { roomId, messages } = event.detail;
    const roomType = roomId && roomId.startsWith('public-') ? 'public' : 'private';
    
    updateChatState(prevState => ({
      messages: {
        ...prevState.messages,
        [roomType]: messages
      },
      isLoadingRoom: roomId === prevState.currentRoomId ? false : prevState.isLoadingRoom
    }));
  }, [updateChatState]);

  const handleTypingStatusChanged = useCallback((event) => {
    const { roomId, typingUsers } = event.detail;
    setChatState(prevState => {
        if (roomId === prevState.currentRoomId) {
            return { ...prevState, typingUsers };
        }
        return prevState;
    });
  }, [setChatState]);

  const handleErrorEvent = useCallback((event) => {
    const { error, functionName, details, roomId: targetRoomIdFromEvent } = event.detail; // Renamed for clarity
    console.error(`[TravelCommunity] 오류 이벤트 수신:`, { error, functionName, details, targetRoomIdFromEvent });
    Sentry.captureException(error, { extra: { functionName, details, targetRoomIdFromEvent, component: 'TravelCommunity' } });
    
    updateChatState(prevState => {
      let errorDisplayRoomType = prevState.chatType; // Default to current active tab's type
      let errorDisplayRoomId = prevState.currentRoomId; // Default to current active room ID

      // If the error event specifies a room, use that for displaying the error message
      if (targetRoomIdFromEvent) {
        errorDisplayRoomType = targetRoomIdFromEvent.startsWith('public-') ? 'public' : 'private';
        errorDisplayRoomId = targetRoomIdFromEvent;
      }
      
      // Get the existing messages for the determined room type, or an empty array if none
      const messagesForRoomType = prevState.messages[errorDisplayRoomType] || [];

      return {
        // Note: updateChatState merges, so no need for ...prevState here if only these fields change
        messages: {
          ...prevState.messages, // Preserve other room types' messages
          [errorDisplayRoomType]: [ // Add error message to the specific room type's message array
            createMessage({
              id: `error-event-${Date.now()}`,
              roomId: errorDisplayRoomId, // Associate message with the specific room ID
              username: '시스템',
              userType: 'system',
              message: `오류: ${error.message || '알 수 없는 오류'}${error.code ? ` (코드: ${error.code})` : ''}. 출처: ${functionName || 'N/A'}. ${details ? `세부사항: ${JSON.stringify(details)}. ` : ''}${error.stack ? `스택: ${error.stack}` : ''}`,
              timestamp: new Date().toISOString(),
              isRead: true, // System messages are typically considered read
              senderId: 'system'
            }),
            ...messagesForRoomType // Prepend error to existing messages for that room type
          ]
        },
        // If the error is related to the current room, stop its loading indicator
        isLoadingRoom: targetRoomIdFromEvent && targetRoomIdFromEvent === prevState.currentRoomId ? false : prevState.isLoadingRoom,
        // Assume list loading should also stop or be marked as not loading on error
        isLoadingRoomList: false 
      };
    });
  }, [updateChatState]);
  
  // 초기화 useEffect: communityDBManager 로드 및 초기화
  useEffect(() => {
    let isMounted = true;
    const initManager = async () => {
      try {
        document.documentElement.setAttribute('data-theme', chatState.theme);
        if (!communityDBManager) {
          throw new Error('CommunityDBManager 모듈 로드 실패');
        }
        if (isMounted) {
          console.log('[TravelCommunity] CommunityDBManager 모듈 로드 성공');
          const target = eventTargetRef.current;
          if (!validateEventTarget(target, 'initManager')) {
            console.error('[TravelCommunity/initManager] 유효하지 않은 eventTargetRef.current로 초기화 중단.');
            // 필요시 사용자에게 오류 메시지를 표시하는 로직 추가
            updateChatState(prevState => ({
              messages: {
                ...prevState.messages,
                [prevState.chatType]: [
                  createMessage({
                    id: `error-init-target-${Date.now()}`,
                    username: '시스템',
                    userType: 'system',
                    message: '컴포넌트 초기화 중 오류 발생: 이벤트 대상을 찾을 수 없습니다.',
                    timestamp: new Date().toISOString(),
                    isRead: true,
                    senderId: 'system'
                  }),
                  ...(prevState.messages[prevState.chatType] || [])
                ]
              }
            }));
            return; // 초기화 중단
          }
          // initializeWithEvents는 CHAT_ROOMS_LOADED 이벤트를 발생시킴
          await communityDBManager.initializeWithEvents(userInfo, target);
        }
      } catch (error) {
        console.error('[TravelCommunity] 초기화 오류:', error);
        if (isMounted) {
          updateChatState({
            messages: {
              ...chatState.messages,
              [chatState.chatType]: [
                createMessage({
                  id: `error-init-${Date.now()}`,
                  username: '시스템',
                  userType: 'system',
                  message: '초기화 중 오류 발생: ' + error.message,
                  timestamp: new Date().toISOString(),
                  isRead: true,
                  senderId: 'system'
                }),
                ...(chatState.messages[chatState.chatType] || [])
              ]
            }
          });
        }
      }
    };

    initManager();

    return () => {
      isMounted = false;
      if (communityDBManager) {
        if (chatState.currentRoomId && userInfo.userId) {
          try {
            communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false, { target: eventTargetRef.current });
          } catch (error) {
            console.warn('[TravelCommunity] 타이핑 상태 초기화 오류 (언마운트):', error);
          }
        }
        if (chatListenerUnsubscribeRef.current) {
          chatListenerUnsubscribeRef.current();
          chatListenerUnsubscribeRef.current = null;
        }
        communityDBManager.cleanup();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityDBManager, eventTargetRef, userInfo]); // 초기 마운트 시 한 번만 실행 (의존성 명확화)

  // --- currentRoomId 변경에 따른 동적 리스너 설정 useEffect ---
  useEffect(() => {
    const target = eventTargetRef.current;
    if (!chatState.currentRoomId || !communityDBManager || !target) {
      // 이전 리스너가 있다면 정리
      if (messageListenerUnsubscribeRef.current) {
        messageListenerUnsubscribeRef.current();
        messageListenerUnsubscribeRef.current = null;
      }
      if (typingListenerUnsubscribeRef.current) {
        typingListenerUnsubscribeRef.current();
        typingListenerUnsubscribeRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupListenersForRoom = async () => {
      // 이전 리스너 정리
      if (messageListenerUnsubscribeRef.current) {
        console.log(`[TravelCommunity] 이전 메시지 리스너 정리: ${chatState.currentRoomId}`);
        messageListenerUnsubscribeRef.current();
      }
      if (typingListenerUnsubscribeRef.current) {
        console.log(`[TravelCommunity] 이전 타이핑 리스너 정리: ${chatState.currentRoomId}`);
        typingListenerUnsubscribeRef.current();
      }

      try {
        console.log(`[TravelCommunity] 새 메시지 리스너 설정: ${chatState.currentRoomId}`);
        const unsubscribeMessages = await communityDBManager.setupChatListener(chatState.currentRoomId, { target });
        if (isMounted) messageListenerUnsubscribeRef.current = unsubscribeMessages;
        else unsubscribeMessages(); // 이미 언마운트된 경우 즉시 해제

        console.log(`[TravelCommunity] 새 타이핑 리스너 설정: ${chatState.currentRoomId}`);
        const unsubscribeTyping = await communityDBManager.setupTypingListener(chatState.currentRoomId, { target });
        if (isMounted) typingListenerUnsubscribeRef.current = unsubscribeTyping;
        else unsubscribeTyping(); // 이미 언마운트된 경우 즉시 해제
      } catch (error) {
        console.error(`[TravelCommunity] 동적 리스너 설정 중 오류 (${chatState.currentRoomId}):`, error);
        // 오류 발생 시에도 이전 리스너는 이미 정리되었을 수 있으므로, ref를 null로 설정
        if (isMounted) {
            messageListenerUnsubscribeRef.current = null;
            typingListenerUnsubscribeRef.current = null;
        }
      }
    };

    setupListenersForRoom();

    return () => {
      isMounted = false;
      console.log(`[TravelCommunity] 동적 리스너 정리 (cleanup): ${chatState.currentRoomId}`);
      if (messageListenerUnsubscribeRef.current) {
        messageListenerUnsubscribeRef.current();
        messageListenerUnsubscribeRef.current = null;
      }
      if (typingListenerUnsubscribeRef.current) {
        typingListenerUnsubscribeRef.current();
        typingListenerUnsubscribeRef.current = null;
      }
    };
  }, [chatState.currentRoomId, communityDBManager, eventTargetRef]);

  // --- 정적 이벤트 리스너 설정 useEffect (CHAT_ROOMS_LOADED, ERROR) ---
  useEffect(() => {
    // eventTargetRef.current가 설정된 후에 리스너 등록
    const targetElement = eventTargetRef.current; 
    if (!targetElement || !communityDBManager) {
        console.log('[TravelCommunity] useEffect: targetElement 또는 communityDBManager 없음, 리스너 설정 건너뜀');
        return;
    }
    console.log('[TravelCommunity] useEffect: 이벤트 리스너 설정/재설정');

    targetElement.addEventListener(CommunityEventTypes.CHAT_ROOMS_LOADED, handleChatRoomsLoaded);
    // MESSAGES_UPDATED 및 TYPING_STATUS 리스너는 currentRoomId 기반 useEffect에서 동적으로 관리됩니다.
    targetElement.addEventListener(CommunityEventTypes.ERROR, handleErrorEvent);
    document.body.addEventListener(CommunityEventTypes.ERROR, handleErrorEvent); // Catch globally dispatched errors

    return () => {
      console.log('[TravelCommunity] useEffect cleanup: 정적 이벤트 리스너 제거');
      targetElement.removeEventListener(CommunityEventTypes.CHAT_ROOMS_LOADED, handleChatRoomsLoaded);
      // MESSAGES_UPDATED 및 TYPING_STATUS 리스너는 currentRoomId 기반 useEffect에서 동적으로 관리됩니다.
      targetElement.removeEventListener(CommunityEventTypes.ERROR, handleErrorEvent);
      document.body.removeEventListener(CommunityEventTypes.ERROR, handleErrorEvent);
    };
  }, [communityDBManager, eventTargetRef, handleChatRoomsLoaded, handleErrorEvent]);
  
  // 채팅방 목록 로드 함수 (중앙화된 비동기 작업 사용)
  const loadChatRooms = async (manager, options = {}) => {
    if (!manager) {
      console.error('[TravelCommunity] 채팅방 목록 로드 실패: manager가 없음');
      updateChatState({ isLoadingRoomList: false });
      return [];
    }
    
    try {
      console.log('[TravelCommunity] 채팅방 목록 로드 시작');
      // 로딩 상태 설정
      updateChatState({
        isLoadingRoomList: true,
        isLoadingRoom: true
      });

      // 중앙화된 loadChatData 메서드 사용
      const { rooms, messages, roomId } = await manager.loadChatData(
        chatState.currentRoomId,
        { useCache: true, ...options }
      );
      
      console.log(`[TravelCommunity] 채팅 데이터 로드 성공: ${rooms.length}개 채팅방, ${messages.length}개 메시지`);
      
      // 채팅방이 없는 경우 상태 초기화
      if (rooms.length === 0) {
        updateChatState({
          chatRooms: [],
          currentRoomId: null,
          messages: { public: [], private: [] }
        });
        console.log('[TravelCommunity] 채팅방이 없음, 모든 상태 초기화');
        return [];
      }
      
      // 메시지 형식 변환 및 상태 업데이트
      const roomType = roomId && roomId.startsWith('public-') ? 'public' : 'private';
      const updatedMessages = { ...chatState.messages };
      updatedMessages[roomType] = messages;
      
      // 상태 일괄 업데이트
      updateChatState({
        chatRooms: rooms,
        currentRoomId: roomId,
        messages: updatedMessages
      });
      
      return rooms;
    } catch (error) {
      console.error('[TravelCommunity] 채팅 데이터 로드 오류:', error);
      // 오류 발생 시 상태 초기화
      updateChatState({
        chatRooms: [],
        currentRoomId: null,
        messages: { public: [], private: [] }
      });
      return [];
    } finally {
      // 로딩 상태 해제 - 성공/실패 여부와 관계없이 항상 실행
      updateChatState({
        isLoadingRoomList: false,
        isLoadingRoom: false
      });
      console.log('[TravelCommunity] 채팅 데이터 로드 완료');
    }
  };
  
  // 채팅방 선택 함수
  const selectChatRoom = async (newRoomId) => {
    if (newRoomId === chatState.currentRoomId || chatState.isLoadingRoom) return;

    const previousRoomId = chatState.currentRoomId;
    updateChatState({
      isLoadingRoom: true,
      currentRoomId: newRoomId,
      messages: { ...chatState.messages, [chatState.chatType]: [] }, // 새 방 선택 시 메시지 초기화
      typingUsers: {},
      chatRooms: chatState.chatRooms.map(room => ({
        ...room,
        isSelected: room.id === newRoomId,
        notification: room.id === newRoomId ? false : room.notification
      }))
    });

    try {
      const target = eventTargetRef.current; // initManager에서 이미 검증되었으므로, 여기서는 null 체크만 필요할 수 있으나 일단 유지.
      // validateEventTarget 호출은 제거 (initManager에서 검증 가정)
      if (!target) {
        console.error('[TravelCommunity/selectChatRoom] eventTargetRef.current가 null입니다. 초기화 로직을 확인하세요.');
        updateChatState({ isLoadingRoom: false }); // 로딩 상태 해제
        return;
      }

      if (communityDBManager) {
        // 이전 방 타이핑 상태 정리
        if (previousRoomId && userInfo.userId && chatState.isTyping) {
          updateChatState({ isTyping: false });
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
          await communityDBManager.updateTypingStatus(previousRoomId, userInfo.userId, false, { target });
        }

        // 이전 방 리스너 정리
        if (chatListenerUnsubscribeRef.current) {
          chatListenerUnsubscribeRef.current();
          chatListenerUnsubscribeRef.current = null;
        }

        // 새 방 메시지 가져오기 (MESSAGES_UPDATED 이벤트 유발)
        await communityDBManager.getChatMessages(newRoomId, { target });

        // 새 방 리스너 설정
        const unsubscribe = await communityDBManager.setupChatListener(newRoomId, { target });
        chatListenerUnsubscribeRef.current = unsubscribe;
      } else {
        console.warn('[TravelCommunity] communityDBManager가 없어 메시지/리스너를 처리할 수 없음');
        updateChatState({ isLoadingRoom: false });
      }
    } catch (error) {
      console.error(`[TravelCommunity] 채팅방 ${newRoomId} 선택 오류:`, error);
      updateChatState({ isLoadingRoom: false });
      // 오류 이벤트는 CommunityDBManager에서 발생시키고 여기서 처리될 것임
    }
    // isLoadingRoom: false 는 MESSAGES_UPDATED 핸들러에서 처리
  };
  
  // 탭 전환 함수
  const handleChangeType = (type) => {
    if (type === chatState.chatType) return;
    
    console.log(`[TravelCommunity] 채팅 타입 변경: ${chatState.chatType} -> ${type}`);
    updateChatState({ chatType: type });
    
    // 타입 변경 시 메시지 로드
    if (communityDBManager && chatState.currentRoomId) {
      // loadChatMessages 함수는 이벤트 기반 아키텍처로 변경
      // communityDBManager.getChatMessages(chatState.currentRoomId);
    }
  };
  
  // 입력 메시지 변경 핸들러
  const handleInputChange = (e) => {
    updateChatState({ inputMessage: e.target.value });
    
    // 타이핑 상태 업데이트
    if (communityDBManager && chatState.currentRoomId && userInfo.userId) {
      // 이미 타이핑 중이 아닌 경우에만 상태 업데이트
      if (!chatState.isTyping) {
        updateChatState({ isTyping: true });
        communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, true, { target: eventTargetRef.current });
      }
      
      // 타이핑 타임아웃 설정 (사용자가 타이핑을 멈추면 상태 업데이트)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        updateChatState({ isTyping: false });
        if (communityDBManager && chatState.currentRoomId) {
          communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false, { target: eventTargetRef.current });
        }
      }, 2000); // 2초 동안 타이핑이 없으면 타이핑 중지로 간주
    }
  };
  
  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    try {
      const file = e.target.files[0];
      if (file) {
        // 파일 크기 제한 검사 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('파일 크기는 10MB를 초과할 수 없습니다.');
          return;
        }
        updateChatState({ selectedFile: file });
      }
    } catch (error) {
      console.error('[TravelCommunity] 파일 선택 오류:', error);
    }
  };
  
  // 파일 업로드 버튼 클릭 핸들러
  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // 메시지 전송 핸들러
  const handleSendMessage = async () => {
    // 입력 검증
    if (chatState.inputMessage.trim() === '' && !chatState.selectedFile) {
      console.log('[TravelCommunity] 메시지와 파일이 모두 비어있습니다.');
      return;
    }
    
    if (!chatState.currentRoomId) {
      console.log('[TravelCommunity] 선택된 채팅방이 없습니다.');
      return;
    }
    
    if (!communityDBManager) {
      console.log('[TravelCommunity] communityDBManager가 로드되지 않았습니다.');
      return;
    }
    
    // 전송 중이거나 업로드 중이면 중복 전송 방지
    if (chatState.isUploading) {
      console.log('[TravelCommunity] 이미 업로드 중입니다.');
      return;
    }

    const target = eventTargetRef.current; // initManager에서 이미 검증되었으므로, 여기서는 null 체크만 필요할 수 있으나 일단 유지.
    // validateEventTarget 호출은 제거 (initManager에서 검증 가정)
    if (!target) {
      console.error('[TravelCommunity/handleSendMessage] eventTargetRef.current가 null입니다. 초기화 로직을 확인하세요.');
      // 필요시 사용자에게 오류 메시지 표시
      return;
    }
    
    console.log(`[TravelCommunity] 메시지 전송 시도: ${chatState.inputMessage} (${chatState.chatType} 채팅방)`);
    
    try {
      // 사용자 타이핑 상태 중지
      if (chatState.isTyping) {
        updateChatState({ isTyping: false });
        try {
          await communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false, { target });
        } catch (typingError) {
          console.warn('[TravelCommunity] 타이핑 상태 업데이트 오류:', typingError);
          // 타이핑 오류는 메시지 전송을 중단하지 않음
        }
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
      
      // 메시지 데이터 생성
      const messageData = createMessage({
        senderId: userInfo.userId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: chatState.inputMessage.trim(),
        isBold: userInfo.isBold,
        // timestamp: new Date().toISOString(), // createMessage에서 자동 생성 또는 data.timestamp 사용
        isRead: false, // createMessage에서 기본값 처리
      });
      
      // 임시 로컬 메시지 추가 (사용자 경험 개선)
      const currentMessages = [...chatState.messages[chatState.chatType]];
      const newMessageId = `temp-${Date.now()}`;
      const tempMessage = {
        id: newMessageId,
        senderId: userInfo.userId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: chatState.inputMessage,
        isBold: userInfo.isBold,
        timestamp: new Date().toISOString(),
        isRead: false,
        isSending: true // 전송 중 표시
      };
      
      if (chatState.selectedFile) {
        tempMessage.fileName = chatState.selectedFile.name;
        tempMessage.fileUploading = true;
      }
      
      // 메시지 상태 업데이트
      updateChatState(prevState => {
        const updatedMessages = { ...prevState.messages };
        updatedMessages[chatState.chatType] = [...currentMessages, tempMessage];
        return { messages: updatedMessages };
      });
      
      // 입력 필드 초기화 (사용자 경험 개선을 위해 전송 전 초기화)
      updateChatState({ inputMessage: '' });
      
      let messageId;
      
      // 파일 업로드 처리
      if (chatState.selectedFile) {
        updateChatState({ isUploading: true });
        
        try {
          // 파일 업로드 및 메시지 전송 (캐싱 사용)
          messageId = await communityDBManager.uploadFileAndSendMessage(
            chatState.currentRoomId, 
            messageData, 
            chatState.selectedFile,
            { target, useCache: true }
          );
          
          console.log(`[TravelCommunity] 파일 업로드 및 메시지 전송 성공: ${messageId}`);
        } catch (uploadError) {
          console.error('[TravelCommunity] 파일 업로드 오류:', uploadError);
          throw uploadError; // 오류 재전파
        } finally {
          updateChatState({
            isUploading: false,
            selectedFile: null
          });
        }
      } else {
        // 일반 메시지 전송 (캐싱 사용)
        try {
          console.log(`[TravelCommunity] 메시지 전송 시작: ${chatState.currentRoomId}`);
          messageId = await communityDBManager.sendMessage(
            chatState.currentRoomId, 
            messageData, 
            { target, useCache: true }
          );
          console.log(`[TravelCommunity] 메시지 전송 성공: ${messageId}`);
        } catch (sendError) {
          console.error('[TravelCommunity] 메시지 전송 오류:', sendError);
          throw sendError; // 오류 재전파
        }
      }
      
      // 스크롤 맨 아래로 이동
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error("[TravelCommunity] 메시지 전송 오류:", error);
      
      // 오류 발생 시 로컬에서만 메시지 추가 (오프라인 대체)
      const currentMessages = [...chatState.messages[chatState.chatType]];
      const newMessageId = currentMessages.length > 0 
        ? Math.max(...currentMessages.map(msg => typeof msg.id === 'number' ? msg.id : 0)) + 1 
        : 1;
      
      const newMessage = {
        id: newMessageId,
        senderId: userInfo.userId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: chatState.inputMessage,
        isBold: userInfo.isBold,
        timestamp: new Date().toISOString(),
        isRead: false,
        isOffline: true, // 오프라인 메시지 표시
        error: true // 오류 표시
      };
      
      if (chatState.selectedFile) {
        newMessage.fileName = chatState.selectedFile.name;
        newMessage.fileError = true;
        updateChatState({ 
          selectedFile: null,
          isUploading: false 
        });
      }
      
      // 임시 메시지 제거
      const filteredMessages = currentMessages.filter(msg => !msg.isSending);
      
      // 상태 업데이트 함수 사용
      updateChatState(prevState => ({
        ...prevState,
        messages: {
          ...prevState.messages,
          [chatState.chatType]: [...filteredMessages, newMessage]
        }
      }));
    }
  };
  
  // 엔터 키 입력 시 메시지 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };
  
  // 채팅방 생성 모달 상태
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('public');
  const [isCreatingRoomLoading, setIsCreatingRoomLoading] = useState(false);
  const newRoomInputRef = useRef(null);
  
  // 채팅방 생성 모달 열기
  const openCreateRoomModal = () => {
    setNewRoomName('');
    setNewRoomType('public');
    setIsCreatingRoom(true);
    // 모달이 열리면 입력 필드에 포커스
    setTimeout(() => {
      if (newRoomInputRef.current) {
        newRoomInputRef.current.focus();
      }
    }, 100);
  };
  
  // 채팅방 생성 모달 닫기
  const closeCreateRoomModal = () => {
    setIsCreatingRoom(false);
  };
  
  // 새로운 채팅방 생성 함수
  const createNewChatRoom = async () => {
    // 모달이 열려있지 않은 경우 모달 열기
    if (!isCreatingRoom) {
      openCreateRoomModal();
      return;
    }
    
    // 입력 검증
    if (!newRoomName.trim()) {
      alert('채팅방 이름을 입력해주세요.');
      return;
    }
    
    if (!communityDBManager) {
      console.error('[TravelCommunity] CommunityDBManager가 로드되지 않았습니다.');
      alert('CommunityDBManager가 로드되지 않았습니다.');
      return;
    }
    
    setIsCreatingRoomLoading(true);
    
    try {
      console.log('[TravelCommunity] 채팅방 생성 시작:', newRoomName, newRoomType);
      
      // Firestore에 저장할 채팅방 데이터
      const roomDataForDB = {
        name: newRoomName.trim(),
        description: `${userInfo.username}님이 생성한 채팅방`,
        isPublic: newRoomType === 'public',
        createdBy: userInfo.userId,
        // createdAt은 CommunityDBManager 또는 Firestore에서 처리될 수 있으므로 여기서는 제외하거나, 
        // 명시적으로 전달해야 한다면 new Date().toISOString()을 사용합니다.
        // 여기서는 CommunityDBManager가 Firestore에 저장 시 처리한다고 가정합니다.
        members: [userInfo.userId],
        admins: [userInfo.userId]
      };

      console.log('[TravelCommunity] Firestore에 전달할 채팅방 데이터:', roomDataForDB);

      // 새로운 채팅방 생성 (캐싱 사용)
      const newRoomId = await communityDBManager.createChatRoom(roomDataForDB, { useCache: true });

      if (!newRoomId) {
        throw new Error('채팅방 ID가 생성되지 않았습니다.');
      }

      console.log('[TravelCommunity] 채팅방 생성 완료, ID:', newRoomId);

      // 로컬 UI 상태 업데이트를 위한 채팅방 객체 생성 (ChatRoom 모델 사용)
      const newRoomForUI = createChatRoom({
        id: newRoomId,
        name: roomDataForDB.name,
        description: roomDataForDB.description,
        isPublic: roomDataForDB.isPublic,
        createdBy: roomDataForDB.createdBy,
        members: roomDataForDB.members,
        admins: roomDataForDB.admins,
        createdAt: new Date().toISOString(), // UI에서는 즉시 보여주기 위해 현재 시간 사용
        // badge, lastMessage 등은 createChatRoom 모델의 기본값을 따름
      });
      // UI에 필요한 추가/재정의 속성
      newRoomForUI.isSelected = false; // 새로 만든 방은 처음엔 선택되지 않음
      newRoomForUI.notification = false; // 기본 알림 상태

      console.log('[TravelCommunity] 채팅방 목록에 추가:', newRoomForUI);
      // chatState 사용하도록 수정
      updateChatState(prevState => ({
        ...prevState,
        chatRooms: [...prevState.chatRooms, newRoomForUI]
      }));
      
      // 모달 닫기
      closeCreateRoomModal();
      
      // 새 채팅방 선택
      console.log('[TravelCommunity] 새 채팅방 선택:', newRoomId);
      await selectChatRoom(newRoomId);
      
      // 환영 메시지 자동 전송
      const welcomeMessage = {
        senderId: 'system',
        username: '시스템',
        message: `환영합니다! ${roomDataForDB.name} 채팅방이 생성되었습니다.`,
        timestamp: new Date().toISOString()
      };
      
      console.log('[TravelCommunity] 환영 메시지 전송:', welcomeMessage);
      await communityDBManager.sendMessage(newRoomId, welcomeMessage, { useCache: true });
      
      console.log('[TravelCommunity] 채팅방 생성 프로세스 완료');
      
    } catch (error) {
      console.error("[TravelCommunity] 새로운 채팅방 생성 오류:", error);
      alert(`채팅방 생성 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsCreatingRoomLoading(false);
    }
  };
  
  // 채팅방 이름 변경 핸들러
  const handleNewRoomNameChange = (e) => {
    setNewRoomName(e.target.value);
  };
  
  // 채팅방 타입 변경 핸들러
  const handleNewRoomTypeChange = (type) => {
    setNewRoomType(type);
  };
  
  // 채팅방 생성 폼 제출 핸들러
  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    createNewChatRoom();
  };

  return (
    <div ref={eventTargetRef} className={`${styles['travelCommunity-container']} ${styles[chatState.theme]}`}>
      {/* 채팅방 생성 모달 */}
      {isCreatingRoom && (
        <div className={styles['travelCommunity-modal-overlay']}>
          <div className={styles['travelCommunity-modal']}>
            <div className={styles['travelCommunity-modal-header']}>
              <h3>새 채팅방 생성</h3>
              <button 
                className={styles['travelCommunity-modal-close']}
                onClick={closeCreateRoomModal}
                disabled={isCreatingRoomLoading}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateRoomSubmit}>
              <div className={styles['travelCommunity-modal-body']}>
                <div className={styles['travelCommunity-form-group']}>
                  <label htmlFor="roomName">채팅방 이름</label>
                  <input
                    id="roomName"
                    type="text"
                    ref={newRoomInputRef}
                    value={newRoomName}
                    onChange={handleNewRoomNameChange}
                    placeholder="채팅방 이름을 입력하세요"
                    className={styles['travelCommunity-input']}
                    disabled={isCreatingRoomLoading}
                    required
                  />
                </div>
                
                <div className={styles['travelCommunity-form-group']}>
                  <label>채팅방 유형</label>
                  <div className={styles['travelCommunity-room-type-selector']}>
                    <button
                      type="button"
                      className={`${styles['travelCommunity-room-type-button']} ${newRoomType === 'public' ? styles['travelCommunity-active'] : ''}`}
                      onClick={() => handleNewRoomTypeChange('public')}
                      disabled={isCreatingRoomLoading}
                    >
                      퍼블릭
                    </button>
                    <button
                      type="button"
                      className={`${styles['travelCommunity-room-type-button']} ${newRoomType === 'private' ? styles['travelCommunity-active'] : ''}`}
                      onClick={() => handleNewRoomTypeChange('private')}
                      disabled={isCreatingRoomLoading}
                    >
                      프라이빗
                    </button>
                  </div>
                </div>
              </div>
              
              <div className={styles['travelCommunity-modal-footer']}>
                <button
                  type="button"
                  className={styles['travelCommunity-button-secondary']}
                  onClick={closeCreateRoomModal}
                  disabled={isCreatingRoomLoading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={styles['travelCommunity-button-primary']}
                  disabled={!newRoomName.trim() || isCreatingRoomLoading}
                >
                  {isCreatingRoomLoading ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 상단 채팅 영역 */}
      <div className={styles['travelCommunity-chatSection']}>
        {/* 탭 영역 */}
        <div className={styles['travelCommunity-tabs']}>
          <button 
            className={`${styles['travelCommunity-tab']} ${chatState.chatType === 'public' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => updateChatState({ chatType: 'public' })}
            disabled={!chatState.currentRoomId}
          >
            공개 채팅
          </button>
          <button 
            className={`${styles['travelCommunity-tab']} ${chatState.chatType === 'private' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => updateChatState({ chatType: 'private' })}
            disabled={!chatState.currentRoomId}
          >
            개인 채팅
          </button>
          {/* 테마 전환 버튼 */}
          <button 
            className={styles['travelCommunity-tab']}
            onClick={toggleTheme}
            title="테마 전환"
          >
            {chatState.theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        
        {/* 채팅 메시지 영역 */}
        <div className={styles['travelCommunity-messages']}>
          {!chatState.currentRoomId ? (
            <div className={styles['travelCommunity-noRoomSelected']}>
              <p>좌측에서 채팅방을 선택하거나 새 채팅방을 만들어주세요.</p>
            </div>
          ) : (
            <>
              {/* 타이핑 상태 표시 */}
              {Object.keys(chatState.typingUsers).length > 0 && (
                <div className={styles['travelCommunity-typingIndicator']}>
                  {Object.keys(chatState.typingUsers).map(userId => chatState.typingUsers[userId]).join(', ')}
                  <span> 입력 중...</span>
                </div>
              )}
              
              {chatState.messages[chatState.chatType].map(message => (
                <div key={message.id} className={`${styles['travelCommunity-message']} ${message.isSending ? styles['travelCommunity-sending'] : ''} ${message.error ? styles['travelCommunity-error'] : ''}`}>
                  <div className={styles['travelCommunity-messageHeader']}>
                    <div className={styles['travelCommunity-messageSender']}>
                      <span className={styles['travelCommunity-username']}>{message.username}</span>
                      {message.userType && (
                        <>
                          <span className={styles['travelCommunity-divider']}>/</span>
                          <span className={`${styles['travelCommunity-userType']} ${message.isBold ? styles['travelCommunity-bold'] : ''}`}>
                            {message.userType}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* 메시지 수정/삭제 버튼 (자신의 메시지인 경우에만 표시) */}
                    {message.senderId === userInfo.userId && !message.isSending && !message.error && (
                      <div className={styles['travelCommunity-messageActions']}>
                        <button 
                          className={styles['travelCommunity-actionButton']}
                          onClick={() => {
                            const newMessage = prompt('수정할 메시지를 입력하세요:', message.message);
                            if (newMessage && newMessage.trim() !== '' && newMessage !== message.message) {
                              communityDBManager.editMessage(chatState.currentRoomId, message.id, newMessage, userInfo.userId);
                            }
                          }}
                          title="메시지 수정"
                        >
                          ✏️
                        </button>
                        <button 
                          className={styles['travelCommunity-actionButton']}
                          onClick={() => {
                            if (window.confirm('정말 이 메시지를 삭제하시겠습니까?')) {
                              communityDBManager.deleteMessage(chatState.currentRoomId, message.id, userInfo.userId);
                            }
                          }}
                          title="메시지 삭제"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles['travelCommunity-messageContent']}>
                    {message.message}
                    
                    {/* 파일 첨부 표시 */}
                    {message.fileUrl && (
                      <div className={styles['travelCommunity-fileAttachment']}>
                        <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                          📎 {message.fileName || '첨부파일'}
                        </a>
                      </div>
                    )}
                    
                    {/* 파일 업로드 중 표시 */}
                    {message.fileUploading && (
                      <div className={styles['travelCommunity-fileUploading']}>
                        💾 {message.fileName} 업로드 중...
                      </div>
                    )}
                    
                    {/* 파일 업로드 오류 표시 */}
                    {message.fileError && (
                      <div className={styles['travelCommunity-fileError']}>
                        ⚠️ {message.fileName} 업로드 실패
                      </div>
                    )}
                  </div>
                  
                  {/* 읽음 상태 표시 */}
                  <div className={styles['travelCommunity-messageFooter']}>
                    {message.timestamp && (
                      <span className={styles['travelCommunity-timestamp']}>
                        {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                    {message.isRead && message.senderId === userInfo.userId && (
                      <span className={styles['travelCommunity-readStatus']}>
                        ✓ 읽음
                      </span>
                    )}
                    {message.isSending && (
                      <span className={styles['travelCommunity-sendingStatus']}>
                        전송 중...
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* 입력 영역 */}
        <div className={styles['travelCommunity-inputArea']}>
          {!chatState.currentRoomId || chatState.isLoadingRoom ? (
            <div className={styles['travelCommunity-inputDisabled']}>
              <p>{chatState.isLoadingRoom ? '채팅방 로드 중...' : '채팅방을 선택해주세요'}</p>
            </div>
          ) : (
            <>
              {/* 파일 업로드 입력 (화면에 보이지 않음) */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                style={{ display: 'none' }} 
              />
              
              {/* 파일 업로드 버튼 */}
              <button
                className={styles['travelCommunity-fileButton']}
                onClick={handleFileButtonClick}
                disabled={chatState.isUploading || !chatState.currentRoomId || chatState.isLoadingRoom}
                title="파일 첨부"
              >
                📎
              </button>
              
              {/* 메시지 입력 필드 */}
              <input 
                type="text" 
                placeholder={chatState.selectedFile ? `파일: ${chatState.selectedFile.name}` : "메시지를 입력하세요..."} 
                className={styles['travelCommunity-input']}
                value={chatState.inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={chatState.isUploading || !chatState.currentRoomId || chatState.isLoadingRoom}
              />
              
              {/* 선택된 파일 표시 */}
              {chatState.selectedFile && (
                <div className={styles['travelCommunity-selectedFile']}>
                  <span>{chatState.selectedFile.name}</span>
                  <button 
                    className={styles['travelCommunity-removeFileButton']}
                    onClick={() => updateChatState({ selectedFile: null })}
                    title="파일 제거"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* 전송 버튼 */}
              <button 
                className={styles['travelCommunity-sendButton']}
                onClick={handleSendMessage}
                disabled={chatState.isUploading || !chatState.currentRoomId || chatState.isLoadingRoom || (chatState.inputMessage.trim() === '' && !chatState.selectedFile)}
              >
                {chatState.isUploading ? '업로드 중...' : '전송'}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 하단 채팅방 목록 영역 */}
      <div className={styles['travelCommunity-roomsSection']}>
        <div className={styles['travelCommunity-roomsHeader']}>
          <h3>대화방</h3>
          <div className={styles['travelCommunity-roomsActions']}>
            <button className={styles['travelCommunity-searchButton']}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />
              </svg>
            </button>
            <button 
              className={styles['travelCommunity-createRoomButton']} 
              onClick={createNewChatRoom}
              title="새 채팅방 만들기"
              aria-label="새 채팅방 만들기"
            >
              <span className={styles['travelCommunity-plusIcon']}>+</span>
              <span className={styles['travelCommunity-createRoomText']}>새 채팅방</span>
            </button>
          </div>
        </div>
        
        <div className={styles['travelCommunity-roomsList']}>
          {chatState.isLoadingRoomList ? (
            <div className={styles['travelCommunity-roomsLoading']}>
              <p>채팅방 목록을 불러오는 중...</p>
            </div>
          ) : chatState.chatRooms.length === 0 ? (
            <div className={styles['travelCommunity-noRooms']}>
              <p>채팅방이 없습니다. 새 채팅방을 만들어보세요.</p>
            </div>
          ) : (
            chatState.chatRooms.map(room => (
              <div 
                key={room.id} 
                className={`${styles['travelCommunity-roomItem']} ${room.isSelected ? styles['travelCommunity-selected'] : ''}`}
                onClick={() => selectChatRoom(room.id)}
              >
                <div className={styles['travelCommunity-roomInfo']}>
                  <div className={styles['travelCommunity-roomName']}>{room.name}</div>
                  {room.badge && (
                    <div className={styles['travelCommunity-roomBadge']}>{room.badge}</div>
                  )}
                </div>
                {room.notification && (
                  <div className={styles['travelCommunity-notification']}></div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelCommunity; 