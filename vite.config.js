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
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // 图标库
          if (id.includes('@heroicons') || id.includes('lucide-react')) return 'icons';
          // React 运行时
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
          // 国际化
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
          // Tauri API 与插件
          if (id.includes('@tauri-apps')) return 'tauri';
          // 按需加载的重型依赖，独立成块（仅在使用时下载）
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('qrcode') || id.includes('jsqr') || id.includes('gif.js')) return 'qr';
          return 'vendor';
        }
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