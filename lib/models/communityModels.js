/**
 * 커뮤니티 기능의 데이터 모델을 정의하는 모듈
 * - 채팅 관련 모델: ChatMessage, ChatRoom
 * - 향후 확장 예정: UserProfile, CommunityEvent, Notification
 * @module communityModels
 */

/**
 * 메시지 객체 구조
 * @typedef {Object} ChatMessage
 * @property {string} id - 메시지 ID
 * @property {string} username - 사용자 이름
 * @property {string} userType - 사용자 유형 (예: '참여', '관리자', '시스템')
 * @property {boolean} isBold - 굵은 글씨 여부
 * @property {string} message - 메시지 내용
 * @property {string} timestamp - 타임스탬프 (ISO 형식 문자열, Firestore Timestamp에서 변환됨)
 * @property {boolean} isRead - 읽음 상태
 * @property {string|null} [fileUrl] - 파일 URL
 * @property {string|null} [fileName] - 파일 이름
 * @property {string} senderId - 발신자 ID
 * @property {boolean} isEdited - 수정 여부
 * @property {Array<{url: string, name: string, type: string, size: number}>} attachments - 첨부파일 배열
 * @property {Object.<string, string[]>} reactions - 반응 객체 (예: { '👍': ['user1', 'user2'] })
 * @property {string[]} readBy - 읽은 사용자 ID 배열
 * @property {boolean} isDeleted - 삭제 여부
 * @property {boolean} [isSystemMessage] - 시스템 메시지 여부
 * @property {string|null} [updatedAt] - 수정 시간 (ISO 형식 문자열, Firestore Timestamp에서 변환됨)
 */

/**
 * 채팅 메시지 프로토타입
 * @type {ChatMessage}
 */
export const protoChatMessage = {
    id: "",
    username: "익명",
    userType: "",
    isBold: false,
    message: "",
    timestamp: new Date().toISOString(),
    isRead: false,
    fileUrl: null,
    fileName: null,
    senderId: "",
    isEdited: false,
    attachments: [],
    reactions: {},
    readBy: [],
    isDeleted: false,
    isSystemMessage: false,
    updatedAt: null,
  };
  
  /**
   * 채팅방 객체 구조
   * @typedef {Object} ChatRoom
   * @property {string} id - 채팅방 ID
   * @property {string} name - 채팅방 이름
   * @property {string} description - 채팅방 설명
   * @property {string|number} badge - 메시지 카운트 (문자열 또는 숫자)
   * @property {boolean} isSelected - 선택 여부
   * @property {boolean} notification - 알림 여부 (기본값 false: 사용자별 설정 반영)
   * @property {string} lastMessage - 마지막 메시지
   * @property {string|null} lastMessageTime - 마지막 메시지 시간 (ISO 형식 문자열)
   * @property {boolean} isPublic - 공개 여부
   * @property {string[]} members - 멤버 ID 배열
   * @property {string[]} admins - 관리자 ID 배열
   * @property {string} createdAt - 생성 시간 (ISO 형식 문자열)
   * @property {string|null} createdBy - 생성자 ID
   * @property {Object.<string, boolean>} typingUsers - 입력 상태 (예: { 'user1': true })
   * @property {string} [sectionName] - 섹션 이름
   */
  
  /**
   * 채팅방 프로토타입
   * @type {ChatRoom}
   */
  export const protoChatRoom = {
    id: "",
    name: "새 채팅방",
    description: "",
    badge: "0",
    isSelected: false,
    notification: false,
    lastMessage: "",
    lastMessageTime: null,
    isPublic: true,
    members: [],
    admins: [],
    createdAt: new Date().toISOString(),
    createdBy: null,
    typingUsers: {},
    sectionName: "",
  };

/**
 * 사용자 프로필 객체 구조
 * @typedef {Object} UserProfile
 * @property {string} userId - 사용자 ID
 * @property {string} username - 사용자 이름
 * @property {string} [avatarUrl] - 아바타 URL
 * @property {string} [statusMessage] - 상태 메시지
 * @property {Object} [settings] - 사용자 설정
 * // 이후 개발에 따라 수정 중
 */

/**
 * 커뮤니티 이벤트 객체 구조
 * @typedef {Object} CommunityEvent
 * @property {string} eventId - 이벤트 ID
 * @property {string} title - 이벤트 제목
 * @property {string} [description] - 이벤트 설명
 * @property {string} startTime - 시작 시간 (ISO 형식 문자열)
 * @property {string} [endTime] - 종료 시간 (ISO 형식 문자열)
 * @property {string} [location] - 장소
 * @property {string} organizerId - 주최자 ID (userId)
 * @property {string[]} participants - 참가자 ID 배열
 * @property {string} createdAt - 생성 시간 (ISO 형식 문자열)
 * // 이후 개발에 따라 수정 중
 */

