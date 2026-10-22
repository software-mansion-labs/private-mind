type ReviewPrompt = typeof import('../utils/reviewPrompt');
type StoreReviewModule = typeof import('expo-store-review');

const healthyAnswer = {
  stoppedByUser: false,
  tokensPerSecond: 20,
  cannedReply: false,
};

let storage: Record<string, string>;
let appState: string;
let StoreReview: StoreReviewModule;

const freshModule = (): ReviewPrompt => {
  jest.resetModules();
  const AsyncStorage = require('@react-native-async-storage/async-storage')
    .default as typeof import('@react-native-async-storage/async-storage').default;
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(storage[key] ?? null)
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    (key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }
  );
  const { AppState } = require('react-native') as typeof import('react-native');
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => appState,
  });
  StoreReview = require('expo-store-review');
  return require('../utils/reviewPrompt');
};

const setForeground = (state: string) => {
  appState = state;
};

const reachChatCount = async (review: ReviewPrompt, chats: number) => {
  storage.total_chats_created = String(chats - 1);
  await review.noteChatCreated();
};

const answerAndWait = async (
  review: ReviewPrompt,
  answer = healthyAnswer,
  stillIdle = () => true
) => {
  const prompted = review.promptReviewAfterAnswer(answer, stillIdle);
  await jest.advanceTimersByTimeAsync(review.REVIEW_PROMPT_DELAY_MS);
  await prompted;
};

beforeEach(() => {
  jest.useFakeTimers();
  storage = {};
  setForeground('active');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('asking for a review after an answer', () => {
  it('asks after a healthy answer once enough chats were created on a later launch', async () => {
    storage.app_launches = '1';
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 5);

    await answerAndWait(review);

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(storage.last_review_prompt_count).toBe('5');
  });

  it('never asks during the very first launch of the app', async () => {
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 5);

    await answerAndWait(review);

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(storage.last_review_prompt_count).toBeUndefined();
  });

  it('does not ask after a slow answer and keeps the review due for a healthy one', async () => {
    storage.app_launches = '3';
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 5);

    await answerAndWait(review, { ...healthyAnswer, tokensPerSecond: 0.2 });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    await answerAndWait(review);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask after an answer the user stopped or a canned reply', async () => {
    storage.app_launches = '3';
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 5);

    await answerAndWait(review, { ...healthyAnswer, stoppedByUser: true });
    await answerAndWait(review, { ...healthyAnswer, cannedReply: true });

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('holds the question when another answer starts or the app leaves during the pause', async () => {
    storage.app_launches = '3';
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 5);

    await answerAndWait(review, healthyAnswer, () => false);
    setForeground('background');
    await answerAndWait(review);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    setForeground('active');
    await answerAndWait(review);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('asks nothing before the fifth chat', async () => {
    storage.app_launches = '3';
    const review = freshModule();
    await review.noteAppLaunch();
    await reachChatCount(review, 4);

    await answerAndWait(review);

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
