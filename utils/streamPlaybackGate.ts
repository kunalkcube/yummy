import { AppAlert } from '@/components/AppAlert';
import { CATALOG_PROVIDER_ID } from '@/constants/streamProviders';
import {
  STREAM_DISCLAIMER_MESSAGE,
  STREAM_DISCLAIMER_TITLE,
} from '@/constants/streamDisclaimer';

type GateOptions = {
  streamDisclaimerAccepted: boolean;
  streamProvider: string;
  streamUrl: string;
  /** User-supplied service domain; required when the catalog provider is picked. */
  catalogDomain: string;
  acceptStreamDisclaimer: () => Promise<void>;
  openSettings: () => void;
  onReady: () => void;
};

const hasConfiguredSource = (
  streamProvider: string,
  streamUrl: string,
  catalogDomain: string
) => {
  if (!streamProvider) return false;
  if (streamProvider === 'custom') return Boolean(streamUrl.trim());
  if (streamProvider === CATALOG_PROVIDER_ID) return Boolean(catalogDomain.trim());
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

const promptCatalogDomain = (openSettings: () => void) => {
  AppAlert.alert(
    'Add your service domain',
    'This source needs the domain of the OTT service you use. Add it in Settings under Catalog Service, then activate a session.',
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
  catalogDomain,
  acceptStreamDisclaimer,
  openSettings,
  onReady,
}: GateOptions) {
  const proceed = () => {
    if (streamProvider === CATALOG_PROVIDER_ID && !catalogDomain.trim()) {
      promptCatalogDomain(openSettings);
      return;
    }
    if (!hasConfiguredSource(streamProvider, streamUrl, catalogDomain)) {
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
  streamUrl: string,
  catalogDomain: string
) {
  return (
    streamDisclaimerAccepted &&
    hasConfiguredSource(streamProvider, streamUrl, catalogDomain)
  );
}
