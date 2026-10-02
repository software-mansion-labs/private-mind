export const availableModelName = (
  wanted: string,
  takenNames: string[]
): string => {
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  let suffix = 2;
  while (taken.has(`${wanted} ${suffix}`.toLowerCase())) suffix += 1;
  return `${wanted} ${suffix}`;
};
