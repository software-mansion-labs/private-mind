import type { SQLiteDatabase } from 'expo-sqlite';
import { EMPTY_USAGE_TOTALS, TOKENS_PER_A4_PAGE } from '../utils/usageStats';

const mockRecordAnswerUsage = jest.fn<Promise<void>, unknown[]>(async () => {});
const mockLoadUsageTotals = jest.fn<Promise<unknown>, unknown[]>();
const mockMarkMilestoneShown = jest.fn<Promise<void>, unknown[]>(
  async () => {}
);

jest.mock('../database/usageStatsRepository', () => ({
  recordAnswerUsage: (...args: unknown[]) => mockRecordAnswerUsage(...args),
  loadUsageTotals: (...args: unknown[]) => mockLoadUsageTotals(...args),
  markMilestoneShown: (...args: unknown[]) => mockMarkMilestoneShown(...args),
}));

import { countFinishedAnswer } from '../utils/answerUsage';
import { useMilestoneNudgeStore } from '../store/milestoneNudgeStore';

const db = {} as SQLiteDatabase;
const finished = {
  chatId: 3,
  messageId: 41,
  modelName: 'Qwen 2.5 0.5B',
  tokens: 180,
  words: 120,
  tokensPerSecond: 33,
};

beforeEach(() => {
  mockRecordAnswerUsage.mockClear();
  mockMarkMilestoneShown.mockClear();
  useMilestoneNudgeStore.setState({ milestonePages: null });
});

describe('counting a finished answer', () => {
  it('records the answer and reports a milestone it crossed', async () => {
    mockLoadUsageTotals.mockResolvedValue({
      ...EMPTY_USAGE_TOTALS,
      countedTokens: TOKENS_PER_A4_PAGE * 10,
    });

    const milestone = countFinishedAnswer(db, finished);

    expect(await milestone.reached).toBe(10);
    expect(mockRecordAnswerUsage).toHaveBeenCalledWith(db, finished);
  });

  it('reports no milestone already shown', async () => {
    mockLoadUsageTotals.mockResolvedValue({
      ...EMPTY_USAGE_TOTALS,
      countedTokens: TOKENS_PER_A4_PAGE * 12,
      milestonePagesShown: 10,
    });

    expect(await countFinishedAnswer(db, finished).reached).toBeNull();
  });

  it('records nothing for an answer the model did not generate', async () => {
    const milestone = countFinishedAnswer(db, { ...finished, tokens: 0 });

    expect(await milestone.reached).toBeNull();
    expect(mockRecordAnswerUsage).not.toHaveBeenCalled();
  });

  it('keeps the chat going when counting fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockRecordAnswerUsage.mockRejectedValueOnce(
      new Error('database is locked')
    );

    expect(await countFinishedAnswer(db, finished).reached).toBeNull();
  });

  it('remembers a milestone as shown before it opens the nudge', async () => {
    await countFinishedAnswer(db, finished).show(100);

    expect(mockMarkMilestoneShown).toHaveBeenCalledWith(db, 100);
    expect(useMilestoneNudgeStore.getState().milestonePages).toBe(100);
  });
});
