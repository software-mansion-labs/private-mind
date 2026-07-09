export const AudioManager = {
  requestRecordingPermissions: jest.fn(() => Promise.resolve('Granted')),
  setAudioSessionOptions: jest.fn(),
  setAudioSessionActivity: jest.fn(() => Promise.resolve()),
};
