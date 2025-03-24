import { protoServerDataset } from '../dataModels';

/**
 * 구글 Place API로부터 받은 장소 데이터를 앱에서 사용하는 형식으로 직렬화
 * @param {Object} detailPlace - 구글 Place API 응답 객체
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 직렬화된 장소 데이터
 */
export const serializeGooglePlaceData = (detailPlace, apiKey) => {
  const serializedPlace = { ...detailPlace };
  
  // 사진 객체의 처리
  if (detailPlace.photos && detailPlace.photos.length > 0) {
    // 직렬화 가능한 형태로 사진 데이터 변환
    const serializedPhotos = detailPlace.photos.map((photo, index) => {
      // photo 객체의 모든 속성 수집
      const photoProps = Object.getOwnPropertyNames(photo);
      
      // photo 객체에서 사용 가능한 메서드 목록 확인
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(photo));
      
      // photo 객체의 메서드 목록에서 URL 관련 메서드 필터링
      const urlMethods = methods.filter(method => 
        method.toLowerCase().includes('url') || 
        method.toLowerCase().includes('photo') || 
        method.toLowerCase().includes('image')
      );
      
      // photo 객체에서 사용 가능한 속성 복사
      const serializedPhoto = {};
      photoProps.forEach(prop => {
        // 함수가 아닌 속성만 복사
        if (typeof photo[prop] !== 'function') {
          serializedPhoto[prop] = photo[prop];
        }
      });
      
      // photo 객체의 메서드를 직접 호출하여 이미지 URL 생성
      let photoUrl = null;
      
      try {
        // 메서드 호출 테스트 1: getUrl
        if (typeof photo.getUrl === 'function') {
          const originalUrl = photo.getUrl({ maxWidth: 400, maxHeight: 300 });
          
          // Places JavaScript API URL을 Places REST API 형식으로 완전히 재구성
          // 예: maxwidth=400&photoreference=REF&key=KEY
          const photoRef = originalUrl.match(/1s([^&]+)/);
          if (photoRef && photoRef[1]) {
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef[1]}&key=${apiKey}`;
          } else {
            photoUrl = originalUrl; // 원본 URL 유지
          }
        }
      } catch (error) {
        // 오류 발생 시 아무 처리 안함
      }
      
      // URL 생성에 성공했을 경우 serializedPhoto에 추가
      if (photoUrl) {
        serializedPhoto.getUrl = photoUrl;
      }
      
      return serializedPhoto;
    });
    
    // 처리된 사진 데이터를 직렬화된 장소 데이터에 추가
    serializedPlace.photos = serializedPhotos;
  }
  
  return serializedPlace;
};

/**
 * 구글 장소 데이터를 앱 서버 데이터셋 형식으로 변환
 * @param {Object} serializedPlace - 직렬화된 구글 Place 데이터
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 앱 형식의 서버 데이터셋
 */
export const convertGooglePlaceToServerDataset = (googlePlace, apiKey) => {
  // 입력 검증
  if (!googlePlace) return null;
  
  // 서버 데이터셋 구조로 초기화
  const convertedData = {
    locationMap: '',
    storeName: googlePlace.name || '',
    storeStyle: '',
    alias: '',
    businessHours: googlePlace.opening_hours?.weekday_text || [''],
    address: googlePlace.formatted_address || '',
    contactNumber: googlePlace.formatted_phone_number || '',
    storeUrl: googlePlace.website || '',
    mainImage: '',
    subImages: [],
    origin: 'google',
    googlePlaceId: googlePlace.place_id || '',
    pathCoordinates: [],
    pinCoordinates: googlePlace.geometry?.location ? 
      `${googlePlace.geometry.location.lat()},${googlePlace.geometry.location.lng()}` : '',
    rating: googlePlace.rating ? googlePlace.rating.toString() : '',
    tags: []
  };
  
  // 구글 장소의 이미지 처리
  if (googlePlace.photos && googlePlace.photos.length > 0) {
    const serializedPlace = serializeGooglePlaceData(googlePlace, apiKey);
    
    // 첫 번째 이미지를 메인 이미지로 사용
    if (serializedPlace.photos[0]) {
      // getUrl 속성이 있으면 우선 사용 - 직렬화 과정에서 이미 적절히 변환된 URL임
      if (serializedPlace.photos[0].getUrl) {
        convertedData.mainImage = serializedPlace.photos[0].getUrl;
      } 
      // photo_reference가 있으면 API 호출 URL 생성
      else if (serializedPlace.photos[0].photo_reference) {
        convertedData.mainImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${serializedPlace.photos[0].photo_reference}&key=${apiKey}`;
      }
    }
    
    // 나머지 이미지를 서브 이미지로 사용
    if (serializedPlace.photos.length > 1) {
      convertedData.subImages = serializedPlace.photos.slice(1).map((photo, index) => {
        // getUrl 속성이 있으면 우선 사용 - 직렬화 과정에서 이미 적절히 변환된 URL임
        if (photo.getUrl) {
          return photo.getUrl;
        } 
        // photo_reference가 있으면 API 호출 URL 생성
        else if (photo.photo_reference) {
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`;
        }
        else {
          // 빈 문자열 반환 (이미지 로드 실패 시 에러 처리기에서 처리)
          return '';
        }
      }).filter(url => url); // 빈 문자열 필터링
    }
  }
  
  return convertedData;
};

/**
 * 구글 Place API 데이터를 앱 형식 데이터로 한번에 변환
 * @param {Object} detailPlace - 구글 Place API 응답 객체
 * @param {string} apiKey - 구글 Maps API 키
 * @returns {Object} 앱 형식의 서버 데이터셋
 */
export const parseGooglePlaceData = (detailPlace, apiKey) => {
  const serializedData = serializeGooglePlaceData(detailPlace, apiKey);
  if (!serializedData) return null;
  
  return convertGooglePlaceToServerDataset(serializedData, apiKey);
}; 