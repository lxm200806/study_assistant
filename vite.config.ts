import { cpSync, createReadStream, existsSync, rmSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const API_PORT = process.env.API_PORT || '3005'
const ATLAS_DIR = resolve(process.cwd(), 'assets/atlas')
const ATLAS_URL_PREFIX = '/static/atlas/'

function mimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.webp':
      return 'image/webp'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.svg':
      return 'image/svg+xml'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    default:
      return 'application/octet-stream'
  }
}

/**
 * 图鉴资源不放在 src/static，避免被小程序/App 打进代码包：
 * - H5 dev：由 Vite 中间件从 assets/atlas 提供 /static/atlas/*
 * - H5 build：把 assets/atlas 拷到 dist/build/h5/static/atlas
 * - mp/App：不拷贝，客户端通过 VITE_ASSET_BASE 从 CDN/OSS 加载
 */
function atlasAssetsPlugin(options: {
  copyToH5: boolean
  remoteBaseConfigured: boolean
}): Plugin {
  let outDir = ''
  let warnedMissingBase = false

  return {
    name: 'study-assistant-atlas-assets',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (!pathname.startsWith(ATLAS_URL_PREFIX)) {
          next()
          return
        }

        let relative = ''
        try {
          relative = decodeURIComponent(pathname.slice(ATLAS_URL_PREFIX.length))
        } catch {
          res.statusCode = 400
          res.end('Bad request')
          return
        }

        const filePath = resolve(ATLAS_DIR, relative)
        if (
          !filePath.startsWith(ATLAS_DIR + sep) ||
          !existsSync(filePath) ||
          !statSync(filePath).isFile()
        ) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        res.setHeader('Content-Type', mimeType(filePath))
        res.setHeader('Cache-Control', 'public, max-age=604800')
        const stream = createReadStream(filePath)
        stream.on('error', () => {
          if (!res.headersSent) res.statusCode = 500
          res.end()
        })
        stream.pipe(res)
      })
    },
    closeBundle() {
      const normalized = outDir.replace(/\\/g, '/')
      const isH5 = normalized.endsWith('/build/h5')

      if (isH5) {
        if (!options.copyToH5) return
        const dest = resolve(outDir, 'static/atlas')
        rmSync(dest, { recursive: true, force: true })
        cpSync(ATLAS_DIR, dest, { recursive: true })
        console.log(`[atlas] copied to ${dest}`)
        return
      }

      if (!options.remoteBaseConfigured && !warnedMissingBase) {
        warnedMissingBase = true
        console.warn(
          '[atlas] VITE_ASSET_BASE is not set; atlas images will fall back to placeholders on this platform'
        )
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const remoteBaseConfigured = Boolean((env.VITE_ASSET_BASE || '').trim())

  return {
    plugins: [uni(), atlasAssetsPlugin({ copyToH5: !remoteBaseConfigured, remoteBaseConfigured })],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // 预编译页面，避免首次进入 tab 时动态 import 超时（WSL 下常见）
      warmup: {
        clientFiles: ['./src/App.vue', './src/pages/**/*.vue']
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${API_PORT}`,
          changeOrigin: true
        }
      },
      // WSL2 + Windows 浏览器：HMR 与页面使用同一 host:port
      hmr: {
        clientPort: 5173
      },
      watch: {
        usePolling: true
      }
    }
  }
})
