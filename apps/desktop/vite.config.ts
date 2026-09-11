import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';

// 主进程/preload 构建：所有裸模块导入（node_modules / workspace 包）保持 external，
// 运行时由 Electron 主进程从 node_modules 解析，避免 pdfkit/xlsx 等 CJS 包被打包后失效
const externalBareImports = (id: string) =>
  !id.startsWith('.') && !id.startsWith('/') && !path.isAbsolute(id);

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // Main process entry
        entry: 'src/main.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            // vite-plugin-electron 会依据 package.json 的 type 字段设置
            // build.lib.formats，lib 模式下的 formats 优先级高于
            // rollupOptions.output.format，因此必须在这里显式覆盖。
            // 主进程保持 ESM：workspace 包全部编译为 ESM，而 Electron 28
            // 内置 Node 18 不支持 require(esm)，改成 CJS 反而无法加载它们。
            lib: {
              entry: 'src/main.ts',
              formats: ['es'],
              fileName: () => '[name].mjs',
            },
            rollupOptions: {
              external: externalBareImports,
              output: {
                format: 'es',
                entryFileNames: '[name].mjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      {
        // Preload script
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            // preload 只依赖 electron（CJS），不受 require(esm) 限制，
            // 输出为 CJS 最稳妥：Electron 对 preload 的 ESM 支持并不完整，
            // 而 .js 在 "type": "module" 的包里会被当作 ESM 解析。
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
            rollupOptions: {
              external: externalBareImports,
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    // 用数组形式以便支持正则精确匹配（对象形式的字符串 key 会做前缀匹配）
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src/renderer') },
      { find: '@main', replacement: path.resolve(__dirname, 'src/main') },
      { find: '@shared', replacement: path.resolve(__dirname, '../../packages/shared-types/src') },
      // pdfkit 没有 browser 字段，只有 main(node 版) / module(node 版 ESM)。
      // Vite 会优先取 module → js/pdfkit.es.js，它又把 jpeg-exif（lib/index.js 里
      // `var _fs = require('fs')`）、fontkit、zlib 等 Node 包一起拉进渲染进程产物，
      // 最终在 ESM chunk 里留下顶层 `require("fs")` / `require("stream")` /
      // `require("buffer")` 等调用。渲染进程是 ESM，没有 require，加载即抛
      // "ReferenceError: require is not defined" —— 渲染进程随之崩溃，表现就是「双击无反应」。
      // 这里强制指向官方浏览器构建：它是 browserify 自包含 bundle（2.6MB），
      // 里面的 require 是 browserify 内部局部变量，不依赖全局 require。
      {
        find: /^pdfkit$/,
        replacement: path.resolve(__dirname, 'node_modules/pdfkit/js/pdfkit.standalone.js'),
      },
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // Vite 5 默认 transformMixedEsModules=false：ESM 文件里混用的 require()
    // 不会被 commonjs 插件转换，会原样留在产物中（渲染进程里即为 ReferenceError）。
    // 打开后这些 require 会被转成 import，缺的 Node 内置模块在构建期就会报错暴露，
    // 而不是等到用户双击程序时才炸。
    commonjsOptions: {
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        splash: path.resolve(__dirname, 'splash.html'),
      },
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-cad': ['dagre', 'd3-force'],
          'vendor-export': ['jspdf', 'pdfkit', 'xlsx', 'handlebars'],
        },
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'lodash-es', 'idb'],
  },
});