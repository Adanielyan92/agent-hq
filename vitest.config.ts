import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { randomBytes } from 'crypto';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      TOKEN_ENCRYPTION_SECRET: Buffer.from(randomBytes(32)).toString('base64'),
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
