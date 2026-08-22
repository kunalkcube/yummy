import { AppAlert } from '@/components/AppAlert';
import {
  STREAM_DISCLAIMER_MESSAGE,
  STREAM_DISCLAIMER_TITLE,
} from '@/constants/streamDisclaimer';

type GateOptions = {
  streamDisclaimerAccepted: boolean;
  streamProvider: string;
  streamUrl: string;
  acceptStreamDisclaimer: () => Promise<void>;
  openSettings: () => void;
  onReady: () => void;
};

const hasConfiguredSource = (streamProvider: string, streamUrl: string) => {
  if (!streamProvider) return false;
  if (streamProvider === 'custom') return Boolean(streamUrl.trim());
  return true;
};

const promptChooseProvider = (openSettings: () => void) => {
  AppAlert.alert(
    'Choose a stream source',
    'Accept the third-party notice in Settings, then pick an embed provider or paste a custom URL.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: openSettings,
      },
    ]
  );
};

/**
 * Ensures disclaimer acceptance + configured provider before opening the player.
 * Shows AppAlert prompts when blocked.
 */
export function ensureStreamPlaybackReady({
  streamDisclaimerAccepted,
  streamProvider,
  streamUrl,
  acceptStreamDisclaimer,
  openSettings,
  onReady,
}: GateOptions) {
  const proceed = () => {
    if (!hasConfiguredSource(streamProvider, streamUrl)) {
      promptChooseProvider(openSettings);
      return;
    }
    onReady();
  };

  if (!streamDisclaimerAccepted) {
    AppAlert.alert(STREAM_DISCLAIMER_TITLE, STREAM_DISCLAIMER_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'I understand',
        onPress: () => {
          void (async () => {
            await acceptStreamDisclaimer();
            proceed();
          })();
        },
      },
    ]);
    return;
  }

  proceed();
}

export function isStreamPlaybackConfigured(
  streamDisclaimerAccepted: boolean,
  streamProvider: string,
  streamUrl: string
) {
  return streamDisclaimerAccepted && hasConfiguredSource(streamProvider, streamUrl);
}
