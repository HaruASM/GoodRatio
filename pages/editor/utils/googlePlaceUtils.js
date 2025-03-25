import { protoServerDataset } from '../dataModels';

/**
 * 구글 Place Photo Reference를 이용해 서버 API 라우트를 통한 이미지 URL 생성
 * @param {string} photoReference - 구글 Place API 사진 참조 ID
 * @param {number} maxWidth - 이미지 최대 너비
 * @returns {string} 프록시된 이미지 URL
 */
const getProxiedPhotoUrl = (photoReference, maxWidth = 400) => {
  if (!photoReference) return '';
  return `/api/place-photo?photo_reference=${photoReference}&maxwidth=${maxWidth}`;
};

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
  
  // 사진 객체 처리를 위한 직렬화 로직
  let serializedPhotos = [];
  if (detailPlace.photos && detailPlace.photos.length > 0) {
    serializedPhotos = detailPlace.photos.map((photo, index) => {
      // photo_reference 추출
      let photoReference = '';
      
      // photo_reference 속성 확인
      if (photo.photo_reference) {
        photoReference = photo.photo_reference;
      } else {
        // getUrl 메서드에서 photo_reference를 추출 시도
        try {
          if (typeof photo.getUrl === 'function') {
            const originalUrl = photo.getUrl();
            const photoRefMatch = originalUrl.match(/1s([^&]+)/);
            if (photoRefMatch && photoRefMatch[1]) {
              photoReference = photoRefMatch[1];
            }
          }
        } catch (error) {
          console.error(`photo_reference 추출 오류 ${index}:`, error);
        }
      }
      
      // 프록시된 이미지 URL 생성
      const photoUrl = photoReference ? getProxiedPhotoUrl(photoReference) : '';
      
      return {
        photo_reference: photoReference,
        getUrl: photoUrl,
        height: photo.height,
        width: photo.width,
        html_attributions: photo.html_attributions,
        // 전체 객체의 속성을 복사
        allProps: { ...photo }
      };
    });
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
    photos: serializedPhotos
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
  convertedData.origin = 'google';
  
  // 연락처 정보
  if (serializedPlace.formatted_phone_number) {
    convertedData.contact = serializedPlace.formatted_phone_number;
  }
  
  // 웹사이트 정보
  if (serializedPlace.website) {
    convertedData.website = serializedPlace.website;
  }
  
  // 영업시간 처리
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
      if (serializedPlace.photos[0].getUrl) {
        convertedData.mainImage = serializedPlace.photos[0].getUrl;
      }
    }
    
    // 나머지 이미지를 서브 이미지로 사용
    if (serializedPlace.photos.length > 1) {
      convertedData.subImages = serializedPlace.photos.slice(1)
        .map(photo => photo.getUrl)
        .filter(url => url); // 빈 문자열 필터링
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

/**
 * 구글 Place ID를 이용해서 상세 정보를 가져오는 함수
 * @param {string} placeId - 구글 Place ID
 * @param {string} apiKey - 구글 Maps API 키
 * @returns {Promise<Object>} 구글 Place 상세 데이터 (앱 형식으로 변환됨)
 */
export const fetchPlaceDetailById = async (placeId, apiKey) => {
  if (!placeId || !apiKey) {
    console.error('Place ID 또는 API 키가 없습니다.');
    return null;
  }

  try {
    // client-side에서 Google Maps JavaScript API를 사용하여 Place 상세 정보를 가져옵니다.
    return new Promise((resolve, reject) => {
      // Google Maps API가 로드되어 있는지 확인
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        reject(new Error('Google Maps API가 로드되지 않았습니다.'));
        return;
      }

      // Places 서비스 인스턴스 생성
      const placesService = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );

      // 요청할 상세 정보 필드 지정
      const request = {
        placeId: placeId,
        fields: [
          'name', 'formatted_address', 'geometry', 'formatted_phone_number',
          'website', 'opening_hours', 'photos', 'place_id'
        ]
      };

      // 상세 정보 요청
      placesService.getDetails(request, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          // 응답 데이터 변환
          const parsedData = parseGooglePlaceData(result, apiKey);
          resolve(parsedData);
        } else {
          console.error('구글 Place API 응답 에러:', status);
          reject(new Error(`Google Place API 응답 에러: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('구글 Place 상세 정보 가져오기 실패:', error);
    return null;
  }
}; 