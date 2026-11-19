import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import NoModelWelcome from '../components/NoModelWelcome';
import { useSettingsStore } from '../store/settingsStore';

const layoutAt = (height: number) =>
  fireEvent(screen.getByTestId('no-model-welcome'), 'layout', {
    nativeEvent: { layout: { height } },
  });

const renderWelcome = (playSwarm = false) => {
  const onChooseModel = jest.fn();
  const onImportChat = jest.fn();
  render(
    <NoModelWelcome
      onChooseModel={onChooseModel}
      onImportChat={onImportChat}
      playSwarm={playSwarm}
    />
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

  it('asks to choose a model from its main button', () => {
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
      <NoModelWelcome
        onChooseModel={jest.fn()}
        onImportChat={jest.fn()}
        playSwarm={false}
      />
    );

    expect(screen.getByText('Choose a model')).toBeTruthy();
    expect(screen.queryByText('Welcome!')).toBeNull();
  });

  describe('before the swarm has played', () => {
    afterEach(() => jest.restoreAllMocks());

    it('keeps the heading, badge and description hidden for the dots to form', () => {
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
      renderWelcome();

      expect(screen.getByText('Welcome!')).toHaveStyle({ opacity: 0 });
      expect(
        screen.getByText('Choose a model to get started with Private Mind')
      ).toHaveStyle({ opacity: 0 });
    });

    it('shows them straight away with reduced motion', () => {
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
      renderWelcome();

      expect(screen.getByText('Welcome!')).toHaveStyle({ opacity: 1 });
    });
  });
});
