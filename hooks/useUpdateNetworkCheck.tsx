import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { useConfirm } from './useConfirm';

export type UpdateNetwork = 'wifi' | 'mobile-data';

export const useUpdateNetworkCheck = () => {
  const { confirm, ConfirmElement } = useConfirm();

  const canDownload = async (sizeGB: number): Promise<UpdateNetwork | null> => {
    const network = await NetInfo.fetch();
    if (!network.isConnected) {
      Toast.show({ type: 'defaultToast', text1: MODEL_UPDATE_TEXT.offline });
      return null;
    }
    if (network.type === 'wifi') return 'wifi';
    const confirmed = await confirm({
      title: MODEL_UPDATE_TEXT.mobileDataTitle,
      message: MODEL_UPDATE_TEXT.mobileDataMessage(sizeGB),
      confirmLabel: MODEL_UPDATE_TEXT.mobileDataConfirm,
    });
    return confirmed ? 'mobile-data' : null;
  };

  return { canDownload, ConfirmElement };
};
