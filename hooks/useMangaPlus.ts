import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useEffect, useState } from 'react';

const MANGAPLUS_BASE_URL = process.env.EXPO_PUBLIC_MANGAPLUS_BASE_URL!;
const DEVICE_ID_KEY = '@mangaplus_device_id';
const DEVICE_SECRET_KEY = '@mangaplus_device_secret';

// Types based on API responses
export interface MangaPlusTitle {
  titleId: number;
  name: string;
  author: string;
  portraitImageUrl: string;
  landscapeImageUrl: string;
  viewCount: number;
  language: string;
  titleUpdateStatus: string;
  favoriteImageUrl: string;
}

export interface MangaPlusChapter {
  titleId: number;
  chapterId: number;
  name: string;
  subTitle: string;
  thumbnailUrl: string;
  startTimeStamp: string;
  endTimeStamp: string;
  alreadyViewed: boolean;
  isVerticalOnly: boolean;
  isHorizontalOnly: boolean;
  viewCount: number;
  commentCount: number;
}

export interface MangaPlusTitleGroup {
  titles: MangaPlusTitle[];
  tags?: Array<{ tag: string; slug: string }>;
  theTitle: string;
  label?: { label: string; description: string };
  nextChapterStartTimestamp?: string;
}

export interface MangaPlusTitleDetail {
  title: MangaPlusTitle;
  titleImageUrl: string;
  overview: string;
  backgroundImageUrl: string;
  tags: Array<{ tag: string; slug: string }>;
  chapterListV2: MangaPlusChapter[];
  numberOfViews: number;
  isSimulReleased: boolean;
  rating: string;
  label?: { label: string; description: string };
}

export interface MangaPlusUpdate {
  titleGroups: Array<{
    titles: Array<{
      title: MangaPlusTitle;
      chapterId: number;
      chapterName: string;
      chapterSubTitle: string;
      isLatest: boolean;
    }>;
    theTitle: string;
    chapterNumber: string;
    viewCount: number;
    titleUpdateStatus: string;
    chapterStartTime: number;
  }>;
  groupName: string;
  groupNameDays: number;
}

export interface MangaPlusRanking {
  titles: MangaPlusTitle[];
  originalTitleId: number;
  score: number;
}

// Singleton state manager
class MangaPlusManager {
  private static instance: MangaPlusManager;
  private deviceId: string | null = null;
  private deviceSecret: string | null = null;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): MangaPlusManager {
    if (!MangaPlusManager.instance) {
      MangaPlusManager.instance = new MangaPlusManager();
    }
    return MangaPlusManager.instance;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.deviceId) {
      return;
    }

    // If currently initializing, wait for that to complete
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🔄 Starting MangaPlus device initialization...');
      let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      let storedDeviceSecret = await AsyncStorage.getItem(DEVICE_SECRET_KEY);

      if (!storedDeviceId || !storedDeviceSecret) {
        console.log('📝 No stored device found, registering new device...');
        const newDeviceId = `device-${Date.now()}`;
        const response = await axios.post(`${MANGAPLUS_BASE_URL}/register`, {
          deviceId: newDeviceId,
          lang: 'eng',
          clang: ['eng'],
          viewer: 'vertical',
        });

        if (response.data.registerationData?.deviceSecret) {
          const deviceSecret = response.data.registerationData.deviceSecret;

          await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
          await AsyncStorage.setItem(DEVICE_SECRET_KEY, deviceSecret);

          storedDeviceId = newDeviceId;
          storedDeviceSecret = deviceSecret;

          console.log('✅ MangaPlus device registered:', newDeviceId);
        } else {
          console.error('❌ Registration response missing deviceSecret');
        }
      } else {
        console.log('✅ Using stored device:', storedDeviceId);
      }

      if (storedDeviceId && storedDeviceSecret) {
        this.deviceId = storedDeviceId;
        this.deviceSecret = storedDeviceSecret;
        console.log('✅ MangaPlus initialized with device:', storedDeviceId);
      } else {
        console.error('❌ Failed to get device credentials');
      }
    } catch (error) {
      console.error('❌ Error initializing MangaPlus device:', error);
    } finally {
      this.isInitialized = true;
      this.isInitializing = false;
      this.initPromise = null;
      this.notify();
    }
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

const manager = MangaPlusManager.getInstance();

