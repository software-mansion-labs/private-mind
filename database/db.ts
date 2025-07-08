import { type SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_MODELS } from '../constants/default-models';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { addModel } from './modelRepository';

const runMigrations = async (db: SQLiteDatabase) => {
  const tableInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(models)`
  );
  const hasFeatured = tableInfo.some((col) => col.name === 'featured');

  if (!hasFeatured) {
    await db.execAsync(
      `ALTER TABLE models ADD COLUMN featured INTEGER DEFAULT 0`
    );
  }

  const defaultModelNames = DEFAULT_MODELS.map((m) => m.modelName);
  const placeholders = defaultModelNames.map(() => '?').join(',');

  await db.runAsync(
    `
    DELETE FROM models
    WHERE source = 'built-in' AND modelName NOT IN (${placeholders})
    `,
    ...defaultModelNames
  );

  for (const model of DEFAULT_MODELS) {
    await db.runAsync(
      `UPDATE models SET featured = ? WHERE modelName = ?`,
      model.featured ? 1 : 0,
      model.modelName
    );
  }
};

export const initDatabase = async (db: SQLiteDatabase) => {
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modelName TEXT UNIQUE NOT NULL,
      modelSize INTEGER DEFAULT NULL,
      parameters INTEGER DEFAULT NULL,
      source TEXT,
      isDownloaded INTEGER DEFAULT 0,
      modelPath TEXT,
      tokenizerPath TEXT,
      tokenizerConfigPath TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lastUsed timestamp DEFAULT CURRENT_TIMESTAMP,
      modelId INTEGER,
      title TEXT DEFAULT '',
      FOREIGN KEY (modelId) REFERENCES models (id) ON DELETE SET NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modelName TEXT,
      timestamp timestamp DEFAULT CURRENT_TIMESTAMP,
      chatId INTEGER,
      role TEXT,
      content TEXT,
      tokensPerSecond INTEGER DEFAULT 0,
      timeToFirstToken INTEGER DEFAULT 0,
      FOREIGN KEY (chatId) REFERENCES chats (id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chatSettings (
      chatId INTEGER PRIMARY KEY NOT NULL,
      systemPrompt TEXT DEFAULT '',
      contextWindow INTEGER DEFAULT 10,
      FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS benchmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp timestamp DEFAULT CURRENT_TIMESTAMP,
      modelId INTEGER,
      modelName TEXT,
      totalTime INTEGER DEFAULT 0,
      timeToFirstToken INTEGER DEFAULT 0,
      tokensGenerated INTEGER DEFAULT 0,
      tokensPerSecond INTEGER DEFAULT 0,
      peakMemory INTEGER DEFAULT 0,
      FOREIGN KEY (modelId) REFERENCES models (id) ON DELETE SET NULL
    );
  `);

  // Run migration before inserting default models

  useChatStore.getState().setDB(db);
  useModelStore.getState().setDB(db);
  useLLMStore.getState().setDB(db);

  await db.withTransactionAsync(async () => {
    for (const model of DEFAULT_MODELS) {
      const {
        modelName,
        modelPath,
        tokenizerPath,
        tokenizerConfigPath,
        featured,
      } = model;

      await addModel(db, {
        modelName,
        source: 'built-in',
        isDownloaded: false,
        modelPath,
        tokenizerPath,
        tokenizerConfigPath,
        parameters: model.parameters,
        modelSize: model.modelSize,
        featured: !!featured,
      });
    }
  });

  await runMigrations(db);
};
