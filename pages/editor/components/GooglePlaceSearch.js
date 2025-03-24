// 장소 선택 핸들러
const handlePlaceSelected = (place) => {
  if (!place || !place.geometry) {
    // console.error('선택된 장소 정보가 없습니다.');
    return;
  }

  // 지도 이동 및 콜백 처리로 간소화
  if (onPlaceSelected) {
    onPlaceSelected(place);
  }
  
  // console.log('구글 장소 선택됨:', place.name);
  
  // 복잡한 직렬화 및 모달 호출 로직은 index.js의 initSearchInput에서 처리
  shouldComparePlace = false;
}; 