# 리팩토링 로그
## 2025-05-23

### 커뮤니티 API 로직 리팩토링

#### 1. 중복 정렬 제거

**파일**: `realtimeChatUtilsFB.js`
- **변경 내용**: `getChatMessages` 함수에서 중복 클라이언트 정렬 제거
- **변경 코드**:
```javascript
// 라인 378-379 변경 전
messages.sort((a, b) => orderDirection === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);

// 라인 378-379 변경 후
// Client-side sort removed; Firestore's orderBy("timestamp", orderDirection) is now solely responsible for sorting.
```

#### 2. 메모리 관리 개선

**파일**: `communityAPI.js`
- **변경 내용**: `testRoomCreationFlags` 객체를 Map으로 변경하여 메모리 관리 개선
- **변경 코드**:
```javascript
// 라인 12 변경 전
const testRoomCreationFlags = {};

// 라인 12 변경 후
const testRoomCreationFlags = new Map();

// 라인 56-65 변경 전
if (testRoomCreationFlags[instanceId]) {
  log(`이미 테스트 채팅방 생성 중: ${instanceId}`, 'warn');
  return null;
}
testRoomCreationFlags[instanceId] = true;
// ... 코드 생략 ...
delete testRoomCreationFlags[instanceId];

// 라인 56-65 변경 후
if (testRoomCreationFlags.has(instanceId)) {
  log(`이미 테스트 채팅방 생성 중: ${instanceId}`, 'warn');
  return null;
}
testRoomCreationFlags.set(instanceId, true);
// ... 코드 생략 ...
testRoomCreationFlags.delete(instanceId);
```

#### 3. 파라미터 요구사항 강화

**파일**: `communityAPI.js`
- **변경 내용**: `createTestChatRoom` 함수에서 `instanceId`를 필수 파라미터로 변경
- **변경 코드**:
```javascript
// 라인 103-116 변경 전
async function createTestChatRoom(roomName, instanceId = generateId()) {
  // 코드 생략...
}

// 라인 103-116 변경 후
async function createTestChatRoom(roomName, instanceId) {
  if (!instanceId) {
    log('채팅방 생성 실패: instanceId가 필요합니다', 'error');
    throw new Error('instanceId is required');
  }
  // 코드 생략...
}
```

#### 4. 서버 측 필터링 활용

**파일**: `communityAPI.js`
- **변경 내용**: `fetchRooms` 함수에서 클라이언트 측 필터링 대신 Firestore의 서버 측 필터링 활용
- **변경 코드**:
```javascript
// 라인 203-227 변경 전
async function fetchRooms(userId) {
  try {
    const { rooms } = await realtimeChatUtils.getChatRooms();
    const filteredRooms = rooms.filter(room => room.members.includes(userId));
    log(`채팅방 목록 로드 완료: ${filteredRooms.length}개`);
    return filteredRooms;
  } catch (error) {
    log(`채팅방 목록 로드 오류: ${error.message}`, 'error');
    throw error;
  }
}

// 라인 203-227 변경 후
async function fetchRooms(userId) {
  try {
    const { rooms } = await realtimeChatUtils.getChatRooms({ userId });
    log(`채팅방 목록 로드 완료: ${rooms.length}개`);
    return rooms;
  } catch (error) {
    log(`채팅방 목록 로드 오류: ${error.message}`, 'error');
    throw error;
  }
}
```

#### 5. 유효성 검사 책임 이동

**파일**: `travelCommunitySlice.js`
- **변경 내용**: `communityAPI.js`에서 수행하던 유효성 검사를 Redux 썽크로 이동
- **변경 코드**:
```javascript
// 라인 124-137 변경 전 (sendMessageThunk)
export const sendMessageThunk = createAsyncThunk(
  'travelCommunity/sendMessage',
  async ({ roomId, message, file, userInfo }, { rejectWithValue }) => {
    try {
      const result = await communityDBManager.sendMessage(roomId, message, file, userInfo);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 라인 124-137 변경 후 (sendMessageThunk)
export const sendMessageThunk = createAsyncThunk(
  'travelCommunity/sendMessage',
  async ({ roomId, message, file, userInfo }, { rejectWithValue }) => {
    try {
      if (!roomId) return rejectWithValue('Room ID is required');
      if (!userInfo?.userId) return rejectWithValue('User ID is required');
      
      const result = await communityDBManager.sendMessage(roomId, message, file, userInfo);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 유사한 변경이 editMessageThunk와 deleteMessageThunk에도 적용됨
```

### 결론

이번 리팩토링을 통해 다음과 같은 개선이 이루어졌습니다:

1. **성능 최적화**: 중복 정렬 제거 및 서버 측 필터링 활용으로 성능 향상
2. **메모리 관리**: `Map` 객체 사용으로 메모리 누수 방지 및 효율적인 관리
3. **유효성 검사**: 검증 로직을 Redux 썽크로 이동하여 일관성 있는 오류 처리
4. **코드 품질**: 명확한 파라미터 요구사항으로 코드 안정성 향상

이러한 변경으로 코드의 유지보수성과 성능이 향상되었습니다.


