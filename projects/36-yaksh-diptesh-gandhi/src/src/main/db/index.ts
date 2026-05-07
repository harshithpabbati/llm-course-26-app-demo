import { app } from 'electron'
import { join } from 'path'
import { stat } from 'fs/promises'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as sqliteVec from 'sqlite-vec'
import * as schema from './schema'

let sqlite: Database.Database | null = null
let db: ReturnType<typeof drizzle> | null = null
let checkpointTimer: NodeJS.Timeout | null = null
let truncateTimer: NodeJS.Timeout | null = null
let isClosing = false // é˜²æ­¢é‡å¤å…³é—­

/**
 * åˆå§‹åŒ–æ•°æ®åº“è¿žæŽ¥
 * åœ¨ Electron ä¸»è¿›ç¨‹çš„ app.whenReady() ä¸­è°ƒç”¨
 */
export function initDatabase() {
  // æ•°æ®åº“æ–‡ä»¶å­˜æ”¾åœ¨ç”¨æˆ·æ•°æ®ç›®å½•
  const dbPath = join(app.getPath('userData'), 'scout.db')

  console.log('[Database] Initializing database at:', dbPath)

  try {
    // åˆ›å»º SQLite æ•°æ®åº“å®žä¾‹
    sqlite = new Database(dbPath)

    // åŠ è½½ sqlite-vec æ‰©å±•
    if (app.isPackaged) {
      // æ‰“åŒ…çŽ¯å¢ƒï¼šæ‰‹åŠ¨æž„å»ºåˆ° .asar.unpacked çš„è·¯å¾„
      const platform = process.platform
      const arch = process.arch

      // æ˜ å°„å¹³å°å’Œæž¶æž„åç§°
      const platformName = platform === 'win32' ? 'windows' : platform
      const packageName = `sqlite-vec-${platformName}-${arch}`
      const extension = platform === 'win32' ? 'dll' : platform === 'darwin' ? 'dylib' : 'so'

      // æž„å»ºåˆ°è§£åŒ…ç›®å½•çš„è·¯å¾„
      const vecPath = join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        packageName,
        `vec0.${extension}`
      )

      console.log('[Database] Loading sqlite-vec from:', vecPath)
      sqlite.loadExtension(vecPath)
    } else {
      // å¼€å‘çŽ¯å¢ƒï¼šä½¿ç”¨ sqlite-vec é»˜è®¤åŠ è½½
      sqliteVec.load(sqlite)
    }
    console.log('[Database] sqlite-vec extension loaded')

    // éªŒè¯ sqlite-vec ç‰ˆæœ¬
    const vecVersion = sqlite.prepare('SELECT vec_version() as version').get() as {
      version: string
    }
    console.log('[Database] sqlite-vec version:', vecVersion?.version)

    // å¯ç”¨ WAL æ¨¡å¼ä»¥æé«˜æ€§èƒ½
    sqlite.pragma('journal_mode = WAL')

    // ä¼˜åŒ– WAL é…ç½®
    sqlite.pragma('wal_autocheckpoint = 100') // æ¯ 100 é¡µè‡ªåŠ¨ checkpointï¼ˆé™ä½Žé»˜è®¤å€¼ï¼‰
    sqlite.pragma('synchronous = NORMAL') // WAL æ¨¡å¼æŽ¨èè®¾ç½®
    sqlite.pragma('busy_timeout = 5000') // 5 ç§’è¶…æ—¶ï¼Œé˜²æ­¢å¹¶å‘å†²çª

    // è®°å½•å½“å‰é…ç½®
    const journalMode = sqlite.pragma('journal_mode', { simple: true })
    const walCheckpoint = sqlite.pragma('wal_autocheckpoint', { simple: true })
    const syncMode = sqlite.pragma('synchronous', { simple: true })
    console.log('[Database] Configuration:', {
      journal_mode: journalMode,
      wal_autocheckpoint: walCheckpoint,
      synchronous: syncMode
    })

    // åˆ›å»º Drizzle å®žä¾‹
    db = drizzle(sqlite, { schema })

    // æ•°æ®åº“å®Œæ•´æ€§æ£€æŸ¥
    const integrityCheck = sqlite.pragma('integrity_check', { simple: true })
    if (integrityCheck !== 'ok') {
      console.error('[Database] Integrity check failed:', integrityCheck)
    } else {
      console.log('[Database] Integrity check passed')
    }

    // å¯åŠ¨å®šæœŸ checkpoint æœºåˆ¶
    startPeriodicCheckpoint(dbPath)

    console.log('[Database] Database initialized successfully')
    return db
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error)
    throw error
  }
}

