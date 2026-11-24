export interface Release {
  version: string;
  title: string;
  highlights: string[];
  opensOnLaunch: boolean;
}

export const LATEST_RELEASE: Release = {
  version: '1.4.1',
  title: 'Choose how much a chat remembers',
  highlights: [
    'Set the context size to Low, Medium, High or Auto in Settings or from the chat',
    'Quick web questions get answered faster',
    'Long chats bring back earlier messages that matter to your question',
    'Turn haptic feedback off in Settings',
    'Fixes for answers shown twice and a blank screen on some Android phones',
  ],
  opensOnLaunch: true,
};
