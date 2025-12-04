
import { VideoMetadata, ChannelDetails, SearchResult } from '../types';

export const extractVideoId = (url: string): string | null => {
  try {
    // Cleaner regex definition to avoid parser issues
    const regExp = new RegExp(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch (e) {
    return null;
  }
};

export const extractTweetId = (url: string): string | null => {
  try {
    if (url.includes('twitter.com') || url.includes('x.com')) {
       const match = url.match(/\/status\/(\d+)/);
       return match ? match[1] : null;
    }
    return null;
  } catch (e) { return null; }
};

export const extractChannelId = (url: string): string | null => {
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

const INVIDIOUS_INSTANCES = [
  'https://invidious.projectsegfau.lt',
  'https://inv.tux.pizza',
  'https://invidious.jing.rocks',
  'https://vid.ufficio.eu.org',
  'https://invidious.nerdvpn.de',
  'https://inv.bp.projectsegfau.lt',
  'https://yt.artemislena.eu'
];

const SUS_KEYWORDS = [
  "porn", "xxx", "sex", "nude", "naked", "boobs", "ass", 
  "thicc", "onlyfans", "dick", "cock", 
  "pussy", "hentai", "ahegao", "gore", "murder", "suicide",
  "strip", "stripper"
];

const checkForSus = (text: string): boolean => {
  const lower = text.toLowerCase();
  return SUS_KEYWORDS.some(k => lower.includes(k));
};

const getApiKey = (): string | null => {
  try {
    const userKey = localStorage.getItem('potatotool_api_key');
    if (userKey) return userKey;
  } catch(e) {}
  // Only use the fallback if absolutely necessary, user key is prioritized
  return "AIzaSyDVcFhERQvxsfbVsjYZSFqW--Kwj2-PMK8";
};

export const fetchVideoMetadata = async (videoId: string): Promise<VideoMetadata> => {
  try {
    const apiKey = getApiKey();
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const snippet = data.items[0].snippet;
          return {
            title: snippet.title,
            description: snippet.description,
            keywords: snippet.tags || [],
            channelId: snippet.channelId,
            channelTitle: snippet.channelTitle
          };
        }
      }
    }
  } catch (e) {
    console.warn("YouTube Data API error:", e);
  }

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title,
          description: data.description,
          keywords: data.keywords || [],
          channelId: data.authorId,
          channelTitle: data.author
        };
      }
    } catch (e) {
      continue;
    }
  }

  try {
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

export const searchYouTubeVideos = async (query: string, categoryId?: string): Promise<SearchResult[]> => {
  try {
    const apiKey = getApiKey();
    if (apiKey) {
      let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,channel&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=20`;
      
      if (categoryId) {
          apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=${categoryId}&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=20`;
      }

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

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Add randomness to page to avoid same results if possible
      const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=all&sort=relevance`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
            return data.slice(0, 20).map((item: any) => ({
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

export const fetchExploreFeed = async (category: 'HOME' | 'TRENDING' | 'GAMING' | 'TECH' | 'MUSIC' | 'SUS' = 'HOME'): Promise<SearchResult[]> => {
  let query = '';
  let categoryId = '';

  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  switch (category) {
      case 'GAMING':
          const gamingQueries = [
              'video game iceberg explained',
              'retro gaming hardware review',
              'speedrun history documentary',
              'indie game hidden gems',
              'esports documentary',
              'minecraft technical build tour',
              'game design analysis essay',
              'playstation 2 nostalgia'
          ];
          query = pickRandom(gamingQueries) + ' -shorts -livestream';
          categoryId = '20'; 
          break;
      case 'TECH':
          const techQueries = [
              'unique pc build time lapse',
              'mechanical keyboard sound test custom',
              'vintage computer restoration',
              'coding project showcase python',
              'linux rice setup tour',
              'tech gadget review underrated',
              'cybersecurity explained for beginners',
              'arduino robot project'
          ];
          query = pickRandom(techQueries) + ' -shorts';
          categoryId = '28'; 
          break;
      case 'MUSIC':
          const musicQueries = [
              'music production breakdown',
              'synthesizer jam session',
              'music theory video essay',
              'album review needle drop style',
              'lofi hip hop mix visual',
              'underground band live performance'
          ];
          query = pickRandom(musicQueries) + ' -shorts';
          categoryId = '10'; 
          break;
      case 'TRENDING':
          // Trending is hard to force "quality" on, but we can try
          query = 'viral video commentary';
          break;
      case 'SUS':
          const susQueries = [
              'scary footage caught on camera',
              'weird youtube videos rabbit hole',
              'liminal spaces compilation',
              'unsettling videos lost media',
              'internet mysteries iceburg',
              'cursed videos playlist',
              'found footage horror short',
              'strange internet websites'
          ];
          query = pickRandom(susQueries);
          break;
      case 'HOME':
      default:
          const homeQueries = [
              'video essay cinema analysis',
              'investigative documentary youtube',
              'internet culture history',
              'travel vlog cinematic 4k',
              'street food tour japan',
              'philosophy video essay',
              'science experiment explained',
              'digital art timelapse commentary'
          ];
          query = pickRandom(homeQueries) + ' -shorts';
          break;
  }

  return searchYouTubeVideos(query, categoryId);
};

export const fetchChannelVideos = async (channelId: string, pageToken?: string): Promise<SearchResult[]> => {
    try {
        const apiKey = getApiKey();
        if (apiKey) {
            let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=24&key=${apiKey}`;
            if (pageToken && !pageToken.startsWith('page:')) {
                apiUrl += `&pageToken=${pageToken}`;
            }
            
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
    
    let pageNum = 1;
    if (pageToken && pageToken.startsWith('page:')) {
        pageNum = parseInt(pageToken.split(':')[1]) || 1;
    }

    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/channels/${channelId}/videos?page=${pageNum}`);
            if (response.ok) {
                const data = await response.json();
                if (data.videos && Array.isArray(data.videos)) {
                    return data.videos.slice(0, 24).map((item: any) => ({
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
        } catch (e) {
            continue;
        }
    }
    return [];
};
