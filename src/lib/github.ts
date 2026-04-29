import type { GitHubRepoContent, RepositorySong, Song } from "../types";

const REPO_OWNER = "SnowTimSwiss";
const REPO_NAME = "OpenStage-songs";
const REPO_PATH = ""; // Root directory

export function getSongFileName(title: string): string {
  return `${title.replace(/[^a-z0-9]/gi, "-")}.json`;
}

/**
 * Fetch repository contents (list of files)
 */
export async function fetchRepoContents(): Promise<GitHubRepoContent[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${REPO_PATH}`;

  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(`Failed to fetch repo contents: ${response.statusText}`);
  }

  const data = await response.json();

  // Filter to only JSON files
  return data.filter((item: GitHubRepoContent) =>
    item.type === "file" && item.name.endsWith(".json")
  );
}

/**
 * Download a song file from GitHub via the contents API.
 */
export async function downloadSong(apiUrl: string): Promise<Song> {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.raw+json",
  };

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to download song: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Process repository contents into RepositorySong objects
 */
export async function processRepositoryContents(
  contents: GitHubRepoContent[],
  localSongs: Song[]
): Promise<RepositorySong[]> {
  const songs: RepositorySong[] = [];
  
  for (const item of contents) {
    if (item.type !== "file" || !item.name.endsWith(".json")) continue;
    
    const localSong = localSongs.find(s => 
      getSongFileName(s.title) === item.name
    );
    
    songs.push({
      name: item.name.replace(".json", ""),
      path: item.path,
      sha: item.sha,
      apiUrl: item.url,
      downloadUrl: item.download_url!,
      isLocal: !!localSong,
      localVersion: localSong ? undefined : undefined,
      needsUpdate: false, // Would need to compare SHA or content
    });
  }
  
  return songs;
}
