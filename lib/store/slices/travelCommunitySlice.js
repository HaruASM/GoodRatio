import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as communityAPI from '../../../components/travelCommunity/communityAPI';
import { cleanup as cleanupListeners } from '../../services/listenerManager';

// 인스턴스 ID 생성 (다중 인스턴스 지원용)
const generateInstanceId = () => `travel_community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Async thunk for initializing chat data (rooms, initial messages, etc.)
export const initializeChat = createAsyncThunk(
  'chat/initialize',
  // Parameters updated: instanceId is now expected from the dispatch call.
  // getState and dispatch are removed as they are not used.
  async ({ userInfo, instanceId }, { rejectWithValue }) => { 
    try {
      const userId = userInfo?.userId;

      if (!userId) {
        const errorMsg = 'initializeChat: User ID is missing from userInfo.';
        console.error(errorMsg);
        return rejectWithValue(errorMsg);
      }
      // instanceId is now expected to be passed in, so we check it directly.
      if (!instanceId) {
        const errorMsg = 'initializeChat: Instance ID was not provided for initialization.';
        console.error(errorMsg);
        return rejectWithValue(errorMsg);
      }

      // Call initializeWithEvents with explicit userId and instanceId
      const chatData = await communityAPI.initializeWithEvents({ userId, instanceId });
      
      // Retain the original check for valid data structure
      if (!chatData || !chatData.rooms) {
        console.warn('initializeChat: 유효하지 않은 데이터 수신. 반환된 데이터:', chatData);
        // 기본 구조 반환하여 UI 오류 방지
        return { rooms: [], roomId: null, messages: [] }; 
      }
      
      return chatData; // 예상 반환값: { rooms: Array, roomId: String|null, messages: Array }
    } catch (error) {
      console.error('initializeChat error:', error);
      return rejectWithValue(error.message || 'An unknown error occurred during chat initialization.');
    }
  }
);

// 특정 채팅방의 메시지를 가져오는 Thunk
export const fetchMessagesForRoom = createAsyncThunk(
  'chat/fetchMessages',
  async (roomId, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setIsLoadingRoom(true));
      const messages = await communityAPI.getChatMessages(roomId, { messageLimit: 50 });
      return messages;
    } catch (error) {
      console.error('fetchMessagesForRoom error:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 메시지 리스너 설정 Thunk
export const setupMessageListenerThunk = createAsyncThunk(
  'chat/setupMessageListener',
  async ({ roomId }, { dispatch, getState }) => {
    if (!roomId) {
      console.warn('setupMessageListenerThunk: No roomId provided');
      return null;
    }

    try {
      console.log(`[TravelCommunity] 메시지 리스너 설정: 방 ID ${roomId}`);
      // instanceId를 Redux 상태에서 가져옴
      const { instanceId } = getState().chat;
      
      // 메시지 리스너 설정 함수 호출 (instanceId 전달)
      const unsubscribe = await communityAPI.listenForMessages(instanceId, roomId, (messages) => {
        // 새 메시지가 도착하면 Redux 상태 업데이트
        dispatch(setMessages(messages));
      });

      // 리스너 해제 함수 반환 (useEffect의 cleanup 함수에서 사용)
      return unsubscribe;
    } catch (error) {
      console.error('setupMessageListenerThunk error:', error);
      throw error;
    }
  }
);

// 타이핑 상태 리스너 설정 Thunk
export const setupTypingListenerThunk = createAsyncThunk(
  'chat/setupTypingListener',
  async ({ roomId }, { dispatch, getState }) => {
    if (!roomId) {
      console.warn('setupTypingListenerThunk: No roomId provided');
      return null;
    }

    try {
      console.log(`[TravelCommunity] 타이핑 상태 리스너 설정: 방 ID ${roomId}`);
      // instanceId를 Redux 상태에서 가져옴
      const { instanceId } = getState().chat;
      
      // 타이핑 상태 리스너 설정 함수 호출 (instanceId 전달)
      const unsubscribe = await communityAPI.listenForTypingStatus(instanceId, roomId, (typingData) => {
        // 타이핑 데이터 형식: { userId: string, userName: string, isTyping: boolean }
        if (typingData) {
          dispatch(setUserTyping(typingData));
        }
      });

      // 리스너 해제 함수 반환 (useEffect의 cleanup 함수에서 사용)
      return unsubscribe;
    } catch (error) {
      console.error('setupTypingListenerThunk error:', error);
      throw error;
    }
  }
);

// 메시지 전송 Thunk
export const sendMessageThunk = createAsyncThunk(
  'chat/sendMessage',
  async ({ roomId, message, file, userInfo }, { dispatch, getState, rejectWithValue }) => {
    try {
      // 필수 파라미터 검증 (communityAPI.js에서 이동)
      if (!roomId) {
        return rejectWithValue('roomId가 필요합니다.');
      }
      if (!userInfo?.userId) {
        return rejectWithValue('사용자 ID가 필요합니다.');
      }
      if (!message && !file) {
        return rejectWithValue('메시지 또는 파일이 필요합니다.');
      }
      
      dispatch(setIsSendingMessage(true));
      
      // 파일이 있는 경우 업로드 처리
      let fileUrl = null;
      let fileName = null;
      
      if (file) {
        // 임시 메시지 ID 생성 (파일 업로드 진행 상태 표시용)
        const tempMessageId = `temp-${Date.now()}`;
        
        // 파일 업로드 중 상태 표시를 위한 임시 메시지 추가
        dispatch(addMessage({
          id: tempMessageId,
          senderId: userInfo.userId,
          username: userInfo.username || userInfo.displayName,
          message: `파일 업로드 중: ${file.name}`,
          timestamp: new Date().toISOString(),
          uploading: true,
          fileName: file.name
        }));
        
        try {
          // 파일 업로드 및 메시지 전송
          const messageData = {
            senderId: userInfo.userId,
            username: userInfo.username || userInfo.displayName,
            message: message || '파일 첨부',
            timestamp: new Date().toISOString()
          };
          const uploadResult = await communityAPI.uploadFileAndSendMessage(roomId, messageData, file);
          fileUrl = uploadResult?.fileUrl;
          fileName = file.name;
          
          // 임시 메시지 제거 (실제 메시지로 대체될 예정)
          // 실제 구현에서는 메시지 업데이트 로직이 필요할 수 있음
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          
          // 파일 업로드 실패 메시지로 업데이트
          dispatch(addMessage({
            id: tempMessageId,
            senderId: userInfo.userId,
            username: userInfo.username || userInfo.displayName,
            message: message,
            timestamp: new Date().toISOString(),
            fileError: true,
            fileName: file.name,
            error: true
          }));
          
          return rejectWithValue('파일 업로드 실패: ' + uploadError.message);
        }
      }
      
      // 파일이 없는 경우에만 메시지 전송 (파일이 있는 경우는 위에서 이미 처리됨)
      let messageId;
      if (!file) {
        // 메시지 데이터 구성
        const messageData = {
          senderId: userInfo.userId,
          username: userInfo.username || userInfo.displayName,
          message: message,
          timestamp: new Date().toISOString()
        };
        
        // 메시지 전송
        messageId = await communityAPI.sendMessage(roomId, messageData);
      }
      
      // 입력 필드 초기화
      dispatch(setInputMessage(''));
      if (file) {
        dispatch(clearSelectedFile());
      }
      
      // 전송된 메시지 반환 (리스너가 없는 경우에만 필요)
      return { ...messageData, id: messageId };
    } catch (error) {
      console.error('sendMessageThunk error:', error);
      return rejectWithValue(error.message);
    } finally {
      dispatch(setIsSendingMessage(false));
    }
  }
);

// 채팅방 생성 Thunk
export const createRoomThunk = createAsyncThunk(
  'chat/createRoom',
  async ({ roomName, roomType, userInfo }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setIsCreatingRoomLoading(true));
      
      // 채팅방 데이터 구성
      const roomData = {
        name: roomName.trim(),
        description: `${userInfo.username || userInfo.displayName}님이 생성한 채팅방`,
        isPublic: roomType === 'public',
        createdBy: userInfo.userId,
        members: [userInfo.userId],
        admins: [userInfo.userId]
      };
      
      // 채팅방 생성
      const roomId = await communityAPI.createChatRoom(roomData);
      
      // 새 채팅방 객체 생성 (UI 업데이트용)
      const newRoom = {
        id: roomId,
        name: roomData.name,
        description: roomData.description,
        isPublic: roomData.isPublic,
        createdBy: roomData.createdBy,
        members: roomData.members,
        admins: roomData.admins,
        createdAt: new Date().toISOString(),
        isSelected: false,
        notification: false
      };
      
      // 채팅방 목록 업데이트
      dispatch(setChatRooms([...getState().chat.chatRooms, newRoom]));
      
      // 모달 닫기
      dispatch(closeNewRoomModal());
      
      // 새 채팅방 선택
      dispatch(setCurrentRoomId(roomId));
      
      // 환영 메시지 자동 전송
      const welcomeMessage = {
        senderId: 'system',
        username: '시스템',
        message: `환영합니다! ${roomData.name} 채팅방이 생성되었습니다.`,
        timestamp: new Date().toISOString()
      };
      
      await communityAPI.sendMessage(roomId, welcomeMessage);
      
      return newRoom;
    } catch (error) {
      console.error('createRoomThunk error:', error);
      return rejectWithValue(error.message);
    } finally {
      dispatch(setIsCreatingRoomLoading(false));
    }
  }
);

// 메시지 수정 Thunk
export const editMessageThunk = createAsyncThunk(
  'chat/editMessage',
  async ({ roomId, messageId, newMessageText, userInfo }, { dispatch, rejectWithValue }) => {
    try {
      // 필수 파라미터 검증 (communityAPI.js에서 이동)
      if (!roomId) {
        return rejectWithValue('roomId가 필요합니다.');
      }
      if (!messageId) {
        return rejectWithValue('messageId가 필요합니다.');
      }
      if (!newMessageText || newMessageText.trim() === '') {
        return rejectWithValue('새 메시지 내용이 필요합니다.');
      }
      if (!userInfo?.userId) {
        return rejectWithValue('사용자 ID가 필요합니다.');
      }

      await communityAPI.editMessage(roomId, messageId, newMessageText, userInfo.userId);
      return { messageId, newMessageText };
    } catch (error) {
      console.error('editMessageThunk error:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 메시지 삭제 Thunk
export const deleteMessageThunk = createAsyncThunk(
  'chat/deleteMessage',
  async ({ roomId, messageId, userInfo }, { dispatch, rejectWithValue }) => {
    try {
      // 필수 파라미터 검증 (communityAPI.js에서 이동)
      if (!roomId) {
        return rejectWithValue('roomId가 필요합니다.');
      }
      if (!messageId) {
        return rejectWithValue('messageId가 필요합니다.');
      }
      if (!userInfo?.userId) {
        return rejectWithValue('사용자 ID가 필요합니다.');
      }

      await communityAPI.deleteMessage(roomId, messageId, userInfo.userId);
      return { messageId };
    } catch (error) {
      console.error('deleteMessageThunk error:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 컴포넌트 언마운트 시 정리 Thunk 추가
export const cleanupChatThunk = createAsyncThunk(
  'chat/cleanup',
  async (_, { getState }) => {
    const { instanceId } = getState().chat;
    communityAPI.cleanup(instanceId);
    return instanceId;
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    instanceId: generateInstanceId(), // 인스턴스 ID 추가
    chatType: 'public', // 'public' or 'private'
    theme: 'dark', 
    inputMessage: '',
    messages: [], // Messages for the currentRoomId
    chatRooms: [],
    currentRoomId: null,
    isLoadingRoom: false, // For loading messages of a selected room
    isLoadingRoomList: false, // For initially loading room list
    isSendingMessage: false, // For message sending state
    typingUsers: {}, // { [userId]: name, ... }
    isTyping: false, // Current user is typing
    selectedFile: null,
    isUploading: false,
    // States for creating a new room modal/form
    isNewRoomModalOpen: false, 
    newRoomName: '',
    newRoomType: 'public', 
    isCreatingRoomLoading: false, 
    error: null, // For storing any errors from thunks or operations
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      // 전역 테마 적용 (선택적)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', action.payload);
      }
    },
    setChatType: (state, action) => { 
      state.chatType = action.payload; 
    },
    setInputMessage: (state, action) => { 
      state.inputMessage = action.payload; 
    },
    setSelectedFile: (state, action) => {
      state.selectedFile = action.payload;
    },
    clearSelectedFile: (state) => {
      state.selectedFile = null;
    },
    setCurrentRoomId: (state, action) => {
      state.currentRoomId = action.payload;
      state.messages = []; // Clear messages when room changes, new ones will be loaded
      state.isLoadingRoom = true;
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
      state.isLoadingRoom = false;
    },
    addMessage: (state, action) => {
      // Add to current room's messages. Ensure it's not a duplicate if using listeners.
      const newMessage = action.payload;
      if (!state.messages.find(msg => msg.id === newMessage.id)) {
         state.messages.push(newMessage);
      }
    },
    setChatRooms: (state, action) => {
      state.chatRooms = action.payload;
    },
    setIsLoadingRoom: (state, action) => {
      state.isLoadingRoom = action.payload;
    },
    setIsSendingMessage: (state, action) => {
      state.isSendingMessage = action.payload;
    },
    // New Room Modal/Form reducers
    openNewRoomModal: (state) => { state.isNewRoomModalOpen = true; },
    closeNewRoomModal: (state) => { 
      state.isNewRoomModalOpen = false; 
      state.newRoomName = '';
      state.newRoomType = 'public';
    },
    setNewRoomName: (state, action) => { state.newRoomName = action.payload; },
    setNewRoomType: (state, action) => { state.newRoomType = action.payload; },
    // Typing indicators - simplified example
    setUserTyping: (state, action) => { // payload: { userId, isTyping, userName }
      if (action.payload.isTyping) {
        state.typingUsers[action.payload.userId] = action.payload.userName;
      } else {
        delete state.typingUsers[action.payload.userId];
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    // 인스턴스 ID 재설정 (필요 시)
    resetInstanceId: (state) => {
      state.instanceId = generateInstanceId();
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Chat
      .addCase(initializeChat.pending, (state) => {
        state.isLoadingRoomList = true;
        state.error = null;
      })
      .addCase(initializeChat.fulfilled, (state, action) => {
        const { rooms, roomId, messages } = action.payload;
        state.chatRooms = rooms || [];
        state.currentRoomId = roomId || (rooms && rooms.length > 0 ? rooms[0].id : null);
        state.messages = messages || [];
        state.isLoadingRoomList = false;
        if (state.currentRoomId && (!messages || messages.length === 0)) {
          state.isLoadingRoom = true; // Indicate messages for the current room should be fetched
        }
      })
      .addCase(initializeChat.rejected, (state, action) => {
        state.isLoadingRoomList = false;
        state.error = action.payload || 'Failed to initialize chat';
      })
      
      // setupMessageListenerThunk
      .addCase(setupMessageListenerThunk.pending, (state) => {
        // 메시지 리스너 설정 시작
        state.error = null;
      })
      .addCase(setupMessageListenerThunk.fulfilled, (state, action) => {
        // 리스너 설정 성공 - 실제 리스너는 이미 동작 중
        // 리스너 해제 함수는 컴포넌트에서 관리
      })
      .addCase(setupMessageListenerThunk.rejected, (state, action) => {
        state.error = action.payload || '메시지 리스너 설정 실패';
      })
      
      // setupTypingListenerThunk
      .addCase(setupTypingListenerThunk.pending, (state) => {
        // 타이핑 리스너 설정 시작
        state.error = null;
      })
      .addCase(setupTypingListenerThunk.fulfilled, (state, action) => {
        // 리스너 설정 성공 - 실제 리스너는 이미 동작 중
        // 리스너 해제 함수는 컴포넌트에서 관리
      })
      .addCase(setupTypingListenerThunk.rejected, (state, action) => {
        state.error = action.payload || '타이핑 리스너 설정 실패';
      })
      
      // sendMessageThunk
      .addCase(sendMessageThunk.pending, (state) => {
        state.isSendingMessage = true;
        state.error = null;
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        state.isSendingMessage = false;
        state.inputMessage = ''; // 입력 필드 초기화
        state.selectedFile = null; // 파일 선택 초기화
        
        // 새 메시지 추가 (리스너가 없는 경우에만 필요)
        if (action.payload && action.payload.id) {
          // 이미 동일한 ID의 메시지가 있는지 확인
          const existingMessageIndex = state.messages.findIndex(msg => msg.id === action.payload.id);
          
          if (existingMessageIndex >= 0) {
            // 기존 메시지 업데이트 (임시 메시지를 실제 메시지로 교체)
            state.messages[existingMessageIndex] = action.payload;
          } else {
            // 새 메시지 추가
            state.messages.push(action.payload);
          }
        }
      })
      .addCase(sendMessageThunk.rejected, (state, action) => {
        state.isSendingMessage = false;
        state.error = action.payload || '메시지 전송 실패';
      })
      
      // createRoomThunk
      .addCase(createRoomThunk.pending, (state) => {
        state.isCreatingRoomLoading = true;
        state.error = null;
      })
      .addCase(createRoomThunk.fulfilled, (state, action) => {
        state.isCreatingRoomLoading = false;
        state.isNewRoomModalOpen = false; // 모달 닫기
        state.newRoomName = ''; // 입력 필드 초기화
        state.newRoomType = 'public'; // 기본값으로 초기화
        
        // 새 채팅방 추가
        if (action.payload && action.payload.id) {
          state.chatRooms.push(action.payload);
          state.currentRoomId = action.payload.id; // 새 채팅방 선택
        }
      })
      .addCase(createRoomThunk.rejected, (state, action) => {
        state.isCreatingRoomLoading = false;
        state.error = action.payload || '채팅방 생성 실패';
      })
      
      // editMessageThunk
      .addCase(editMessageThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(editMessageThunk.fulfilled, (state, action) => {
        // 메시지 수정 성공 - 리스너가 없는 경우 업데이트
        if (action.payload && action.payload.messageId) {
          const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.messageId);
          if (messageIndex >= 0) {
            state.messages[messageIndex].message = action.payload.newMessageText;
            state.messages[messageIndex].edited = true;
          }
        }
      })
      .addCase(editMessageThunk.rejected, (state, action) => {
        state.error = action.payload || '메시지 수정 실패';
      })
      
      // deleteMessageThunk
      .addCase(deleteMessageThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteMessageThunk.fulfilled, (state, action) => {
        // 메시지 삭제 성공 - 리스너가 없는 경우 업데이트
        if (action.payload && action.payload.messageId) {
          state.messages = state.messages.filter(msg => msg.id !== action.payload.messageId);
        }
      })
      .addCase(deleteMessageThunk.rejected, (state, action) => {
        state.error = action.payload || '메시지 삭제 실패';
      })
      
      // fetchMessagesForRoom
      .addCase(fetchMessagesForRoom.pending, (state) => {
        state.isLoadingRoom = true;
        state.error = null;
      })
      .addCase(fetchMessagesForRoom.fulfilled, (state, action) => {
        state.messages = action.payload;
        state.isLoadingRoom = false;
      })
      .addCase(fetchMessagesForRoom.rejected, (state, action) => {
        state.isLoadingRoom = false;
        state.error = action.payload || '메시지 로드 실패';
      });
  }
});

export const {
  setTheme,
  setChatType,
  setInputMessage,
  setSelectedFile,
  clearSelectedFile,
  setCurrentRoomId,
  setMessages,
  addMessage,
  setChatRooms,
  setIsLoadingRoom,
  setIsSendingMessage,
  openNewRoomModal,
  closeNewRoomModal,
  setNewRoomName,
  setNewRoomType,
  setUserTyping,
  clearError,
  resetInstanceId // 인스턴스 ID 재설정 액션 추가
} = chatSlice.actions;

export default chatSlice.reducer;
