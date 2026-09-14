import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
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
    // The panel's position is animated on the UI thread, so the rect React
    // measures a row against is the one it had before the panel opened. Without
    // this every move event cancels the press and the row does nothing.
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

  it('says why the image rows are dimmed, where the finger already is', () => {
    jest.useFakeTimers();
    const view = render(
      <AttachmentMenu onSelect={jest.fn()} imagesEnabled={false} />
    );
    expect(screen.queryAllByText('Images not supported')).toHaveLength(0);

    // A toast cannot be seen here: on Android the panel is hosted in the window
    // above the keyboard and a toast is drawn in the app's own, underneath it.
    view.rerender(
      <AttachmentMenu
        onSelect={jest.fn()}
        imagesEnabled={false}
        unsupportedAt={1}
      />
    );
    expect(screen.queryAllByText('Images not supported')).toHaveLength(2);
    expect(screen.getByText('Files')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(screen.queryAllByText('Images not supported')).toHaveLength(0);
    jest.useRealTimers();
  });
});
