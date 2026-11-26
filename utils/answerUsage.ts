import type { SQLiteDatabase } from 'expo-sqlite';
import {
  type FinishedAnswerUsage,
  loadUsageTotals,
  markMilestoneShown,
  recordAnswerUsage,
} from '../database/usageStatsRepository';
import { useMilestoneNudgeStore } from '../store/milestoneNudgeStore';
import { type MilestoneAsk } from './askAfterAnswer';
import { milestoneToOffer, summarizeUsage } from './usageStats';

const countAnswer = async (
  db: SQLiteDatabase,
  answer: FinishedAnswerUsage
): Promise<number | null> => {
  try {
    await recordAnswerUsage(db, answer);
    const totals = await loadUsageTotals(db);
    return milestoneToOffer(
      summarizeUsage(totals).pages,
      totals.milestonePagesShown
    );
  } catch (error) {
    console.warn('Counting the answer failed:', error);
    return null;
  }
};

const showMilestone = async (db: SQLiteDatabase, pages: number) => {
  try {
    await markMilestoneShown(db, pages);
    useMilestoneNudgeStore.getState().showMilestone(pages);
  } catch (error) {
    console.warn('Showing the milestone failed:', error);
  }
};

export const countFinishedAnswer = (
  db: SQLiteDatabase,
  answer: FinishedAnswerUsage
): MilestoneAsk => ({
  reached: answer.tokens > 0 ? countAnswer(db, answer) : Promise.resolve(null),
  show: (pages) => showMilestone(db, pages),
});
