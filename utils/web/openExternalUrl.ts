import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { isHttpUrl } from './security/outboundFetch';

const UNOPENABLE_MESSAGE = 'This link cannot be opened.';

const refuse = (): void => {
  Toast.show({ type: 'defaultToast', text1: UNOPENABLE_MESSAGE });
};

export const openExternalUrl = (url: string | undefined): void => {
  if (!url || !isHttpUrl(url)) {
    refuse();
    return;
  }
  WebBrowser.openBrowserAsync(url).catch(refuse);
};
