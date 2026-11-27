import type { SQLiteDatabase } from 'expo-sqlite';
import {
  EMPTY_USAGE_TOTALS,
  MIN_TOKENS_FOR_SPEED_RECORD,
  type StoredAnswer,
  type UsageTotals,
  estimateBackfill,
} from '../utils/usageStats';

const USAGE_ROW_ID = 1;
const BACKFILL_BATCH_SIZE = 200;

export const migrateUsageStats = async (db: SQLiteDatabase): Promise<void> => {
  const existing = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('usageStats', 'modelUsage')`
  );
  const names = new Set(existing.map((row) => row.name));

  if (!names.has('modelUsage')) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS modelUsage (
        modelName TEXT PRIMARY KEY NOT NULL,
        answers INTEGER NOT NULL DEFAULT 0,
        tokens INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  if (names.has('usageStats')) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS usageStats (
      id INTEGER PRIMARY KEY NOT NULL,
      countedTokens INTEGER NOT NULL DEFAULT 0,
      countedWords INTEGER NOT NULL DEFAULT 0,
      countedAnswers INTEGER NOT NULL DEFAULT 0,
      estimatedTokens INTEGER NOT NULL DEFAULT 0,
      estimatedWords INTEGER NOT NULL DEFAULT 0,
      estimatedAnswers INTEGER NOT NULL DEFAULT 0,
      chats INTEGER NOT NULL DEFAULT 0,
      bestTokensPerSecond REAL NOT NULL DEFAULT 0,
      bestTokensPerSecondModel TEXT DEFAULT NULL,
      milestonePagesShown INTEGER NOT NULL DEFAULT 0,
      backfillThroughMessageId INTEGER DEFAULT NULL
    );
  `);
  const newest = await db.getFirstAsync<{ id: number | null }>(
    `SELECT MAX(id) AS id FROM messages`
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO usageStats (id, backfillThroughMessageId) VALUES (?, ?)`,
    USAGE_ROW_ID,
    newest?.id ?? null
  );
};

interface UsageRow {
  countedTokens: number;
  countedWords: number;
  countedAnswers: number;
  estimatedTokens: number;
  estimatedWords: number;
  estimatedAnswers: number;
  chats: number;
  bestTokensPerSecond: number;
  bestTokensPerSecondModel: string | null;
  milestonePagesShown: number;
  backfillThroughMessageId: number | null;
}

const readUsageRow = (db: SQLiteDatabase) =>
  db.getFirstAsync<UsageRow>(
    `SELECT * FROM usageStats WHERE id = ?`,
    USAGE_ROW_ID
  );

const readStoredAnswers = async (
  db: SQLiteDatabase,
  throughMessageId: number
): Promise<StoredAnswer[]> => {
  const answers: StoredAnswer[] = [];
  let afterId = 0;
  for (;;) {
    const batch = await db.getAllAsync<StoredAnswer & { id: number }>(
      `SELECT id, chatId, content, modelName, tokensPerSecond FROM messages
       WHERE role = 'assistant' AND id > ? AND id <= ?
       ORDER BY id ASC LIMIT ?`,
      afterId,
      throughMessageId,
      BACKFILL_BATCH_SIZE
    );
    answers.push(...batch);
    if (batch.length < BACKFILL_BATCH_SIZE) return answers;
    afterId = batch[batch.length - 1].id;
  }
};

const runBackfill = async (db: SQLiteDatabase): Promise<void> => {
  const row = await readUsageRow(db);
  const throughMessageId = row?.backfillThroughMessageId;
  if (throughMessageId === null || throughMessageId === undefined) return;

  const backfill = estimateBackfill(
    await readStoredAnswers(db, throughMessageId)
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE usageStats SET
         estimatedTokens = ?, estimatedWords = ?, estimatedAnswers = ?,
         chats = chats + ?, backfillThroughMessageId = NULL
       WHERE id = ? AND backfillThroughMessageId IS NOT NULL`,
      backfill.tokens,
      backfill.words,
      backfill.answers,
      backfill.chats,
      USAGE_ROW_ID
    );
    for (const [modelName, tally] of Object.entries(backfill.models)) {
      await addModelUsage(db, modelName, tally.answers, tally.tokens);
    }
    await raiseBestSpeed(
      db,
      backfill.bestTokensPerSecond,
      backfill.bestTokensPerSecondModel
    );
  });
};

