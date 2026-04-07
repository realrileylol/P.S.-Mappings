import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const buildTime = Date.now().toString()

// Write version.json to public/ so the deployed site can be queried for it
function versionPlugin() {
  return {
    name: 'write-version',
    buildStart() {
      writeFileSync(
        resolve(__dirname, 'public/version.json'),
        JSON.stringify({ buildTime })
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  base: '/P.S.-Mappings/',
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
})
