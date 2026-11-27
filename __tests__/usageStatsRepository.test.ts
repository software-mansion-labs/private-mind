import type { SQLiteDatabase } from 'expo-sqlite';

type Repository = typeof import('../database/usageStatsRepository');

interface StoredMessage {
  id: number;
  chatId: number;
  role: string;
  content: string;
  modelName: string;
  tokensPerSecond: number;
}

type UsageRow = Record<string, number | string | null>;

class FakeUsageDb {
  tables = new Set<string>();
  messages: StoredMessage[] = [];
  usage: UsageRow | null = null;
  modelUsage = new Map<string, { answers: number; tokens: number }>();

  addMessage(message: Omit<StoredMessage, 'id'>) {
    const id = this.messages.length + 1;
    this.messages.push({ id, ...message });
    return id;
  }

  getAllAsync = async (sql: string, ...params: number[]) => {
    if (sql.includes('sqlite_master')) {
      return [...this.tables].map((name) => ({ name }));
    }
    const [afterId, throughId, limit] = params;
    return this.messages
      .filter(
        (m) => m.role === 'assistant' && m.id > afterId && m.id <= throughId
      )
      .slice(0, limit);
  };

  getFirstAsync = async (sql: string, ...params: number[]) => {
    if (sql.includes('MAX(id)')) {
      return { id: this.messages.length ? this.messages.length : null };
    }
    if (sql.includes('FROM usageStats')) return this.usage;
    if (sql.includes('COUNT(*)')) {
      const [chatId, messageId] = params;
      return {
        answers: this.messages.filter(
          (m) =>
            m.chatId === chatId && m.role === 'assistant' && m.id < messageId
        ).length,
      };
    }
    if (sql.includes('FROM modelUsage')) {
      const [top] = [...this.modelUsage.entries()].sort(
        (a, b) => b[1].answers - a[1].answers || b[1].tokens - a[1].tokens
      );
      return top ? { modelName: top[0] } : null;
    }
    return null;
  };

  execAsync = async (sql: string) => {
    const created = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql);
    if (created) this.tables.add(created[1]);
  };

  runAsync = async (sql: string, ...params: (number | string | null)[]) => {
    const row = this.usage as UsageRow;
    if (sql.startsWith('INSERT OR IGNORE INTO usageStats')) {
      this.usage ??= {
        countedTokens: 0,
        countedWords: 0,
        countedAnswers: 0,
        estimatedTokens: 0,
        estimatedWords: 0,
        estimatedAnswers: 0,
        chats: 0,
        bestTokensPerSecond: 0,
        bestTokensPerSecondModel: null,
        milestonePagesShown: 0,
        backfillThroughMessageId: params[1],
      };
    } else if (sql.includes('estimatedTokens = ?')) {
      if (row.backfillThroughMessageId === null) return;
      const [tokens, words, answers, chats] = params as number[];
      Object.assign(row, {
        estimatedTokens: tokens,
        estimatedWords: words,
        estimatedAnswers: answers,
        chats: (row.chats as number) + chats,
        backfillThroughMessageId: null,
      });
    } else if (sql.includes('countedTokens = countedTokens + ?')) {
      const [tokens, words, opensChat] = params as number[];
      Object.assign(row, {
        countedTokens: (row.countedTokens as number) + tokens,
        countedWords: (row.countedWords as number) + words,
        countedAnswers: (row.countedAnswers as number) + 1,
        chats: (row.chats as number) + opensChat,
      });
    } else if (sql.startsWith('INSERT INTO modelUsage')) {
      const [name, answers, tokens] = params as [string, number, number];
      const tally = this.modelUsage.get(name) ?? { answers: 0, tokens: 0 };
      this.modelUsage.set(name, {
        answers: tally.answers + answers,
        tokens: tally.tokens + tokens,
      });
    } else if (sql.includes('SET bestTokensPerSecond')) {
      const [speed, model] = params;
      if ((row.bestTokensPerSecond as number) < (speed as number)) {
        Object.assign(row, {
          bestTokensPerSecond: speed,
          bestTokensPerSecondModel: model,
        });
      }
    } else if (sql.includes('SET milestonePagesShown')) {
      const [pages] = params as number[];
      if ((row.milestonePagesShown as number) < pages) {
        row.milestonePagesShown = pages;
      }
    }
  };

  withTransactionAsync = async (fn: () => Promise<void>) => fn();

  asDb() {
    return this as unknown as SQLiteDatabase;
  }
}

