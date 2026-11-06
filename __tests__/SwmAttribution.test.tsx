import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

let mockSheetData: unknown = null;
jest.mock('../components/bottomSheets/BackDismissibleSheetModal', () => {
  const { View } = require('react-native');
  return ({
    children,
  }: {
    children: (props: { data: unknown }) => React.ReactNode;
  }) =>
    mockSheetData ? <View>{children({ data: mockSheetData })}</View> : null;
});

jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = require('react-native');
  return { BottomSheetView: View };
});

const mockOpenExternalUrl = jest.fn();
jest.mock('../utils/web/openExternalUrl', () => ({
  openExternalUrl: (url: string | undefined) => mockOpenExternalUrl(url),
}));

import SwmAttributionCard from '../components/model-hub/SwmAttributionCard';
import FamilyProviderRow from '../components/model-hub/FamilyProviderRow';
import SwmAttributionSheet, {
  type SwmAttributionSheetData,
} from '../components/bottomSheets/SwmAttributionSheet';
import {
  FAMILY_PROVIDERS,
  FAMILY_SWM_ROLES,
} from '../constants/family-descriptions';
import { huggingFaceRepoUrl } from '../utils/huggingFaceRepoUrl';
import bundledCatalog from '../catalog/model-catalog-v2.json';

const GEMMA_URL =
  'https://huggingface.co/software-mansion/gemma-4-E2B-it-ExecuTorch';

const renderSheet = (data: SwmAttributionSheetData) => {
  mockSheetData = data;
  const ref = createRef<BottomSheetModal<SwmAttributionSheetData>>();
  return render(<SwmAttributionSheet bottomSheetModalRef={ref} />);
};

const gemma: SwmAttributionSheetData = {
  family: 'Gemma 4',
  provider: 'Google',
  role: 'optimized',
  modelUrl: GEMMA_URL,
};

beforeEach(() => {
  mockSheetData = null;
  mockOpenExternalUrl.mockClear();
});

describe('family attribution config', () => {
  it('calls Llama 3.2 prepared, not optimized, because Meta trained its SpinQuant and QLoRA quantization', () => {
    expect(FAMILY_SWM_ROLES['LLaMA 3.2']).toBe('prepared');
  });

  it('keeps the original author for every credited family', () => {
    for (const family of Object.keys(FAMILY_SWM_ROLES)) {
      expect(FAMILY_PROVIDERS[family]).toBeTruthy();
    }
  });

  it('finds a Software Mansion Hugging Face repo in the bundled catalog for every credited family', () => {
    const catalogPaths = (family: string) =>
      bundledCatalog.models
        .filter((model) => model.family === family)
        .flatMap((model) =>
          typeof model.modelPath === 'string'
            ? [model.modelPath]
            : Object.values(model.modelPath)
        );
    for (const family of Object.keys(FAMILY_SWM_ROLES)) {
      const repoUrls = catalogPaths(family).map(huggingFaceRepoUrl);
      expect(repoUrls.length).toBeGreaterThan(0);
      for (const url of repoUrls) {
        expect(url).toMatch(
          /^https:\/\/huggingface\.co\/software-mansion\/[\w.-]+$/
        );
      }
    }
  });
});

describe('huggingFaceRepoUrl', () => {
  it('turns a file download URL into the repo page', () => {
    expect(
      huggingFaceRepoUrl(
        'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.9.0/0_6b/xnnpack/qwen_3_0_6b_xnnpack_8da4w.pte'
      )
    ).toBe(
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3'
    );
  });

  it('gives nothing for a local file or another host, so the link stays hidden', () => {
    expect(huggingFaceRepoUrl('file:///data/models/model.pte')).toBeUndefined();
    expect(
      huggingFaceRepoUrl('https://example.com/org/repo/resolve/main/model.pte')
    ).toBeUndefined();
  });
});

describe('SwmAttributionCard', () => {
  it('reads "Optimized by Software Mansion" over the original author from data', () => {
    render(
      <SwmAttributionCard
        role="optimized"
        provider="Google"
        onPress={jest.fn()}
      />
    );
    expect(screen.getByText('Optimized by Software Mansion')).toBeTruthy();
    expect(screen.getByText('Original model by Google')).toBeTruthy();
  });

  it('says "Prepared for mobile" for the prepared role', () => {
    render(
      <SwmAttributionCard role="prepared" provider="Meta" onPress={jest.fn()} />
    );
    expect(
      screen.getByText('Prepared for mobile by Software Mansion')
    ).toBeTruthy();
    expect(screen.getByText('Original model by Meta')).toBeTruthy();
  });

  it('is one button for screen readers that announces both lines', () => {
    const onPress = jest.fn();
    render(
      <SwmAttributionCard
        role="optimized"
        provider="Google"
        onPress={onPress}
      />
    );
    const card = screen.getByRole('button', {
      name: 'Optimized by Software Mansion. Original model by Google',
    });
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('FamilyProviderRow without a Software Mansion role', () => {
  it('keeps the plain author credit with nothing to tap', () => {
    render(<FamilyProviderRow provider="Alibaba" />);
    expect(screen.getByLabelText('Made by Alibaba')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Software Mansion/)).toBeNull();
  });
});

describe('SwmAttributionSheet', () => {
  it('lists the four agreed rows for Gemma 4, each read as one sentence', () => {
    renderSheet(gemma);
    expect(screen.getByText('How this model runs on your phone')).toBeTruthy();
    const rowLabel = (key: string) =>
      screen.getByTestId(`swm-attribution-row-${key}`).props.accessibilityLabel;
    expect(rowLabel('original')).toBe('Original model: Gemma 4 by Google');
    expect(rowLabel('swm')).toBe(
      "Optimized by Software Mansion: Compressed and exported for your phone's hardware"
    );
    expect(rowLabel('benchmarked')).toBe(
      'Regularly benchmarked: Speed and memory use on real devices'
    );
    expect(rowLabel('private')).toBe(
      'Private by design: Runs on your device with React Native ExecuTorch'
    );
  });

  it('names the prepared role in the second row', () => {
    renderSheet({ ...gemma, role: 'prepared' });
    expect(
      screen.getByText('Prepared for mobile by Software Mansion')
    ).toBeTruthy();
    expect(screen.queryByText('Optimized by Software Mansion')).toBeNull();
  });

  it('opens the model page and the UTM-tagged Software Mansion page as links', () => {
    renderSheet(gemma);
    fireEvent.press(screen.getByRole('link', { name: 'View model details' }));
    fireEvent.press(
      screen.getByRole('link', { name: 'About Software Mansion' })
    );
    expect(mockOpenExternalUrl.mock.calls).toEqual([
      [GEMMA_URL],
      [
        'https://swmansion.com/?utm_source=private-mind&utm_medium=app&utm_campaign=model-details',
      ],
    ]);
  });

  it('hides "View model details" when the model has no confirmed link', () => {
    renderSheet({ ...gemma, modelUrl: undefined });
    expect(screen.queryByText('View model details')).toBeNull();
    expect(screen.getByText('About Software Mansion')).toBeTruthy();
  });
});
