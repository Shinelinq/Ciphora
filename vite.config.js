import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    // 优化构建性能
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 保留console用于调试
        drop_debugger: true
      }
    },
    // 代码分割优化
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // 不使用自定义 manualChunks：手动拆包会在 CJS 依赖（React 运行时）之间制造
        // 循环依赖，导致生产构建出现 "Cannot set properties of undefined" 白屏。
        // 交给 Rollup 自动分包；xlsx 等按需 import 的依赖会自动成为懒加载 chunk。
      },
    },
    // 减少chunk大小警告阈值
    chunkSizeWarningLimit: 1000,
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 启用源码映射（可选，生产环境可以关闭）
    sourcemap: false
  },
  server: {
    // Tauri devUrl 必须与此端口一致；1420 为 Tauri 惯例端口，避开常见的 3000 占用
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // 优化开发服务器性能
  optimizeDeps: {
    include: ['react', 'react-dom', '@heroicons/react']
  }
}) 