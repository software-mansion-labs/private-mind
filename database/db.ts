import { type SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_MODELS } from '../constants/default-models';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { addModel } from './modelRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSourceStore } from '../store/sourceStore';

const runMigrations = async (db: SQLiteDatabase) => {
  const modelsTableInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(models)`
  );
  const hasFeatured = modelsTableInfo.some((col) => col.name === 'featured');
  const hasThinking = modelsTableInfo.some((col) => col.name === 'thinking');

  if (!hasFeatured) {
    await db.execAsync(
      `ALTER TABLE models ADD COLUMN featured INTEGER DEFAULT 0`
    );
  }

  if (!hasThinking) {
    await db.execAsync(
      `ALTER TABLE models ADD COLUMN thinking INTEGER DEFAULT 0`
    );
  }

  // Check and add thinkingEnabled to chatSettings
  const chatSettingsTableInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(chatSettings)`
  );
  const hasThinkingEnabled = chatSettingsTableInfo.some(
    (col) => col.name === 'thinkingEnabled'
  );

  if (!hasThinkingEnabled) {
    await db.execAsync(
      `ALTER TABLE chatSettings ADD COLUMN thinkingEnabled INTEGER DEFAULT NULL`
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
      `UPDATE models SET featured = ?, thinking = ? WHERE modelName = ?`,
      model.featured ? 1 : 0,
      model.thinking ? 1 : 0,
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
      tokenizerConfigPath TEXT,
      thinking INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0
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
      thinkingEnabled INTEGER DEFAULT NULL,
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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      size INTEGER,
      type TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chatSources (
      chatId INTEGER NOT NULL,
      sourceId INTEGER NOT NULL,
      PRIMARY KEY (chatId, sourceId),
      FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY(sourceId) REFERENCES sources(id) ON DELETE CASCADE
    );
  `);

  // Run migration before inserting default models

  useChatStore.getState().setDB(db);
  useModelStore.getState().setDB(db);
  useLLMStore.getState().setDB(db);
  useSourceStore.getState().setDB(db);

  const defaultSettings = await AsyncStorage.getItem('default_chat_settings');
  if (!defaultSettings) {
    await AsyncStorage.setItem(
      'default_chat_settings',
      JSON.stringify({
        systemPrompt:
          'You are a knowledgeable and helpful assistant. Provide clear, accurate, and well-structured responses. When given context from documents, use that information to give comprehensive answers while being concise and relevant.',
        contextWindow: 6,
      })
    );
  }

  await db.withTransactionAsync(async () => {
    for (const model of DEFAULT_MODELS) {
      const {
        modelName,
        modelPath,
        tokenizerPath,
        tokenizerConfigPath,
        featured,
        thinking,
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
        thinking: !!thinking,
      });
    }
  });

  await runMigrations(db);
};
