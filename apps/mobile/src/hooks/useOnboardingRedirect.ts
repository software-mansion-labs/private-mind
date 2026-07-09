import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  isOnboardingComplete,
  resetOnboarding,
} from '../utils/onboardingStatus';
import { getAllModels } from '../database/modelRepository';
import { useSQLiteContext } from 'expo-sqlite';

// DEBUG: flip to true to force the onboarding screen on every dev-build launch.
const FORCE_ONBOARDING_IN_DEV = false;

function useOnboardingRedirect() {
  const router = useRouter();
  const db = useSQLiteContext();

  useEffect(() => {
    const checkOnboardingAndModels = async () => {
      if (__DEV__ && FORCE_ONBOARDING_IN_DEV) {
        await resetOnboarding();
      }
      const complete = await isOnboardingComplete();
      if (!complete) {
        router.push('/onboarding');
        return;
      }

      const models = await getAllModels(db);
      if (!models.some((m) => m.isDownloaded)) {
        router.push('/(modals)/select-starting-model');
      }
    };

    checkOnboardingAndModels();
  }, [router, db]);
}

export default useOnboardingRedirect;
