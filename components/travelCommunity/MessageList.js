import React from 'react';
import styles from './TravelCommunity.module.css';

// 파일 확장자가 이미지인지 확인하는 함수
const isImageFile = (fileName) => {
  if (!fileName) return false;
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const extension = fileName.split('.').pop().toLowerCase();
  return imageExtensions.includes(extension);
};

const MessageList = ({ messages, typingUsers, userInfo, editMessage, deleteMessage, isLoading }) => {
  if (isLoading) {
    return <div className={styles['travelCommunity-messages']}>
      <div className={styles['travelCommunity-loading']}>메시지 로딩 중...</div>
    </div>;
  }

  return (
    <div className={styles['travelCommunity-messages']}>
      {messages && messages.length > 0 ? (
        messages.map(message => (
          <div key={message.id} className={`${styles['travelCommunity-message']} ${message.senderId === userInfo?.userId ? styles['travelCommunity-sent'] : styles['travelCommunity-received']} ${message.isSending ? styles['travelCommunity-sending'] : ''} ${message.error ? styles['travelCommunity-error'] : ''}`}>
            <div className={styles['travelCommunity-messageHeader']}>
              <div className={styles['travelCommunity-messageSender']}>
                <span className={styles['travelCommunity-username']}>{message.username || 'User'}</span>
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
              {message.senderId === userInfo?.userId && !message.isSending && !message.error && (
                <div className={styles['travelCommunity-messageActions']}>
                  <button 
                    className={styles['travelCommunity-actionButton']}
                    onClick={() => {
                      const newText = prompt('수정할 메시지를 입력하세요:', message.message);
                      if (newText && newText.trim() && newText !== message.message) {
                        editMessage(message.id, newText);
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
                        deleteMessage(message.id);
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
              
              {/* 이미지 표시 - 파일 확장자가 이미지인 경우에만 */}
              {message.fileUrl && isImageFile(message.fileName) && 
                <img src={message.fileUrl} alt="Uploaded content" className={styles['travelCommunity-messageImage']}/>}
            </div>
            {/* 메시지 푸터 - 타임스탬프 및 상태 표시 */}
            <div className={styles['travelCommunity-messageFooter']}>
              {message.timestamp && (
                <span className={styles['travelCommunity-timestamp']}>
                  {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              )}
              {message.isRead && message.senderId === userInfo?.userId && (
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
        ))
      ) : (
        <div className={styles['travelCommunity-noMessages']}>
          <p>아직 메시지가 없습니다. 대화를 시작해보세요!</p>
        </div>
      )}
      {typingUsers && Object.keys(typingUsers).length > 0 && (
        <div className={styles['travelCommunity-typingIndicator']}>
          {Object.values(typingUsers).join(', ')}
          <span> 입력 중...</span>
        </div>
      )}
    </div>
  );
};

export default MessageList;
