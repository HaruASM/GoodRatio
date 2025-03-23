import { protoServerDataset } from '../dataModels';

/**
 * 구글 Place API로부터 받은 장소 데이터를 앱에서 사용하는 형식으로 직렬화
 * @param {Object} detailPlace - 구글 Place API 응답 객체
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 직렬화된 장소 데이터
 */
export const serializeGooglePlaceData = (detailPlace, apiKey) => {
  if (!detailPlace || !detailPlace.geometry || !detailPlace.geometry.location) {
    console.error("유효하지 않은 구글 Place 데이터");
    return null;
  }
  
  return {
    ...detailPlace,
    geometry: detailPlace.geometry ? {
      ...detailPlace.geometry,
      location: detailPlace.geometry.location ? {
        lat: typeof detailPlace.geometry.location.lat === 'function' ? 
             detailPlace.geometry.location.lat() : detailPlace.geometry.location.lat,
        lng: typeof detailPlace.geometry.location.lng === 'function' ? 
             detailPlace.geometry.location.lng() : detailPlace.geometry.location.lng
      } : null,
      viewport: detailPlace.geometry.viewport ? {
        northeast: {
          lat: typeof detailPlace.geometry.viewport.getNorthEast().lat === 'function' ? 
               detailPlace.geometry.viewport.getNorthEast().lat() : 
               detailPlace.geometry.viewport.getNorthEast().lat,
          lng: typeof detailPlace.geometry.viewport.getNorthEast().lng === 'function' ? 
               detailPlace.geometry.viewport.getNorthEast().lng() : 
               detailPlace.geometry.viewport.getNorthEast().lng
        },
        southwest: {
          lat: typeof detailPlace.geometry.viewport.getSouthWest().lat === 'function' ? 
               detailPlace.geometry.viewport.getSouthWest().lat() : 
               detailPlace.geometry.viewport.getSouthWest().lat,
          lng: typeof detailPlace.geometry.viewport.getSouthWest().lng === 'function' ? 
               detailPlace.geometry.viewport.getSouthWest().lng() : 
               detailPlace.geometry.viewport.getSouthWest().lng
        }
      } : null
    } : null,
    opening_hours: detailPlace.opening_hours ? {
      weekday_text: detailPlace.opening_hours.weekday_text || []
    } : null,
    photos: detailPlace.photos ? 
      detailPlace.photos.map(photo => ({ 
        photo_reference: photo.photo_reference, 
        height: photo.height, 
        width: photo.width 
      })) : []
  };
};

/**
 * 구글 장소 데이터를 앱 서버 데이터셋 형식으로 변환
 * @param {Object} serializedPlace - 직렬화된 구글 Place 데이터
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 앱 형식의 서버 데이터셋
 */
export const convertGooglePlaceToServerDataset = (serializedPlace, apiKey) => {
  if (!serializedPlace) return null;
  
  // 기본 서버 데이터셋 템플릿 복사
  const convertedData = { ...protoServerDataset };
  
  // 기본 필드 매핑
  convertedData.storeName = serializedPlace.name || '';
  convertedData.address = serializedPlace.formatted_address || '';
  convertedData.googleDataId = serializedPlace.place_id || '';
  
  // 연락처 정보 (있는 경우)
  if (serializedPlace.formatted_phone_number) {
    convertedData.contact = serializedPlace.formatted_phone_number;
  }
  
  // 웹사이트 정보 (있는 경우)
  if (serializedPlace.website) {
    convertedData.website = serializedPlace.website;
  }
  
  // 영업시간 처리 (주간 영업시간 텍스트 배열)
  if (serializedPlace.opening_hours && serializedPlace.opening_hours.weekday_text) {
    convertedData.businessHours = serializedPlace.opening_hours.weekday_text;
  }
          
  // 좌표 처리
  if (serializedPlace.geometry && serializedPlace.geometry.location) {
    const { lat, lng } = serializedPlace.geometry.location;
    convertedData.pinCoordinates = `${lat},${lng}`;
  }
  
  // 구글 장소의 이미지 처리
  if (serializedPlace.photos && serializedPlace.photos.length > 0) {
    // 첫 번째 이미지를 메인 이미지로 사용
    if (serializedPlace.photos[0]) {
      convertedData.mainImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${serializedPlace.photos[0].photo_reference}&key=${apiKey}`;
    }
    
    // 나머지 이미지를 서브 이미지로 사용
    if (serializedPlace.photos.length > 1) {
      convertedData.subImages = serializedPlace.photos.slice(1).map(photo => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${apiKey}`
      );
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