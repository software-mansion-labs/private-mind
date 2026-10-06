import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: { ...require('../styles/colors').lightTheme } }),
}));

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));

jest.mock('expo-router', () => ({
  useNavigation: () => ({ openDrawer: jest.fn() }),
}));

jest.mock('expo-image', () => ({ Image: () => null }));

import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import NewChatHeaderButton from '../components/NewChatHeaderButton';
import ChatTitle from '../components/chat-screen/ChatTitle';
import AttachmentThumbnail from '../components/chat-screen/AttachmentThumbnail';
import { Attachment } from '../hooks/useAttachment';

const document: Attachment = {
  id: 'doc-1',
  type: 'document',
  uri: 'file:///notes.pdf',
  name: 'notes.pdf',
  status: 'ready',
};

describe('header buttons for a screen reader', () => {
  it('reads the drawer toggle as a button named "Open menu"', () => {
    render(<DrawerToggleButton />);

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
  });

  it('reads the new chat action as a button named "New chat"', () => {
    render(<NewChatHeaderButton />);

    expect(screen.getByRole('button', { name: 'New chat' })).toBeTruthy();
  });
});

describe('ChatTitle for a screen reader', () => {
  it('reads a tappable title as a button that opens chat options', () => {
    render(
      <ChatTitle title="Trip plan" modelName="Llama" onPress={jest.fn()} />
    );

    const title = screen.getByRole('button', { name: 'Trip plan, Llama' });
    expect(title.props.accessibilityHint).toBe('Opens chat options');
  });

  it('reads a title with nothing to open as a header, not a button', () => {
    render(<ChatTitle title="Trip plan" modelName="Llama" />);

    expect(
      screen.getByRole('header', { name: 'Trip plan, Llama' })
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AttachmentThumbnail for a screen reader', () => {
  it('names the remove button after the attachment it removes', () => {
    render(<AttachmentThumbnail attachment={document} onRemove={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Remove notes.pdf' })
    ).toBeTruthy();
  });

  it('falls back to "Remove attachment" when the attachment has no name', () => {
    render(
      <AttachmentThumbnail
        attachment={{ ...document, name: undefined }}
        onRemove={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Remove attachment' })
    ).toBeTruthy();
  });
});
