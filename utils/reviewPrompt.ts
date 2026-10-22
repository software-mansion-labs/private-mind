import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as StoreReview from 'expo-store-review';

const TOTAL_CHATS_KEY = 'total_chats_created';
const LAST_PROMPT_KEY = 'last_review_prompt_count';
const APP_LAUNCHES_KEY = 'app_launches';

const FIRST_PROMPT_AT = 5;
const RE_PROMPT_INTERVAL = 20;
const FIRST_LAUNCH_ELIGIBLE_FOR_REVIEW = 2;
export const MIN_REVIEW_TOKENS_PER_SECOND = 5;
export const REVIEW_PROMPT_DELAY_MS = 1500;

export function shouldPromptReview(
  totalChats: number,
  lastPromptedAt: number | null
): boolean {
  if (totalChats < FIRST_PROMPT_AT) return false;
  if (lastPromptedAt === null) return true;
  return totalChats - lastPromptedAt >= RE_PROMPT_INTERVAL;
}

export interface FinishedAnswer {
  stoppedByUser: boolean;
  tokensPerSecond: number | undefined;
  cannedReply: boolean;
}

export function answerEarnsReviewPrompt(
  answer: FinishedAnswer,
  launchNumber: number
): boolean {
  if (launchNumber < FIRST_LAUNCH_ELIGIBLE_FOR_REVIEW) return false;
  if (answer.stoppedByUser || answer.cannedReply) return false;
  return (answer.tokensPerSecond ?? 0) >= MIN_REVIEW_TOKENS_PER_SECOND;
}

export async function incrementChatCount(): Promise<number> {
  const current = await AsyncStorage.getItem(TOTAL_CHATS_KEY);
  const newCount = (current ? parseInt(current, 10) : 0) + 1;
  await AsyncStorage.setItem(TOTAL_CHATS_KEY, String(newCount));
  return newCount;
}

let launchNumber = 0;
let dueAtChatCount: number | null = null;

export async function noteAppLaunch(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(APP_LAUNCHES_KEY);
    launchNumber = (current ? parseInt(current, 10) : 0) + 1;
    await AsyncStorage.setItem(APP_LAUNCHES_KEY, String(launchNumber));
  } catch (error) {
    console.warn('Counting app launches failed:', error);
  }
}

export async function noteChatCreated(): Promise<void> {
  try {
    const totalChats = await incrementChatCount();
    const lastPromptedRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    const lastPromptedAt = lastPromptedRaw
      ? parseInt(lastPromptedRaw, 10)
      : null;
    if (shouldPromptReview(totalChats, lastPromptedAt)) {
      dueAtChatCount = totalChats;
    }
  } catch (error) {
    console.warn('Review prompt failed:', error);
  }
}

const appIsInForeground = () => AppState.currentState === 'active';

export async function promptReviewAfterAnswer(
  answer: FinishedAnswer,
  stillIdle: () => boolean
): Promise<void> {
  const chatCount = dueAtChatCount;
  if (chatCount === null || !answerEarnsReviewPrompt(answer, launchNumber)) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, REVIEW_PROMPT_DELAY_MS));
  if (dueAtChatCount !== chatCount || !stillIdle() || !appIsInForeground()) {
    return;
  }
  dueAtChatCount = null;
  try {
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(chatCount));
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch (error) {
    console.warn('Review prompt failed:', error);
  }
}
