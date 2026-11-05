const models = (count: number) => (count === 1 ? 'model' : 'models');

export const MODEL_UPDATE_TEXT = {
  title: 'Your models need a one-time update',
  body: (count: number, sizeGB: number) =>
    `The new engine uses updated model files. Re-download ${count} ${models(count)} (${sizeGB.toFixed(1)} GB) to keep chatting.`,
  action: (count: number) => `Update ${count} ${models(count)}`,
  inProgress: (left: number) => `Updating… ${left} left`,
  retired: (modelName: string, replacement: string) =>
    `${modelName} is no longer supported and was removed. Its chats now use ${replacement}.`,
  badge: 'Update needed',
};