/**
 * 알림 객체 구조
 * @typedef {Object} Notification
 * @property {string} notificationId - 알림 ID
 * @property {string} userId - 수신자 ID
 * @property {string} type - 알림 유형 (예: 'new_message', 'event_reminder', 'mention')
 * @property {string} message - 알림 메시지
 * @property {string} [link] - 관련 링크
 * @property {string} [relatedItemId] - 관련 아이템 ID (예: 메시지 ID, 이벤트 ID)
 * @property {boolean} isRead - 읽음 여부
 * @property {string} createdAt - 생성 시간 (ISO 형식 문자열)
 * // 이후 개발에 따라 수정 중
 */
  
  /**
   * 메시지 객체를 표준화된 형식으로 생성
   * @param {Object} data - 메시지 데이터
   * @param {string} [data.id] - 메시지 ID
   * @param {string} [data.username] - 사용자 이름
   * @param {string} [data.userType] - 사용자 유형
   * @param {boolean} [data.isBold] - 굵은 글씨 여부
   * @param {string} [data.message] - 메시지 내용
   * @param {Date|string} [data.timestamp] - 타임스탬프
   * @param {boolean} [data.isRead] - 읽음 상태
   * @param {string} [data.fileUrl] - 파일 URL
   * @param {string} [data.fileName] - 파일 이름
   * @param {string} [data.senderId] - 발신자 ID
   * @param {boolean} [data.isEdited] - 수정 여부
   * @param {Array} [data.attachments] - 첨부파일 배열
   * @param {Object} [data.reactions] - 반응 객체
   * @param {Array} [data.readBy] - 읽은 사용자 ID 배열
   * @param {boolean} [data.isDeleted] - 삭제 여부
   * @param {boolean} [data.isSystemMessage] - 시스템 메시지 여부
   * @param {Date|string|null} [data.updatedAt] - 수정 시간
   * @returns {ChatMessage} 표준화된 메시지 객체
   */
  export const createMessage = (data) => {
    const now = new Date().toISOString();
    // protoChatMessage를 깊은 복사하여 기본값 설정
    const chatMessage = structuredClone(protoChatMessage);
  
    // 입력 데이터로 필드 덮어씌우기
    Object.assign(chatMessage, data);
  
    // 필요한 필드만 가공
    chatMessage.id = data.id || `temp-${Date.now()}`;
    chatMessage.timestamp = data.timestamp ? (data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp) : now;
    chatMessage.updatedAt = data.updatedAt ? (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt) : null;
  
    // 필수 필드 검증
    if (!chatMessage.id || !chatMessage.senderId) {
      throw new Error('필수 메시지 필드 누락');
    }
  
    return chatMessage;
  };

/**
 * 채팅방 객체를 표준화된 형식으로 생성
 * @param {Object} data - 채팅방 데이터
 * @param {string} [data.id] - 채팅방 ID
 * @param {string} [data.name] - 채팅방 이름
 * @param {string} [data.description] - 채팅방 설명
 * @param {string|number} [data.badge] - 메시지 카운트
 * @param {boolean} [data.isSelected] - 선택 여부
 * @param {boolean} [data.notification] - 알림 여부
 * @param {string} [data.lastMessage] - 마지막 메시지
 * @param {string|null} [data.lastMessageTime] - 마지막 메시지 시간
 * @param {boolean} [data.isPublic] - 공개 여부
 * @param {string[]} [data.members] - 멤버 ID 배열
 * @param {string[]} [data.admins] - 관리자 ID 배열
 * @param {Date|string} [data.createdAt] - 생성 시간
 * @param {string|null} [data.createdBy] - 생성자 ID
 * @param {Object.<string, boolean>} [data.typingUsers] - 입력 상태
 * @param {string} [data.sectionName] - 섹션 이름
 * @returns {ChatRoom} 표준화된 채팅방 객체
 */
export const createChatRoom = (data) => {
  const now = new Date().toISOString();
  // protoChatRoom을 깊은 복사하여 기본값 설정
  const room = structuredClone(protoChatRoom);

  // 입력 데이터로 필드 덮어씌우기
  Object.assign(room, data);

  // 필요한 필드만 가공 및 기본값 설정
  room.id = data.id || `room-${Date.now()}`;
  room.createdAt = data.createdAt ? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt) : now;
  
  // badge는 문자열로 통일, 기본값 '0'
  room.badge = typeof data.badge === 'number' ? String(data.badge) : (data.badge || '0');

  // 필수 필드 검증 (예: name)
  if (!room.name) {
    // 기본 이름을 설정하거나 오류를 발생시킬 수 있습니다.
    // 여기서는 protoChatRoom의 기본 이름을 사용하도록 structuredClone에서 이미 처리되었습니다.
    // 만약 data.name이 명시적으로 null이나 undefined로 들어올 경우를 대비한 방어 코드를 추가할 수 있습니다.
    room.name = room.name || protoChatRoom.name; 
  }

  return room;
};