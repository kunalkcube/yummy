import { AppAlert } from '@/components/AppAlert';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { CATALOG_SESSION_TTL_MS } from '@/constants/catalog';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { webInputReset } from '@/constants/inputStyles';
import { STREAM_DISCLAIMER_MESSAGE, STREAM_DISCLAIMER_TITLE } from '@/constants/streamDisclaimer';
import {
  CATALOG_PROVIDER_ID,
  getProviderHostname,
  getStreamProvider,
  STREAM_PROVIDERS,
} from '@/constants/streamProviders';
import { useSettings } from '@/contexts/SettingsContext';
import { useCatalog } from '@/hooks/useCatalog';
import { isTmdbDnsAvailable } from '@/utils/tmdbDns';
import axios, { isAxiosError } from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Eye, EyeOff,
  Film, Info, KeyRound, ListVideo, LockKeyhole, Network, Play, Plus, Radio, ShieldCheck, Trash2, X,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, type TextInputProps, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SETTINGS_TABS = ['General', 'Playback', 'IPTV', 'About'] as const;
type SettingsTab = typeof SETTINGS_TABS[number];
type SaveTarget = 'api' | 'provider' | 'domain' | 'stream';

const getPlaylistHost = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Invalid URL';
  }
};

function SettingsField({ label, trailing, ...props }: TextInputProps & {
  label: string;
  trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputContainer, focused && styles.inputFocused]}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing}
      </View>
    </View>
  );
}

