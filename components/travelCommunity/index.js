import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.module.css';
import ModuleManager from '../../lib/moduleManager';

const TravelCommunity = () => {
  // 채팅방 타입 (퍼블릭/프라이빗)
  const [chatType, setChatType] = useState('public');
  
  // 테마 상태 (light/dark)
  const [theme, setTheme] = useState('dark');
  
  // 입력 메시지 상태
  const [inputMessage, setInputMessage] = useState('');
  
  // 메시지 목록 상태
  const [messages, setMessages] = useState({
    public: [],
    private: []
  });
  
  // 채팅방 목록 상태
  const [chatRooms, setChatRooms] = useState([]);
  
  // 현재 선택된 채팅방 ID
  const [currentRoomId, setCurrentRoomId] = useState(null);
  
  // 사용자 정보 (실제 애플리케이션에서는 로그인 시스템에서 가져옴)
  const [userInfo, setUserInfo] = useState({
    username: '김상배',
    userType: '참여',
    isBold: false
  });
  
  // communityDBManager 참조
  const [communityDBManager, setCommunityDBManager] = useState(null);
  
  // 메시지 영역 스크롤 참조
  const messagesEndRef = useRef(null);
  
  // 테마 전환 함수
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // 컴포넌트 마운트 시 theme 테마 설정
  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', theme);
  }, []);
  
  // 메시지 추가 시 스크롤 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 컴포넌트 마운트 시 ModuleManager를 통해 communityDBManager 로드
  useEffect(() => {
    const loadCommunityDBManager = async () => {
      try {
        // ModuleManager를 통해 communityDBManager 로드
        const manager = await ModuleManager.loadGlobalModuleAsync('communityDBManager');
        if (manager) {
          console.log('[TravelCommunity] CommunityDBManager 모듈 로드 성공');
          setCommunityDBManager(manager);
          
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
    
    // 컴포넌트 언마운트 시 리스너 정리
    return () => {
      if (communityDBManager) {
        communityDBManager.cleanupListeners();
        ModuleManager.unloadGlobalModule('communityDBManager');
      }
    };
  }, []);
  
  // 채팅방 목록 로드 함수
  const loadChatRooms = async (manager) => {
    try {
      const rooms = await manager.getChatRooms();
      
      if (rooms.length > 0) {
        // 첫 번째 채팅방 선택
        const firstRoom = rooms[0];
        firstRoom.isSelected = true;
        setCurrentRoomId(firstRoom.id);
        
        // 채팅방 메시지 로드 및 리스너 설정
        loadChatMessages(manager, firstRoom.id);
      } else {
        // 채팅방이 없으면 기본 데이터 사용
        const defaultRooms = [
          { id: 'default-1', name: '가상화폐', badge: '0', isSelected: true, notification: false },
          { id: 'default-2', name: '주식 & 지수', badge: '0', isSelected: false, notification: false },
          { id: 'default-3', name: '비트코인', badge: '0', isSelected: false, notification: false }
        ];
        setChatRooms(defaultRooms);
        setCurrentRoomId('default-1');
        
        // 기본 메시지 설정
        setMessages({
          public: [{ id: 1, username: '시스템', message: '환영합니다! 채팅방에 참여해주세요.' }],
          private: [{ id: 1, username: '시스템', message: '프라이빗 메시지입니다. 직접 대화를 시작해보세요.' }]
        });
      }
      
      setChatRooms(rooms);
    } catch (error) {
      console.error("[TravelCommunity] 채팅방 목록 로드 오류:", error);
      
      // 오류 발생 시 기본 데이터 사용
      const defaultRooms = [
        { id: 'default-1', name: '가상화폐', badge: '0', isSelected: true, notification: false },
        { id: 'default-2', name: '주식 & 지수', badge: '0', isSelected: false, notification: false },
        { id: 'default-3', name: '비트코인', badge: '0', isSelected: false, notification: false }
      ];
      setChatRooms(defaultRooms);
    }
  };
  
  // 채팅방 메시지 로드 및 리스너 설정 함수
  const loadChatMessages = async (manager, roomId) => {
    try {
      console.log(`[TravelCommunity] 채팅방 ${roomId} 메시지 로드 시작`);
      
      // 초기 메시지 로드
      const initialMessages = await manager.getChatMessages(roomId);
      console.log(`[TravelCommunity] 초기 메시지 로드 완료:`, initialMessages.length);
      
      // 메시지 상태 업데이트 (채팅방 타입에 따라)
      setMessages(prev => {
        const newMessages = {
          ...prev,
          [chatType]: initialMessages.length > 0 ? initialMessages : [
            { id: 1, username: '시스템', message: '환영합니다! 채팅방에 참여해주세요.' }
          ]
        };
        console.log(`[TravelCommunity] 메시지 상태 업데이트:`, newMessages);
        return newMessages;
      });
      
      // 실시간 리스너 설정
      const unsubscribe = manager.setupChatListener(roomId, (updatedMessages) => {
        console.log(`[TravelCommunity] 실시간 메시지 업데이트:`, updatedMessages.length);
        setMessages(prev => {
          // 현재 타입에 맞는 메시지만 업데이트
          const newMessages = {
            ...prev,
            [chatType]: updatedMessages.length > 0 ? updatedMessages : prev[chatType]
          };
          return newMessages;
        });
      });
      
      // 리스너 참조 저장 (나중에 사용하기 위해)
      console.log(`[TravelCommunity] 리스너 설정 완료`);
      return unsubscribe;
    } catch (error) {
      console.error(`[TravelCommunity] 채팅방 ${roomId} 메시지 로드 오류:`, error);
      
      // 오류 발생 시 기본 메시지 사용
      setMessages(prev => ({
        ...prev,
        [chatType]: [{ id: 1, username: '시스템', message: '메시지를 로드하는 중 오류가 발생했습니다.' }]
      }));
      return () => {}; // 더미 해제 함수
    }
  };
  
  // 채팅방 선택 함수
  const selectChatRoom = (roomId) => {
    // 이미 선택된 채팅방이면 무시
    if (currentRoomId === roomId) return;
    
    // 채팅방 목록 업데이트
    const updatedRooms = chatRooms.map(room => ({
      ...room,
      isSelected: room.id === roomId
    }));
    
    setChatRooms(updatedRooms);
    setCurrentRoomId(roomId);
    
    // 새 채팅방 메시지 로드 및 리스너 설정
    if (communityDBManager) {
      loadChatMessages(communityDBManager, roomId);
    }
  };
  
  // 메시지 추가 후 스크롤 조정
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 탭 전환 함수
  const handleChangeType = (type) => {
    console.log(`[TravelCommunity] 채팅 타입 변경: ${chatType} -> ${type}`);
    setChatType(type);
    
    // 타입 변경 시에도 현재 채팅방의 메시지를 다시 로드
    if (communityDBManager && currentRoomId) {
      loadChatMessages(communityDBManager, currentRoomId);
    }
  };
  
  // 입력 메시지 변경 핸들러
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
  };
  
  // 메시지 전송 핸들러
  const handleSendMessage = async () => {
    if (inputMessage.trim() === '') {
      console.log('[TravelCommunity] 메시지가 비어있습니다.');
      return;
    }
    
    if (!currentRoomId) {
      console.log('[TravelCommunity] 선택된 채팅방이 없습니다.');
      return;
    }
    
    if (!communityDBManager) {
      console.log('[TravelCommunity] communityDBManager가 로드되지 않았습니다.');
      return;
    }
    
    console.log(`[TravelCommunity] 메시지 전송 시도: ${inputMessage} (${chatType} 채팅방)`);
    
    try {
      // 메시지 데이터 생성
      const messageData = {
        username: userInfo.username,
        userType: userInfo.userType,
        message: inputMessage,
        isBold: userInfo.isBold
      };
      
      // 임시 로컬 메시지 추가 (사용자 경험 개선)
      const currentMessages = [...messages[chatType]];
      const newMessageId = `temp-${Date.now()}`;
      const tempMessage = {
        id: newMessageId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: inputMessage,
        isBold: userInfo.isBold,
        isSending: true // 전송 중 표시
      };
      
      setMessages({
        ...messages,
        [chatType]: [...currentMessages, tempMessage]
      });
      
      // 입력 필드 초기화 (사용자 경험 개선을 위해 전송 전 초기화)
      setInputMessage('');
      
      // 메시지 전송
      console.log(`[TravelCommunity] 메시지 전송 시작: ${currentRoomId}`);
      const messageId = await communityDBManager.sendMessage(currentRoomId, messageData);
      console.log(`[TravelCommunity] 메시지 전송 성공: ${messageId}`);
      
      // 메시지 전송 후 자동으로 리스너에 의해 업데이트됨
    } catch (error) {
      console.error("[TravelCommunity] 메시지 전송 오류:", error);
      
      // 오류 발생 시 로컬에서만 메시지 추가 (오프라인 대체)
      const currentMessages = [...messages[chatType]];
      const newMessageId = currentMessages.length > 0 
        ? Math.max(...currentMessages.map(msg => typeof msg.id === 'number' ? msg.id : 0)) + 1 
        : 1;
      
      const newMessage = {
        id: newMessageId,
        username: userInfo.username,
        userType: userInfo.userType,
        message: inputMessage,
        isBold: userInfo.isBold,
        isOffline: true, // 오프라인 메시지 표시
        error: true // 오류 표시
      };
      
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
  
  // 새로운 채팅방 생성 함수
  const createNewChatRoom = async () => {
    if (!communityDBManager) return;
    
    try {
      // 새로운 채팅방 데이터 생성
      const newRoomData = {
        name: '새로운 채팅방',
        description: '사용자가 생성한 채팅방',
        isPublic: true
      };
      
      // 새로운 채팅방 생성
      const newRoomId = await communityDBManager.createChatRoom(newRoomData);
      
      // 새로운 채팅방 목록에 추가
      const newRoom = {
        id: newRoomId,
        name: newRoomData.name,
        badge: '0',
        isSelected: false,
        notification: false
      };
      
      const updatedRooms = [...chatRooms, newRoom];
      setChatRooms(updatedRooms);
      
      // 새 채팅방 선택
      selectChatRoom(newRoomId);
    } catch (error) {
      console.error("[TravelCommunity] 새로운 채팅방 생성 오류:", error);
    }
  };

  return (
    <div className={styles['travelCommunity-container']}>
      {/* 상단 채팅 영역 */}
      <div className={styles['travelCommunity-chatSection']}>
        {/* 채팅 유형 선택 탭 */}
        <div className={styles['travelCommunity-tabs']}>
          <button 
            className={`${styles['travelCommunity-tab']} ${chatType === 'public' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => handleChangeType('public')}
          >
            퍼블릭
          </button>
          <button 
            className={`${styles['travelCommunity-tab']} ${chatType === 'private' ? styles['travelCommunity-active'] : ''}`}
            onClick={() => handleChangeType('private')}
          >
            프라이빗
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
        <div className={styles['travelCommunity-messages']}>
          {messages[chatType].map(message => (
            <div key={message.id} className={styles['travelCommunity-message']}>
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
              <div className={styles['travelCommunity-messageContent']}>
                {message.message}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* 입력 영역 */}
        <div className={styles['travelCommunity-inputArea']}>
          <input 
            type="text" 
            placeholder="..." 
            className={styles['travelCommunity-input']}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <div 
            className={styles['travelCommunity-emojiButton']}
            onClick={handleSendMessage}
            style={{ cursor: 'pointer' }}
          >
            <span>😊</span>
          </div>
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
              className={styles['travelCommunity-moreButton']} 
              onClick={createNewChatRoom}
              title="새 채팅방 만들기"
            >
              +
            </button>
          </div>
        </div>
        
        <div className={styles['travelCommunity-roomsList']}>
          {chatRooms.map(room => (
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default TravelCommunity; 