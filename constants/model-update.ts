const models = (count: number) => (count === 1 ? 'model' : 'models');

export const MODEL_UPDATE_TEXT = {
  title: 'Update your models to continue',
  body: (count: number, sizeGB: number) =>
    `This version runs on a new engine that needs updated model files. Download ${count} ${models(count)} (${sizeGB.toFixed(1)} GB) once to keep chatting. Your chats stay as they are.`,
  action: (count: number) => `Update ${count} ${models(count)}`,
  offline: "You're offline. Connect to the internet to update your models.",
  mobileDataTitle: 'No Wi-Fi connection',
  mobileDataMessage: (sizeGB: number) =>
    `This update downloads ${sizeGB.toFixed(1)} GB over mobile data, which may cost extra. Connect to Wi-Fi to avoid it.`,
  mobileDataConfirm: 'Update anyway',
  later: 'Not now',
  chatBanner: (modelName: string) =>
    `${modelName} needs a one-time update to run on the new engine.`,
  chatBannerAction: 'Update',
  newerVersionBanner: (modelName: string) =>
    `A newer version of ${modelName} is available.`,
  replacementBanner: (removed: string, replacement: string) =>
    `${removed} was removed. Download ${replacement} to keep this chat going.`,
  replacementBannerAction: 'Download',
  retired: (modelName: string, replacement: string) =>
    `${modelName} is no longer supported and was removed. Its chats now use ${replacement}.`,
  badge: 'Update needed',
  optionalBadge: 'Update available',
};
