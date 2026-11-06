import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import ModelFamilyTile from '../components/model-hub/ModelFamilyTile';
import { testTheme } from './helpers/renderWithTheme';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const tileStyle = () =>
  StyleSheet.flatten(
    screen.getByTestId('model-family-tile', { includeHiddenElements: true })
      .props.style
  );

const iconWidth = () =>
  screen.getByTestId('model-family-icon', { includeHiddenElements: true }).props
    .width;

describe('ModelFamilyTile', () => {
  it('sits the icon on a tinted tile by default', () => {
    render(<ModelFamilyTile family="Qwen 2.5" size="badge" />);

    expect(tileStyle().backgroundColor).toBe(testTheme.bg.tile);
  });

  it('drops the tile and draws the icon at the size it is given', () => {
    render(<ModelFamilyTile family="Gemma 4" size="badge" bareIconSize={14} />);

    expect(tileStyle().backgroundColor).toBe('transparent');
    expect(tileStyle().width).toBe(14);
    expect(iconWidth()).toBe(14);
  });

  it('shrinks an oversized mark inside an unchanged box', () => {
    render(<ModelFamilyTile family="LFM 3" size="badge" bareIconSize={14} />);

    expect(tileStyle().width).toBe(14);
    expect(iconWidth()).toBeLessThan(14);
  });

  it('keeps the coloured letter tile for a family without an icon, even without a tile requested', () => {
    render(<ModelFamilyTile family="Phi 4" size="badge" bareIconSize={14} />);

    expect(tileStyle().backgroundColor).not.toBe('transparent');
    expect(screen.getByText('P', { includeHiddenElements: true })).toBeTruthy();
  });
});
