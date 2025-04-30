import dynamic from 'next/dynamic';

// 500 페이지 내용 컴포넌트
function ServerErrorPage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1>500 - 서버 오류</h1>
      <p>서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
      <a href="/" style={{ 
        marginTop: '20px',
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: 'white',
        borderRadius: '5px',
        textDecoration: 'none'
      }}>
        홈으로 돌아가기
      </a>
    </div>
  );
}

// 클라이언트 사이드에서만 렌더링되는 500 페이지
export default dynamic(() => Promise.resolve(ServerErrorPage), { 
  ssr: false 
}); 