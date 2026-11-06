import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import NoModelWelcome from '../components/NoModelWelcome';
import { useSettingsStore } from '../store/settingsStore';

const layoutAt = (height: number) =>
  fireEvent(screen.getByTestId('no-model-welcome'), 'layout', {
    nativeEvent: { layout: { height } },
  });

const renderWelcome = () => {
  const onChooseModel = jest.fn();
  const onImportChat = jest.fn();
  render(
    <NoModelWelcome onChooseModel={onChooseModel} onImportChat={onImportChat} />
  );
  layoutAt(844);
  return { onChooseModel, onImportChat };
};

beforeEach(() =>
  useSettingsStore.setState({
    hasHydrated: true,
    dismissedWhatsNewVersion: null,
  })
);

describe('the no-model screen', () => {
  it('welcomes and says what to do first', () => {
    renderWelcome();

    expect(screen.getByRole('header', { name: 'Welcome!' })).toBeTruthy();
    expect(
      screen.getByText('Choose a model to get started with Private Mind')
    ).toBeTruthy();
  });

  it('opens the model picker from its main button', () => {
    const { onChooseModel } = renderWelcome();

    fireEvent.press(screen.getByText('Choose a model'));

    expect(onChooseModel).toHaveBeenCalledTimes(1);
  });

  it('still offers importing a chat', () => {
    const { onImportChat } = renderWelcome();

    fireEvent.press(screen.getByText('Import chat'));

    expect(onImportChat).toHaveBeenCalledTimes(1);
  });

  it('shows the What is new badge above the heading', () => {
    renderWelcome();

    expect(screen.getByTestId('whats-new-badge')).toBeTruthy();
  });

  it('keeps its actions usable before the screen has been measured', () => {
    render(
      <NoModelWelcome onChooseModel={jest.fn()} onImportChat={jest.fn()} />
    );

    expect(screen.getByText('Choose a model')).toBeTruthy();
    expect(screen.queryByText('Welcome!')).toBeNull();
  });
});
