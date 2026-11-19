import { create } from 'zustand';

interface PrivacySheetStore {
  openPrivacySheet: () => void;
}

export const closedPrivacySheet = () => {};

export const usePrivacySheetStore = create<PrivacySheetStore>(() => ({
  openPrivacySheet: closedPrivacySheet,
}));
