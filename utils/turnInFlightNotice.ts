import Toast from 'react-native-toast-message';

export const TURN_IN_FLIGHT_MESSAGE =
  'Wait for the response to finish or stop it first.';

export const showTurnInFlightNotice = (): void => {
  Toast.show({ type: 'defaultToast', text1: TURN_IN_FLIGHT_MESSAGE });
};