export const useMangaPlus = () => {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Start initialization
    manager.initialize();

    // Subscribe to changes
    const unsubscribe = manager.subscribe(() => {
      forceUpdate({});
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const deviceId = manager.getDeviceId();
  const isInitialized = manager.getIsInitialized();

  // Fetch latest updates
  const fetchUpdates = async (): Promise<MangaPlusUpdate[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/updates`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.homeViewV3?.groups || [];
    } catch (error: any) {
      console.error('Error fetching updates:', error.response?.data || error.message);
      return [];
    }
  };

  // Search all titles
  const searchTitles = async (query?: string, titleType?: 'serializing' | 'completed' | 'one-shot'): Promise<MangaPlusTitleGroup[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      console.log(`🔍 Searching MangaPlus titles${query ? ` for: "${query}"` : ''}`);
      
      let allTitles: MangaPlusTitleGroup[] = [];
      
      // If no titleType specified, use /titles/search to get ALL titles
      if (!titleType) {
        const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/search`, {
          params: { deviceId: currentDeviceId },
        });
        allTitles = response.data.searchView?.allTitlesGroup || [];
      } else {
        // If titleType specified, use /titles/all with filter
        const params: any = { deviceId: currentDeviceId, titleType };
        const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/all`, { params });
        allTitles = response.data.searchView?.allTitlesGroup || [];
      }
      
      console.log(`📚 Loaded ${allTitles.length} title groups from MangaPlus`);
      
      if (query) {
        const lowerQuery = query.toLowerCase();
        // Filter groups where the title name OR any manga in the group matches
        const filtered = allTitles.filter((group: MangaPlusTitleGroup) => {
          // Check group title
          if (group.theTitle.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          // Check individual manga titles in the group
          return group.titles.some(title => 
            title.name.toLowerCase().includes(lowerQuery) ||
            title.author.toLowerCase().includes(lowerQuery)
          );
        });
        console.log(`✅ Found ${filtered.length} matching groups for "${query}"`);
        return filtered;
      }

      return allTitles;
    } catch (error: any) {
      console.error('❌ Error searching titles:', error.response?.data || error.message);
      return [];
    }
  };

  // Get search page data (includes all titles and tags)
  const getSearchData = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return null;
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/search`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.searchView;
    } catch (error: any) {
      console.error('Error fetching search data:', error.response?.data || error.message);
      return null;
    }
  };

  // Fetch rankings
  const fetchRanking = async (ranking: 'hottest' | 'trending' | 'completed' = 'hottest'): Promise<MangaPlusRanking[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/ranking`, {
        params: { deviceId: currentDeviceId, ranking },
      });

      return response.data.titleRankingViewV2?.rankedTitles || [];
    } catch (error: any) {
      console.error('Error fetching ranking:', error.response?.data || error.message);
      return [];
    }
  };

  // Fetch title details
  const fetchTitleDetails = async (titleId: number): Promise<MangaPlusTitleDetail | null> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return null;
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/title/${titleId}`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.titleDetailView;
    } catch (error: any) {
      console.error('Error fetching title details:', error.response?.data || error.message);
      return null;
    }
  };

  // Fetch favorites
  const fetchFavorites = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/favorites`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.favoriteTitlesView?.favoriteTitles || [];
    } catch (error: any) {
      console.error('Error fetching favorites:', error.response?.data || error.message);
      return [];
    }
  };

  // Add to favorites
  const addFavorite = async (titleId: number): Promise<boolean> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return false;
    }

    try {
      await axios.post(`${MANGAPLUS_BASE_URL}/favorites/${titleId}`, {
        deviceId: currentDeviceId,
      });
      return true;
    } catch (error: any) {
      console.error('Error adding favorite:', error.response?.data || error.message);
      return false;
    }
  };

  // Remove from favorites
  const removeFavorite = async (titleId: number): Promise<boolean> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return false;
    }

    try {
      await axios.delete(`${MANGAPLUS_BASE_URL}/favorites/${titleId}`, {
        params: { deviceId: currentDeviceId },
      });
      return true;
    } catch (error: any) {
      console.error('Error removing favorite:', error.response?.data || error.message);
      return false;
    }
  };

  // Fetch reading history
  const fetchHistory = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/history`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.historyView?.viewHistory || [];
    } catch (error: any) {
      console.error('Error fetching history:', error.response?.data || error.message);
      return [];
    }
  };

  // Fetch free titles
  const fetchFreeTitles = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.log('Device not initialized');
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/free`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.allFreeTitlesView?.freeTitles || [];
    } catch (error: any) {
      console.error('Error fetching free titles:', error.response?.data || error.message);
      return [];
    }
  };

  // Fetch chapter pages for reading
  const fetchChapterPages = async (chapterId: number, quality: 'low' | 'high' | 'super_high' = 'super_high'): Promise<string[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      console.error('❌ fetchChapterPages called without deviceId');
      return [];
    }

    try {
      console.log(`📖 Fetching chapter ${chapterId} with quality: ${quality}`);
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/chapter/${chapterId}`, {
        params: { 
          deviceId: currentDeviceId,
          quality,
          split: true,
        },
      });

      console.log('📦 Chapter response received');

      // Extract page URLs from mangaViewer
      const mangaViewer = response.data.mangaViewer;
      if (!mangaViewer) {
        console.error('❌ No mangaViewer in response');
        console.log('Response keys:', Object.keys(response.data));
        return [];
      }

      if (!mangaViewer.pages) {
        console.error('❌ No pages in mangaViewer');
        console.log('MangaViewer keys:', Object.keys(mangaViewer));
        return [];
      }

      console.log(`📄 Found ${mangaViewer.pages.length} pages in response`);

      // Filter out non-image pages and extract URLs
      const pageUrls = mangaViewer.pages
        .filter((page: any) => page.mangaPage && page.mangaPage.imageUrl)
        .map((page: any) => page.mangaPage.imageUrl);

      console.log(`✅ Extracted ${pageUrls.length} image URLs`);
      return pageUrls;
    } catch (error: any) {
      console.error('❌ Error fetching chapter pages:', error.response?.data || error.message);
      return [];
    }
  };

  return {
    isInitialized,
    deviceId,
    fetchUpdates,
    searchTitles,
    getSearchData,
    fetchRanking,
    fetchTitleDetails,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    fetchHistory,
    fetchFreeTitles,
    fetchChapterPages,
  };
};