/**
 * å¯åŠ¨å®šæœŸ checkpoint æœºåˆ¶
 */
function startPeriodicCheckpoint(dbPath: string) {
  const walPath = `${dbPath}-wal`

  // æ¯ 30 ç§’æ£€æŸ¥ WAL æ–‡ä»¶å¤§å°å¹¶æ‰§è¡Œ PASSIVE checkpoint
  checkpointTimer = setInterval(async () => {
    try {
      if (!sqlite || isClosing) return

      const stats = await stat(walPath).catch(() => null)
      if (stats && stats.size > 1024 * 1024) {
        // 1MB
        console.log(
          `[Database] WAL file size: ${(stats.size / 1024 / 1024).toFixed(2)}MB, executing PASSIVE checkpoint...`
        )
        const result = sqlite.pragma('wal_checkpoint(PASSIVE)')
        console.log('[Database] PASSIVE checkpoint result:', result)
      }
    } catch (error) {
      console.error('[Database] Error during periodic checkpoint:', error)
    }
  }, 30000) // 30 ç§’

  checkpointTimer.unref() // ä¸é˜»æ­¢è¿›ç¨‹é€€å‡º

  // æ¯ 5 åˆ†é’Ÿæ‰§è¡Œä¸€æ¬¡ TRUNCATE checkpointï¼Œæ¸…ç† WAL æ–‡ä»¶
  truncateTimer = setInterval(() => {
    try {
      if (!sqlite || isClosing) return

      console.log('[Database] Executing scheduled TRUNCATE checkpoint...')
      const result = sqlite.pragma('wal_checkpoint(TRUNCATE)')
      console.log('[Database] TRUNCATE checkpoint result:', result)
    } catch (error) {
      console.error('[Database] Error during truncate checkpoint:', error)
    }
  }, 300000) // 5 åˆ†é’Ÿ

  truncateTimer.unref()
}

/**
 * æ‰§è¡Œä¸»åŠ¨ checkpointï¼ˆä¾›å¤–éƒ¨è°ƒç”¨ï¼‰
 */
export function executeCheckpoint(mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE') {
  if (!sqlite) return

  try {
    console.log(`[Database] Executing ${mode} checkpoint...`)
    const result = sqlite.pragma(`wal_checkpoint(${mode})`)
    console.log(`[Database] ${mode} checkpoint result:`, result)
  } catch (error) {
    console.error(`[Database] Error executing ${mode} checkpoint:`, error)
  }
}

/**
 * è¿è¡Œæ•°æ®åº“è¿ç§»
 * åœ¨åˆå§‹åŒ–æ•°æ®åº“åŽç«‹å³è°ƒç”¨
 */
export function runMigrations() {
  if (!db) {
    throw new Error('[Database] Database not initialized. Call initDatabase() first.')
  }

  // __dirname åœ¨ç¼–è¯‘åŽæŒ‡å‘ out/mainï¼ˆæ‰€æœ‰ä»£ç æ‰“åŒ…åˆ° out/main/index.jsï¼‰
  // è€Œ migrations æ–‡ä»¶è¢«å¤åˆ¶åˆ° out/main/db/migrations
  const migrationsFolder = join(__dirname, 'db', 'migrations')
  console.log('[Database] Running migrations from:', migrationsFolder)

  try {
    migrate(db, { migrationsFolder })
    console.log('[Database] Migrations completed successfully')
  } catch (error) {
    console.error('[Database] Migration failed:', error)
    throw error
  }
}

