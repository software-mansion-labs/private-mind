import { create } from 'zustand';

export type NoticeVariant = 'info' | 'warning' | 'error';

export interface NoticeAction {
  label: string;
  onPress: () => void;
}

export interface AppNotice {
  id: string;
  variant: NoticeVariant;
  title: string;
  message?: string;
  dismissible?: boolean;
  action?: NoticeAction;
}

const SEVERITY: Record<NoticeVariant, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const bySeverity = (notices: AppNotice[]) =>
  [...notices].sort((a, b) => SEVERITY[a.variant] - SEVERITY[b.variant]);

interface NoticeStore {
  notices: AppNotice[];
  showNotice: (notice: AppNotice) => void;
  dismissNotice: (id: string) => void;
}

export const useNoticeStore = create<NoticeStore>((set) => ({
  notices: [],
  showNotice: (notice) =>
    set((state) => ({
      notices: [
        ...state.notices.filter((shown) => shown.id !== notice.id),
        notice,
      ],
    })),
  dismissNotice: (id) =>
    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== id),
    })),
}));
