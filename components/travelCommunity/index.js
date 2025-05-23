import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // Ensure useSelector is imported
import styles from './styles.module.css'; // Ensure this path is correct

// Import Actions and Thunks from Redux Slice
import {
  initializeChat,
  // setChatType, // Theme/type can be managed if needed, but primary focus is chat data
  setInputMessage,
  setSelectedFile,
  clearSelectedFile,
  setCurrentRoomId,
  addMessage,    // For real-time updates or optimistic updates
  setIsLoadingRoom,
  setIsSendingMessage,
  openNewRoomModal,
  closeNewRoomModal,
  setNewRoomName,
  setNewRoomType,
  setUserTyping, // Will be used for handleInputChange
  setupMessageListenerThunk, // For real-time message updates
  setupTypingListenerThunk,  // For real-time typing updates
  // setUserTyping, // Detailed typing status can be added later
  clearError,
  fetchMessagesForRoom,
  sendMessageThunk,
  createRoomThunk,
  editMessageThunk,
  deleteMessageThunk,
} from '../../lib/store/slices/travelCommunitySlice';

// Import UI Components
import ChatRoomList from './ChatRoomList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

// --- Placeholder Thunks (to be implemented in travelCommunitySlice.js) ---
// These would typically involve async operations (e.g., API calls) and dispatching other actions.
// Main TravelCommunity Component
const TravelCommunity = ({ userInfo }) => {
  const dispatch = useDispatch();
  const instanceId = useSelector(state => state.chat.instanceId); // Get instanceId from store
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Selectors to get data from Redux store
  const {
    chatType, // 공개/비공개 탭 관리
    theme,    // 테마 관리
    inputMessage,
    messages, 
    chatRooms,
    currentRoomId,
    isLoadingRoom,
    isLoadingRoomList,
    isSendingMessage,
    typingUsers, 
    selectedFile,
    isNewRoomModalOpen,
    newRoomName,
    newRoomType,
    isCreatingRoomLoading: isCreatingRoomLoadingFromStore, 
    error
  } = useSelector(state => state.chat);

  // 공개/비공개 탭 전환 및 채팅방 필터링
  const toggleChatType = useCallback(() => {
    dispatch(setChatType(chatType === 'public' ? 'private' : 'public'));
  }, [dispatch, chatType]);
  
  // 현재 탭(chatType)에 따라 채팅방 필터링
  const filteredChatRooms = useMemo(() => {
    if (!chatRooms) return [];
    return chatRooms.filter(room => {
      if (chatType === 'public') return room.isPublic !== false;
      return room.isPublic === false;
    });
  }, [chatRooms, chatType]);

  const toggleTheme = useCallback(() => {
    // Assuming a setTheme action exists in the slice
    dispatch(setTheme(theme === 'light' ? 'dark' : 'light'));
  }, [dispatch, theme]);



  // Initialization: Load chat rooms. UserInfo is a dependency.
  useEffect(() => {
    // Ensure userInfo, userInfo.userId, and instanceId are present before initializing
    if (userInfo && userInfo.userId && instanceId) {
      dispatch(initializeChat({ userInfo, instanceId }));
    }
  }, [dispatch, userInfo, instanceId]); // Add instanceId to dependency array

  // Scroll to bottom when new messages arrive or room changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // Only messages, as currentRoomId change might clear messages first

  // Setup real-time listeners when currentRoomId or userInfo changes
  useEffect(() => {
    let unsubscribeMessages = () => {};
    let unsubscribeTyping = () => {};

    if (currentRoomId && userInfo && userInfo.userId) {
      console.log(`[Effect] Setting up listeners for room: ${currentRoomId}`);
      dispatch(setupMessageListenerThunk({ roomId: currentRoomId }))
        .then(result => { 
          if (result.payload && typeof result.payload === 'function') {
            unsubscribeMessages = result.payload;
          } else {
            console.warn('setupMessageListenerThunk did not return a valid unsubscribe function in payload');
            unsubscribeMessages = () => {}; // Ensure it's callable
          }
        })
        .catch(error => console.error('Error setting up message listener:', error));

      dispatch(setupTypingListenerThunk({ roomId: currentRoomId }))
        .then(result => { 
          if (result.payload && typeof result.payload === 'function') {
            unsubscribeTyping = result.payload;
          } else {
            console.warn('setupTypingListenerThunk did not return a valid unsubscribe function in payload');
            unsubscribeTyping = () => {}; // Ensure it's callable
          }
        })
        .catch(error => console.error('Error setting up typing listener:', error));
    }
    return () => {
      console.log(`[Effect] Cleaning up listeners for room: ${currentRoomId}`);
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [currentRoomId, dispatch, userInfo]);

  // Event Handlers that dispatch Redux actions/thunks
  const handleSelectChatRoom = useCallback((roomId) => {
    if (roomId !== currentRoomId) {
      dispatch(setCurrentRoomId(roomId)); // Sets current room, clears messages, sets isLoadingRoom
      dispatch(fetchMessagesForRoom(roomId)); // Thunk to load messages for the selected room
    }
  }, [dispatch, currentRoomId]);

  const handleInputChange = useCallback((value) => {
    dispatch(setInputMessage(value));
  }, [dispatch]);

  const handleSendMessage = useCallback(() => {
    if ((inputMessage.trim() || selectedFile) && currentRoomId && userInfo) {
      dispatch(sendMessageThunk({
        roomId: currentRoomId,
        messageText: inputMessage,
        userInfo,
        file: selectedFile
      }));
    }
  }, [dispatch, inputMessage, selectedFile, currentRoomId, userInfo]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      dispatch(setSelectedFile(file));
    } else {
      dispatch(clearSelectedFile());
    }
  }, [dispatch]);

  const handleCreateNewRoom = useCallback(() => {
    dispatch(openNewRoomModal());
  }, [dispatch]);

  const handleModalSubmitNewRoom = useCallback(() => {
    if (newRoomName.trim() && userInfo) {
      dispatch(createRoomThunk({ roomName: newRoomName, roomType: newRoomType, userInfo }));
    }
  }, [dispatch, newRoomName, newRoomType, userInfo]);
  
  // 채팅방 생성 모달 상태

  const newRoomInputRef = useRef(null);

  // 채팅방 생성 모달 닫기
  const closeCreateRoomModal = () => {
    dispatch(closeNewRoomModal());
  };
  
  // 채팅방 생성 모달 열기
  const openCreateRoomModal = () => {
    dispatch(setNewRoomName(''));
    dispatch(setNewRoomType('public'));
    dispatch(openNewRoomModal());
    // 모달이 열리면 입력 필드에 포커스
    setTimeout(() => {
      if (newRoomInputRef.current) {
        newRoomInputRef.current.focus();
      }
    }, 100);
  };

  
  // 채팅방 이름 변경 핸들러
  const handleNewRoomNameChange = (e) => {
    dispatch(setNewRoomName(e.target.value));
  };
  
  // 채팅방 타입 변경 핸들러
  const handleNewRoomTypeChange = (type) => {
    dispatch(setNewRoomType(type));
  };
  
  // 채팅방 생성 폼 제출 핸들러
  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    handleModalSubmitNewRoom(); // Dispatch createRoomThunk via this handler
  };

  return (
    <div className={styles['travelCommunity-container']} data-theme={theme}>
      {/* 에러 표시 UI */}
      {error && (
        <div className={styles['travelCommunity-error']}>
          오류: {error}
          <button 
            className={styles['travelCommunity-errorCloseButton']} 
            onClick={() => dispatch(clearError())}
          >
            닫기
          </button>
        </div>
      )}
      
      {/* 채팅방 생성 모달 */}
      {isNewRoomModalOpen && (
        <div className={styles['travelCommunity-modal-overlay']}>
          <div className={styles['travelCommunity-modal']}>
            <div className={styles['travelCommunity-modal-header']}>
              <h3>새 채팅방 생성</h3>
              <button 
                className={styles['travelCommunity-modal-close']}
                onClick={closeCreateRoomModal}
                disabled={isCreatingRoomLoadingFromStore}
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
                    disabled={isCreatingRoomLoadingFromStore}
                    required
                  />
                </div>
                
                <div className={styles['travelCommunity-form-group']}>
                  <label>채팅방 유형</label>
                  <div className={styles['travelCommunity-room-type-selector']}>
                    <div className={styles['travelCommunity-room-type-option']}>
                      <button
                        type="button"
                        className={`${styles['travelCommunity-room-type-button']} ${newRoomType === 'public' ? styles['travelCommunity-active'] : ''}`}
                        onClick={() => handleNewRoomTypeChange('public')}
                        disabled={isCreatingRoomLoadingFromStore}
                        title="모든 사용자가 참여할 수 있는 공개 채팅방"
                      >
                        <span className={styles['travelCommunity-room-type-icon']}>🌐</span>
                        <span className={styles['travelCommunity-room-type-text']}>퍼블릭</span>
                        <span className={styles['travelCommunity-room-type-radio']}>
                          {newRoomType === 'public' && <span className={styles['travelCommunity-radio-checked']}>✓</span>}
                        </span>
                      </button>
                      <p className={styles['travelCommunity-room-type-description']}>
                        모든 사용자가 참여할 수 있는 공개 채팅방입니다.
                      </p>
                    </div>
                    
                    <div className={styles['travelCommunity-room-type-option']}>
                      <button
                        type="button"
                        className={`${styles['travelCommunity-room-type-button']} ${newRoomType === 'private' ? styles['travelCommunity-active'] : ''}`}
                        onClick={() => handleNewRoomTypeChange('private')}
                        disabled={isCreatingRoomLoadingFromStore}
                        title="초대된 사용자만 참여할 수 있는 비공개 채팅방"
                      >
                        <span className={styles['travelCommunity-room-type-icon']}>🔒</span>
                        <span className={styles['travelCommunity-room-type-text']}>프라이빗</span>
                        <span className={styles['travelCommunity-room-type-radio']}>
                          {newRoomType === 'private' && <span className={styles['travelCommunity-radio-checked']}>✓</span>}
                        </span>
                      </button>
                      <p className={styles['travelCommunity-room-type-description']}>
                        초대된 사용자만 참여할 수 있는 비공개 채팅방입니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles['travelCommunity-modal-footer']}>
                <button
                  type="button"
                  className={styles['travelCommunity-button-secondary']}
                  onClick={closeCreateRoomModal}
                  disabled={isCreatingRoomLoadingFromStore}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={styles['travelCommunity-button-primary']}
                  disabled={!newRoomName.trim() || isCreatingRoomLoadingFromStore}
                >
                  {isCreatingRoomLoadingFromStore ? '생성 중...' : '생성'}
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
            className={`${styles['travelCommunity-tab']} ${chatType === 'public' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => dispatch(setChatType('public'))}
            disabled={!currentRoomId}
          >
            공개 채팅
          </button>
          <button 
            className={`${styles['travelCommunity-tab']} ${chatType === 'private' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => dispatch(setChatType('private'))}
            disabled={!currentRoomId}
          >
            개인 채팅
          </button>
          {/* 테마 전환 버튼 */}
          <button 
            className={styles['travelCommunity-tab']}
            onClick={toggleTheme}
            title="테마 전환"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        
        {/* 채팅 메시지 영역 */}
        {!currentRoomId ? (
          <div className={styles['travelCommunity-noRoomSelected']}>
            <p>좌측에서 채팅방을 선택하거나 새 채팅방을 만들어주세요.</p>
          </div>
        ) : (
          <MessageList 
            messages={messages} 
            typingUsers={typingUsers} 
            userInfo={userInfo} 
            editMessage={(messageId, newText) => {
              if (newText && newText.trim() !== '') {
                dispatch(editMessageThunk({ 
                  roomId: currentRoomId, 
                  messageId, 
                  newMessageText: newText, 
                  userId: userInfo.userId 
                }));
              }
            }} 
            deleteMessage={(messageId) => {
              if (window.confirm('정말 이 메시지를 삭제하시겠습니까?')) {
                dispatch(deleteMessageThunk({ 
                  roomId: currentRoomId, 
                  messageId, 
                  userInfo 
                }));
              }
            }} 
            isLoading={isLoadingRoom}
          />
        )}
        
        {/* 입력 영역 */}
        <div className={styles['travelCommunity-inputArea']}>
          {currentRoomId ? (
            <MessageInput 
              inputMessage={inputMessage}
              selectedFile={selectedFile}
              onInputChange={handleInputChange}
              onSendMessage={handleSendMessage}
              onFileSelect={handleFileChange}
              isSending={isSendingMessage}
            />
          ) : (
            <p className={styles['travelCommunity-noRoomSelected']}>채팅방을 선택하세요</p>
          )}
        </div>
      </div>
      
      {/* 하단 채팅방 목록 영역 - ChatRoomList 컴포넌트 사용 */}
      <ChatRoomList 
        chatRooms={filteredChatRooms}
        currentRoomId={currentRoomId}
        selectChatRoom={selectChatRoom}
        createNewChatRoom={createNewChatRoom}
        isLoading={isLoadingRoomList}
      />
    </div>
  );
};

export default TravelCommunity;