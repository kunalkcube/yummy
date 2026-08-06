import { useCallback, useEffect, useState } from 'react';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

const GITHUB_OWNER = 'kunalkcube';
const GITHUB_REPO = 'yummy';

function getCurrentVersion(): string | null {
  // Native Android/iOS package version. Always null on web / Tauri.
  if (Application.nativeApplicationVersion) {
    return Application.nativeApplicationVersion;
  }
  // Expo web / desktop shell: use app.json / expo config version.
  return Constants.expoConfig?.version ?? null;
}

export function useVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkForUpdates = useCallback(async () => {
    try {
      const currentVersion = getCurrentVersion();
      if (!currentVersion) {
        return;
      }

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const latestVersion = String(data.tag_name ?? '').replace(/^v/i, '');
      if (!latestVersion) {
        return;
      }

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
    } catch {
      // Network / parse failures: fail closed (no alert).
    } finally {
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
