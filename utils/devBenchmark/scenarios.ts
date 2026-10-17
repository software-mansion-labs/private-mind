import type { Scenario } from './types';

export const BASE_CHAT_SCENARIO: Scenario = {
  id: 'base-chat',
  title: 'Base chat',
  turnTimeoutMs: 180_000,
  turns: [
    { prompt: 'cześć', language: 'pl', greeting: true },
    {
      prompt: 'Why do leaves change colour in autumn?',
      language: 'en',
    },
    { prompt: 'a dlaczego?', language: 'pl' },
    {
      prompt:
        'अच्छी नींद के लिए 7 सुझावों की सूची बनाइए। हर बिंदु के लिए एक शीर्षक लिखिए।',
      language: 'hi',
      expectListItems: 7,
    },
    {
      prompt:
        'Make a markdown table comparing the Sun, the Moon and Earth: diameter and distance from Earth.',
      language: 'en',
      expectTable: true,
    },
    { prompt: 'زمین سورج کے گرد کیوں گھومتی ہے؟', language: 'ur' },
  ],
};

export const DEV_BENCHMARK_SCENARIOS: Scenario[] = [BASE_CHAT_SCENARIO];
