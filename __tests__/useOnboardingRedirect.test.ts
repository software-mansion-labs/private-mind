import { renderHook, waitFor } from '@testing-library/react-native';
import useOnboardingRedirect from '../hooks/useOnboardingRedirect';
import * as onboardingStatus from '../utils/onboardingStatus';
import * as modelRepository from '../database/modelRepository';
import { useRouter } from 'expo-router';

jest.mock('../utils/onboardingStatus');
jest.mock('../database/modelRepository');
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn(() => ({})) }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const mockIsOnboardingComplete = onboardingStatus.isOnboardingComplete as jest.Mock;
const mockGetAllModels = modelRepository.getAllModels as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const mockPush = jest.fn();

const makeModel = (isDownloaded: boolean) => ({
  id: 1,
  modelName: 'Test',
  isDownloaded,
  source: 'remote' as const,
  modelPath: '', tokenizerPath: '', tokenizerConfigPath: '', thinking: false, featured: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: mockPush });
  mockIsOnboardingComplete.mockResolvedValue(true);
  mockGetAllModels.mockResolvedValue([makeModel(true)]);
});

// ─── redirect logic ───────────────────────────────────────────────────────────

describe('redirect logic', () => {
  it('does not redirect when onboarding is complete and a model is downloaded', async () => {
    renderHook(() => useOnboardingRedirect());
    await waitFor(() => expect(mockGetAllModels).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when onboarding is not complete', async () => {
    mockIsOnboardingComplete.mockResolvedValue(false);
    renderHook(() => useOnboardingRedirect());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/onboarding'));
    // Should not check models after redirecting to onboarding
    expect(mockGetAllModels).not.toHaveBeenCalled();
  });

  it('redirects to select-starting-model when no models are downloaded', async () => {
    mockGetAllModels.mockResolvedValue([makeModel(false), makeModel(false)]);
    renderHook(() => useOnboardingRedirect());
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/(modals)/select-starting-model')
    );
  });

  it('does not redirect to model selection when at least one model is downloaded', async () => {
    mockGetAllModels.mockResolvedValue([makeModel(false), makeModel(true)]);
    renderHook(() => useOnboardingRedirect());
    await waitFor(() => expect(mockGetAllModels).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not redirect to model selection when all models are downloaded', async () => {
    mockGetAllModels.mockResolvedValue([makeModel(true), makeModel(true)]);
    renderHook(() => useOnboardingRedirect());
    await waitFor(() => expect(mockGetAllModels).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to select-starting-model when model list is empty', async () => {
    mockGetAllModels.mockResolvedValue([]);
    renderHook(() => useOnboardingRedirect());
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/(modals)/select-starting-model')
    );
  });
});
