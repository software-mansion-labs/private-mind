import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import UnsupportedCpuNotice from '../components/UnsupportedCpuNotice';
import { useCpuSupportStore } from '../store/cpuSupportStore';
import { UNSUPPORTED_CPU_COPY } from '../constants/cpu-support';

jest.mock('../utils/cpuSupport', () => ({
  cpuLacksLseAtomics: async () => false,
}));

const renderNotice = () =>
  render(
    <UnsupportedCpuNotice>
      <Text>app content</Text>
    </UnsupportedCpuNotice>
  );

afterEach(() => {
  useCpuSupportStore.setState({ lacksLseAtomics: false });
});

describe('UnsupportedCpuNotice', () => {
  it('shows only the app on a supported processor', () => {
    useCpuSupportStore.setState({
      lacksLseAtomics: false,
      checkCpu: async () => {},
    });
    renderNotice();

    expect(screen.getByText('app content')).toBeTruthy();
    expect(screen.queryByTestId('unsupported-cpu-notice')).toBeNull();
  });

  it('keeps a notice above the app on a processor without LSE atomics', () => {
    useCpuSupportStore.setState({
      lacksLseAtomics: true,
      checkCpu: async () => {},
    });
    renderNotice();

    expect(screen.getByTestId('unsupported-cpu-notice')).toBeTruthy();
    expect(screen.getByText(UNSUPPORTED_CPU_COPY.title)).toBeTruthy();
    expect(screen.getByText('app content')).toBeTruthy();
  });
});
