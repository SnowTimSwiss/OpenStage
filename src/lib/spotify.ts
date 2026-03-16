export const SPOTIFY_CLIENT_ID_STORAGE_KEY = "openstage-spotify-client-id-v1";

export function getStoredSpotifyClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SPOTIFY_CLIENT_ID_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredSpotifyClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = clientId.trim();
  try {
    if (trimmed) localStorage.setItem(SPOTIFY_CLIENT_ID_STORAGE_KEY, trimmed);
    else localStorage.removeItem(SPOTIFY_CLIENT_ID_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function resolveSpotifyClientId(envClientId: string | undefined): string {
  return getStoredSpotifyClientId() || (envClientId || "").trim();
}