function SettingsButton({ label, onPress, secondary = false, disabled = false, loading = false }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button, secondary ? styles.secondaryButton : styles.primaryButton,
        (disabled || loading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading && <ActivityIndicator size="small" color={secondary ? Colors.text : Colors.background} />}
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const {
    streamUrl, tmdbApiKey, streamProvider, streamDisclaimerAccepted, catalogDomain,
    tmdbDnsEnabled, setTmdbDnsEnabled,
    iptvPlaylists, iptvChannels, setStreamUrl, setTmdbApiKey, setStreamProvider,
    acceptStreamDisclaimer, setCatalogDomain, addIptvPlaylist, removeIptvPlaylist,
    addIptvChannel, removeIptvChannel,
  } = useSettings();
  const {
    isActive: catalogActive, isSessionFresh: catalogSessionFresh,
    startActivation, pollActivation, deactivate: deactivateCatalog,
  } = useCatalog();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const apiKeyEdited = useRef(false);
  const apiTestController = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('General');
  const [localStreamUrl, setLocalStreamUrl] = useState(streamUrl);
  const [localApiKey, setLocalApiKey] = useState(tmdbApiKey);
  const [localProvider, setLocalProvider] = useState(streamProvider);
  const [localCatalogDomain, setLocalCatalogDomain] = useState(catalogDomain);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiTest, setApiTest] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [apiTestMessage, setApiTestMessage] = useState('');
  const [dnsApplying, setDnsApplying] = useState(false);
  const [saving, setSaving] = useState<SaveTarget | null>(null);
  const [catalogActivating, setCatalogActivating] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState('');
  const [adding, setAdding] = useState<'playlist' | 'channel' | null>(null);
  const [playlistFormOpen, setPlaylistFormOpen] = useState(false);
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [iptvPlaylistName, setIptvPlaylistName] = useState('');
  const [iptvPlaylistUrl, setIptvPlaylistUrl] = useState('');
  const [iptvChannelName, setIptvChannelName] = useState('');
  const [iptvChannelUrl, setIptvChannelUrl] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      apiTestController.current?.abort();
    };
  }, []);

  useEffect(() => { setLocalProvider(streamProvider); }, [streamProvider]);
  useEffect(() => { setLocalStreamUrl(streamUrl); }, [streamUrl]);
  useEffect(() => { setLocalCatalogDomain(catalogDomain); }, [catalogDomain]);
  useEffect(() => {
    if (!apiKeyEdited.current) setLocalApiKey(tmdbApiKey);
  }, [tmdbApiKey]);

  const apiDirty = localApiKey.trim() !== tmdbApiKey;
  const providerDirty = localProvider !== streamProvider;
  const domainDirty = localCatalogDomain.trim() !== catalogDomain;
  const streamDirty = localStreamUrl.trim() !== streamUrl;
  const selectedProvider = getStreamProvider(localProvider);
  const savedProvider = getStreamProvider(streamProvider);
  const playbackDirty = providerDirty ||
    (localProvider === 'custom' && streamDirty) ||
    (localProvider === CATALOG_PROVIDER_ID && domainDirty);
  const catalogReady = catalogActive && catalogSessionFresh;
  const catalogStatusLabel = !catalogDomain ? 'Domain needed'
    : catalogReady ? 'Activated on this device'
      : catalogActive ? 'Session expired' : 'Activation needed';

  const changeTab = (tab: SettingsTab) => {
    Keyboard.dismiss();
    setShowApiKey(false);
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const saveSetting = async (target: SaveTarget, save: () => Promise<void>) => {
    if (saving) return;
    setSaving(target);
    try {
      await save();
    } catch (error) {
      AppAlert.alert('Not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (mounted.current) setSaving(null);
    }
  };

  const handleSaveProvider = () => {
    if (!streamDisclaimerAccepted || !selectedProvider) return;
    if (localProvider === CATALOG_PROVIDER_ID && !catalogDomain) {
      AppAlert.alert('Save your service domain', 'Add and save a domain below before saving this provider.');
      return;
    }
    void saveSetting('provider', async () => {
      if (selectedProvider.baseUrl) await setStreamUrl(selectedProvider.baseUrl);
      await setStreamProvider(localProvider);
    });
  };

  const testAPI = async () => {
    const key = localApiKey.trim();
    if (!key || apiTest === 'testing') return;
    apiTestController.current?.abort();
    const controller = new AbortController();
    apiTestController.current = controller;
    setApiTest('testing');
    setApiTestMessage('Checking your connection to TMDB…');
    try {
      const isBearerToken = key.startsWith('eyJ') || key.length > 100;
      await axios.get('https://api.themoviedb.org/3/trending/all/week', {
        ...(isBearerToken
          ? { headers: { accept: 'application/json', Authorization: `Bearer ${key}` } }
          : { params: { api_key: key } }),
        timeout: 15_000,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setApiTest('valid');
      setApiTestMessage('Connected to TMDB.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setApiTest('invalid');
      const status = isAxiosError(error) ? error.response?.status : undefined;
      setApiTestMessage(status === 401 || status === 403
        ? 'Credential not accepted. Check your API key or read access token.'
        : 'Could not reach TMDB. Check your connection and try again.');
    }
  };

  const handleToggleDns = async () => {
    if (dnsApplying) return;
    setDnsApplying(true);
    apiTestController.current?.abort();
    setApiTest('idle');
    setApiTestMessage('');
    try {
      await setTmdbDnsEnabled(!tmdbDnsEnabled);
    } catch (error) {
      AppAlert.alert('DNS setting not changed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (mounted.current) setDnsApplying(false);
    }
  };

  const handleCatalogActivate = async () => {
    if (catalogActivating || !catalogDomain || domainDirty) return;
    setCatalogActivating(true);
    setCatalogStatus('Preparing activation…');
    try {
      const begun = await startActivation();
      if (!mounted.current) return;
      if (!begun) {
        AppAlert.alert('Activation unavailable', 'Check your service domain and connection, then try again.');
        return;
      }
      setCatalogStatus('Complete the ad check in your browser, then return here.');
      await Linking.openURL(begun.adUrl);
      if (!mounted.current) return;
      const session = await pollActivation(begun.baseUrl, begun.addHash, (status) => {
        if (mounted.current && status) setCatalogStatus(status);
      });
      if (!mounted.current) return;
      if (!session) {
        AppAlert.alert('Activation timed out', 'Try again and keep the opened ad page for about 30 seconds.');
      }
    } catch {
      if (mounted.current) AppAlert.alert('Activation failed', 'Could not complete activation. Please try again.');
    } finally {
      if (mounted.current) {
        setCatalogStatus('');
        setCatalogActivating(false);
      }
    }
  };

  const handleAddIptvPlaylist = async () => {
    if (adding) return;
    setAdding('playlist');
    try {
      await addIptvPlaylist({ name: iptvPlaylistName, url: iptvPlaylistUrl });
      setIptvPlaylistName('');
      setIptvPlaylistUrl('');
      setPlaylistFormOpen(false);
    } catch (error) {
      AppAlert.alert('Playlist not added', error instanceof Error ? error.message : 'Check the playlist details.');
    } finally {
      setAdding(null);
    }
  };

  const handleAddIptvChannel = async () => {
    if (adding) return;
    setAdding('channel');
    try {
      await addIptvChannel({ name: iptvChannelName, url: iptvChannelUrl });
      setIptvChannelName('');
      setIptvChannelUrl('');
      setChannelFormOpen(false);
    } catch (error) {
      AppAlert.alert('Channel not added', error instanceof Error ? error.message : 'Check the channel details.');
    } finally {
      setAdding(null);
    }
  };

  const confirmRemoveIptvPlaylist = (id: string, name: string) => {
    AppAlert.alert('Remove playlist', `Remove ${name} and its saved favorites and recent channels?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => void removeIptvPlaylist(id).catch(() => AppAlert.alert('Not removed', 'Please try again.')),
      },
    ]);
  };

  const confirmRemoveIptvChannel = (id: string, name: string) => {
    AppAlert.alert('Remove channel', `Remove ${name} from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => void removeIptvChannel(id).catch(() => AppAlert.alert('Not removed', 'Please try again.')),
      },
    ]);
  };

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
              style={styles.backButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.pageTitle}>Settings</Text>
              <Text style={styles.pageSubtitle}>Make Yummy yours.</Text>
            </View>
          </View>
          <View style={styles.tabs} accessibilityRole="tablist">
            {SETTINGS_TABS.map((tab) => {
              const selected = activeTab === tab;
              const dirty = tab === 'General' ? apiDirty : tab === 'Playback' && playbackDirty;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, selected && styles.tabSelected]}
                  onPress={() => changeTab(tab)}
                  activeOpacity={0.85}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${tab}${dirty ? ', unsaved changes' : ''}`}
                >
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab}</Text>
                  {dirty && <View style={styles.unsavedDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'General' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}><Film size={20} color={Colors.text} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Movie & TV discovery</Text>
                    <Text style={styles.description}>Connect TMDB to discover titles, cast, and recommendations.</Text>
                  </View>
                </View>
                <View style={styles.statusRow}>
                  {tmdbApiKey ? <Check size={14} color={Colors.text} /> : <KeyRound size={14} color={Colors.textSecondary} />}
                  <Text style={styles.statusText}>{tmdbApiKey ? 'Credential saved on this device' : 'Setup needed'}</Text>
                  {apiDirty && <Text style={styles.unsavedText}>Unsaved</Text>}
                </View>
                <SettingsField
                  label="TMDB credential"
                  value={localApiKey}
                  onChangeText={(value) => {
                    apiKeyEdited.current = true;
                    apiTestController.current?.abort();
                    setLocalApiKey(value);
                    setApiTest('idle');
                    setApiTestMessage('');
                  }}
                  placeholder="API key or read access token"
                  secureTextEntry={!showApiKey}
                  trailing={
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setShowApiKey(!showApiKey)}
                      accessibilityRole="button"
                      accessibilityLabel={showApiKey ? 'Hide TMDB credential' : 'Show TMDB credential'}
                    >
                      {showApiKey ? <EyeOff size={18} color={Colors.textSecondary} /> : <Eye size={18} color={Colors.textSecondary} />}
                    </TouchableOpacity>
                  }
                />
                <Text style={styles.hint}>Accepts a v3 API key or API read access token. Stored only on this device.</Text>
                <View style={styles.buttonRow}>
                  <SettingsButton
                    label={saving === 'api' ? 'Saving…' : 'Save credential'}
                    onPress={() => void saveSetting('api', () => setTmdbApiKey(localApiKey.trim()))}
                    disabled={!apiDirty || saving !== null}
                    loading={saving === 'api'}
                  />
                  <SettingsButton
                    label={apiTest === 'testing' ? 'Testing…' : 'Test connection'}
                    onPress={() => void testAPI()}
                    secondary
                    disabled={!localApiKey.trim() || dnsApplying}
                    loading={apiTest === 'testing'}
                  />
                </View>
                {apiTest !== 'idle' && (
                  <View style={styles.feedback} accessibilityLiveRegion="polite">
                    {apiTest === 'valid' ? <Check size={16} color={Colors.text} />
                      : apiTest === 'invalid' ? <Info size={16} color={Colors.accent} /> : null}
                    <Text style={[styles.feedbackText, apiTest === 'invalid' && styles.errorText]}>
                      {apiTestMessage}{apiTest === 'valid' && apiDirty ? ' Save to use this credential.' : ''}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.textLink}
                  onPress={() => void Linking.openURL('https://www.themoviedb.org/settings/api')}
                  accessibilityRole="link"
                  accessibilityLabel="Get a TMDB credential, opens TMDB in your browser"
                >
                  <Text style={styles.textLinkLabel}>Get a TMDB credential</Text>
                  <ArrowUpRight size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {Platform.OS === 'android' && (
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.headingIcon}><Network size={20} color={Colors.text} /></View>
                    <View style={styles.headingCopy}>
                      <Text style={styles.sectionTitle}>Connection</Text>
                      <Text style={styles.description}>Trouble loading TMDB on Wi-Fi or mobile data?</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.dnsToggle, tmdbDnsEnabled && styles.dnsToggleEnabled]}
                    onPress={() => void handleToggleDns()}
                    disabled={dnsApplying || !isTmdbDnsAvailable}
                    activeOpacity={0.85}
                    accessibilityRole="switch"
                    accessibilityLabel="Use Cloudflare DNS for TMDB"
                    accessibilityHint="Applies immediately to Yummy’s movie discovery and poster images only."
                    accessibilityState={{ checked: tmdbDnsEnabled, disabled: dnsApplying || !isTmdbDnsAvailable, busy: dnsApplying }}
                  >
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>Use Cloudflare DNS for TMDB</Text>
                      <Text style={styles.rowMeta}>Movie discovery & poster images</Text>
                    </View>
                    {dnsApplying ? <ActivityIndicator size="small" color={Colors.accent} /> : (
                      <View style={[styles.dnsIndicator, tmdbDnsEnabled && styles.dnsIndicatorEnabled]}>
                        <Text style={styles.dnsIndicatorText}>{tmdbDnsEnabled ? 'ON' : 'OFF'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.dnsStatus} accessibilityLiveRegion="polite">
                    {!isTmdbDnsAvailable ? 'Available in an Android build of Yummy.'
                      : dnsApplying ? 'Applying DNS setting…'
                        : tmdbDnsEnabled ? 'Cloudflare DNS enabled · saved on this device'
                          : 'Using your device’s DNS · off by default'}
                  </Text>
                  <Text style={styles.hint}>
                    Uses encrypted DNS inside Yummy. No Android settings to change.
                    If Cloudflare is unavailable, Yummy tries your device’s DNS.
                    This can help DNS-related loading issues, but not every network block.
                  </Text>
                  <Text style={styles.hint}>Applies immediately. Use Test connection above to check TMDB.</Text>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Your setup</Text>
                <TouchableOpacity style={styles.summaryRow} onPress={() => changeTab('Playback')} activeOpacity={0.85} accessibilityRole="button">
                  <Play size={18} color={Colors.textSecondary} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Playback</Text>
                    <Text style={styles.rowMeta}>{savedProvider ? savedProvider.name : 'Choose a stream provider'}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryRow} onPress={() => changeTab('IPTV')} activeOpacity={0.85} accessibilityRole="button">
                  <Radio size={18} color={Colors.textSecondary} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Live TV</Text>
                    <Text style={styles.rowMeta}>{iptvPlaylists.length} playlists · {iptvChannels.length} custom channels</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {activeTab === 'Playback' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}><Play size={20} color={Colors.text} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Stream provider</Text>
                    <Text style={styles.description}>Choose where movie and TV playback opens.</Text>
                  </View>
                </View>

                <View style={styles.notice}>
                  <TouchableOpacity
                    style={styles.noticeHeader}
                    onPress={() => setNoticeOpen(!noticeOpen)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: noticeOpen || !streamDisclaimerAccepted }}
                    accessibilityLabel={`${STREAM_DISCLAIMER_TITLE}, ${streamDisclaimerAccepted ? 'accepted' : 'review required'}`}
                  >
                    {streamDisclaimerAccepted ? <ShieldCheck size={18} color={Colors.textSecondary} /> : <LockKeyhole size={18} color={Colors.textSecondary} />}
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{STREAM_DISCLAIMER_TITLE}</Text>
                      <Text style={styles.rowMeta}>{streamDisclaimerAccepted ? 'Notice accepted on this device' : 'Review before choosing a provider'}</Text>
                    </View>
                    <ChevronDown size={18} color={Colors.textSecondary} style={(noticeOpen || !streamDisclaimerAccepted) && styles.chevronUp} />
                  </TouchableOpacity>
                  {(noticeOpen || !streamDisclaimerAccepted) && (
                    <View style={styles.noticeBody}>
                      <Text style={styles.hint}>{STREAM_DISCLAIMER_MESSAGE}</Text>
                      {!streamDisclaimerAccepted && (
                        <SettingsButton label="I understand — enable providers" onPress={() => void acceptStreamDisclaimer()} />
                      )}
                    </View>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Playback source</Text>
                <TouchableOpacity
                  style={[styles.providerSelector, !streamDisclaimerAccepted && styles.buttonDisabled]}
                  onPress={() => setProviderPickerOpen(!providerPickerOpen)}
                  disabled={!streamDisclaimerAccepted || saving === 'provider'}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose playback source, ${selectedProvider?.name ?? 'none selected'}`}
                  accessibilityState={{ expanded: providerPickerOpen, disabled: !streamDisclaimerAccepted || saving === 'provider' }}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{selectedProvider?.name ?? 'Choose a provider'}</Text>
                    <Text style={styles.rowMeta}>
                      {selectedProvider ? localProvider === CATALOG_PROVIDER_ID ? 'Native player · your service domain'
                        : localProvider === 'custom' ? 'Your own embed base URL'
                          : getProviderHostname(selectedProvider.baseUrl) : 'No default provider is selected'}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={Colors.textSecondary} style={providerPickerOpen && styles.chevronUp} />
                </TouchableOpacity>
                {providerPickerOpen && streamDisclaimerAccepted && (
                  <View style={styles.providerList} accessibilityRole="radiogroup" accessibilityLabel="Stream providers">
                    {STREAM_PROVIDERS.map((provider) => {
                      const selected = localProvider === provider.id;
                      return (
                        <TouchableOpacity
                          key={provider.id}
                          style={[styles.providerOption, selected && styles.providerOptionSelected]}
                          onPress={() => {
                            setLocalProvider(provider.id);
                            setProviderPickerOpen(false);
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                        >
                          <View style={styles.rowCopy}>
                            <Text style={styles.rowTitle}>{provider.name}</Text>
                            <Text style={styles.rowMeta}>
                              {provider.id === CATALOG_PROVIDER_ID ? 'Native only · domain and activation required'
                                : provider.id === 'custom' ? 'Use your own HTTPS embed URL'
                                  : getProviderHostname(provider.baseUrl)}
                            </Text>
                          </View>
                          <View style={[styles.radio, selected && styles.radioSelected]}>
                            {selected && <Check size={12} color={Colors.text} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={styles.saveStatus} accessibilityLiveRegion="polite">
                  <Text style={providerDirty ? styles.unsavedText : styles.statusText}>
                    {providerDirty ? 'Unsaved provider change' : savedProvider ? 'Saved on this device' : 'Select a provider to get started'}
                  </Text>
                </View>
                <View style={styles.buttonRow}>
                  <SettingsButton
                    label={saving === 'provider' ? 'Saving…' : 'Save provider'}
                    onPress={handleSaveProvider}
                    disabled={!streamDisclaimerAccepted || !localProvider || !providerDirty || saving !== null || (localProvider === CATALOG_PROVIDER_ID && !catalogDomain)}
                    loading={saving === 'provider'}
                  />
                </View>
              </View>

              {streamDisclaimerAccepted && localProvider === CATALOG_PROVIDER_ID && (
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.headingIcon}><KeyRound size={20} color={Colors.text} /></View>
                    <View style={styles.headingCopy}>
                      <Text style={styles.sectionTitle}>Catalog Service</Text>
                      <Text style={styles.description}>Connect your own compatible service. Native playback only.</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionLabel}>01 / Service domain</Text>
                  <SettingsField
                    label="Service domain"
                    value={localCatalogDomain}
                    onChangeText={setLocalCatalogDomain}
                    placeholder="example.com"
                    keyboardType="url"
                    editable={!catalogActivating && saving !== 'domain'}
                  />
                  <Text style={styles.hint}>Yummy includes no service domain. Changing it clears the previous session.</Text>
                  <View style={styles.buttonRow}>
                    <SettingsButton
                      label={saving === 'domain' ? 'Saving…' : 'Save domain'}
                      onPress={() => void saveSetting('domain', () => setCatalogDomain(localCatalogDomain))}
                      secondary
                      disabled={!localCatalogDomain.trim() || !domainDirty || catalogActivating || saving !== null}
                      loading={saving === 'domain'}
                    />
                  </View>
                  <Text style={styles.savedDomain} accessibilityLiveRegion="polite">
                    {domainDirty ? 'Unsaved domain change' : catalogDomain ? `Saved: ${catalogDomain}` : 'Save a domain before activating.'}
                  </Text>

                  <View style={styles.activationSection}>
                    <Text style={styles.sectionLabel}>02 / Activate playback</Text>
                    <View style={styles.statusRow} accessibilityLiveRegion="polite">
                      {catalogActivating ? <ActivityIndicator size="small" color={Colors.accent} />
                        : catalogReady ? <Check size={16} color={Colors.text} /> : <KeyRound size={16} color={Colors.textSecondary} />}
                      <Text style={styles.statusText}>{catalogActivating ? 'Activation in progress' : catalogStatusLabel}</Text>
                    </View>
                    <Text style={styles.hint}>
                      Activation opens an ad page in your browser. Keep it open for about 30 seconds, then return here.
                      Sessions last about {Math.round(CATALOG_SESSION_TTL_MS / 3_600_000)} hours.
                    </Text>
                    {catalogActivating && <Text style={styles.progressText} accessibilityLiveRegion="polite">{catalogStatus}</Text>}
                    {domainDirty && catalogDomain ? <Text style={styles.hint}>Save your domain change before activating.</Text> : null}
                    <View style={styles.buttonRow}>
                      <SettingsButton
                        label={catalogActivating ? 'Activating…' : catalogActive ? 'Re-activate' : 'Activate service'}
                        onPress={() => void handleCatalogActivate()}
                        disabled={!catalogDomain || domainDirty || saving !== null}
                        loading={catalogActivating}
                      />
                      {catalogActive && (
                        <SettingsButton
                          label="Deactivate"
                          secondary
                          disabled={catalogActivating}
                          onPress={() => AppAlert.alert('Deactivate service', 'Remove this service’s saved session from this device?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Deactivate', style: 'destructive', onPress: () => void deactivateCatalog() },
                          ])}
                        />
                      )}
                    </View>
                  </View>
                </View>
              )}

              {streamDisclaimerAccepted && localProvider === 'custom' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Custom stream URL</Text>
                  <Text style={styles.description}>Use a base URL that supports the movie and TV paths below.</Text>
                  <SettingsField
                    label="HTTPS embed base URL"
                    value={localStreamUrl}
                    onChangeText={setLocalStreamUrl}
                    placeholder="https://your-player.example"
                    keyboardType="url"
                  />
                  <View style={styles.codeBlock}>
                    <Text style={styles.codeText}>Movie /movie/{'{id}'}</Text>
                    <Text style={styles.codeText}>TV /tv/{'{id}'}/{'{season}'}/{'{episode}'}</Text>
                  </View>
                  <View style={styles.saveStatus} accessibilityLiveRegion="polite">
                    <Text style={streamDirty ? styles.unsavedText : styles.statusText}>{streamDirty ? 'Unsaved URL change' : 'No unsaved URL changes'}</Text>
                  </View>
                  <View style={styles.buttonRow}>
                    <SettingsButton
                      label={saving === 'stream' ? 'Saving…' : 'Save custom URL'}
                      onPress={() => void saveSetting('stream', () => setStreamUrl(localStreamUrl.trim()))}
                      disabled={!localStreamUrl.trim() || !streamDirty || saving !== null}
                      loading={saving === 'stream'}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {activeTab === 'IPTV' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}><ListVideo size={20} color={Colors.text} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Playlists</Text>
                    <Text style={styles.description}>Manage the M3U sources available in your IPTV tab.</Text>
                  </View>
                  <Text style={styles.count}>{iptvPlaylists.length}</Text>
                </View>
                <View style={styles.list}>
                  {iptvPlaylists.map((playlist) => (
                    <View key={playlist.id} style={styles.listItem}>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{playlist.name}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{getPlaylistHost(playlist.url)}</Text>
                      </View>
                      {playlist.isBuiltIn ? <Text style={styles.builtInLabel}>Built-in</Text> : (
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => confirmRemoveIptvPlaylist(playlist.id, playlist.name)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${playlist.name} playlist`}
                        ><Trash2 size={18} color={Colors.textSecondary} /></TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addToggle}
                  onPress={() => setPlaylistFormOpen(!playlistFormOpen)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: playlistFormOpen }}
                >
                  {playlistFormOpen ? <X size={18} color={Colors.text} /> : <Plus size={18} color={Colors.text} />}
                  <Text style={styles.addToggleText}>{playlistFormOpen ? 'Close playlist form' : 'Add playlist'}</Text>
                </TouchableOpacity>
                {playlistFormOpen && (
                  <View style={styles.addForm}>
                    <SettingsField label="Playlist name" value={iptvPlaylistName} onChangeText={setIptvPlaylistName} placeholder="My playlist" autoCapitalize="words" maxLength={80} />
                    <SettingsField label="HTTPS M3U URL" value={iptvPlaylistUrl} onChangeText={setIptvPlaylistUrl} placeholder="https://example.com/channels.m3u" keyboardType="url" />
                    <Text style={styles.hint}>Use a public HTTPS playlist without embedded credentials.</Text>
                    <View style={styles.buttonRow}>
                      <SettingsButton label={adding === 'playlist' ? 'Adding…' : 'Add playlist'} onPress={() => void handleAddIptvPlaylist()} disabled={!iptvPlaylistName.trim() || !iptvPlaylistUrl.trim() || adding !== null} loading={adding === 'playlist'} />
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}><Radio size={20} color={Colors.text} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Custom channels</Text>
                    <Text style={styles.description}>Save individual direct streams for quick access.</Text>
                  </View>
                  <Text style={styles.count}>{iptvChannels.length}</Text>
                </View>
                {iptvChannels.length ? (
                  <View style={styles.list}>
                    {iptvChannels.map((channel) => (
                      <View key={channel.id} style={styles.listItem}>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{channel.name}</Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>{getPlaylistHost(channel.streamUrl)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => confirmRemoveIptvChannel(channel.id, channel.name)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${channel.name}`}
                        ><Trash2 size={18} color={Colors.textSecondary} /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Radio size={26} color={Colors.textSecondary} />
                    <Text style={styles.emptyTitle}>Your channels, in one place</Text>
                    <Text style={styles.emptyDescription}>Add a direct stream URL to find it in the IPTV tab.</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addToggle}
                  onPress={() => setChannelFormOpen(!channelFormOpen)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: channelFormOpen }}
                >
                  {channelFormOpen ? <X size={18} color={Colors.text} /> : <Plus size={18} color={Colors.text} />}
                  <Text style={styles.addToggleText}>{channelFormOpen ? 'Close channel form' : 'Add channel'}</Text>
                </TouchableOpacity>
                {channelFormOpen && (
                  <View style={styles.addForm}>
                    <SettingsField label="Channel name" value={iptvChannelName} onChangeText={setIptvChannelName} placeholder="My channel" autoCapitalize="words" maxLength={80} />
                    <SettingsField label="Direct stream URL" value={iptvChannelUrl} onChangeText={setIptvChannelUrl} placeholder="https://example.com/live.m3u8" keyboardType="url" />
                    <Text style={styles.hint}>Use a public HTTP or HTTPS media stream, not a web page.</Text>
                    <View style={styles.buttonRow}>
                      <SettingsButton label={adding === 'channel' ? 'Adding…' : 'Add channel'} onPress={() => void handleAddIptvChannel()} disabled={!iptvChannelName.trim() || !iptvChannelUrl.trim() || adding !== null} loading={adding === 'channel'} />
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {activeTab === 'About' && (
            <>
              <View style={styles.aboutIntro}>
                <Text style={styles.aboutName}>Yummy</Text>
                <Text style={styles.version}>VERSION {Constants.expoConfig?.version ?? '—'}</Text>
                <Text style={styles.aboutDescription}>Movies, TV, manga, and live channels.{ '\n' }One personal media space.</Text>
              </View>
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}><ShieldCheck size={20} color={Colors.text} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Your data stays yours</Text>
                    <Text style={styles.description}>No Yummy account. No Yummy backend.</Text>
                  </View>
                </View>
                <Text style={styles.bodyText}>Credentials, service sessions, playlists, favorites, watchlist, watch history, and watched progress are stored locally on this device using AsyncStorage.</Text>
                <Text style={styles.bodyText}>The Android DNS preference stays in native device storage. When enabled, TMDB DNS queries go to Cloudflare, with device DNS as a fallback.</Text>
                <Text style={styles.bodyText}>Discovery and playback connect directly to the third-party services you use, including TMDB, manga sources, IPTV playlists, and your chosen stream provider.</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Made for the love of media</Text>
                <TouchableOpacity
                  style={styles.summaryRow}
                  onPress={() => void Linking.openURL('https://github.com/kunalkcube')}
                  activeOpacity={0.85}
                  accessibilityRole="link"
                  accessibilityLabel="Built by kunalkcube, opens GitHub"
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Built by kunalkcube</Text>
                    <Text style={styles.rowMeta}>Find the creator on GitHub</Text>
                  </View>
                  <ArrowUpRight size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.footerNote}>Discovery powered by TMDB. Yummy does not host or provide video files.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  pageTitle: { fontSize: 24, fontFamily: Fonts.GeistMono.Bold, color: Colors.text },
  pageSubtitle: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, minHeight: 48, paddingHorizontal: 2, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: Colors.accent },
  tabText: { fontSize: 12, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary },
  tabTextSelected: { color: Colors.text, fontFamily: Fonts.GeistMono.SemiBold },
  unsavedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  section: { marginBottom: 32 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  headingIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, lineHeight: 25 },
  sectionLabel: { fontSize: 11, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 },
  description: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 19, marginTop: 6, marginBottom: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusText: { fontSize: 11, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, flexShrink: 1, lineHeight: 17 },
  unsavedText: { fontSize: 11, fontFamily: Fonts.GeistMono.Medium, color: Colors.text, lineHeight: 17 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.GeistMono.Medium, color: Colors.text, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, minHeight: 50 },
  inputFocused: { borderColor: Colors.accent },
  input: { flex: 1, minWidth: 0, color: Colors.text, paddingHorizontal: 14, paddingVertical: 14, fontSize: 14, fontFamily: Fonts.GeistMono.Regular, ...webInputReset },
  hint: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 19, marginBottom: 14 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexGrow: 1, flexBasis: 140, minHeight: 48, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  primaryButton: { backgroundColor: Colors.text, borderColor: Colors.text },
  secondaryButton: { backgroundColor: Colors.surface, borderColor: Colors.border },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.background, fontSize: 12, fontFamily: Fonts.GeistMono.SemiBold, textAlign: 'center', flexShrink: 1 },
  secondaryButtonText: { color: Colors.text },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
  feedbackText: { flex: 1, fontSize: 12, fontFamily: Fonts.GeistMono.Regular, lineHeight: 19, color: Colors.textSecondary },
  errorText: { color: Colors.accent },
  textLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: 6 },
  textLinkLabel: { fontSize: 11, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, textDecorationLine: 'underline' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, lineHeight: 20 },
  rowMeta: { fontSize: 11, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 17, marginTop: 3 },
  notice: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, marginBottom: 24 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 64 },
  noticeBody: { paddingHorizontal: 14, paddingBottom: 14 },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  providerSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  providerList: { marginTop: 8, gap: 4 },
  providerOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', minHeight: 64 },
  providerOptionSelected: { backgroundColor: Colors.surface, borderColor: Colors.accent },
  radio: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: Colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  saveStatus: { marginTop: 10, marginBottom: 14 },
  dnsToggle: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 72, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.surface },
  dnsToggleEnabled: { borderColor: Colors.accent },
  dnsIndicator: { minWidth: 40, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 7, borderRadius: 6, backgroundColor: Colors.card },
  dnsIndicatorEnabled: { backgroundColor: Colors.accent },
  dnsIndicatorText: { fontSize: 10, fontFamily: Fonts.GeistMono.Bold, color: Colors.text },
  dnsStatus: { fontSize: 11, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, lineHeight: 18, marginTop: 12, marginBottom: 12 },
  savedDomain: { fontSize: 11, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 18, marginTop: 12 },
  activationSection: { marginTop: 24, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  progressText: { fontSize: 12, fontFamily: Fonts.GeistMono.Medium, color: Colors.text, lineHeight: 19, marginBottom: 14 },
  codeBlock: { borderLeftWidth: 2, borderLeftColor: Colors.border, paddingLeft: 12, gap: 6, marginVertical: 6 },
  codeText: { fontSize: 11, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 18 },
  count: { fontSize: 12, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, paddingTop: 4 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, minHeight: 68 },
  builtInLabel: { fontSize: 10, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  addToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 12, marginTop: 10 },
  addToggleText: { fontSize: 12, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text },
  addForm: { paddingTop: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 8, gap: 10 },
  emptyTitle: { fontSize: 13, fontFamily: Fonts.GeistMono.SemiBold, color: Colors.text, textAlign: 'center' },
  emptyDescription: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  aboutIntro: { paddingVertical: 12, marginBottom: 32 },
  aboutName: { fontSize: 34, fontFamily: Fonts.GeistMono.Bold, color: Colors.text },
  version: { fontSize: 10, fontFamily: Fonts.GeistMono.Medium, color: Colors.textSecondary, letterSpacing: 1.5, marginTop: 8 },
  aboutDescription: { fontSize: 13, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 22, marginTop: 20 },
  bodyText: { fontSize: 12, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 21, marginBottom: 12 },
  footerNote: { fontSize: 11, fontFamily: Fonts.GeistMono.Regular, color: Colors.textSecondary, lineHeight: 19, marginTop: 20 },
});
