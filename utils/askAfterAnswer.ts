import { AppState } from 'react-native';
import {
  type FinishedAnswer,
  REVIEW_PROMPT_DELAY_MS,
  promptReviewAfterAnswer,
} from './reviewPrompt';

export const ANSWERS_BETWEEN_ASKS = 3;

let answersSinceLastAsk = ANSWERS_BETWEEN_ASKS;

export const noteAskedNow = () => {
  answersSinceLastAsk = 0;
};

const appIsInForeground = () => AppState.currentState === 'active';

export interface MilestoneAsk {
  reached: Promise<number | null>;
  show: (pages: number) => Promise<void>;
}

export async function askAfterAnswer(
  answer: FinishedAnswer,
  stillIdle: () => boolean,
  milestone: MilestoneAsk
): Promise<void> {
  answersSinceLastAsk += 1;
  if (answersSinceLastAsk < ANSWERS_BETWEEN_ASKS) return;

  if (await promptReviewAfterAnswer(answer, stillIdle)) {
    noteAskedNow();
    return;
  }
  if (answer.cannedReply) return;

  const pages = await milestone.reached;
  if (pages === null) return;
  await new Promise((resolve) => setTimeout(resolve, REVIEW_PROMPT_DELAY_MS));
  if (!stillIdle() || !appIsInForeground()) return;
  noteAskedNow();
  await milestone.show(pages);
}
