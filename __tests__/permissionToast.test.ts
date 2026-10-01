import Toast from 'react-native-toast-message';
import { showPermissionToast } from '../utils/permissionToast';

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

describe('showPermissionToast', () => {
  it('asks the toast for the action that reaches the setting', () => {
    showPermissionToast(
      'Microphone permission is required to record messages.'
    );

    expect(Toast.show).toHaveBeenCalledWith({
      type: 'defaultToast',
      text1: 'Microphone permission is required to record messages.',
      props: { settings: true },
    });
  });
});
