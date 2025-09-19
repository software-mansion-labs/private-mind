import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { getAllModels } from '../database/modelRepository';
import { useSQLiteContext } from 'expo-sqlite';

const useSelectStartingModelRedirect = () => {
  const router = useRouter();
  const db = useSQLiteContext();

  useEffect(() => {
    getAllModels(db).then((models) => {
      if (models.filter((m) => m.isDownloaded).length === 0) {
        router.push('/(modals)/select-starting-model');
      }
    });
  }, [db, router]);
};

export default useSelectStartingModelRedirect;
