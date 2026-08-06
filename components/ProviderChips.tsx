import { HorizontalScrollRow } from '@/components/HorizontalScrollRow';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { StreamingProvider } from '@/constants/providers';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ProviderChipsProps {
  providers: StreamingProvider[];
  selectedProvider: number | null;
  onSelectProvider: (providerId: number | null) => void;
}

export const ProviderChips = ({
  providers,
  selectedProvider,
  onSelectProvider,
}: ProviderChipsProps) => {
  const isDesktop = useIsDesktop();

  const chips = (
    <>
      <TouchableOpacity
        style={[styles.chip, selectedProvider === null && styles.chipSelected]}
        onPress={() => onSelectProvider(null)}
        activeOpacity={0.8}
      >
        <View style={styles.allChipIcon}>
          <Text style={styles.allChipText}>ALL</Text>
        </View>
      </TouchableOpacity>

      {providers.map((provider) => {
        const logoUrl = `https://image.tmdb.org/t/p/original${provider.logo_path}`;

        return (
          <TouchableOpacity
            key={provider.id}
            style={[
              styles.chip,
              selectedProvider === provider.id && styles.chipSelected,
              selectedProvider === provider.id && { borderColor: provider.color },
            ]}
            onPress={() => onSelectProvider(provider.id)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: logoUrl }} style={styles.providerLogo} resizeMode="contain" />
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (!isDesktop) {
    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {chips}
        </ScrollView>
      </View>
    );
  }

  return (
    <HorizontalScrollRow
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      buttonTop={12}
    >
      {chips}
    </HorizontalScrollRow>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.card,
    borderColor: Colors.accent,
  },
  allChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allChipText: {
    color: Colors.text,
    fontSize: 10,
    fontFamily: Fonts.GeistMono.Bold,
    letterSpacing: 0.5,
  },
  providerLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
});
