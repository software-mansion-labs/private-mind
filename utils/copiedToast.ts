import Toast from 'react-native-toast-message';

export const showCopiedToast = () => {
  Toast.show({ type: 'defaultToast', text1: 'Message copied' });
};
