import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite는 DNS 리바인딩 방어로 Host 헤더가 목록에 없으면 요청을 거부한다.
 * dev(server)와 배포 컨테이너(preview) 양쪽에 다 적용되므로 같은 목록을 쓴다.
 *
 * - console.optics.run: 배포된 콘솔. preview로 서빙하므로 여기 없으면 502/403이 난다.
 * - .devtunnels.ms: VSCode 포트 포워딩으로 접속할 때의 임시 도메인.
 *   맨 앞의 점은 해당 도메인의 모든 서브도메인을 뜻해서 터널 URL이 바뀌어도 계속 통한다.
 */
const allowedHosts = ['console.optics.run', '.devtunnels.ms']

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: { allowedHosts },
  preview: { allowedHosts },
})
