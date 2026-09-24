import { create } from 'zustand';

interface KeyboardOwnerStore {
  modalOwnsKeyboard: boolean;
  setModalOwnsKeyboard: (owns: boolean) => void;
}

export const useKeyboardOwnerStore = create<KeyboardOwnerStore>((set) => ({
  modalOwnsKeyboard: false,
  setModalOwnsKeyboard: (modalOwnsKeyboard) => set({ modalOwnsKeyboard }),
}));
