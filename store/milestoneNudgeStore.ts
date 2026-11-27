import { create } from 'zustand';

interface MilestoneNudgeStore {
  milestonePages: number | null;
  showMilestone: (pages: number) => void;
  dismissMilestone: () => void;
}

export const useMilestoneNudgeStore = create<MilestoneNudgeStore>((set) => ({
  milestonePages: null,
  showMilestone: (pages) => set({ milestonePages: pages }),
  dismissMilestone: () => set({ milestonePages: null }),
}));
