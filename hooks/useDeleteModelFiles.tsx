import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { Model } from '../database/modelRepository';
import { useModelStore } from '../store/modelStore';
import { useConfirm } from './useConfirm';

export const useDeleteModelFiles = () => {
  const removeModelFiles = useModelStore((state) => state.removeModelFiles);
  const { confirm, ConfirmElement } = useConfirm();

  const deleteModelFiles = useCallback(
    async (model: Model) => {
      const confirmed = await confirm({
        title: 'Delete model files?',
        message: `${model.modelName} will be removed from your device. You can redownload it later.`,
        confirmLabel: 'Delete',
      });
      if (!confirmed) return false;

      await removeModelFiles(model.id);
      Toast.show({
        type: 'defaultToast',
        text1: `${model.modelName} has been successfully deleted`,
      });
      return true;
    },
    [confirm, removeModelFiles]
  );

  return { deleteModelFiles, ConfirmElement };
};
