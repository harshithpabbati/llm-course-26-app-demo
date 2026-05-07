import type { Config } from 'drizzle-kit'

export default {
  // æ•°æ®åº“ç±»åž‹
  dialect: 'sqlite',

  // Schema æ–‡ä»¶ä½ç½®
  schema: './src/main/db/schema.ts',

  // è¿ç§»æ–‡ä»¶è¾“å‡ºç›®å½•
  out: './src/main/db/migrations',

  // å¼€å‘æ—¶æ•°æ®åº“æ–‡ä»¶è·¯å¾„ï¼ˆç”¨äºŽ drizzle-kit pushï¼‰
  // ç”Ÿäº§çŽ¯å¢ƒçš„è·¯å¾„åœ¨è¿è¡Œæ—¶ç”± Electron app.getPath('userData') å†³å®š
  dbCredentials: {
    url: './scout.db'
  }
} satisfies Config

