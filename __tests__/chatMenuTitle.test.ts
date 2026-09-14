import {
  ACTION_SHEET_TITLE_MAX_LENGTH,
  getActionSheetTitle,
} from '../constants/chat-menu';
import { MAX_CHAT_TITLE_LENGTH } from '../utils/chatLabel';

describe('getActionSheetTitle', () => {
  it('caps a title that ActionSheetIOS cannot ellipsize by width', () => {
    const title = 'a'.repeat(MAX_CHAT_TITLE_LENGTH);

    const capped = getActionSheetTitle(title);

    expect(capped).toHaveLength(ACTION_SHEET_TITLE_MAX_LENGTH + 1);
    expect(capped.endsWith('…')).toBe(true);
  });

  it('leaves a title that already fits', () => {
    const title = 'Weekend in London';

    expect(getActionSheetTitle(title)).toBe(title);
  });

  it('drops the space a cut would otherwise leave before the ellipsis', () => {
    const title = `${'a'.repeat(ACTION_SHEET_TITLE_MAX_LENGTH - 1)} trailing`;

    expect(getActionSheetTitle(title)).toBe(`${'a'.repeat(31)}…`);
  });
});
