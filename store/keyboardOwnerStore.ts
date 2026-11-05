import { create } from 'zustand';

interface KeyboardOwnerStore {
  modalOwnsKeyboard: boolean;
  drawerSearchOwnsKeyboard: boolean;
  setModalOwnsKeyboard: (owns: boolean) => void;
  setDrawerSearchOwnsKeyboard: (owns: boolean) => void;
}

export const useKeyboardOwnerStore = create<KeyboardOwnerStore>((set) => ({
  modalOwnsKeyboard: false,
  drawerSearchOwnsKeyboard: false,
  setModalOwnsKeyboard: (modalOwnsKeyboard) => set({ modalOwnsKeyboard }),
  setDrawerSearchOwnsKeyboard: (drawerSearchOwnsKeyboard) =>
    set({ drawerSearchOwnsKeyboard }),
}));

export const selectKeyboardOwnedElsewhere = (state: KeyboardOwnerStore) =>
  state.modalOwnsKeyboard || state.drawerSearchOwnsKeyboard;