const freshRepository = (): Repository => {
  jest.resetModules();
  return require('../database/usageStatsRepository');
};

const answer = (
  chatId: number,
  content: string,
  modelName = 'Qwen 2.5 0.5B'
) => ({
  chatId,
  role: 'assistant',
  content,
  modelName,
  tokensPerSecond: 30,
});

describe('the usage counter on a phone that already has chats', () => {
  it('estimates the stored history once and keeps it apart from the exact counter', async () => {
    const repo = freshRepository();
    const db = new FakeUsageDb();
    db.addMessage({ ...answer(1, 'hi'), role: 'user' });
    db.addMessage(answer(1, 'Hello there, how can I help you today?'));
    db.addMessage(answer(2, 'Another older answer.'));

    await repo.migrateUsageStats(db.asDb());
    expect(db.usage?.backfillThroughMessageId).toBe(3);

    const newId = db.addMessage(answer(2, 'A new answer after the update.'));
    await repo.recordAnswerUsage(db.asDb(), {
      chatId: 2,
      messageId: newId,
      modelName: 'Qwen 2.5 0.5B',
      tokens: 120,
      words: 6,
      tokensPerSecond: 31,
    });

    const totals = await repo.loadUsageTotals(db.asDb());
    expect(totals.countedTokens).toBe(120);
    expect(totals.countedAnswers).toBe(1);
    expect(totals.estimatedAnswers).toBe(2);
    expect(totals.estimatedTokens).toBeGreaterThan(0);
    expect(totals.chats).toBe(2);
    expect(db.usage?.backfillThroughMessageId).toBeNull();

    const again = await freshRepository().loadUsageTotals(db.asDb());
    expect(again.estimatedAnswers).toBe(2);
  });

  it('leaves an existing counter alone when the migration runs again', async () => {
    const repo = freshRepository();
    const db = new FakeUsageDb();
    await repo.migrateUsageStats(db.asDb());
    db.usage!.countedTokens = 999;

    await repo.migrateUsageStats(db.asDb());

    expect(db.usage!.countedTokens).toBe(999);
  });
});

describe('counting a finished answer', () => {
  it('adds the real token count and opens a chat only on its first answer', async () => {
    const repo = freshRepository();
    const db = new FakeUsageDb();
    await repo.migrateUsageStats(db.asDb());

    const first = db.addMessage(answer(7, 'First answer.'));
    await repo.recordAnswerUsage(db.asDb(), {
      chatId: 7,
      messageId: first,
      modelName: 'LFM 2.5 VL 450M',
      tokens: 40,
      words: 2,
      tokensPerSecond: 55,
    });
    const second = db.addMessage(answer(7, 'Second answer.'));
    await repo.recordAnswerUsage(db.asDb(), {
      chatId: 7,
      messageId: second,
      modelName: 'LFM 2.5 VL 450M',
      tokens: 60,
      words: 2,
      tokensPerSecond: 20,
    });

    const totals = await repo.loadUsageTotals(db.asDb());
    expect(totals.countedTokens).toBe(100);
    expect(totals.countedAnswers).toBe(2);
    expect(totals.chats).toBe(1);
    expect(totals.mostUsedModel).toBe('LFM 2.5 VL 450M');
    expect(totals.bestTokensPerSecond).toBe(55);
  });

  it('does not take a speed record from an answer too short to measure', async () => {
    const repo = freshRepository();
    const db = new FakeUsageDb();
    await repo.migrateUsageStats(db.asDb());
    const id = db.addMessage(answer(1, 'Yes.'));

    await repo.recordAnswerUsage(db.asDb(), {
      chatId: 1,
      messageId: id,
      modelName: 'Qwen 2.5 0.5B',
      tokens: 3,
      words: 1,
      tokensPerSecond: 400,
    });

    expect((await repo.loadUsageTotals(db.asDb())).bestTokensPerSecond).toBe(0);
  });
});

describe('remembering a shown milestone', () => {
  it('never lowers the milestone already shown', async () => {
    const repo = freshRepository();
    const db = new FakeUsageDb();
    await repo.migrateUsageStats(db.asDb());

    await repo.markMilestoneShown(db.asDb(), 100);
    await repo.markMilestoneShown(db.asDb(), 10);

    expect((await repo.loadUsageTotals(db.asDb())).milestonePagesShown).toBe(
      100
    );
  });
});
