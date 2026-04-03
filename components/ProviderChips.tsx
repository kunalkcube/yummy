import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { StreamingProvider } from '@/constants/providers';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ProviderChipsProps {
  providers: StreamingProvider[];
  selectedProvider: number | null;
  onSelectProvider: (providerId: number | null) => void;
}

export const ProviderChips = ({ providers, selectedProvider, onSelectProvider }: ProviderChipsProps) => {
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            selectedProvider === null && styles.chipSelected,
          ]}
          onPress={() => onSelectProvider(null)}
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
            >
              <Image 
                source={{ uri: logoUrl }} 
                style={styles.providerLogo}
                resizeMode="contain"
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 15,
    gap: 12,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.card,
    borderColor: Colors.accent,
  },
  allChipIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allChipText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.GeistMono.Bold,
  },
  providerLogo: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
});
