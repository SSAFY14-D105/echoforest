import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './styles/GlobalStyles.css'

// [FIX] StrictMode 제거 - Web Speech API가 중복 초기화되어 aborted 에러 발생
// StrictMode는 개발 모드에서 컴포넌트를 2번 마운트하는데, 
// 이로 인해 여러 개의 SpeechRecognition 인스턴스가 동시에 start()를 호출하여 충돌 발생
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)