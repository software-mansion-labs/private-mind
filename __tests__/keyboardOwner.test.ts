import { useKeyboardOwnerStore } from '../store/keyboardOwnerStore';

const state = () => useKeyboardOwnerStore.getState();

beforeEach(() => state().setModalOwnsKeyboard(false));

describe('keyboard ownership', () => {
  it('starts with the screen owning the keyboard', () => {
    expect(state().modalOwnsKeyboard).toBe(false);
  });

  it('hands ownership to a modal and takes it back', () => {
    state().setModalOwnsKeyboard(true);
    expect(state().modalOwnsKeyboard).toBe(true);

    state().setModalOwnsKeyboard(false);
    expect(state().modalOwnsKeyboard).toBe(false);
  });
});
