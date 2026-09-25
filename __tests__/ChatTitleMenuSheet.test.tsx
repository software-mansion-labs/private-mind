import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import ChatTitleMenuSheet from '../components/chat-screen/ChatTitleMenuSheet';
import { MAX_CHAT_TITLE_LENGTH } from '../utils/chatLabel';

const renderSheet = (title: string) =>
  render(
    <ChatTitleMenuSheet
      bottomSheetModalRef={{ current: null }}
      title={title}
      onRename={jest.fn()}
      onExport={jest.fn()}
      onDelete={jest.fn()}
    />
  );

describe('ChatTitleMenuSheet', () => {
  it('takes a full-length title without a cut of its own', () => {
    const title = 'a'.repeat(MAX_CHAT_TITLE_LENGTH);

    renderSheet(title);

    expect(screen.getByText(title)).toBeTruthy();
  });

  it('keeps the title on one line and lets the width end it', () => {
    renderSheet('Weekend in London with a list of things worth seeing there');

    expect(screen.getByTestId('chat-menu-title').props.numberOfLines).toBe(1);
  });
});
