import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.module.css';

const TravelCommunity = () => {
  // 채팅방 타입 (퍼블릭/프라이빗)
  const [chatType, setChatType] = useState('public');
  
  // 테마 상태 (light/dark)
  const [theme, setTheme] = useState('light');
  
  // 입력 메시지 상태
  const [inputMessage, setInputMessage] = useState('');
  
  // 메시지 목록 상태
  const [messages, setMessages] = useState({
    public: [
      { id: 1, username: 'Dobswe100', userType: 'ETH/USDT.P 24D', isBold: true, message: '다들 고베인좀 어떻게여?' },
      { id: 2, username: 'Maxwait', userType: '참여', message: '내려가주세요' },
      { id: 3, username: 'Junideepal-5008', userType: 'BTC/DOLUSDT.P 5', isBold: true, message: '아님사람은 관바티는거고 그게 몰리고 시작한편...배매가 꼬이는거자뉴' },
      { id: 4, username: 'Dobswe100', userType: 'ETH/USDT.P 24D', isBold: true, message: '고베인데 지금 쭉들어가는 사람은 왕초롱' },
      { id: 5, username: 'Dobswe100', userType: 'ETH/USDT.P 24D', isBold: true, message: '고베면 아까 롱락줍을때 사지... 물론 고베 재배 기준은 사람마다 다를 짓만 에헤' }
    ],
    private: [
      { id: 1, username: '시스템', message: '프라이빗 메시지입니다. 직접 대화를 시작해보세요.' }
    ]
  });
  
  // 메시지 영역 스크롤 참조
  const messagesEndRef = useRef(null);
  
  // 테마 전환 함수
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // 컴포넌트 마운트 시 light 테마 설정
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);
  
  // 메시지 추가 시 스크롤 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 메시지 추가 후 스크롤 조정
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 채팅방 목록 데이터
  const chatRooms = [
    { id: 1, name: '가상화폐', badge: '12.2M', isSelected: true, notification: false },
    { id: 2, name: 'Dobswe100: 물론 고베 재배 기준은 사...', badge: '', isSelected: false, notification: true },
    { id: 3, name: '이형', badge: '1.4K', isSelected: false, notification: true },
    { id: 4, name: 'minkil0t: 물론 - 18 시간전', badge: '', isSelected: false, notification: true },
    { id: 5, name: '주식 & 지수', badge: '2.4K', isSelected: false, notification: true },
    { id: 6, name: 'UnicornPro: https://m.site... - 6 시간전', badge: '', isSelected: false, notification: true },
    { id: 7, name: 'TradingView 사용 꿀팁', badge: '1.6K', isSelected: false, notification: false },
    { id: 8, name: 'BitCoinGuide: https://kr.tra... - 21 시간전', badge: '', isSelected: false, notification: false },
    { id: 9, name: '비트코인', badge: '229', isSelected: false, notification: false },
    { id: 10, name: 'joeblack21070: sds - 5월 9', badge: '', isSelected: false, notification: false }
  ];

  // 탭 전환 함수
  const handleChangeType = (type) => {
    setChatType(type);
  };
  
  // 입력 메시지 변경 핸들러
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
  };
  
  // 메시지 전송 핸들러
  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;
    
    // 현재 채팅 타입의 메시지 목록 가져오기
    const currentMessages = [...messages[chatType]];
    
    // 새 메시지 ID 생성 (현재 메시지의 마지막 ID + 1)
    const newMessageId = currentMessages.length > 0 
      ? Math.max(...currentMessages.map(msg => msg.id)) + 1 
      : 1;
    
    // 새 메시지 객체 생성
    const newMessage = {
      id: newMessageId,
      username: '김상배',
      userType: 'USDC 15',
      isBold: true,
      message: inputMessage
    };
    
    // 메시지 목록 업데이트
    setMessages({
      ...messages,
      [chatType]: [...currentMessages, newMessage]
    });
    
    // 입력 필드 초기화
    setInputMessage('');
  };
  
  // 엔터 키 입력 시 메시지 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
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
            placeholder="할 말이 있으신가요?" 
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
            <span>➤</span>
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
            <button className={styles['travelCommunity-moreButton']}>⋮</button>
          </div>
        </div>
        
        <div className={styles['travelCommunity-roomsList']}>
          {chatRooms.map(room => (
            <div 
              key={room.id} 
              className={`${styles['travelCommunity-roomItem']} ${room.isSelected ? styles['travelCommunity-selected'] : ''}`}
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