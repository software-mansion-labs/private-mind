import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ModelHubTabs from '../components/model-hub/ModelHubTabs';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

describe('ModelHubTabs', () => {
  it('renders all three tabs', () => {
    render(<ModelHubTabs value="featured" onChange={jest.fn()} />);
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText('Experimental')).toBeTruthy();
    expect(screen.getByText('Mine')).toBeTruthy();
  });

  it('calls onChange with the tapped tab key', () => {
    const onChange = jest.fn();
    render(<ModelHubTabs value="featured" onChange={onChange} />);

    fireEvent.press(screen.getByText('Experimental'));
    expect(onChange).toHaveBeenCalledWith('experimental');

    fireEvent.press(screen.getByText('Mine'));
    expect(onChange).toHaveBeenCalledWith('mine');
  });
});
