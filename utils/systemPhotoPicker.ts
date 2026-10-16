export interface PickedPhoto {
  id: string;
  uri: string;
}

export const launchSystemPhotoPicker = async (): Promise<PickedPhoto | null> =>
  null;
