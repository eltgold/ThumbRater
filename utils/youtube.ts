

export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const extractChannelId = (url: string): string | null => {
  // Supports youtube.com/channel/ID and simple @handle (requires search)
  // For simplicity in this app, we mainly rely on extracting channel from video ID 
  // or explicit channel IDs.
  if (url.includes('/channel/')) {
    const parts = url.split('/channel/');
    return parts[1].split('/')[0].split('?')[0];
  }
  return null;
};

export const getThumbnailUrl = (videoId: string): string => {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export interface VideoMetadata {
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  channelId?: string | null;
  channelTitle?: string | null;
}

export interface ChannelDetails {
  title: string;
  description: string;
  customUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
  thumbnailUrl?: string;
}

export interface SearchResult {
  id: string;
  type: 'video' | 'channel';
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt?: string;
  description?: string;
  isSus?: boolean; // New field for SafeSearch
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.projectsegfau.lt',
  'https://inv.tux.pizza',
  'https://invidious.jing.rocks',
  'https://vid.ufficio.eu.org',
  'https://invidious.nerdvpn.de'
];

// Lightweight client-side sus detector for Store Results
const SUS_KEYWORDS = [
  "nsfw", "18+", "porn", "xxx", "sex", "nude", "naked", "boobs", "ass", 
  "thicc", "hot girl", "bikini", "lingerie", "onlyfans", "dick", "cock", 
  "pussy", "hentai", "ahegao", "gore", "death", "murder", "kill", "suicide",
  "strip", "stripper"
];

const checkForSus = (text: string): boolean => {
  const lower = text.toLowerCase();
  return SUS_KEYWORDS.some(k => lower.includes(k));
};

// Helper to get the best available API Key dynamically
const getApiKey = (): string | null => {
  // 1. User provided key
  const userKey = localStorage.getItem('ricetool_api_key');
  if (userKey) return userKey;
  
  // 2. Hardcoded fallback (Might hit quota limits)
  return "AIzaSyDVcFhERQvxsfbVsjYZSFqW--Kwj2-PMK8";
};

export const fetchVideoMetadata = async (videoId: string): Promise<VideoMetadata> => {
  console.log("Fetching metadata for:", videoId);

  // STRATEGY 1: Official YouTube Data API v3
  try {
    const apiKey = getApiKey();
    if (apiKey) {
      console.log("Attempting YouTube Data API v3...");
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const snippet = data.items[0].snippet;
          console.log("YouTube Data API success");
          return {
            title: snippet.title,
            description: snippet.description,
            keywords: snippet.tags || [],
            channelId: snippet.channelId,
            channelTitle: snippet.channelTitle
          };
        }
      } else {
        console.warn("YouTube Data API failed. Status:", response.status);
      }
    }
  } catch (e) {
    console.warn("YouTube Data API error:", e);
  }

  // STRATEGY 2: Invidious API (Public Instances Rotation)
  console.log("Attempting Invidious API Fallback...");
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Invidious API success from:", instance);
        return {
          title: data.title,
          description: data.description,
          keywords: data.keywords || [],
          channelId: data.authorId,
          channelTitle: data.author
        };
      }
    } catch (e) {
      console.warn(`Failed to fetch from ${instance}`);
      continue;
    }
  }

  // STRATEGY 3: oEmbed (Last Resort - Title Only)
  try {
     console.log("Attempting oEmbed Fallback...");
     const oembedUrl = `https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`;
     const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(oembedUrl)}`;
     const response = await fetch(proxyUrl);
     if(response.ok) {
        const data = await response.json();
         return {
          title: data.title,
          description: null,
          keywords: [],
          channelTitle: data.author_name
        };
     }
  } catch(e) {
      console.warn("All metadata fetch methods failed.");
  }

  return { title: null, description: null, keywords: null };
};

export const fetchChannelDetails = async (channelId: string): Promise<ChannelDetails | null> => {
    try {
        const apiKey = getApiKey();
        if (apiKey) {
            const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    const item = data.items[0];
                    return {
                        title: item.snippet.title,
                        description: item.snippet.description,
                        customUrl: item.snippet.customUrl,
                        subscriberCount: item.statistics.subscriberCount,
                        videoCount: item.statistics.videoCount,
                        viewCount: item.statistics.viewCount,
                        thumbnailUrl: item.snippet.thumbnails.medium?.url
                    };
                }
            }
        }
    } catch(e) { console.error(e); }

    // Invidious Fallback
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/channels/${channelId}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    title: data.author,
                    description: data.description,
                    subscriberCount: data.subCount,
                    videoCount: undefined,
                    viewCount: data.totalViews,
                    thumbnailUrl: data.authorThumbnails?.[0]?.url
                };
            }
        } catch(e) { continue; }
    }
    return null;
}

export const searchYouTubeVideos = async (query: string): Promise<SearchResult[]> => {
  console.log("Searching for:", query);
  
  try {
    const apiKey = getApiKey();
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,channel&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=16`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items.map((item: any) => ({
            id: item.id.videoId || item.id.channelId,
            type: item.id.channelId ? 'channel' : 'video',
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description,
            isSus: checkForSus(item.snippet.title || "")
          }));
        }
      }
    }
  } catch (e) {
    console.warn("YouTube Search API error:", e);
  }

  // Invidious Fallback
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=all`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
            return data.slice(0, 16).map((item: any) => ({
              id: item.videoId || item.authorId,
              type: item.type === 'channel' ? 'channel' : 'video',
              title: item.title || item.author,
              thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
              channelTitle: item.author,
              publishedAt: item.published ? new Date(item.published * 1000).toISOString() : undefined,
              isSus: checkForSus(item.title || item.author || "")
            }));
        }
      }
    } catch (e) {
       console.warn(`Search failed on ${instance}`);
    }
  }

  return [];
};

// NEW: Fetches a "Creator Feed" (Vlog, Tech, Gaming) excluding music
export const fetchExploreFeed = async (): Promise<SearchResult[]> => {
  // Query designed to capture typical YouTuber content and filter out music
  const query = "(vlog|gaming|tech|challenge|commentary|analysis) -vevo -lyrics -\"official music video\"";
  return searchYouTubeVideos(query);
};

export const fetchChannelLatestVideos = async (channelId: string): Promise<SearchResult[]> => {
    console.log("Fetching videos for channel:", channelId);
    
    try {
        const apiKey = getApiKey();
        if (apiKey) {
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=15&key=${apiKey}`;
            const response = await fetch(apiUrl);
             if (response.ok) {
                const data = await response.json();
                if (data.items && Array.isArray(data.items)) {
                    return data.items.map((item: any) => ({
                        id: item.id.videoId,
                        type: 'video',
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        isSus: checkForSus(item.snippet.title || "")
                    }));
                }
            }
        }
    } catch (e) {
        console.warn("Channel videos fetch failed:", e);
    }
    
    // Invidious Fallback
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/channels/${channelId}/videos`);
            if (response.ok) {
                const data = await response.json();
                if (data.videos && Array.isArray(data.videos)) {
                    return data.videos.slice(0, 15).map((item: any) => ({
                        id: item.videoId,
                        type: 'video',
                        title: item.title,
                        thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || item.videoThumbnails?.[0]?.url,
                        channelTitle: item.author,
                        publishedAt: new Date(item.published * 1000).toISOString(),
                        isSus: checkForSus(item.title || "")
                    }));
                }
            }
        } catch (e) { continue; }
    }

    return [];
}
