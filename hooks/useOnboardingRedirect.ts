import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { isOnboardingComplete } from '../utils/onboardingStatus';
import { getAllModels } from '../database/modelRepository';
import { useSQLiteContext } from 'expo-sqlite';

function useOnboardingRedirect() {
  const router = useRouter();
  const db = useSQLiteContext();

  useEffect(() => {
    const checkOnboardingAndModels = async () => {
      const complete = await isOnboardingComplete();
      if (!complete) {
        router.push('/onboarding');
        return;
      }

      const models = await getAllModels(db);
      if (models.filter((m) => m.isDownloaded).length === 0) {
        router.push('/(modals)/select-starting-model');
      }
    };

    checkOnboardingAndModels();
  }, [router, db]);
}

export default useOnboardingRedirect;
