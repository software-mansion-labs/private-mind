export type SendRefusal =
  | 'nothing-to-send'
  | 'cpu-unsupported'
  | 'model-not-started'
  | 'busy'
  | 'chat-not-created'
  | 'image-not-saved'
  | 'image-unsupported'
  | 'model-needs-update';

export const sendWasRefused = (outcome: boolean | SendRefusal): boolean =>
  outcome === false || typeof outcome === 'string';
