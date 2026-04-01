import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { lightTheme } from '../../styles/colors';

export const testTheme = { ...lightTheme, insets: { top: 0, bottom: 0, left: 0, right: 0 } };

// Re-export for convenience in tests that need the wrapper
export const renderWithTheme = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, options);
