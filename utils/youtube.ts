
export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
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
}

export interface SearchResult {
  id: string;
  type: 'video' | 'channel';
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt?: string;
  description?: string;
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.projectsegfau.lt',
  'https://inv.tux.pizza',
  'https://invidious.jing.rocks',
  'https://vid.ufficio.eu.org',
  'https://invidious.nerdvpn.de'
];

export const fetchVideoMetadata = async (videoId: string): Promise<VideoMetadata> => {
  console.log("Fetching metadata for:", videoId);

  // STRATEGY 1: Official YouTube Data API v3
  try {
    const apiKey = "AIzaSyDVcFhERQvxsfbVsjYZSFqW--Kwj2-PMK8";
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
            keywords: snippet.tags || []
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
          keywords: data.keywords || []
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
     // Proxy needed because oEmbed endpoint might strictly enforce CORS or be blocked
     const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(oembedUrl)}`;
     const response = await fetch(proxyUrl);
     if(response.ok) {
        const data = await response.json();
         return {
          title: data.title,
          description: null,
          keywords: []
        };
     }
  } catch(e) {
      console.warn("All metadata fetch methods failed.");
  }

  return { title: null, description: null, keywords: null };
};

export const searchYouTubeVideos = async (query: string): Promise<SearchResult[]> => {
  console.log("Searching for:", query);
  
  // STRATEGY 1: Official YouTube Data API v3
  try {
    const apiKey = "AIzaSyDVcFhERQvxsfbVsjYZSFqW--Kwj2-PMK8";
    if (apiKey) {
      console.log("Searching via YouTube Data API v3...");
      // type=video,channel to get both
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,channel&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=16`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          return data.items.map((item: any) => ({
            id: item.id.videoId || item.id.channelId,
            type: item.id.channelId ? 'channel' : 'video',
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description
          }));
        }
      }
    }
  } catch (e) {
    console.warn("YouTube Search API error:", e);
  }

  // STRATEGY 2: Invidious API Fallback
  console.log("Attempting Invidious Search Fallback...");
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Invidious separate search for types usually, or 'type=all' depends on version.
      // We'll try fetching videos first as primary fallback.
      const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=all`);
      if (response.ok) {
        const data = await response.json();
        return data.slice(0, 16).map((item: any) => ({
          id: item.videoId || item.authorId,
          type: item.type === 'channel' ? 'channel' : 'video',
          title: item.title || item.author,
          thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
          channelTitle: item.author,
          publishedAt: item.published ? new Date(item.published * 1000).toISOString() : undefined
        }));
      }
    } catch (e) {
       console.warn(`Search failed on ${instance}`);
    }
  }

  return [];
};

export const fetchChannelLatestVideos = async (channelId: string): Promise<SearchResult[]> => {
    console.log("Fetching videos for channel:", channelId);
    
    try {
        const apiKey = "AIzaSyDVcFhERQvxsfbVsjYZSFqW--Kwj2-PMK8";
        if (apiKey) {
            // Search for videos by channelId, order by date
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=12&key=${apiKey}`;
            const response = await fetch(apiUrl);
             if (response.ok) {
                const data = await response.json();
                if (data.items) {
                    return data.items.map((item: any) => ({
                        id: item.id.videoId,
                        type: 'video',
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt
                    }));
                }
            }
        }
    } catch (e) {
        console.warn("Channel videos fetch failed:", e);
    }
    
    // Invidious Fallback for Channel Videos
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/channels/${channelId}/videos`);
            if (response.ok) {
                const data = await response.json();
                return data.videos.slice(0, 12).map((item: any) => ({
                    id: item.videoId,
                    type: 'video',
                    title: item.title,
                    thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || item.videoThumbnails?.[0]?.url,
                    channelTitle: item.author,
                    publishedAt: new Date(item.published * 1000).toISOString()
                }));
            }
        } catch (e) { continue; }
    }

    return [];
}
