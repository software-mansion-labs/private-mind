import Toast from 'react-native-toast-message';
import { showCopiedToast } from '../utils/copiedToast';

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

describe('showCopiedToast', () => {
  it('confirms the copy with the shared wording', () => {
    showCopiedToast();

    expect(Toast.show).toHaveBeenCalledWith({
      type: 'defaultToast',
      text1: 'Message copied',
    });
  });
});
