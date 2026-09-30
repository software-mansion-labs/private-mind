import { readFileSync } from 'fs';
import { join } from 'path';
import { TEXT_SELECTION } from '../styles/colors';

const res = (file: string) =>
  readFileSync(join(__dirname, '..', 'android/app/src/main/res', file), 'utf8');

const colorValue = (name: string) => {
  const match = new RegExp(
    `<color name="${name}">(#[0-9A-Fa-f]{6,8})</color>`
  ).exec(res('values/colors.xml'));
  if (!match) throw new Error(`No android color named ${name}`);
  return match[1];
};

const themeItem = (name: string) => {
  const match = new RegExp(`<item name="${name}">([^<]+)</item>`).exec(
    res('values/styles.xml')
  );
  if (!match) throw new Error(`AppTheme has no item named ${name}`);
  return match[1];
};

describe('android text selection tint', () => {
  it('highlights a selection in the same colour a text field does', () => {
    expect(themeItem('android:textColorHighlight')).toBe(
      '@color/textSelectionHighlight'
    );

    const argb = colorValue('textSelectionHighlight');
    const alpha = parseInt(argb.slice(1, 3), 16);
    const rgb = [3, 5, 7].map((at) => parseInt(argb.slice(at, at + 2), 16));

    expect(TEXT_SELECTION.selectionColor).toBe(
      `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.round((alpha / 255) * 10) / 10})`
    );
  });

  it('tints the selection handles with the brand colour, not the AppCompat accent', () => {
    expect(themeItem('colorAccent')).toBe('@color/brandBlue');
    expect(themeItem('colorControlActivated')).toBe('@color/brandBlue');
    expect(colorValue('brandBlue').toLowerCase()).toBe(
      TEXT_SELECTION.cursorColor.toLowerCase()
    );
  });
});
