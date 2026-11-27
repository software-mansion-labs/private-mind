import { FEEDBACK_ISSUES_URL, buildFeedbackUrl } from '../utils/feedbackLink';

const context = {
  appVersion: '1.3.6',
  platform: 'android',
  osVersion: '34',
  deviceModel: 'Pixel 10',
};

describe('the feedback link', () => {
  it('opens a new issue on the project repository', () => {
    expect(
      buildFeedbackUrl(context).startsWith(`${FEEDBACK_ISSUES_URL}?`)
    ).toBe(true);
  });

  it('carries the app version and the device so a report can be reproduced', () => {
    const url = new URL(buildFeedbackUrl(context));
    const body = url.searchParams.get('body') ?? '';

    expect(body).toContain('App: 1.3.6');
    expect(body).toContain('Device: Pixel 10 (android 34)');
  });

  it('sends no chat content, only the prompt text and the device facts', () => {
    const url = new URL(buildFeedbackUrl(context));
    const body = url.searchParams.get('body') ?? '';

    expect(body.split('\n').filter((line) => line.trim())).toHaveLength(4);
  });
});
