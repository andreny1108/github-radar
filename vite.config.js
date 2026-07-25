import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 会把站点挂在 https://<用户名>.github.io/<仓库名>/ 下，
// 所以生产构建必须带上 /<仓库名>/ 前缀，否则 JS/CSS 全部 404、页面白屏。
// 本地 dev 用根路径，不受影响。
// 换仓库名时改这里（或在 CI 里设 VITE_BASE 环境变量）。
const REPO_NAME = 'github-radar'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE ?? `/${REPO_NAME}/`) : '/',
  // 视觉全部由 src/index.css（Industry 设计系统）承担，没有用 Tailwind
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
}))
