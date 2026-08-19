import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    // Vite는 DNS 리바인딩 방어로 Host 헤더가 모르는 값이면 요청을 막는다.
    // VSCode 포트 포워딩(dev tunnels)으로 접속하면 Host가 *.devtunnels.ms라 여기에 걸린다.
    // 맨 앞의 점은 해당 도메인의 모든 서브도메인을 허용한다는 뜻이다.
    allowedHosts: ['.devtunnels.ms'],
  },
})
