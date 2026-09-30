export const BENCHMARK_PROMPT =
  'Two roads diverged in a yellow wood, And sorry I could not travel both And be one traveler, long I stood And looked down one as far as I could To where it bent in the undergrowth; Then took the other, as just as fair, And having perhaps the better claim, Because it was grassy and wanted wear; Though as for that the passing there Had worn them really about the same, And both that morning equally lay In leaves no step had trodden black. Oh, I kept the first for another day! Yet knowing how way leads on to way, I doubted if I should ever come back. I shall be telling this with a sigh Somewhere ages and ages hence: Two roads diverged in a wood, and I— I took the one less traveled by, And that has made all the difference.';

export const BENCHMARK_WARMUP_RUNS = 1;

export const BENCHMARK_ITERATIONS = 3;

export const BENCHMARK_TOKEN_TARGET = 128;

// The runtime scales logits by the inverse of temperature, so 0 divides by
// zero; 0.01 is the closest we can get to greedy decoding.
export const BENCHMARK_GENERATION_CONFIG = {
  temperature: 0.01,
  topP: 1,
  minP: 0,
};
