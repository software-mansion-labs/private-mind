import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { isOnboardingComplete } from '../utils/onboardingStatus';
import { getAllModels } from '../database/modelRepository';
import { useSQLiteContext } from 'expo-sqlite';

export type OnboardingRedirect = 'checking' | 'stayed' | 'redirected';

function useOnboardingRedirect(): OnboardingRedirect {
  const router = useRouter();
  const db = useSQLiteContext();
  const [redirect, setRedirect] = useState<OnboardingRedirect>('checking');

  useEffect(() => {
    let cancelled = false;
    const settle = (outcome: OnboardingRedirect) => {
      if (!cancelled) setRedirect(outcome);
    };
    const checkOnboardingAndModels = async () => {
      const complete = await isOnboardingComplete();
      if (!complete) {
        router.push('/onboarding');
        settle('redirected');
        return;
      }

      const models = await getAllModels(db);
      if (!models.some((m) => m.isDownloaded)) {
        router.push('/(modals)/select-starting-model');
        settle('redirected');
        return;
      }
      settle('stayed');
    };

    checkOnboardingAndModels().catch((error) => {
      console.error('Failed to check onboarding and models:', error);
      settle('stayed');
    });
    return () => {
      cancelled = true;
    };
  }, [router, db]);

  return redirect;
}

export default useOnboardingRedirect;
