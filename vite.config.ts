import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createPublicAssetsPlugin = () => {
  const photoModuleId = 'virtual:photos'
  const musicModuleId = 'virtual:music'

  const buildModule = (folder: string, exportName: string, pattern: RegExp) => {
    const dir = path.resolve(__dirname, `public/${folder}`)
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((file) => pattern.test(file))
          .map((file) => `/${folder}/${encodeURIComponent(file)}`)
      : []

    return `export const ${exportName} = ${JSON.stringify(files)};`
  }

  return {
    name: 'expose-public-assets',
    resolveId(id: string) {
      if (id === photoModuleId || id === musicModuleId) return id
      return null
    },
    load(id: string) {
      if (id === photoModuleId)
        return buildModule('photos', 'photos', /\.(png|jpe?g|gif|webp|avif)$/i)
      if (id === musicModuleId)
        return buildModule('music', 'musicTracks', /\.(mp3|wav|ogg|m4a)$/i)
      return null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createPublicAssetsPlugin()],
})
