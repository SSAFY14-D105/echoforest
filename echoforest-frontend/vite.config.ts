import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api 요청을 백엔드 서버로 프록시 (CORS 회피)
      '/api': {
        target: 'https://i14d105.p.ssafy.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
