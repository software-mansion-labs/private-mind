type Coordinator = typeof import('../utils/askAfterAnswer');
type ReviewPrompt = typeof import('../utils/reviewPrompt');

const healthyAnswer = {
  stoppedByUser: false,
  tokensPerSecond: 20,
  cannedReply: false,
};

let storage: Record<string, string>;
let appState: string;
let coordinator: Coordinator;
let review: ReviewPrompt;
let requestReview: jest.Mock;

const loadModules = () => {
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
  const StoreReview = require('expo-store-review');
  requestReview = StoreReview.requestReview as jest.Mock;
  requestReview.mockClear();
  (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  review = require('../utils/reviewPrompt');
  coordinator = require('../utils/askAfterAnswer');
};

const milestoneAt = (pages: number | null) => {
  const show = jest.fn(async () => {});
  return { reached: Promise.resolve(pages), show };
};

const finishAnswer = async (
  milestone: ReturnType<typeof milestoneAt>,
  answer = healthyAnswer,
  stillIdle = () => true
) => {
  const asked = coordinator.askAfterAnswer(answer, stillIdle, milestone);
  await jest.advanceTimersByTimeAsync(review.REVIEW_PROMPT_DELAY_MS * 2);
  await asked;
};

const makeReviewDue = async () => {
  await review.noteAppLaunch();
  await review.noteAppLaunch();
  storage.total_chats_created = '4';
  await review.noteChatCreated();
};

beforeEach(() => {
  jest.useFakeTimers();
  storage = {};
  appState = 'active';
  loadModules();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('asking after an answer', () => {
  it('shows a reached milestone once the answer has settled', async () => {
    const milestone = milestoneAt(10);

    await finishAnswer(milestone);

    expect(milestone.show).toHaveBeenCalledWith(10);
  });

  it('shows nothing when no milestone was reached', async () => {
    const milestone = milestoneAt(null);

    await finishAnswer(milestone);

    expect(milestone.show).not.toHaveBeenCalled();
  });

  it('does not interrupt a new generation that started meanwhile', async () => {
    const milestone = milestoneAt(100);

    await finishAnswer(milestone, healthyAnswer, () => false);

    expect(milestone.show).not.toHaveBeenCalled();
  });

  it('skips the canned welcome', async () => {
    const milestone = milestoneAt(10);

    await finishAnswer(milestone, { ...healthyAnswer, cannedReply: true });

    expect(milestone.show).not.toHaveBeenCalled();
  });

  it('lets a due review prompt go first and holds the milestone back', async () => {
    await makeReviewDue();
    const milestone = milestoneAt(10);

    await finishAnswer(milestone);

    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(milestone.show).not.toHaveBeenCalled();
  });

  it('waits a few answers after any ask so the user is not asked twice in a row', async () => {
    await finishAnswer(milestoneAt(10));

    const tooSoon = milestoneAt(100);
    for (let answer = 1; answer < coordinator.ANSWERS_BETWEEN_ASKS; answer++) {
      await finishAnswer(tooSoon);
    }
    expect(tooSoon.show).not.toHaveBeenCalled();

    const later = milestoneAt(100);
    await finishAnswer(later);
    expect(later.show).toHaveBeenCalledWith(100);
  });

  it('holds back the review prompt right after a milestone', async () => {
    await finishAnswer(milestoneAt(10));
    await makeReviewDue();

    await finishAnswer(milestoneAt(null));

    expect(requestReview).not.toHaveBeenCalled();
  });
});

describe('rating the app from a button', () => {
  it('opens the store listing and counts as the review ask', async () => {
    const { Linking, Platform } =
      require('react-native') as typeof import('react-native');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await makeReviewDue();
    const { rateApp, storeReviewUrl } =
      require('../utils/rateApp') as typeof import('../utils/rateApp');

    await rateApp();
    await finishAnswer(milestoneAt(null));

    expect(openURL).toHaveBeenCalledWith(storeReviewUrl(Platform.OS));
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('sends iPhone users to the review page and Android users to Google Play', () => {
    const { storeReviewUrl } =
      require('../utils/rateApp') as typeof import('../utils/rateApp');

    expect(storeReviewUrl('ios')).toBe(
      'https://apps.apple.com/app/private-mind/id6746713439?action=write-review'
    );
    expect(storeReviewUrl('android')).toBe(
      'https://play.google.com/store/apps/details?id=com.swmansion.privatemind'
    );
  });
});
