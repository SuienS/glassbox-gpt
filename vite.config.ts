/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/glassbox-gpt/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})