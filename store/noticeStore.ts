import { create } from 'zustand';

export interface AppNotice {
  id: string;
  title: string;
  message?: string;
}

interface NoticeStore {
  notices: AppNotice[];
  showNotice: (notice: AppNotice) => void;
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
}));
