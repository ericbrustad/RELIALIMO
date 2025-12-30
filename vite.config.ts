
import { defineConfig } from 'vite'
import history from 'connect-history-api-fallback'

export default defineConfig({
  server: {
    port: 3000,
    middleware: [history()] as any
  }
})