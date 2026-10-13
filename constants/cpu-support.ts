import type { AppNotice } from '../store/noticeStore';

export const UNSUPPORTED_CPU_NOTICE: AppNotice = {
  id: 'unsupported-cpu',
  variant: 'warning',
  title: "This device isn't supported yet",
  message:
    "Its processor is missing instructions the on-device AI engine needs, so models can't run here and this version may not work reliably. We're working on it and will bring support as soon as possible.",
};

export const UNSUPPORTED_CPU_REFUSAL =
  "On-device models can't run on this phone's processor yet.";
