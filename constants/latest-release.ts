export interface Release {
  version: string;
  title: string;
  highlights: string[];
  opensOnLaunch: boolean;
}

export const LATEST_RELEASE: Release = {
  version: '1.4.0',
  title: 'A whole new look',
  highlights: [
    'Redesigned chat, sidebar, models and settings, with a lighter glass style',
    'A simpler start: pick a model and the extra features in one place',
    'Long conversations remember more on phones with 8 GB of RAM or more',
    'Update an outdated model straight from the Models screen',
  ],
  opensOnLaunch: true,
};
