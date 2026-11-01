import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface TmdbDnsModule {
  getEnabled(): boolean;
  setEnabled(enabled: boolean): Promise<void>;
}

const nativeDns = Platform.OS === 'android'
  ? requireOptionalNativeModule<TmdbDnsModule>('YummyTmdbDns')
  : null;

export const isTmdbDnsAvailable = nativeDns !== null;
export const getTmdbDnsEnabled = () => nativeDns?.getEnabled() ?? false;

export const applyTmdbDnsEnabled = async (enabled: boolean) => {
  if (!nativeDns) throw new Error('Cloudflare DNS requires an Android build of Yummy.');
  await nativeDns.setEnabled(enabled);
};
