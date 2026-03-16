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

export function getSpotifyPlaylistId(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (raw.startsWith("spotify:playlist:")) return raw.replace("spotify:playlist:", "").trim() || null;
  const marker = "/playlist/";
  const idx = raw.indexOf(marker);
  if (idx >= 0) {
    const rest = raw.slice(idx + marker.length);
    const id = rest.split("?")[0]?.split("/")[0]?.trim();
    return id || null;
  }
  return null;
}

export function toSpotifyPlaylistUrl(playlistId: string): string {
  return `https://open.spotify.com/playlist/${playlistId}`;
}

export function toSpotifyPlaylistEmbedUrl(playlistId: string): string {
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}
