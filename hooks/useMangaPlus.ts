import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

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
      let storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      let storedDeviceSecret = await AsyncStorage.getItem(DEVICE_SECRET_KEY);

      if (!storedDeviceId || !storedDeviceSecret) {
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
        }
      }

      if (storedDeviceId && storedDeviceSecret) {
        this.deviceId = storedDeviceId;
        this.deviceSecret = storedDeviceSecret;
      }
    } catch {
      // Registration/storage failures leave the client uninitialized
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
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/updates`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.homeViewV3?.groups || [];
    } catch (error: any) {
      return [];
    }
  };

  // Search all titles
  const searchTitles = async (query?: string, titleType?: 'serializing' | 'completed' | 'one-shot'): Promise<MangaPlusTitleGroup[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      
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
        return filtered;
      }

      return allTitles;
    } catch (error: any) {
      return [];
    }
  };

  // Get search page data (includes all titles and tags)
  const getSearchData = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return null;
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/search`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.searchView;
    } catch (error: any) {
      return null;
    }
  };

  // Fetch rankings
  const fetchRanking = useCallback(async (ranking: 'hottest' | 'trending' | 'completed' = 'hottest'): Promise<MangaPlusRanking[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/ranking`, {
        params: { deviceId: currentDeviceId, ranking },
      });

      return response.data.titleRankingViewV2?.rankedTitles || [];
    } catch (error: any) {
      return [];
    }
  }, []);

  // Fetch title details
  const fetchTitleDetails = useCallback(async (titleId: number): Promise<MangaPlusTitleDetail | null> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return null;
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/title/${titleId}`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.titleDetailView;
    } catch (error: any) {
      return null;
    }
  }, []);

  // Fetch favorites
  const fetchFavorites = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/favorites`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.favoriteTitlesView?.favoriteTitles || [];
    } catch (error: any) {
      return [];
    }
  };

  // Add to favorites
  const addFavorite = async (titleId: number): Promise<boolean> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return false;
    }

    try {
      await axios.post(`${MANGAPLUS_BASE_URL}/favorites/${titleId}`, {
        deviceId: currentDeviceId,
      });
      return true;
    } catch (error: any) {
      return false;
    }
  };

  // Remove from favorites
  const removeFavorite = async (titleId: number): Promise<boolean> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return false;
    }

    try {
      await axios.delete(`${MANGAPLUS_BASE_URL}/favorites/${titleId}`, {
        params: { deviceId: currentDeviceId },
      });
      return true;
    } catch (error: any) {
      return false;
    }
  };

  // Fetch reading history
  const fetchHistory = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/history`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.historyView?.viewHistory || [];
    } catch (error: any) {
      return [];
    }
  };

  // Fetch free titles
  const fetchFreeTitles = async () => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/titles/free`, {
        params: { deviceId: currentDeviceId },
      });

      return response.data.allFreeTitlesView?.freeTitles || [];
    } catch (error: any) {
      return [];
    }
  };

  // Fetch chapter pages for reading
  const fetchChapterPages = useCallback(async (chapterId: number, quality: 'low' | 'high' | 'super_high' = 'super_high'): Promise<string[]> => {
    await manager.initialize();
    const currentDeviceId = manager.getDeviceId();
    
    if (!currentDeviceId) {
      return [];
    }

    try {
      const response = await axios.get(`${MANGAPLUS_BASE_URL}/chapter/${chapterId}`, {
        params: { 
          deviceId: currentDeviceId,
          quality,
          split: true,
        },
      });


      // Extract page URLs from mangaViewer
      const mangaViewer = response.data.mangaViewer;
      if (!mangaViewer) {
        return [];
      }

      if (!mangaViewer.pages) {
        return [];
      }


      // Filter out non-image pages and extract URLs
      const pageUrls = mangaViewer.pages
        .filter((page: any) => page.mangaPage && page.mangaPage.imageUrl)
        .map((page: any) => page.mangaPage.imageUrl);

      return pageUrls;
    } catch (error: any) {
      return [];
    }
  }, []);

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
