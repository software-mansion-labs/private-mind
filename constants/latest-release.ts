export interface Release {
  version: string;
  title: string;
  highlights: string[];
  opensOnLaunch: boolean;
}

export const LATEST_RELEASE: Release = {
  version: '1.3.6',
  title: 'LFM 3 is here',
  highlights: [
    'LFM 3 1.7B: reasons before it answers, 16 languages',
    'LFM 3 VL 2B: ask about your photos',
    'New on-device engine: update your models once to keep chatting',
    'Voice dictation gets ready faster on first use',
  ],
  opensOnLaunch: false,
};
