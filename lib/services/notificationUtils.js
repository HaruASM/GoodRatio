'use client';

import { collection, doc, addDoc, updateDoc, query, where, getDocs, orderBy, limit, serverTimestamp, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { firebasedb } from '../../lib/firebaseCli';

/**
 * 알림 관련 유틸리티 함수 모음
 * 푸시 알림 생성, 읽음 처리, 조회 등 알림 관련 기능을 담당합니다.
 */

// 로깅 유틸리티 함수
const log = (message) => console.log(`[NotificationUtils] ${message}`);
const logError = (message, error) => console.error(`[NotificationUtils] ${message}:`, error);

/**
 * 오류 처리 헬퍼 함수
 * @param {Error} error - 발생한 오류
 * @param {string} context - 오류 발생 컨텍스트
 */
const handleFirestoreError = (error, context) => {
  logError(context, error);
  throw error;
};

/**
 * 푸시 알림 트리거 (Cloud Functions 호출)
 * 채팅 메시지 전송 시 호출되어 알림을 생성합니다.
 * 
 * @param {string} roomId - 채팅방 ID
 * @param {Object} notificationData - 알림 데이터
 * @param {string} notificationData.message - 메시지 내용
 * @param {string} notificationData.senderId - 발신자 ID
 * @param {string} notificationData.senderName - 발신자 이름
 * @param {Array} [notificationData.attachments] - 첨부파일 정보 (선택사항)
 * @returns {Promise<string>} 생성된 알림 ID
 */
export const triggerPushNotification = async (roomId, notificationData) => {
  try {
    // 채팅방 정보 조회
    const roomRef = doc(firebasedb, "chatRooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error("채팅방을 찾을 수 없습니다.");
    }
    
    const roomData = roomSnap.data();
    const members = roomData.members || [];
    
    // 수신자 목록 (발신자 제외)
    const recipients = members.filter(id => id !== notificationData.senderId);
    
    // 수신자가 없으면 알림 생성 불필요
    if (recipients.length === 0) {
      log(`알림 수신자가 없습니다: ${roomId}`);
      return null;
    }
    
    // Cloud Functions 호출을 위한 notifications 컬렉션에 문서 추가
    const notificationRef = collection(firebasedb, "notifications");
    const firestoreNotificationData = {
      roomId,
      roomName: roomData.name || '채팅방',
      message: notificationData.message || '새 메시지가 도착했습니다',
      senderId: notificationData.senderId,
      senderName: notificationData.senderName,
      recipients: recipients,
      timestamp: serverTimestamp(),
      type: 'new_message',
      read: false,
      // 첨부파일 정보 추가 (있는 경우)
      hasAttachments: notificationData.attachments && notificationData.attachments.length > 0,
      attachmentType: notificationData.attachments && notificationData.attachments.length > 0 ? 
                      notificationData.attachments[0].type || 'file' : null
    };
    
    const docRef = await addDoc(notificationRef, firestoreNotificationData);
    log(`푸시 알림 생성 성공: ${roomId}, 알림 ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, `푸시 알림 트리거 실패 (${roomId})`);
    return null;
  }
};

/**
 * 알림을 읽음 처리
 * @param {string} notificationId - 알림 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notificationRef = doc(firebasedb, "notifications", notificationId);
    const notificationSnap = await getDoc(notificationRef);
    
    if (!notificationSnap.exists()) {
      log(`알림을 찾을 수 없습니다: ${notificationId}`);
      return false;
    }
    
    const notificationData = notificationSnap.data();
    
    // 이미 읽은 알림인 경우
    if (notificationData.read) {
      return true;
    }
    
    // 수신자가 아닌 경우
    if (!notificationData.recipients.includes(userId)) {
      log(`사용자가 알림 수신자가 아닙니다: ${userId}`);
      return false;
    }
    
    // 알림 읽음 처리
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
      readBy: [...(notificationData.readBy || []), userId]
    });
    
    log(`알림 읽음 처리 성공: ${notificationId}, 사용자: ${userId}`);
    return true;
  } catch (error) {
    handleFirestoreError(error, `알림 읽음 처리 실패 (${notificationId})`);
    return false;
  }
};

/**
 * 사용자의 모든 알림을 읽음 처리
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 읽음 처리된 알림 수
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    // 사용자가 수신자인 읽지 않은 알림 조회
    const notificationsRef = collection(firebasedb, "notifications");
    const q = query(
      notificationsRef,
      where("recipients", "array-contains", userId),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      log(`읽지 않은 알림이 없습니다: ${userId}`);
      return 0;
    }
    
    // 배치 처리로 모든 알림 읽음 처리
    const batch = writeBatch(firebasedb);
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      const notificationData = doc.data();
      batch.update(doc.ref, {
        read: true,
        readAt: serverTimestamp(),
        readBy: [...(notificationData.readBy || []), userId]
      });
      count++;
    });
    
    await batch.commit();
    log(`모든 알림 읽음 처리 성공: ${userId}, 총 ${count}개`);
    return count;
  } catch (error) {
    handleFirestoreError(error, `모든 알림 읽음 처리 실패 (${userId})`);
    return 0;
  }
};

/**
 * 사용자의 알림 목록 조회
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 조회 옵션
 * @param {number} options.limit - 조회할 최대 알림 수 (기본값: 20)
 * @param {boolean} options.unreadOnly - 읽지 않은 알림만 조회 (기본값: false)
 * @returns {Promise<Array>} 알림 목록
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit: limitCount = 20, unreadOnly = false } = options;
    
    // 사용자가 수신자인 알림 조회 쿼리 구성
    const notificationsRef = collection(firebasedb, "notifications");
    let queryConstraints = [
      where("recipients", "array-contains", userId),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    ];
    
    // 읽지 않은 알림만 조회하는 경우 조건 추가
    if (unreadOnly) {
      queryConstraints.splice(1, 0, where("read", "==", false));
    }
    
    const q = query(notificationsRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);
    
    // 결과를 배열로 변환
    const notifications = [];
    querySnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
        // 서버 타임스탬프를 JS Date로 변환
        timestamp: doc.data().timestamp?.toDate() || new Date()
      });
    });
    
    log(`사용자 알림 조회 성공: ${userId}, 총 ${notifications.length}개`);
    return notifications;
  } catch (error) {
    handleFirestoreError(error, `사용자 알림 조회 실패 (${userId})`);
    return [];
  }
};

/**
 * 알림 삭제
 * @param {string} notificationId - 알림 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export const deleteNotification = async (notificationId) => {
  try {
    const notificationRef = doc(firebasedb, "notifications", notificationId);
    await deleteDoc(notificationRef);
    
    log(`알림 삭제 성공: ${notificationId}`);
    return true;
  } catch (error) {
    handleFirestoreError(error, `알림 삭제 실패 (${notificationId})`);
    return false;
  }
};

/**
 * 사용자의 읽은 알림 모두 삭제
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 삭제된 알림 수
 */
export const deleteAllReadNotifications = async (userId) => {
  try {
    // 사용자가 수신자이고 읽은 알림 조회
    const notificationsRef = collection(firebasedb, "notifications");
    const q = query(
      notificationsRef,
      where("recipients", "array-contains", userId),
      where("read", "==", true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      log(`삭제할 읽은 알림이 없습니다: ${userId}`);
      return 0;
    }
    
    // 배치 처리로 모든 알림 삭제
    const batch = writeBatch(firebasedb);
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    log(`읽은 알림 모두 삭제 성공: ${userId}, 총 ${count}개`);
    return count;
  } catch (error) {
    handleFirestoreError(error, `읽은 알림 삭제 실패 (${userId})`);
    return 0;
  }
};

/**
 * 읽지 않은 알림 개수 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 읽지 않은 알림 개수
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    // 사용자가 수신자이고 읽지 않은 알림 조회
    const notificationsRef = collection(firebasedb, "notifications");
    const q = query(
      notificationsRef,
      where("recipients", "array-contains", userId),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    const count = querySnapshot.size;
    
    log(`읽지 않은 알림 개수 조회 성공: ${userId}, 개수: ${count}`);
    return count;
  } catch (error) {
    handleFirestoreError(error, `읽지 않은 알림 개수 조회 실패 (${userId})`);
    return 0;
  }
};
