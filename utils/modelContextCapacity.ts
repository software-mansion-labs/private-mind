const capacityByModelId = new Map<number, number>();

export const rememberModelContextCapacity = (
  modelId: number,
  tokens: number
): void => {
  if (Number.isInteger(tokens) && tokens > 0) {
    capacityByModelId.set(modelId, tokens);
  }
};

export const modelContextCapacity = (modelId: number): number | undefined =>
  capacityByModelId.get(modelId);

export const forgetModelContextCapacities = (): void => {
  capacityByModelId.clear();
};
