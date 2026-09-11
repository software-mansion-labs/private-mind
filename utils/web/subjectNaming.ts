import { foldForMatching } from '../queryTerms';

const TOKEN = /[\p{L}\p{N}'’-]+/gu;
const NAME_PART = /^[\p{Lu}\p{Lt}][\p{L}\p{N}'’-]*$/u;
const MIN_NAME_PARTS = 2;

const nameRuns = (question: string): string[][] => {
  const tokens = question.match(TOKEN) ?? [];
  const runs: string[][] = [];
  let run: string[] = [];
  tokens.forEach((token, index) => {
    if (index > 0 && NAME_PART.test(token)) {
      run.push(token);
      return;
    }
    if (run.length >= MIN_NAME_PARTS) runs.push(run);
    run = [];
  });
  if (run.length >= MIN_NAME_PARTS) runs.push(run);
  return runs;
};

export const unnamedSubjects = (
  question: string,
  sourcesText: string
): string[] => {
  const haystack = foldForMatching(sourcesText);
  return nameRuns(question)
    .filter((run) =>
      run.every((part) => !haystack.includes(foldForMatching(part)))
    )
    .map((run) => run.join(' '));
};
