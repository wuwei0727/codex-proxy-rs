import type { Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import CodexProxyUI from '@codex-proxy/ui/vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { pluginBridge } from './build/plugin-bridge.ts'

// 单条审计例外以依赖不进入运行产物为前提，后续依赖变化也必须守住该边界
const buildOnlyDependencyGuard: Plugin = {
  name: 'enforce-build-only-picomatch',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === 'chunk' && Object.keys(output.modules).some(id => /(?:^|[\\/])picomatch(?:[\\/]|$)/u.test(id)))
        this.error('picomatch must remain build-only while GHSA-fc5q-39xc-vjpf is excepted')
    }
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'CPR_WEB_BASE_PATH')
  const sourceUi = mode === 'source'
  const uiRoot = new URL('../modules/ui/', import.meta.url)

  return {
    base: env.CPR_WEB_BASE_PATH || '/',
    plugins: [
      buildOnlyDependencyGuard,
      vue(),
      VueI18n({
        include: fileURLToPath(new URL('./src/i18n/locales/**/*.json', import.meta.url)),
      }),
      tailwindcss(),
      CodexProxyUI({
        source: sourceUi ? uiRoot : undefined,
      }),
      pluginBridge(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/dev': {
          target: 'https://cpr.ranran0112.ccwu.cc',
          secure: false,
          changeOrigin: true,
          cookieDomainRewrite: '127.0.0.1',
          cookiePathRewrite: {
            '/api/auth': '/dev/api/auth',
            '/api': '/dev/api',
            '/': '/',
          },
          rewrite: path => path.replace(/^\/dev/, ''),
        },
      },
    },
    build: {
      outDir: sourceUi ? 'node_modules/.vite/source-dist' : 'dist',
      assetsDir: 'assets',
      license: { fileName: 'THIRD_PARTY_LICENSES.md' },
      chunkSizeWarningLimit: 600,
      rolldownOptions: {
        checks: {
          invalidAnnotation: false,
        },
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'echarts',
                test: /node_modules\/echarts/,
              },
              {
                name: 'zrender',
                test: /node_modules\/zrender/,
              },
            ],
          },
        },
      },
    },
  }
})
