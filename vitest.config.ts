import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

const alias = { '@renderer': resolve('src/renderer/src') }

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'main',
          environment: 'node',
          include: ['tests/main/**/*.test.ts']
        }
      },
      {
        resolve: { alias },
        test: {
          name: 'markdown',
          environment: 'happy-dom',
          include: ['tests/markdown/**/*.test.ts']
        }
      }
    ]
  }
})
