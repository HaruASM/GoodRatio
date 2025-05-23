import React from 'react';
import styles from './TravelCommunity.module.css';

const ChatRoomList = ({ chatRooms, currentRoomId, selectChatRoom, createNewChatRoom, isLoading }) => {
  if (isLoading) {
    return <div className={styles['travelCommunity-roomsSection']}>
      <div className={styles['travelCommunity-loading']}>채팅방 로딩 중...</div>
    </div>;
  }

  return (
    <div className={styles['travelCommunity-roomsSection']}>
      <div className={styles['travelCommunity-roomsHeader']}>
        <h3 className={styles['travelCommunity-sectionTitle']}>대화방</h3>
        <div className={styles['travelCommunity-roomsActions']}>
          <button className={styles['travelCommunity-searchButton']} title="채팅방 검색">
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
        {chatRooms && chatRooms.length > 0 ? (
          chatRooms.map(room => (
            <div 
              key={room.id} 
              role="button"
              tabIndex={0}
              className={`${styles['travelCommunity-roomItem']} ${room.id === currentRoomId ? styles['travelCommunity-selected'] : ''}`}
              onClick={() => selectChatRoom(room.id)}
              onKeyDown={(e) => e.key === 'Enter' && selectChatRoom(room.id)}
              aria-selected={room.id === currentRoomId}
            >
              <div className={styles['travelCommunity-roomInfo']}>
                <div className={styles['travelCommunity-roomName']}>
                  {room.name} {room.isPublic === false ? '(비공개)' : ''}
                </div>
                {room.badge && (
                  <div className={styles['travelCommunity-roomBadge']}>{room.badge}</div>
                )}
              </div>
              {room.notification && (
                <div className={styles['travelCommunity-notification']}></div>
              )}
            </div>
          ))
        ) : (
          <div className={styles['travelCommunity-noRooms']}>
            <p>채팅방이 없습니다. 새 채팅방을 만들어보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoomList;