let backfillInFlight: Promise<void> | null = null;

export const ensureUsageBackfilled = (db: SQLiteDatabase): Promise<void> => {
  if (!backfillInFlight) {
    backfillInFlight = runBackfill(db).catch((error) => {
      backfillInFlight = null;
      console.warn('Estimating earlier usage failed:', error);
    });
  }
  return backfillInFlight;
};

const addModelUsage = (
  db: SQLiteDatabase,
  modelName: string,
  answers: number,
  tokens: number
) =>
  db.runAsync(
    `INSERT INTO modelUsage (modelName, answers, tokens) VALUES (?, ?, ?)
     ON CONFLICT(modelName) DO UPDATE SET
       answers = answers + excluded.answers,
       tokens = tokens + excluded.tokens`,
    modelName,
    answers,
    tokens
  );

const raiseBestSpeed = async (
  db: SQLiteDatabase,
  tokensPerSecond: number,
  modelName: string | null
) => {
  if (!(tokensPerSecond > 0)) return;
  await db.runAsync(
    `UPDATE usageStats SET bestTokensPerSecond = ?, bestTokensPerSecondModel = ?
     WHERE id = ? AND bestTokensPerSecond < ?`,
    tokensPerSecond,
    modelName,
    USAGE_ROW_ID,
    tokensPerSecond
  );
};

export interface FinishedAnswerUsage {
  chatId: number;
  messageId: number;
  modelName: string;
  tokens: number;
  words: number;
  tokensPerSecond: number;
}

export const recordAnswerUsage = async (
  db: SQLiteDatabase,
  answer: FinishedAnswerUsage
): Promise<void> => {
  const earlier = await db.getFirstAsync<{ answers: number }>(
    `SELECT COUNT(*) AS answers FROM messages
     WHERE chatId = ? AND role = 'assistant' AND id < ?`,
    answer.chatId,
    answer.messageId
  );
  const opensChat = (earlier?.answers ?? 0) === 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE usageStats SET
         countedTokens = countedTokens + ?,
         countedWords = countedWords + ?,
         countedAnswers = countedAnswers + 1,
         chats = chats + ?
       WHERE id = ?`,
      answer.tokens,
      answer.words,
      opensChat ? 1 : 0,
      USAGE_ROW_ID
    );
    if (answer.modelName) {
      await addModelUsage(db, answer.modelName, 1, answer.tokens);
    }
    if (answer.tokens >= MIN_TOKENS_FOR_SPEED_RECORD) {
      await raiseBestSpeed(db, answer.tokensPerSecond, answer.modelName);
    }
  });
};

export const loadUsageTotals = async (
  db: SQLiteDatabase
): Promise<UsageTotals> => {
  await ensureUsageBackfilled(db);
  const row = await readUsageRow(db);
  if (!row) return EMPTY_USAGE_TOTALS;
  const favourite = await db.getFirstAsync<{ modelName: string }>(
    `SELECT modelName FROM modelUsage ORDER BY answers DESC, tokens DESC LIMIT 1`
  );
  return {
    countedTokens: row.countedTokens,
    countedWords: row.countedWords,
    countedAnswers: row.countedAnswers,
    estimatedTokens: row.estimatedTokens,
    estimatedWords: row.estimatedWords,
    estimatedAnswers: row.estimatedAnswers,
    chats: row.chats,
    bestTokensPerSecond: row.bestTokensPerSecond,
    bestTokensPerSecondModel: row.bestTokensPerSecondModel,
    mostUsedModel: favourite?.modelName ?? null,
    milestonePagesShown: row.milestonePagesShown,
  };
};

export const markMilestoneShown = (db: SQLiteDatabase, pages: number) =>
  db.runAsync(
    `UPDATE usageStats SET milestonePagesShown = ?
     WHERE id = ? AND milestonePagesShown < ?`,
    pages,
    USAGE_ROW_ID,
    pages
  );
