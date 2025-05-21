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



import React, { useState, useEffect, useRef } from 'react';
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
  
  // 상태 업데이트 헬퍼 함수
  const updateChatState = (updates) => {
    setChatState(prev => ({ ...prev, ...updates }));
  };
  
  // 사용자 정보 (실제 애플리케이션에서는 로그인 시스템에서 가져옴)
  const [userInfo, setUserInfo] = useState({
    userId: 'user-1', // 사용자 ID 추가
    username: '김상배',
    userType: '참여',
    isBold: false
  });
  
  // communityDBManager 참조
  const [communityDBManager, setCommunityDBManager] = useState(null);
  
  // 메시지 영역 스크롤 참조
  const messagesEndRef = useRef(null);
  
  // 타이밍 관련 참조
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // 테마 전환 함수
  const toggleTheme = () => {
    const newTheme = chatState.theme === 'light' ? 'dark' : 'light';
    updateChatState({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // 컴포넌트 마운트 시 theme 테마 설정
  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', chatState.theme);
  }, [chatState.theme]);
  
  // DOM 루트 요소 참조
  const containerRef = useRef(null);

  // 메시지 추가 시 스크롤 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 컴포넌트 마운트 시 ModuleManager를 통해 communityDBManager 로드
  useEffect(() => {
    let unsubscribeFromManager = null;

    const loadCommunityDBManager = async () => {
      try {
        const manager = await ModuleManager.loadGlobalModuleAsync('communityDBManager');
        if (manager) {
          console.log('[TravelCommunity] CommunityDBManager 모듈 로드 성공');
          setCommunityDBManager(manager);

          // 채팅방 리스너 설정 시 target 전달
          if (chatState.currentRoomId && containerRef.current) {
            // 메시지 수신 시 호출될 콜백 함수 정의
            // TODO 여기에 선언된 콜백이  communityDBManager.js의 분리 방향에 부합하는가? 
            const messagesCallback = (messages) => {
              console.log(`[채팅 콜백] ${chatState.currentRoomId} 채팅방 메시지 수신: ${messages.length}개`);
              setChatState(prev => ({
                ...prev,
                messages: {
                  ...prev.messages,
                  [chatState.chatType]: messages
                }
              }));
            };
            
            // 올바른 파라미터로 setupChatListener 호출
            manager.setupChatListener(
              chatState.currentRoomId,
              messagesCallback,
              { autoMarkAsRead: true },
              containerRef.current
            );
          }

          // 채팅방 목록 로드
          loadChatRooms(manager);
        } else {
          console.error('[TravelCommunity] CommunityDBManager 모듈 로드 실패');
        }
      } catch (error) {
        console.error('[TravelCommunity] CommunityDBManager 모듈 로드 오류:', error);
      }
    };

    loadCommunityDBManager();

    return () => {
      if (unsubscribeFromManager) {
        unsubscribeFromManager();
      }
      if (communityDBManager) {
        if (chatState.currentRoomId && userInfo.userId) {
          try {
            communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false);
          } catch (error) {
            console.warn('[TravelCommunity] 타이핑 상태 초기화 오류:', error);
          }
        }
        communityDBManager.cleanupListeners();
        ModuleManager.unloadGlobalModule('communityDBManager');
      }
    };
  }, [chatState.currentRoomId, userInfo.userId]);

  useEffect(() => {
    // communityDBManager가 로드되지 않았거나 DOM 요소가 없으면 리스너를 등록하지 않음
    if (!communityDBManager || !containerRef.current) return;

    const container = containerRef.current;

    // 이벤트 핸들러 정의
    const handleMessagesUpdated = (event) => {
      const { roomId, messages } = event.detail;
      if (roomId === chatState.currentRoomId) {
        const roomType = roomId.startsWith('public-') ? 'public' : 'private';
        updateChatState(prev => ({
          ...prev,
          messages: { ...prev.messages, [roomType]: messages },
          isLoadingRoom: false, // 메시지 업데이트 시 로딩 상태 해제
        }));
        setTimeout(scrollToBottom, 100);

        // 읽지 않은 메시지 읽음 처리
        const unreadMessages = messages
          .filter(msg => !msg.isRead && msg.senderId && msg.senderId !== userInfo.userId)
          .map(msg => msg.id);
        if (unreadMessages.length > 0) { 
          communityDBManager.markMessagesAsRead(roomId, unreadMessages, userInfo.userId)
            .catch(err => console.warn(`[읽음 처리 오류] ${roomId}:`, err));
        }
      }
    };

    const handleTypingStatus = (event) => {
      const { roomId, typingUsers } = event.detail;
      if (roomId === chatState.currentRoomId) {
        const filteredTypingUsers = {};
        Object.keys(typingUsers).forEach(userId => {
          if (userId !== userInfo.userId && typingUsers[userId]) {
            filteredTypingUsers[userId] = typingUsers[userId];
          }
        });
        updateChatState({ typingUsers: filteredTypingUsers });
      }
    };

    const handleError = (event) => {
      const { roomId, error } = event.detail;
      console.error(`[TravelCommunity] 이벤트 오류 (${roomId || '전역'}):`, error);
      // 오류 UI 업데이트 (예: 에러 메시지 표시)
      if (roomId && roomId === chatState.currentRoomId) {
        const roomType = roomId.startsWith('public-') ? 'public' : 'private';
        updateChatState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [roomType]: [
              createMessage({
                id: `error-${Date.now()}`,
                username: '시스템',
                userType: 'system',
                message: error || '오류가 발생했습니다.',
                timestamp: new Date().toISOString(),
                isRead: true,
                senderId: 'system',
              }),
              ...(prev.messages[roomType] || []), 
            ],
          },
          isLoadingRoom: false, // 오류 시 로딩 상태 해제
        }));
      } else if (!roomId) {
        alert(`시스템 오류 발생: ${error}`);
      }
    };

    // 이벤트 리스너 등록 - 이제 container DOM 요소에 등록
    console.log('[TravelCommunity] 커스텀 이벤트 리스너 등록 시도: .travelCommunity-container');
    container.addEventListener(CommunityEventTypes.MESSAGES_UPDATED, handleMessagesUpdated);
    container.addEventListener(CommunityEventTypes.TYPING_STATUS, handleTypingStatus);
    container.addEventListener(CommunityEventTypes.ERROR, handleError);

    // 컴포넌트 언마운트 또는 의존성 변경 시 리스너 정리
    return () => {
      console.log('[TravelCommunity] 커스텀 이벤트 리스너 정리: .travelCommunity-container');
      container.removeEventListener(CommunityEventTypes.MESSAGES_UPDATED, handleMessagesUpdated);
      container.removeEventListener(CommunityEventTypes.TYPING_STATUS, handleTypingStatus);
      container.removeEventListener(CommunityEventTypes.ERROR, handleError);
    };
  }, [chatState.currentRoomId, userInfo.userId, communityDBManager, updateChatState, scrollToBottom]);
  
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
  
  // 채팅방 메시지 로드 및 리스너 설정 함수
  const loadChatMessages = async (manager, roomId) => {
    updateChatState({ isLoadingRoom: true });
    console.log(`[TravelCommunity] 채팅방 메시지 로드 시작: ${roomId}`);
    const roomType = roomId.startsWith('public-') ? 'public' : 'private';

    try {
      // 타이핑 상태 초기화
      if (manager.typingListeners && manager.typingListeners[roomId]) {
        try {
          await manager.updateTypingStatus(roomId, userInfo.userId, false);
        } catch (error) {
          console.warn(`[타이핑 상태 초기화 오류] ${roomId}:`, error);
        }
      }

      // 메시지 로드
      const roomMessages = await manager.getChatMessages(roomId, { useCache: true });
      console.log(`[TravelCommunity] 메시지 로드 완료 (${roomId}):`, roomMessages);
      
      updateChatState(prev => ({
        ...prev,
        messages: { ...prev.messages, [roomType]: roomMessages },
      }));

      setTimeout(scrollToBottom, 100);

      // 읽음 처리 및 타이핑 리스너 설정
      if (userInfo.userId) {
        // 읽지 않은 메시지 처리
        try {
          const unreadMessages = roomMessages
            .filter(msg => !msg.isRead && msg.senderId && msg.senderId !== userInfo.userId)
            .map(msg => msg.id);
          if (unreadMessages.length > 0) {
            await manager.markMessagesAsRead(roomId, unreadMessages, userInfo.userId);
          }
        } catch (readError) {
          console.warn(`[읽음 처리 오류] ${roomId}:`, readError);
        }

        // 타이핑 리스너 설정
        try {
          await manager.setupTypingListener(roomId, (typingUsersList) => {
            const filteredTypingUsers = {};
            Object.keys(typingUsersList || {}).forEach(userId => {
              if (userId !== userInfo.userId && typingUsersList[userId]) {
                filteredTypingUsers[userId] = typingUsersList[userId];
              }
            });
            updateChatState({ typingUsers: filteredTypingUsers });
          });
        } catch (typingError) {
          console.warn(`[타이핑 리스너 오류] ${roomId}:`, typingError);
        }
      }
    } catch (error) {
      console.error('[TravelCommunity] 메시지 로드 오류:', error);
      // 메시지 로드 실패해도 채팅방 선택 상태는 유지
      const roomType = roomId.startsWith('public-') ? 'public' : 'private';
      updateChatState(prevState => {
        const updatedMessages = { ...prevState.messages };
        updatedMessages[roomType] = [createMessage({
          id: 'error-message',
          username: '시스템',
          userType: 'system',
          message: error.message || '메시지를 불러오는데 실패했습니다.',
          timestamp: new Date().toISOString(), // createMessage가 ISO 문자열로 처리
          isRead: true,
          senderId: 'system',
        })];
        return { messages: updatedMessages };
      });
    } finally {
      updateChatState({ isLoadingRoom: false });
      console.log(`[TravelCommunity] 채팅방 메시지 로드 완료: ${roomId}`);
    }
  };
  
  // 채팅방 선택 함수
  const selectChatRoom = async (roomId) => {
    if (chatState.currentRoomId === roomId) return;
    
    // 이전 채팅방 정보 백업 (오류 발생 시 복원용)
    const prevRoomId = chatState.currentRoomId;
    const prevRooms = [...chatState.chatRooms];
    
    try {
      console.log('[TravelCommunity] 채팅방 선택 시도:', roomId);
      updateChatState({ isLoadingRoom: true });
      
      // 1. 먼저 채팅방 선택 상태 업데이트 (UI 즉시 반영)
      // 채팅방 목록 업데이트
      const updatedRooms = chatState.chatRooms.map(room => ({
        ...room,
        isSelected: room.id === roomId,
        notification: room.id === roomId ? false : room.notification
      }));
      
      // 상태 업데이트 (메시지 로드 전에 먼저 수행)
      updateChatState({
        chatRooms: updatedRooms,
        currentRoomId: roomId,
        typingUsers: {}
      });
      
      // 2. 현재 채팅방의 타이핑 상태 초기화 (비동기 작업이지만 UI에 즉시 영향 없음)
      if (communityDBManager && prevRoomId && userInfo.userId && chatState.isTyping) {
        try {
          updateChatState({ isTyping: false }); // 즉시 UI 업데이트
          
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
          
          // 비동기 작업은 UI 업데이트 후 수행
          await communityDBManager.updateTypingStatus(prevRoomId, userInfo.userId, false);
        } catch (error) {
          console.warn('[TravelCommunity] 타이핑 상태 초기화 오류:', error);
          // 타이핑 상태 초기화 실패는 무시 (UI에 영향 없음)
        }
      }
      
      // 3. 메시지 로드 (가장 시간이 오래 걸리는 작업)
      if (communityDBManager) {
        try {
          await loadChatMessages(communityDBManager, roomId);
          console.log('[TravelCommunity] 채팅방 선택 및 메시지 로드 완료');
        } catch (msgError) {
          console.error('[TravelCommunity] 메시지 로드 오류:', msgError);
          // 메시지 로드 실패해도 채팅방 선택 상태는 유지
          const roomType = roomId.startsWith('public-') ? 'public' : 'private';
          updateChatState(prevState => {
            const updatedMessages = { ...prevState.messages };
            updatedMessages[roomType] = [{
              id: 'error-message',
              username: '시스템',
              message: msgError.message || '메시지를 불러오는데 실패했습니다.',
              timestamp: new Date().getTime(),
              isRead: true,
              senderId: 'system'
            }];
            return { messages: updatedMessages };
          });
        }
      } else {
        console.warn('[TravelCommunity] communityDBManager가 없어 메시지를 로드할 수 없음');
      }
    } catch (error) {
      console.error('[TravelCommunity] 채팅방 선택 오류:', error);
      
      // 오류 발생 시 이전 상태로 복원 (채팅방 목록이 사라지는 문제 방지)
      updateChatState({
        chatRooms: prevRooms,
        currentRoomId: prevRoomId
      });
    } finally {
      updateChatState({ isLoadingRoom: false });
    }
  };
  
  // 메시지 추가 후 스크롤 조정
  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages]);

  // 탭 전환 함수
  const handleChangeType = (type) => {
    console.log(`[TravelCommunity] 채팅 타입 변경: ${chatState.chatType} -> ${type}`);
    updateChatState({ chatType: type });
    
    // 타입 변경 시에도 현재 채팅방의 메시지를 다시 로드
    if (communityDBManager && chatState.currentRoomId) {
      loadChatMessages(communityDBManager, chatState.currentRoomId);
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
        communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, true);
      }
      
      // 타이핑 타임아웃 설정 (사용자가 타이핑을 멈추면 상태 업데이트)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        updateChatState({ isTyping: false });
        if (communityDBManager && chatState.currentRoomId) {
          communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false);
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
    
    console.log(`[TravelCommunity] 메시지 전송 시도: ${chatState.inputMessage} (${chatState.chatType} 채팅방)`);
    
    try {
      // 사용자 타이핑 상태 중지
      if (chatState.isTyping) {
        updateChatState({ isTyping: false });
        try {
          await communityDBManager.updateTypingStatus(chatState.currentRoomId, userInfo.userId, false);
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
            { useCache: true }
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
          messageId = await communityDBManager.sendMessage(chatState.currentRoomId, messageData, { useCache: true });
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
      const currentMessages = [...messages[chatType]];
      const newMessageId = currentMessages.length > 0 
        ? Math.max(...currentMessages.map(msg => typeof msg.id === 'number' ? msg.id : 0)) + 1 
        : 1;
      
      const newMessage = {
        id: newMessageId,
        senderId: userInfo.userId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: inputMessage,
        isBold: userInfo.isBold,
        timestamp: new Date().toISOString(),
        isRead: false,
        isOffline: true, // 오프라인 메시지 표시
        error: true // 오류 표시
      };
      
      if (selectedFile) {
        newMessage.fileName = selectedFile.name;
        newMessage.fileError = true;
        setSelectedFile(null);
        setIsUploading(false);
      }
      
      // 임시 메시지 제거
      const filteredMessages = currentMessages.filter(msg => !msg.isSending);
      
      setMessages({
        ...messages,
        [chatType]: [...filteredMessages, newMessage]
      });
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
      const updatedRooms = [...chatRooms, newRoomForUI];
      setChatRooms(updatedRooms);
      
      // 모달 닫기
      closeCreateRoomModal();
      
      // 새 채팅방 선택
      console.log('[TravelCommunity] 새 채팅방 선택:', newRoomId);
      await selectChatRoom(newRoomId);
      
      // 환영 메시지 자동 전송
      const welcomeMessage = {
        senderId: 'system',
        username: '시스템',
        message: `환영합니다! ${newRoomData.name} 채팅방이 생성되었습니다.`,
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
    <div className={styles['travelCommunity-container']} ref={containerRef}>
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