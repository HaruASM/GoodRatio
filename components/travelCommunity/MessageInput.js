import React, { useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserTyping } from '../../lib/store/slices/travelCommunitySlice'; // Adjust path as needed
import styles from './TravelCommunity.module.css';

const MessageInput = ({ 
  inputMessage, 
  selectedFile, 
  onInputChange, 
  onSendMessage, 
  onFileSelect, 
  onTyping, 
  isSending,
  userInfo // userInfo를 props로 받도록 변경
}) => {
  const dispatch = useDispatch();
  const typingTimeoutRef = useRef(null);
  const { currentRoomId } = useSelector(state => ({
    currentRoomId: state.chat.currentRoomId
  }));
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    onInputChange(value);

    if (currentRoomId && userInfo && userInfo.userId) {
      // Notify that user started typing
      dispatch(setUserTyping({ 
        roomId: currentRoomId, // Pass roomId if your backend/slice needs it for context
        userId: userInfo.userId, 
        userName: userInfo.username || userInfo.name || 'User', // Ensure userName is available
        isTyping: true 
      }));

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to mark user as not typing
      typingTimeoutRef.current = setTimeout(() => {
        dispatch(setUserTyping({ 
          roomId: currentRoomId,
          userId: userInfo.userId, 
          userName: userInfo.username || userInfo.name || 'User',
          isTyping: false 
        }));
      }, 2000); // 2 seconds timeout
    }
  }, [dispatch, onInputChange, currentRoomId, userInfo, typingTimeoutRef]);

  const handleSendMessage = () => {
    if (inputMessage.trim() || selectedFile) {
      onSendMessage();
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles['travelCommunity-inputArea']}>
      <textarea 
        className={styles['travelCommunity-input']}
        value={inputMessage} 
        onChange={handleInputChange} 
        onKeyPress={handleKeyPress}
        placeholder="메시지를 입력하세요..."
        rows="3"
        disabled={isSending}
      />
      <div className={styles['travelCommunity-inputControls']}>
        <input 
          type="file" 
          onChange={onFileSelect} 
          disabled={isSending} 
          id="fileInput"
          style={{display: 'none'}} // Hide default input, use label as button
        />
        <label htmlFor="fileInput" className={`${styles['travelCommunity-fileSelectButton']} ${isSending ? styles.disabled : ''}`}>파일 첨부</label>
        {selectedFile && <span className={styles['travelCommunity-selectedFileName']}>{selectedFile.name}</span>}
        <button 
          className={styles['travelCommunity-sendButton']}
          onClick={handleSendMessage} 
          disabled={isSending || (!inputMessage.trim() && !selectedFile)}
        >
          {isSending ? '전송 중...' : '전송'}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
