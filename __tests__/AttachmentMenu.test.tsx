import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AttachmentMenu from '../components/chat-screen/attachments/AttachmentMenu';
import MenuRow from '../components/menu/MenuRow';
import { PRESS_ANYWHERE } from '../components/chat-screen/attachments/constants';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

describe('AttachmentMenu', () => {
  it('holds a press through the finger travelling, on every row', () => {
    const view = render(<AttachmentMenu onSelect={jest.fn()} />);

    const rows = view.UNSAFE_getAllByType(MenuRow);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.props.pressRetentionOffset).toEqual(PRESS_ANYWHERE);
    }
  });

  it('reports every row to its handler', () => {
    const onSelect = jest.fn();
    render(<AttachmentMenu onSelect={onSelect} />);

    fireEvent.press(screen.getByTestId('attachment-document'));
    expect(onSelect).toHaveBeenCalledWith('files');
  });

  it('keeps every row reading as itself on a model that takes no images', () => {
    render(<AttachmentMenu onSelect={jest.fn()} imagesEnabled={false} />);

    expect(screen.getByText('Camera')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.queryByText('Images not supported')).toBeNull();
  });
});
