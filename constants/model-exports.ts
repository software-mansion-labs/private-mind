export const EXPORT_TAGS_THE_RUNNER_CANNOT_LOAD = [
  '/resolve/v0.8.0/',
  '/resolve/v0.9.0/',
];

export const runnerCanLoad = (source: string): boolean =>
  !EXPORT_TAGS_THE_RUNNER_CANNOT_LOAD.some((tag) => source.includes(tag));
