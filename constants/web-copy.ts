import { type GroundingCaveatKind } from '../database/chatRepository';

export const GROUNDING_CAVEAT_COPY: Record<GroundingCaveatKind, string> = {
  figure: "A number here couldn't be confirmed against the sources",
  trend: 'No data on the change over time was found in the sources',
  conversion: 'No real conversion rate was found in the sources',
};

export type WebSkipReason = 'documents' | 'image' | 'model' | 'memory';

export const WEB_SKIP_COPY: Record<WebSkipReason, string> = {
  documents:
    'Using your documents for this chat — web search is off while they’re active.',
  image:
    'Reading the attached image — web search is off while an image is attached.',
  model: 'Web search is off for this model — answering without it.',
  memory:
    'Not enough memory to search alongside this model — answering without it.',
};
