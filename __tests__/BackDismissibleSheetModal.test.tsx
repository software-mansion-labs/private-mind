import React, { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

type SheetProps = {
  onChange?: (index: number) => void;
  onDismiss?: () => void;
};

jest.mock('@gorhom/bottom-sheet', () => {
  const MockReact = require('react');
  const BottomSheetModal = MockReact.forwardRef(
    (props: SheetProps, ref: React.Ref<unknown>) => {
      MockReact.useImperativeHandle(ref, () => ({
        present: () => props.onChange?.(0),
        dismiss: () => {
          props.onChange?.(-1);
          props.onDismiss?.();
        },
      }));
      return null;
    }
  );
  return { BottomSheetModal };
});

import BackDismissibleSheetModal from '../components/bottomSheets/BackDismissibleSheetModal';

const listeners: (() => boolean)[] = [];

const pressBack = () => {
  for (let i = listeners.length - 1; i >= 0; i--) {
    if (listeners[i]()) return true;
  }
  return false;
};

beforeEach(() => {
  listeners.length = 0;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return {
        remove: () => listeners.splice(listeners.indexOf(handler as never), 1),
      } as never;
    });
});

afterEach(() => jest.restoreAllMocks());

const renderSheet = (onDismiss = jest.fn()) => {
  const ref = createRef<BottomSheetModal | null>();
  render(
    <BackDismissibleSheetModal ref={ref} onDismiss={onDismiss}>
      {null}
    </BackDismissibleSheetModal>
  );
  return { ref, onDismiss };
};

describe('BackDismissibleSheetModal', () => {
  it('still hands its caller the sheet to present', () => {
    const { ref } = renderSheet();
    expect(ref.current?.present).toEqual(expect.any(Function));
  });

  it('leaves back to the screen while closed', () => {
    renderSheet();
    expect(pressBack()).toBe(false);
  });

  it('closes on back instead of leaving the screen behind it', () => {
    const { ref, onDismiss } = renderSheet();
    act(() => ref.current?.present());

    let consumed = false;
    act(() => {
      consumed = pressBack();
    });

    expect(consumed).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(pressBack()).toBe(false);
  });

  it('closes only the sheet on top when one opens over another', () => {
    const below = renderSheet();
    const above = renderSheet();
    act(() => below.ref.current?.present());
    act(() => above.ref.current?.present());

    act(() => {
      pressBack();
    });

    expect(above.onDismiss).toHaveBeenCalledTimes(1);
    expect(below.onDismiss).not.toHaveBeenCalled();
  });
});
