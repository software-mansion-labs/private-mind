import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { isOnboardingComplete } from '../utils/onboardingStatus';

function useOnboardingRedirect() {
  const router = useRouter();

  useEffect(() => {
    isOnboardingComplete().then((complete) => {
      if (!complete) {
        router.push('/onboarding');
      }
    });
  }, [router]);
}

export default useOnboardingRedirect;
