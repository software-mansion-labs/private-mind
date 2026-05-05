import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const TOTAL_CHATS_KEY = 'total_chats_created';
const LAST_PROMPT_KEY = 'last_review_prompt_count';

const FIRST_PROMPT_AT = 5;
const RE_PROMPT_INTERVAL = 20;

export function shouldPromptReview(
  totalChats: number,
  lastPromptedAt: number | null
): boolean {
  if (totalChats < FIRST_PROMPT_AT) return false;
  if (lastPromptedAt === null) return true;
  return totalChats - lastPromptedAt >= RE_PROMPT_INTERVAL;
}

export async function incrementChatCount(): Promise<number> {
  const current = await AsyncStorage.getItem(TOTAL_CHATS_KEY);
  const newCount = (current ? parseInt(current, 10) : 0) + 1;
  await AsyncStorage.setItem(TOTAL_CHATS_KEY, String(newCount));
  return newCount;
}

export async function maybePromptReview(): Promise<void> {
  try {
    const totalChats = await incrementChatCount();
    const lastPromptedRaw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    const lastPromptedAt = lastPromptedRaw
      ? parseInt(lastPromptedRaw, 10)
      : null;

    if (!shouldPromptReview(totalChats, lastPromptedAt)) return;

    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(totalChats));

    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
    }
  } catch (error) {
    // Silently fail — rating prompt is non-critical
    console.warn('Review prompt failed:', error);
  }
}
