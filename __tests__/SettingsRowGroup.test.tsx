import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { darkTheme, lightTheme } from '../styles/colors';
import SettingsRowGroup from '../components/settings/SettingsRowGroup';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const groupStyle = (): Record<string, unknown> =>
  StyleSheet.flatten(
    (screen.toJSON() as unknown as { props: { style: object } }).props
      .style as never
  ) as Record<string, unknown>;

const separators = () => {
  const root = screen.toJSON() as unknown as {
    children: { props: { style?: unknown } }[];
  };
  return root.children
    .filter((child) => child.props.style !== undefined)
    .map(
      (child) =>
        StyleSheet.flatten(child.props.style as never) as unknown as {
          height: number;
          marginHorizontal: number;
          opacity?: number;
          backgroundColor: string;
        }
    );
};

describe('RowGroup', () => {
  it('is one step lighter than the screen, with a subtle outline and radius 20', () => {
    render(
      <SettingsRowGroup separatorInset={0}>
        <Text>a</Text>
      </SettingsRowGroup>
    );
    expect(groupStyle()).toMatchObject({
      backgroundColor: lightTheme.bg.group,
      borderColor: lightTheme.border.group,
      borderWidth: 1,
      borderRadius: 20,
      overflow: 'hidden',
    });
  });

  it('puts the dividers only between rows, none above the first or below the last', () => {
    render(
      <SettingsRowGroup separatorInset={0}>
        <Text>a</Text>
        <Text>b</Text>
        <Text>c</Text>
      </SettingsRowGroup>
    );
    expect(separators()).toHaveLength(2);
  });

  it('draws the divider as a faint hairline inset from both edges', () => {
    render(
      <SettingsRowGroup separatorInset={0}>
        <Text>a</Text>
        <Text>b</Text>
      </SettingsRowGroup>
    );
    const [separator] = separators();
    expect(separator.height).toBe(StyleSheet.hairlineWidth);
    expect(separator.marginHorizontal).toBe(16);
    expect(separator.backgroundColor).toBe(lightTheme.border.groupDivider);
  });

  it('hides the separators on both sides of the selected row', () => {
    render(
      <SettingsRowGroup separatorInset={0} selectedIndex={1}>
        <Text>a</Text>
        <Text>b</Text>
        <Text>c</Text>
        <Text>d</Text>
      </SettingsRowGroup>
    );
    expect(separators().map((separator) => separator.opacity)).toEqual([
      0,
      0,
      undefined,
    ]);
  });
});

describe('the group tokens in both themes', () => {
  it.each([
    { name: 'light', theme: lightTheme },
    { name: 'dark', theme: darkTheme },
  ])('$name has a fill, an outline and a fainter divider', ({ theme }) => {
    expect(theme.bg.group).toBeTruthy();
    expect(theme.border.group).toBeTruthy();
    expect(theme.border.groupDivider).toBeTruthy();
    expect(theme.border.groupDivider).not.toBe(theme.border.group);
  });
});
