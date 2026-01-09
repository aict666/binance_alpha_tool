import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 自定义插件：复制静态文件
const copyStaticFiles = () => ({
  name: 'copy-static-files',
  closeBundle() {
    // 复制 manifest.json
    copyFileSync(
      path.resolve(__dirname, 'public/manifest.json'),
      path.resolve(__dirname, 'dist/manifest.json')
    );
    // 复制 background.js
    copyFileSync(
      path.resolve(__dirname, 'public/background.js'),
      path.resolve(__dirname, 'dist/background.js')
    );
    console.log('[Build] Static files copied to dist/');
  }
});

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');

    // 开发模式配置
    if (command === 'serve') {
      return {
        base: './',
        server: {
          port: 3000,
          host: '0.0.0.0',
        },
        plugins: [react()],
        define: {
          'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
          'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'src'),
          }
        }
      };
    }

    // 构建模式配置 (Chrome 扩展)
    return {
      base: './',
      plugins: [react(), copyStaticFiles()],
      build: {
        outDir: 'dist',
        emptyDirBeforeWrite: true,
        rollupOptions: {
          input: {
            'content-main': path.resolve(__dirname, 'src/content/content-main.jsx'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'assets/[name].js',
            assetFileNames: 'assets/[name].[ext]',
            // 将所有代码打包到一个文件
            inlineDynamicImports: true,
          }
        },
        sourcemap: false,
        // CSS 不分割
        cssCodeSplit: false,
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
