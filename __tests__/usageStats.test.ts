import { estimatePromptTokens } from '../constants/context-window';
import {
  EMPTY_USAGE_TOTALS,
  PAGE_MILESTONES,
  TOKENS_PER_A4_PAGE,
  countWords,
  estimateBackfill,
  formatCount,
  formatPages,
  milestoneToOffer,
  pagesLabel,
  summarizeUsage,
  tokensToPages,
} from '../utils/usageStats';

describe('counting words in a stored answer', () => {
  it('counts whitespace-separated words and ignores bare markdown marks', () => {
    expect(countWords('## Steps\n\n- Boil the water.\n- Add **pasta** -')).toBe(
      6
    );
  });

  it('counts each CJK ideograph as a word, since the script uses no spaces', () => {
    expect(countWords('東京は大きい')).toBe(6);
    expect(countWords('Tokyo 東京')).toBe(3);
  });

  it('counts nothing in an empty answer', () => {
    expect(countWords('   \n')).toBe(0);
  });
});

describe('turning tokens into A4 pages', () => {
  it('fills one single-spaced A4 page with about 650 tokens', () => {
    expect(TOKENS_PER_A4_PAGE).toBe(650);
    expect(tokensToPages(650 * 412)).toBe(412);
  });

  it('shows tenths below ten pages and whole pages with thousands from there', () => {
    expect(formatPages(tokensToPages(1500))).toBe('2.3');
    expect(formatPages(3)).toBe('3');
    expect(formatPages(412.9)).toBe('412');
    expect(formatPages(12345.2)).toBe('12,345');
  });

  it('uses the singular for exactly one page', () => {
    expect(pagesLabel(1)).toBe('1 A4 page');
    expect(pagesLabel(2)).toBe('2 A4 pages');
  });

  it('groups thousands in counts', () => {
    expect(formatCount(267800)).toBe('267,800');
    expect(formatCount(38)).toBe('38');
  });
});

describe('estimating history from before the counter', () => {
  const answers = [
    {
      chatId: 1,
      content: 'Paris is the capital of France.',
      modelName: 'Qwen 2.5 0.5B',
      tokensPerSecond: 40,
    },
    {
      chatId: 1,
      content: 'It has about two million people. '.repeat(10),
      modelName: 'Qwen 2.5 0.5B',
      tokensPerSecond: 22,
    },
    {
      chatId: 2,
      content: 'A haiku about autumn leaves falling slowly on a quiet road.',
      modelName: 'LFM 2.5 VL 450M',
      tokensPerSecond: 18,
    },
    { chatId: 3, content: '', modelName: 'Qwen 2.5 0.5B', tokensPerSecond: 0 },
  ];

  it('estimates tokens with the per-script estimator and counts real words', () => {
    const backfill = estimateBackfill(answers);
    const expectedTokens = answers
      .filter((answer) => answer.content)
      .reduce((sum, answer) => sum + estimatePromptTokens(answer.content), 0);

    expect(backfill.tokens).toBe(expectedTokens);
    expect(backfill.words).toBe(6 + 60 + 11);
    expect(backfill.answers).toBe(3);
  });

  it('counts a chat once however many answers it holds and skips empty ones', () => {
    expect(estimateBackfill(answers).chats).toBe(2);
  });

  it('tallies answers per model', () => {
    const { models } = estimateBackfill(answers);
    expect(models['Qwen 2.5 0.5B'].answers).toBe(2);
    expect(models['LFM 2.5 VL 450M'].answers).toBe(1);
  });

  it('keeps the best speed only from answers long enough to measure it', () => {
    const backfill = estimateBackfill(answers);
    expect(backfill.bestTokensPerSecond).toBe(22);
    expect(backfill.bestTokensPerSecondModel).toBe('Qwen 2.5 0.5B');
  });
});

describe('marking the backfilled figure as approximate', () => {
  it('says "about" while the estimate is more than a tenth of the total', () => {
    const summary = summarizeUsage({
      ...EMPTY_USAGE_TOTALS,
      countedTokens: 800,
      estimatedTokens: 200,
    });
    expect(summary.tokens).toBe(1000);
    expect(summary.approximate).toBe(true);
  });

  it('drops "about" once counted tokens dominate', () => {
    const summary = summarizeUsage({
      ...EMPTY_USAGE_TOTALS,
      countedTokens: 9500,
      estimatedTokens: 500,
    });
    expect(summary.approximate).toBe(false);
  });

  it('is exact on a phone that had no history to estimate', () => {
    expect(
      summarizeUsage({ ...EMPTY_USAGE_TOTALS, countedTokens: 30 }).approximate
    ).toBe(false);
  });
});

describe('choosing a page milestone to celebrate', () => {
  it('celebrates 10, 100 and 1000 pages', () => {
    expect(PAGE_MILESTONES).toEqual([10, 100, 1000]);
  });

  it('offers nothing before the first milestone', () => {
    expect(milestoneToOffer(9.9, 0)).toBeNull();
  });

  it('offers a milestone once and never again after it was shown', () => {
    expect(milestoneToOffer(10.2, 0)).toBe(10);
    expect(milestoneToOffer(57, 10)).toBeNull();
  });

  it('offers only the highest milestone when several were crossed at once', () => {
    expect(milestoneToOffer(150, 0)).toBe(100);
    expect(milestoneToOffer(1200, 100)).toBe(1000);
    expect(milestoneToOffer(5000, 1000)).toBeNull();
  });
});
