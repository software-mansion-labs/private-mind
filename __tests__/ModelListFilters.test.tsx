import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ModelHubFilter } from '../hooks/useModelHubData';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme, insets: { top: 0, bottom: 0, left: 0, right: 0 } },
  }),
}));

jest.mock('../components/TextFieldInput', () => {
  const { TextInput } = require('react-native');
  return ({ value, onChangeText, placeholder }: any) => (
    <TextInput
      testID="search-input"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
});

jest.mock('../components/model-hub/SortingTag', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ text, selected, onPress }: any) => (
    <TouchableOpacity
      testID={`tag-${text}`}
      onPress={onPress}
      accessibilityState={{ selected }}
    >
      <Text>{text}</Text>
    </TouchableOpacity>
  );
});

import ModelListFilters from '../components/model-hub/ModelListFilters';

const defaultProps = {
  search: '',
  onSearchChange: jest.fn(),
  activeFilters: new Set<ModelHubFilter>(),
  onFiltersChange: jest.fn(),
  groupByModel: false,
  onGroupByModelChange: jest.fn(),
};

const renderFilters = (props = {}) =>
  render(<ModelListFilters {...defaultProps} {...props} />);

beforeEach(() => jest.clearAllMocks());

// ─── search input ─────────────────────────────────────────────────────────────

describe('search input', () => {
  it('renders with current search value', () => {
    renderFilters({ search: 'llama' });
    expect(screen.getByDisplayValue('llama')).toBeTruthy();
  });

  it('calls onSearchChange when text changes', () => {
    const onSearchChange = jest.fn();
    renderFilters({ onSearchChange });
    fireEvent.changeText(screen.getByTestId('search-input'), 'qwen');
    expect(onSearchChange).toHaveBeenCalledWith('qwen');
  });
});

// ─── filter tags ──────────────────────────────────────────────────────────────

describe('filter tags', () => {
  it('renders all four filter tags', () => {
    renderFilters();
    expect(screen.getByTestId('tag-Featured')).toBeTruthy();
    expect(screen.getByTestId('tag-Compatible')).toBeTruthy();
    expect(screen.getByTestId('tag-Group by model')).toBeTruthy();
    expect(screen.getByTestId('tag-Ready to use')).toBeTruthy();
  });

  it('toggles Featured filter on press — adds when not active', () => {
    const onFiltersChange = jest.fn();
    renderFilters({ onFiltersChange, activeFilters: new Set() });
    fireEvent.press(screen.getByTestId('tag-Featured'));
    const passed = onFiltersChange.mock.calls[0][0] as Set<ModelHubFilter>;
    expect(passed.has(ModelHubFilter.Featured)).toBe(true);
  });

  it('toggles Featured filter on press — removes when active', () => {
    const onFiltersChange = jest.fn();
    renderFilters({ onFiltersChange, activeFilters: new Set([ModelHubFilter.Featured]) });
    fireEvent.press(screen.getByTestId('tag-Featured'));
    const passed = onFiltersChange.mock.calls[0][0] as Set<ModelHubFilter>;
    expect(passed.has(ModelHubFilter.Featured)).toBe(false);
  });

  it('toggles Compatible filter independently', () => {
    const onFiltersChange = jest.fn();
    renderFilters({ onFiltersChange, activeFilters: new Set([ModelHubFilter.Featured]) });
    fireEvent.press(screen.getByTestId('tag-Compatible'));
    const passed = onFiltersChange.mock.calls[0][0] as Set<ModelHubFilter>;
    expect(passed.has(ModelHubFilter.Compatible)).toBe(true);
    expect(passed.has(ModelHubFilter.Featured)).toBe(true); // unchanged
  });

  it('toggles Downloaded (Ready to use) filter', () => {
    const onFiltersChange = jest.fn();
    renderFilters({ onFiltersChange, activeFilters: new Set() });
    fireEvent.press(screen.getByTestId('tag-Ready to use'));
    const passed = onFiltersChange.mock.calls[0][0] as Set<ModelHubFilter>;
    expect(passed.has(ModelHubFilter.Downloaded)).toBe(true);
  });
});

// ─── group by model ───────────────────────────────────────────────────────────

describe('Group by model toggle', () => {
  it('calls onGroupByModelChange with true when not grouped', () => {
    const onGroupByModelChange = jest.fn();
    renderFilters({ onGroupByModelChange, groupByModel: false });
    fireEvent.press(screen.getByTestId('tag-Group by model'));
    expect(onGroupByModelChange).toHaveBeenCalledWith(true);
  });

  it('calls onGroupByModelChange with false when already grouped', () => {
    const onGroupByModelChange = jest.fn();
    renderFilters({ onGroupByModelChange, groupByModel: true });
    fireEvent.press(screen.getByTestId('tag-Group by model'));
    expect(onGroupByModelChange).toHaveBeenCalledWith(false);
  });
});
