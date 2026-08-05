import { useState, useEffect, useCallback } from 'react';
import * as Application from 'expo-application';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

const GITHUB_OWNER = 'kunalkcube';
const GITHUB_REPO = 'yummy';

export function useVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkForUpdates = useCallback(async () => {
    try {
      const currentVersion = Application.nativeApplicationVersion!;

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
      );

      if (!response.ok) {
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const latestVersion = data.tag_name.replace('v', '');

      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

      if (hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          latestVersion,
          currentVersion,
          releaseNotes: data.body || 'Bug fixes and improvements',
          downloadUrl: data.html_url,
        });
      }
    } catch { } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return { updateInfo, isLoading, checkForUpdates };
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }

  return 0;
}
