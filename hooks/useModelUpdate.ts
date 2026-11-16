import { type Model } from '../database/modelRepository';
import { useModelStore } from '../store/modelStore';
import { Feedback } from '../utils/Feedback';
import { useUpdateNetworkCheck } from './useUpdateNetworkCheck';

export const useModelUpdate = () => {
  const updateOutdatedModel = useModelStore(
    (state) => state.updateOutdatedModel
  );
  const downloadModel = useModelStore((state) => state.downloadModel);
  const rememberUpdateConsent = useModelStore(
    (state) => state.rememberUpdateConsent
  );
  const { canDownload, ConfirmElement } = useUpdateNetworkCheck();

  const startWithConsent = async (
    model: Model,
    start: (model: Model) => Promise<void>
  ) => {
    const network = await canDownload(model.modelSize ?? 0);
    if (!network) return;
    await rememberUpdateConsent([model.modelName], network === 'mobile-data');
    Feedback.downloadStart();
    await start(model);
  };

  const updateModel = (model: Model) =>
    startWithConsent(model, updateOutdatedModel);

  const downloadReplacement = (model: Model) =>
    startWithConsent(model, downloadModel);

  return { updateModel, downloadReplacement, ConfirmElement };
};