/**
 * åˆå§‹åŒ–å‘é‡å­˜å‚¨è¡¨
 * åˆ›å»º sqlite-vec çš„ vec0 è™šæ‹Ÿè¡¨ç”¨äºŽå‘é‡æ£€ç´¢
 * åœ¨ runMigrations åŽè°ƒç”¨
 */
export function initVectorStore() {
  if (!sqlite) {
    throw new Error('[Database] Database not initialized. Call initDatabase() first.')
  }

  console.log('[Database] Initializing vector store...')

  try {
    // åˆ›å»ºå‘é‡ç´¢å¼•è™šæ‹Ÿè¡¨ï¼ˆå¦‚æžœä¸å­˜åœ¨ï¼‰
    // ä½¿ç”¨ cosine è·ç¦»åº¦é‡ï¼Œ1024 ç»´åº¦ï¼ˆBAAI/bge-m3 é»˜è®¤ç»´åº¦ï¼‰
    sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding_id TEXT PRIMARY KEY,
        chunk_id TEXT,
        notebook_id TEXT,
        embedding FLOAT[1024] distance_metric=cosine
      );
    `)

    console.log('[Database] Vector store initialized successfully')
  } catch (error) {
    console.error('[Database] Failed to initialize vector store:', error)
    throw error
  }
}

/**
 * èŽ·å–æ•°æ®åº“å®žä¾‹
 * åœ¨éœ€è¦æ‰§è¡Œæ•°æ®åº“æ“ä½œæ—¶è°ƒç”¨
 */
export function getDatabase() {
  if (!db) {
    throw new Error('[Database] Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * ä¼˜é›…å…³é—­æ•°æ®åº“è¿žæŽ¥
 * åœ¨ Electron app.on('before-quit') ä¸­è°ƒç”¨
 */
export function closeDatabase() {
  if (isClosing || !sqlite) {
    console.log('[Database] Database already closed or closing')
    return
  }

  isClosing = true
  console.log('[Database] Starting graceful database closure...')

  try {
    // æ¸…é™¤å®šæ—¶å™¨
    if (checkpointTimer) {
      clearInterval(checkpointTimer)
      checkpointTimer = null
    }
    if (truncateTimer) {
      clearInterval(truncateTimer)
      truncateTimer = null
    }

    // æ‰§è¡Œæœ€ç»ˆ checkpointï¼Œå¼ºåˆ¶åˆå¹¶æ‰€æœ‰ WAL æ•°æ®åˆ°ä¸»æ•°æ®åº“
    console.log('[Database] Executing final RESTART checkpoint before closing...')
    const checkpointResult = sqlite.pragma('wal_checkpoint(RESTART)')
    console.log('[Database] Final checkpoint result:', checkpointResult)

    // å…³é—­æ•°æ®åº“è¿žæŽ¥
    sqlite.close()
    console.log('[Database] Database connection closed successfully')

    sqlite = null
    db = null
  } catch (error) {
    console.error('[Database] Error during database closure:', error)
    // å³ä½¿å‡ºé”™ä¹Ÿè¦æ¸…ç†å¼•ç”¨
    sqlite = null
    db = null
  } finally {
    isClosing = false
  }
}

/**
 * èŽ·å–åŽŸå§‹ SQLite å®žä¾‹ï¼ˆç”¨äºŽ pragma ç­‰æ“ä½œï¼‰
 */
export function getSqlite() {
  return sqlite
}

// å¯¼å‡ºç±»åž‹ä¾›å…¶ä»–æ¨¡å—ä½¿ç”¨
export type Database = NonNullable<typeof db>

