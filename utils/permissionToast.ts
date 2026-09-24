import Toast from 'react-native-toast-message';

export const showPermissionToast = (text1: string) => {
  Toast.show({ type: 'defaultToast', text1, props: { settings: true } });
};
