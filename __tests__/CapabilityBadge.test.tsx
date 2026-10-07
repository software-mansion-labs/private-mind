import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

import CapabilityBadge, {
  modelCapabilities,
} from '../components/model-hub/CapabilityBadge';

describe('modelCapabilities', () => {
  it('derives Thinking and Vision from the model flags', () => {
    expect(modelCapabilities({ thinking: true, vision: true })).toEqual([
      { label: 'Thinking', tone: 'thinking' },
      { label: 'Vision', tone: 'vision' },
    ]);
  });

  it('adds labels as neutral badges, skipping ones that restate a capability', () => {
    expect(
      modelCapabilities({
        thinking: true,
        vision: true,
        labels: ['Fast', 'Reasoning', 'Vision', 'Polish'],
      })
    ).toEqual([
      { label: 'Thinking', tone: 'thinking' },
      { label: 'Vision', tone: 'vision' },
      { label: 'Fast', tone: 'neutral' },
      { label: 'Polish', tone: 'neutral' },
    ]);
  });

  it('keeps only the flags when labels are not wanted', () => {
    expect(
      modelCapabilities(
        { vision: true, labels: ['Fast'] },
        { withLabels: false }
      )
    ).toEqual([{ label: 'Vision', tone: 'vision' }]);
  });

  it('returns nothing for a model with no flags or labels', () => {
    expect(modelCapabilities({})).toEqual([]);
  });
});

describe('CapabilityBadge', () => {
  it('renders the label', () => {
    render(<CapabilityBadge label="Thinking" tone="thinking" />);
    expect(screen.getByTestId('capability-badge-Thinking')).toBeTruthy();
    expect(screen.getByText('Thinking')).toBeTruthy();
  });

  it('tints a capability differently from a neutral label', () => {
    const { rerender } = render(
      <CapabilityBadge label="Vision" tone="vision" />
    );
    const visionBackground = screen.getByTestId('capability-badge-Vision').props
      .style.backgroundColor;

    rerender(<CapabilityBadge label="Fast" tone="neutral" />);
    const neutralBackground = screen.getByTestId('capability-badge-Fast').props
      .style.backgroundColor;

    expect(visionBackground).not.toBe(neutralBackground);
  });
});
