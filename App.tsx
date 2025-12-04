import React, { useState, useRef, useEffect } from 'react';
import { extractVideoId, blobToBase64, fetchVideoMetadata, searchYouTubeVideos, fetchChannelVideos, fetchChannelDetails, extractChannelId, fetchExploreFeed, extractTweetId } from './utils/youtube';
import { analyzeThumbnail, sendChatMessage, analyzeBotProbability, analyzeDirtyMind, analyzeXPost } from './services/geminiService';
import { AppState, AnalysisResult, ChatMessage, ChangelogEntry, BotAnalysisResult, SavedItem, RiceTubeCategory, SearchResult, ChannelDetails, VideoMetadata, DirtyAnalysisResult, XAnalysisResult } from './types';
import { ScoreCard } from './components/ScoreCard';
import { 
  Youtube, Search, CircleAlert, Loader2, Send, X, 
  TriangleAlert, Siren, Bot, FolderOpen, Trash2, 
  ShoppingBag, Check, Hammer, Settings, Key, MonitorPlay, Eye, 
  EyeOff, ArrowLeft, Link2, HelpCircle, Flame, 
  Home, Gamepad2, Music2, Cpu, Play, FileText, Download, MessageSquare, Megaphone,
  RotateCw, RefreshCcw, Lock, Unlock, Brain, FlaskConical, Twitter,
  ShieldCheck, ShieldAlert, Sofa, Ghost
} from 'lucide-react';
import clsx from 'clsx';
import { AnalysisChart } from './components/AnalysisChart';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
      version: "v2.54",
      date: "2025-12-31",
      title: "The De-Bar Update",
      changes: [
          "Removed unsightly black bars (footer border, custom scrollbar).",
          "Cleaned up UI visual noise.",
          "Updated browser theme color."
      ]
  },
  {
      version: "v2.53",
      date: "2025-12-31",
      title: "The Anonymous Update",
      changes: [
          "Lazy Mode is now Anonymous Watch Mode.",
          "Deprecated AI chat in Lazy Mode (it was hallucinating anyway).",
          "Watch videos without being tracked by the algorithm."
      ]
  },
  {
      version: "v2.52",
      date: "2025-12-30",
      title: "The Lazy Update",
      changes: [
          "Removed 'Ask Video' and replaced it by 'Stop being a lazy ass and go watch it yourself'.",
          "Dirty Tester: Now smarter at distinguishing innocent vegetables from sus bait.",
          "Improved research logic (less hallucination)."
      ]
  },
  {
      version: "v2.51",
      date: "2025-12-29",
      title: "The Context Update",
      changes: [
          "Ask Video now researches web context instead of hallucinating.",
          "Dirty Tester logic improved: now detects innocent vs bait.",
          "UI tweaks for clarity."
      ]
  },
  {
      version: "v2.50",
      date: "2025-12-28",
      title: "The Potato Update",
      changes: [
          "Rebranded to PotatoTool.",
          "UI is now mobile responsive.",
          "RiceTube became TaterTube.",
          "New PotatoBot persona."
      ]
  }
];

type ActiveTab = 'RATER' | 'BOT_HUNTER' | 'VIDEO_CHAT' | 'DIRTY_TESTER' | 'X_RATER';
type StoreView = 'SEARCH' | 'CHANNEL';

const SmashLogo = () => (
    <div className="relative group w-10 h-10 flex items-center justify-center cursor-pointer">
        <div className="absolute inset-0 bg-red-600 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:translate-y-1 group-hover:shadow-none transition-all duration-100 flex items-center justify-center overflow-hidden dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[10px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
             <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
        </div>
        <Hammer className="absolute -top-3 -right-3 w-8 h-8 text-black fill-zinc-300 drop-shadow-sm transition-transform duration-100 origin-bottom-left group-hover:rotate-[-45deg] z-10 dark:text-white dark:fill-zinc-600" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase text-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-yellow-300 px-1 border border-black rotate-[-5deg] font-sans">
           BONK!
        </div>
    </div>
);

const Tape = ({ className }: { className?: string }) => (
    <div className={clsx("absolute w-24 h-8 bg-white/60 border border-black/10 rotate-[-3deg] backdrop-blur-sm shadow-sm z-20", className)}></div>
);

const BetaTape = () => (
    <span className="absolute -top-3 -right-3 md:-right-4 bg-[#fde047] text-black text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 border border-black rotate-[-10deg] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] z-10 dark:border-white dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)] pointer-events-none">
        BETA
    </span>
);

const PotatoBotAvatar = () => (
    <div className="w-10 h-10 rounded-full border-[3px] border-black overflow-hidden bg-white shrink-0 hard-shadow-sm dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
        <img src="https://i.imgur.com/gL1bk4m.png" alt="PotatoBot" className="w-full h-full object-cover" />
    </div>
);

const generateCaptcha = () => Math.random().toString(36).substring(7);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('RATER');
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoDesc, setVideoDesc] = useState<string | null>(null);
  const [videoKeywords, setVideoKeywords] = useState<string[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // RiceTube (Now TaterTube) State
  const [showRiceTube, setShowRiceTube] = useState(false);
  const [rtView, setRtView] = useState<StoreView>('SEARCH');
  const [rtCategory, setRtCategory] = useState<RiceTubeCategory>('HOME');
  const [rtQuery, setRtQuery] = useState('');
  const [rtResults, setRtResults] = useState<SearchResult[]>([]);
  const [rtIsLoading, setRtIsLoading] = useState(false);
  const [rtSelectedChannel, setRtSelectedChannel] = useState<SearchResult | null>(null);
  const [rtNextPageToken, setRtNextPageToken] = useState<string | undefined>(undefined);
  
  const [isSusUnlocked, setIsSusUnlocked] = useState(false);
  const [susCaptchaString, setSusCaptchaString] = useState(generateCaptcha());
  const [susCaptchaInput, setSusCaptchaInput] = useState('');

  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set());

  const [botResult, setBotResult] = useState<BotAnalysisResult | null>(null);
  const [analyzingChannel, setAnalyzingChannel] = useState<ChannelDetails | null>(null);

  const [currentVideoMetadata, setCurrentVideoMetadata] = useState<VideoMetadata | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const [dirtyResult, setDirtyResult] = useState<DirtyAnalysisResult | null>(null);
  const [dirtyInput, setDirtyInput] = useState<string>('');

  const [xResult, setXResult] = useState<XAnalysisResult | null>(null);
  const [xUrl, setXUrl] = useState<string>('');
  
  const [showImageWarning, setShowImageWarning] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSusContent, setShowSusContent] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReporting, setShowReporting] = useState(false);
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const isCelebrationMode = result?.scores?.overall === 10;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('thumb_rate_saved');
      if (storedItems) setSavedItems(JSON.parse(storedItems));
      
      const storedKey = localStorage.getItem('potatotool_api_key');
      if (storedKey) setApiKeyInput(storedKey);
    } catch (e) { console.error(e); }
  }, []);

  const handleSaveSettings = () => {
      localStorage.setItem('potatotool_api_key', apiKeyInput);
      setShowSettings(false);
      alert("Settings saved.");
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  // TaterTube Functions
  const openRiceTube = () => {
      setShowRiceTube(true);
      if (rtResults.length === 0) loadRiceTubeCategory('HOME');
  };

  const refreshRiceTube = () => {
      if (rtView === 'SEARCH') {
          if (rtQuery) handleRiceTubeSearch();
          else loadRiceTubeCategory(rtCategory);
      } else if (rtView === 'CHANNEL' && rtSelectedChannel) {
          handleRtItemClick(rtSelectedChannel);
      }
  };

  const loadRiceTubeCategory = async (cat: RiceTubeCategory) => {
      setRtCategory(cat);
      setRtView('SEARCH');
      setRtIsLoading(true);
      setRtResults([]);
      try {
          const results = await fetchExploreFeed(cat);
          setRtResults(results);
      } catch (e) { console.error(e); }
      finally { setRtIsLoading(false); }
  };

  const handleRiceTubeSearch = async () => {
      if (!rtQuery.trim()) return;
      setRtIsLoading(true);
      setRtResults([]);
      try {
          const results = await searchYouTubeVideos(rtQuery);
          setRtResults(results);
      } catch (e) { console.error(e); }
      finally { setRtIsLoading(false); }
  };

  const handleRtItemClick = async (item: SearchResult) => {
      if (item.type === 'channel') {
          setRtSelectedChannel(item);
          setRtView('CHANNEL');
          setRtIsLoading(true);
          setRtResults([]);
          try {
              const vids = await fetchChannelVideos(item.id);
              setRtResults(vids);
              setRtNextPageToken("page:2");
          } catch(e) { console.error(e); }
          finally { setRtIsLoading(false); }
      } else {
          handleCopy(item.id, 'video');
      }
  };

  const handleLoadMore = async () => {
      if (rtView === 'CHANNEL' && rtSelectedChannel && rtNextPageToken) {
          setRtIsLoading(true);
          try {
              const newVids = await fetchChannelVideos(rtSelectedChannel.id, rtNextPageToken);
              setRtResults(prev => [...prev, ...newVids]);
              if (newVids.length > 0) {
                 if (rtNextPageToken.startsWith('page:')) {
                     const curr = parseInt(rtNextPageToken.split(':')[1]);
                     setRtNextPageToken(`page:${curr + 1}`);
                 } else {
                     // Handle official API pagination if implemented
                 }
              } else {
                  setRtNextPageToken(undefined);
              }
          } catch(e) { console.error(e); }
          finally { setRtIsLoading(false); }
      }
  };

  const handleCaptchaSubmit = () => {
      if (susCaptchaInput === susCaptchaString) {
          setIsSusUnlocked(true);
          loadRiceTubeCategory('SUS');
      } else {
          alert("Wrong code. Are you a robot?");
          setSusCaptchaString(generateCaptcha());
          setSusCaptchaInput('');
      }
  };

  const refreshCaptcha = () => {
      setSusCaptchaString(generateCaptcha());
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (appState === AppState.ERROR) {
      setAppState(AppState.IDLE);
      setErrorMsg(null);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setBotResult(null);
    setAnalyzingChannel(null);
    setCurrentVideoMetadata(null);
    setActiveVideoId(null);
    setDirtyResult(null);
    setXResult(null);
    setXUrl('');
    setDirtyInput('');
    setVideoTitle(null);
    setVideoDesc(null);
    setVideoKeywords([]);
    setAppState(AppState.IDLE);
    setErrorMsg(null);
    setChatHistory([]);
    setChatInput('');
    setShowSusContent(false);
    setShowSaveModal(false);
    setThumbnailSrc(null);
    setImageBase64(null);
  };

  const fetchImageFromVideoId = async (videoId: string) => {
    setAppState(AppState.LOADING_IMAGE);
    setIsMetadataLoading(true);
    
    fetchVideoMetadata(videoId).then(meta => {
      setVideoTitle(meta.title || "Unknown Title");
      setVideoDesc(meta.description || "No description found.");
      setVideoKeywords(meta.keywords || []);
      setIsMetadataLoading(false);
    }).catch(e => {
      console.error("Metadata fetch error:", e);
      setIsMetadataLoading(false);
    });

    const tryFetch = async (resolution: 'maxresdefault' | 'hqdefault') => {
      const imgUrl = `https://i.ytimg.com/vi/${videoId}/${resolution}.jpg`;
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(imgUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return response.blob();
    };

    try {
      let blob: Blob;
      try {
        blob = await tryFetch('maxresdefault');
      } catch (e) {
        blob = await tryFetch('hqdefault');
      }

      const base64 = await blobToBase64(blob);
      setImageBase64(base64);
      const objectUrl = URL.createObjectURL(blob);
      setThumbnailSrc(objectUrl);
      setAppState(AppState.READY_TO_ANALYZE);
    } catch (err) {
      setErrorMsg("Could not fetch thumbnail. The video might be private or invalid.");
      setAppState(AppState.ERROR);
    }
  };

  const fetchImageFromChannel = async (channelId: string) => {
      setAppState(AppState.LOADING_IMAGE);
      try {
          const details = await fetchChannelDetails(channelId);
          if (!details || !details.thumbnailUrl) throw new Error("Channel not found");
          
          setVideoTitle(details.title); // Use Channel Name as "Title"
          setVideoDesc(details.description);
          
          // Fetch PFP through proxy to get Base64
          const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(details.thumbnailUrl)}`;
          const response = await fetch(proxyUrl);
          const blob = await response.blob();
          const base64 = await blobToBase64(blob);
          
          setImageBase64(base64);
          const objectUrl = URL.createObjectURL(blob);
          setThumbnailSrc(objectUrl);
          setAppState(AppState.READY_TO_ANALYZE);

      } catch (e) {
          setErrorMsg("Could not fetch channel details.");
          setAppState(AppState.ERROR);
      }
  };

  const runBotAnalysis = async (channelId: string) => {
    setAppState(AppState.ANALYZING);
    setBotResult(null);
    try {
      const channelData = await fetchChannelDetails(channelId);
      if (!channelData) throw new Error("Could not find channel");
      setAnalyzingChannel(channelData);

      const videos = await fetchChannelVideos(channelId);
      if (videos.length === 0) throw new Error("No videos found");

      const result = await analyzeBotProbability(channelData, videos);
      setBotResult(result);
      setAppState(AppState.SUCCESS);
    } catch (e) {
      console.error(e);
      setErrorMsg("Could not analyze channel. Check the link.");
      setAppState(AppState.ERROR);
    }
  };

  const runDirtyAnalysis = async (imageBase64: string, title: string) => {
      setAppState(AppState.ANALYZING);
      try {
          const result = await analyzeDirtyMind(imageBase64, title);
          setDirtyResult(result);
          setAppState(AppState.SUCCESS);
      } catch (e) {
          console.error(e);
          setErrorMsg("Analysis failed.");
          setAppState(AppState.ERROR);
      }
  };

  const runXAnalysis = async (link: string, imgBase64?: string | null) => {
      setAppState(AppState.ANALYZING);
      setXUrl(link);
      try {
          const result = await analyzeXPost(link, imgBase64);
          setXResult(result);
          setAppState(AppState.SUCCESS);
      } catch (e) {
           console.error(e);
           setErrorMsg("Could not analyze tweet. Maybe upload a screenshot?");
           setAppState(AppState.ERROR);
      }
  };

  const handleInputSubmit = async () => {
    const input = url.trim();
    if (!input) return;

    if (activeTab === 'RATER') {
      const videoId = extractVideoId(input);
      if (videoId) {
        resetAnalysis();
        fetchImageFromVideoId(videoId);
      } else {
         setErrorMsg("Invalid YouTube video URL.");
         setAppState(AppState.ERROR);
      }
    } else if (activeTab === 'DIRTY_TESTER') {
      resetAnalysis();
      const videoId = extractVideoId(input);
      const channelId = extractChannelId(input);
      
      if (videoId) {
          fetchImageFromVideoId(videoId);
      } else if (channelId) {
          fetchImageFromChannel(channelId);
      } else {
          // Attempt to resolve channel if it's a handle
          if (input.includes('@') || input.includes('youtube.com/')) {
               setErrorMsg("Invalid video or channel link.");
               setAppState(AppState.ERROR);
          } else {
               setErrorMsg("Invalid link.");
               setAppState(AppState.ERROR);
          }
      }
    } else if (activeTab === 'VIDEO_CHAT') {
        const videoId = extractVideoId(input);
        if (videoId) {
            resetAnalysis();
            setActiveVideoId(videoId);
            setAppState(AppState.SUCCESS);
        } else {
            setErrorMsg("Invalid YouTube video URL.");
            setAppState(AppState.ERROR);
        }
    } else if (activeTab === 'X_RATER') {
        resetAnalysis();
        const tweetId = extractTweetId(input);
        if (tweetId || input.includes('twitter.com') || input.includes('x.com')) {
            runXAnalysis(input);
        } else {
            setErrorMsg("Invalid X/Twitter URL.");
            setAppState(AppState.ERROR);
        }
    } else {
      // BOT HUNTER
      resetAnalysis();
      let channelId = extractChannelId(input);
      const videoId = extractVideoId(input);

      if (videoId && !channelId) {
        setAppState(AppState.LOADING_IMAGE);
        const meta = await fetchVideoMetadata(videoId);
        if (meta.channelId) {
          channelId = meta.channelId;
        }
      }

      if (channelId) {
        runBotAnalysis(channelId);
      } else {
        setErrorMsg("Invalid channel or video link.");
        setAppState(AppState.ERROR);
      }
    }
  };

  const handleCopy = (id: string, type: 'channel' | 'video', e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = type === 'channel' 
        ? `https://www.youtube.com/channel/${id}` 
        : `https://www.youtube.com/watch?v=${id}`;
    
    navigator.clipboard.writeText(link);
    setCopiedItemId(id);
    setTimeout(() => setCopiedItemId(null), 2000);
  };

  const toggleReveal = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newRevealed = new Set(revealedItems);
      if (newRevealed.has(id)) newRevealed.delete(id);
      else newRevealed.add(id);
      setRevealedItems(newRevealed);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeTab === 'BOT_HUNTER' || activeTab === 'VIDEO_CHAT') {
        alert("This mode requires a YouTube link.");
        return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    
    resetAnalysis();
    
    try {
      const base64 = await blobToBase64(file);
      const objectUrl = URL.createObjectURL(file);
      setThumbnailSrc(objectUrl);
      setImageBase64(base64);
      setVideoTitle("Uploaded Image"); 
      
      if (activeTab === 'DIRTY_TESTER' || activeTab === 'X_RATER') {
          setAppState(AppState.READY_TO_ANALYZE);
      } else {
          setShowImageWarning(true);
          setAppState(AppState.READY_TO_ANALYZE);
      }
    } catch (err) {
      setErrorMsg("Failed to process file.");
      setAppState(AppState.ERROR);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64 && activeTab !== 'X_RATER') return;
    
    if (activeTab === 'DIRTY_TESTER') {
        if (!imageBase64) return;
        runDirtyAnalysis(imageBase64, videoTitle || "Unknown Title");
        return;
    }

    if (activeTab === 'X_RATER') {
        runXAnalysis(url || "Uploaded Image", imageBase64);
        return;
    }

    setAppState(AppState.ANALYZING);
    setShowSusContent(false);
    try {
      if (!imageBase64) throw new Error("No image");
      const data = await analyzeThumbnail(imageBase64, 'image/jpeg', {
          title: videoTitle,
          description: videoDesc,
          keywords: videoKeywords
        });
      setResult(data);
      setAppState(AppState.SUCCESS);
    } catch (err) {
      setErrorMsg("Analysis failed. Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    if (activeTab === 'RATER' && (!imageBase64 || !result)) return;
    if (activeTab === 'BOT_HUNTER' && (!botResult || !analyzingChannel)) return;
    if (activeTab === 'VIDEO_CHAT') return; // Chat disabled in video chat
    if (activeTab === 'DIRTY_TESTER' && !dirtyResult) return;
    if (activeTab === 'X_RATER' && !xResult) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    
    try {
      const aiResponse = await sendChatMessage(chatHistory, userMsg, {
          type: activeTab,
          imageBase64: imageBase64,
          raterResult: result,
          botResult: botResult,
          channelDetails: analyzingChannel,
          videoResult: null,
          videoMetadata: (activeTab === 'RATER' || activeTab === 'DIRTY_TESTER') ? { title: videoTitle, description: videoDesc, keywords: videoKeywords } : currentVideoMetadata,
          dirtyResult: dirtyResult,
          xResult: xResult,
          xUrl: xUrl
      });
      setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const prepareSaveItem = (): SavedItem | null => {
      if (activeTab === 'RATER' && result && imageBase64) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'THUMB_RATER', thumbnailBase64: imageBase64, thumbnailResult: result, videoTitle, videoDesc, videoKeywords };
      if (activeTab === 'BOT_HUNTER' && botResult && analyzingChannel) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'BOT_HUNTER', botResult, channelDetails: analyzingChannel };
      if (activeTab === 'DIRTY_TESTER' && dirtyResult && imageBase64) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'DIRTY_TESTER', dirtyResult, thumbnailBase64: imageBase64, videoTitle };
      if (activeTab === 'X_RATER' && xResult) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'X_RATER', xResult, xUrl, thumbnailBase64: imageBase64 || undefined };
      return null;
  };

  const handleSaveToApp = () => {
    const item = prepareSaveItem();
    if (!item) { alert("Saving not supported yet."); return; }
    const newItems = [item, ...savedItems];
    setSavedItems(newItems);
    localStorage.setItem('thumb_rate_saved', JSON.stringify(newItems));
    setShowSaveModal(false);
    alert("Saved to Vault.");
  };

  const handleDownloadJSON = () => {
      const item = prepareSaveItem();
      if (!item) return;
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `potatotool_${item.type}_${item.id.substring(0,8)}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      setShowSaveModal(false);
  };

  const deleteSavedItem = (id: string) => {
      const newItems = savedItems.filter(item => item.id !== id);
      setSavedItems(newItems);
      localStorage.setItem('thumb_rate_saved', JSON.stringify(newItems));
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const item = JSON.parse(event.target?.result as string) as SavedItem;
        loadSavedItem(item);
      } catch (err) { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const loadSavedItem = (item: SavedItem) => {
    resetAnalysis();
    setShowSavedList(false);
    if (item.type === 'THUMB_RATER') {
        setActiveTab('RATER');
        setImageBase64(item.thumbnailBase64!);
        setThumbnailSrc(`data:image/jpeg;base64,${item.thumbnailBase64}`);
        setResult(item.thumbnailResult!);
        setVideoTitle(item.videoTitle || null);
        setVideoDesc(item.videoDesc || null);
        setVideoKeywords(item.videoKeywords || []);
        setAppState(AppState.SUCCESS);
    } else if (item.type === 'BOT_HUNTER') {
        setActiveTab('BOT_HUNTER');
        setAnalyzingChannel(item.channelDetails);
        setBotResult(item.botResult!);
        setAppState(AppState.SUCCESS);
    } else if (item.type === 'DIRTY_TESTER') {
        setActiveTab('DIRTY_TESTER');
        setImageBase64(item.thumbnailBase64!);
        setThumbnailSrc(`data:image/jpeg;base64,${item.thumbnailBase64}`);
        setVideoTitle(item.videoTitle || "Unknown");
        setDirtyResult(item.dirtyResult!);
        setAppState(AppState.SUCCESS);
    } else if (item.type === 'X_RATER') {
        setActiveTab('X_RATER');
        setXUrl(item.xUrl || "");
        if (item.thumbnailBase64) {
            setImageBase64(item.thumbnailBase64);
            setThumbnailSrc(`data:image/jpeg;base64,${item.thumbnailBase64}`);
        }
        setXResult(item.xResult!);
        setAppState(AppState.SUCCESS);
    }
  };

  const handleReportChannel = () => {
      setShowReporting(true);
      setTimeout(() => {
          setShowReporting(false);
          alert("Channel reported to the internet police.");
      }, 3000);
  };

  // Helper to get active tab color
  const getActiveTabColor = () => {
      switch(activeTab) {
          case 'RATER': return 'bg-pink-400 text-black';
          case 'BOT_HUNTER': return 'bg-blue-400 text-black';
          case 'VIDEO_CHAT': return 'bg-zinc-400 text-black';
          case 'DIRTY_TESTER': return 'bg-yellow-400 text-black';
          case 'X_RATER': return 'bg-black text-white dark:bg-white dark:text-black';
          default: return 'bg-black text-white';
      }
  };

  return (
    <div className="min-h-screen bg-bliss text-black font-sans pb-20 relative overflow-x-hidden dark:bg-zinc-900 w-full">
      {/* ... [TaterTube Modal Component] ... */}
      {showRiceTube && (
          <div className="fixed inset-0 z-[200] bg-zinc-900 font-sans text-white flex flex-col w-full h-full">
              <div className="h-16 bg-[#202020] flex items-center justify-between px-2 md:px-4 border-b border-zinc-700 shrink-0 gap-2">
                  <div className="flex items-center gap-2 md:gap-4">
                      <button onClick={() => setShowRiceTube(false)} className="p-2 hover:bg-zinc-700 rounded-full">
                          <ArrowLeft className="w-6 h-6" />
                      </button>
                      <div className="flex items-center gap-1">
                          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                          <span className="font-bold tracking-tighter text-xl hidden md:block">TaterTube™</span>
                      </div>
                  </div>
                  
                  <div className="flex-1 max-w-xl mx-2">
                      <div className="relative flex items-center">
                          <input 
                              type="text"
                              value={rtQuery}
                              onChange={(e) => setRtQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRiceTubeSearch()}
                              placeholder="Search TaterTube..."
                              className="w-full bg-[#121212] border border-zinc-700 rounded-full py-2 pl-4 pr-10 text-white focus:outline-none focus:border-blue-500 text-base"
                          />
                          <button onClick={handleRiceTubeSearch} className="absolute right-0 top-0 h-full px-4 bg-zinc-800 rounded-r-full border-l border-zinc-700 hover:bg-zinc-700">
                              <Search className="w-5 h-5 text-zinc-400" />
                          </button>
                      </div>
                  </div>

                  <div className="w-10"></div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#0f0f0f]">
                  {rtView === 'SEARCH' ? (
                      <>
                        <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar border-b border-zinc-800 sticky top-0 bg-[#0f0f0f]/95 backdrop-blur z-10">
                            {['HOME', 'TRENDING', 'GAMING', 'TECH', 'MUSIC', 'SUS'].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => loadRiceTubeCategory(cat as RiceTubeCategory)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                                        rtCategory === cat ? "bg-white text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    )}
                                >
                                    {cat === 'SUS' ? (isSusUnlocked ? '💀 SUS (UNLOCKED)' : '🔒 SUS') : cat}
                                </button>
                            ))}
                        </div>

                        {rtCategory === 'SUS' && !isSusUnlocked ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                                <Ghost className="w-16 h-16 text-zinc-500" />
                                <h2 className="text-2xl font-bold">The Dark Side of YouTube</h2>
                                <p className="text-zinc-400 max-w-md">Warning: This feed contains weird, obscure, and potentially unsettling content found in the depths of the algorithm.</p>
                                <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700 space-y-4 w-full max-w-sm">
                                    <p className="text-sm text-zinc-400">Prove you are not a bot.</p>
                                    <div className="bg-black p-4 rounded text-center font-mono text-2xl tracking-widest text-green-500 select-none relative overflow-hidden">
                                        <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                                        {susCaptchaString}
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={susCaptchaInput}
                                            onChange={(e) => setSusCaptchaInput(e.target.value)}
                                            placeholder="Enter code"
                                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-center uppercase text-base"
                                        />
                                        <button onClick={refreshCaptcha} className="p-2 bg-zinc-700 rounded hover:bg-zinc-600"><RotateCw className="w-5 h-5"/></button>
                                    </div>
                                    <button 
                                        onClick={handleCaptchaSubmit}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                                    >
                                        UNLOCK
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {rtIsLoading ? (
                                    Array(8).fill(0).map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="bg-zinc-800 aspect-video rounded-xl mb-3"></div>
                                            <div className="flex gap-3">
                                                <div className="w-9 h-9 bg-zinc-800 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                                                    <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    rtResults.map((item) => (
                                        <div key={item.id} onClick={() => handleRtItemClick(item)} className="group cursor-pointer">
                                            <div className="relative aspect-video rounded-xl overflow-hidden mb-2 bg-zinc-800 border border-zinc-800 group-hover:border-zinc-600 transition-colors">
                                                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                                                {item.isSus && (
                                                    <div className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                                                        <Siren className="w-3 h-3" /> SUS
                                                    </div>
                                                )}
                                                {item.type === 'channel' && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <div className="bg-zinc-800 p-2 rounded-full border border-zinc-600">
                                                            <MonitorPlay className="w-6 h-6 text-white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-3 px-1">
                                                <div className="flex-1">
                                                    <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight mb-1 group-hover:text-blue-400 transition-colors" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                                                    <div className="text-zinc-400 text-xs flex items-center gap-1">
                                                        <span>{item.channelTitle}</span>
                                                        <Check className="w-3 h-3 bg-zinc-700 rounded-full p-0.5" />
                                                    </div>
                                                    {item.publishedAt && <div className="text-zinc-500 text-xs mt-0.5">{new Date(item.publishedAt).toLocaleDateString()}</div>}
                                                </div>
                                                <button onClick={(e) => handleCopy(item.id, item.type, e)} className="text-zinc-500 hover:text-white self-start pt-1">
                                                    {copiedItemId === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                      </>
                  ) : (
                      // Channel View
                      <div className="p-4 max-w-6xl mx-auto">
                          {rtSelectedChannel && (
                              <>
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 border-b border-zinc-800 pb-8">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-zinc-800">
                                        <img src={rtSelectedChannel.thumbnail} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center md:text-left flex-1">
                                        <h1 className="text-3xl font-bold mb-2">{rtSelectedChannel.channelTitle}</h1>
                                        <p className="text-zinc-400 text-sm max-w-2xl line-clamp-3 mb-4">{rtSelectedChannel.description || "No description provided."}</p>
                                        <div className="flex items-center justify-center md:justify-start gap-4">
                                            <button className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm hover:bg-zinc-200">Subscribe</button>
                                            <button onClick={() => {
                                                setShowRiceTube(false);
                                                setActiveTab('BOT_HUNTER');
                                                setUrl(`https://youtube.com/channel/${rtSelectedChannel.id}`);
                                                runBotAnalysis(rtSelectedChannel.id);
                                            }} className="bg-zinc-800 text-white px-6 py-2 rounded-full font-bold text-sm border border-zinc-700 hover:bg-zinc-700 flex items-center gap-2">
                                                <Bot className="w-4 h-4" /> Analyze
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold mb-4">Recent Videos</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {rtResults.map((item) => (
                                        <div key={item.id} onClick={() => handleCopy(item.id, 'video')} className="group cursor-pointer">
                                            <div className="relative aspect-video rounded-xl overflow-hidden mb-2 bg-zinc-800 border border-zinc-800 group-hover:border-zinc-600 transition-colors">
                                                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                                            </div>
                                            <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                                            <div className="text-zinc-500 text-xs mt-1">{new Date(item.publishedAt!).toLocaleDateString()}</div>
                                        </div>
                                    ))}
                                </div>
                                {rtNextPageToken && (
                                    <div className="mt-8 flex justify-center">
                                        <button 
                                            onClick={handleLoadMore}
                                            disabled={rtIsLoading}
                                            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full font-medium text-sm disabled:opacity-50"
                                        >
                                            {rtIsLoading ? 'Loading...' : 'Load More Videos'}
                                        </button>
                                    </div>
                                )}
                              </>
                          )}
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-50 bg-[#fbbf24] border-b-[3px] border-black px-4 py-3 flex items-center justify-between dark:bg-[#3f3f46] dark:border-white">
        <div className="flex items-center gap-3">
          <SmashLogo />
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter drop-shadow-sm text-black dark:text-white" style={{ fontFamily: '"Comic Neue", cursive' }}>
            PotatoTool
          </h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={openRiceTube} className="hidden md:flex items-center gap-1 bg-white px-3 py-1.5 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all text-xs font-bold uppercase dark:bg-zinc-800 dark:text-white dark:border-zinc-400 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
             <Youtube className="w-4 h-4" /> TaterTube™
          </button>
          
          <button onClick={() => setShowSavedList(true)} className="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1 dark:bg-zinc-800 dark:text-white dark:border-zinc-400 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
             <FolderOpen className="w-5 h-5" /> <span className="hidden md:inline font-bold text-xs uppercase">Vault</span>
          </button>
          <button onClick={() => setShowHelp(true)} className="p-2 bg-black text-white rounded hover:bg-zinc-800 transition-colors border-2 border-transparent hover:border-white dark:bg-white dark:text-black dark:hover:border-black">
              <HelpCircle className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-black hover:bg-black/10 rounded transition-colors dark:text-white">
              <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* Tab Selector - FLEX WRAP for Clean Centered Layout */}
      <div className="container mx-auto px-4 mt-6 mb-6">
          <nav className="flex flex-wrap justify-center gap-2 md:gap-4 w-full">
             {[
               { id: 'RATER', label: 'Thumb Rater', icon: <Search className="w-4 h-4"/>, color: 'bg-pink-400' },
               { id: 'BOT_HUNTER', label: 'Bot Hunter', icon: <Bot className="w-4 h-4"/>, color: 'bg-blue-400' },
               { id: 'VIDEO_CHAT', label: 'Anon Watch', icon: <EyeOff className="w-4 h-4"/>, color: 'bg-zinc-400' },
               { id: 'DIRTY_TESTER', label: 'Dirty Tester', icon: <Siren className="w-4 h-4"/>, color: 'bg-yellow-400', isBeta: true },
               { id: 'X_RATER', label: 'X Rater', icon: <Twitter className="w-4 h-4"/>, color: 'bg-black text-white', isBeta: true },
             ].map((tab) => (
                 <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as ActiveTab); resetAnalysis(); }}
                    className={clsx(
                        "relative px-4 py-3 md:py-2 border-[3px] border-black font-black uppercase text-sm flex items-center justify-center gap-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none flex-grow md:flex-grow-0",
                        activeTab === tab.id ? `${tab.color} text-black` : "bg-white text-black hover:bg-gray-50",
                        tab.id === 'X_RATER' && activeTab === 'X_RATER' && "text-white"
                    )}
                 >
                     {tab.icon}
                     {tab.label}
                     {tab.isBeta && <BetaTape />}
                 </button>
             ))}
          </nav>
      </div>

      <main className="container mx-auto px-4 max-w-4xl relative z-10">
        
        {/* INPUT SECTION */}
        <div className="bg-white border-[3px] border-black p-4 md:p-8 hard-shadow mb-8 relative dark:bg-zinc-800 dark:border-white dark:text-white">
            <div className={clsx("absolute -top-3 left-6 px-2 py-0.5 font-bold text-xs uppercase -rotate-2 border border-black hard-shadow-sm", getActiveTabColor())}>
                {activeTab === 'RATER' && "Input Zone"}
                {activeTab === 'BOT_HUNTER' && "Target Acquisition"}
                {activeTab === 'VIDEO_CHAT' && "Private Theater"}
                {activeTab === 'DIRTY_TESTER' && "Mind Cleaner"}
                {activeTab === 'X_RATER' && "Based Dept."}
            </div>

            <div className="flex flex-col gap-4">
                {activeTab === 'RATER' && (
                    <>
                        <div className="flex flex-col md:flex-row gap-3">
                             <div className="flex-1 relative">
                                 <input 
                                    type="text" 
                                    value={url}
                                    onChange={handleUrlChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                                    placeholder="Paste YouTube link..." 
                                    className="w-full bg-gray-50 border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400 placeholder:text-gray-400 text-base dark:bg-zinc-700 dark:border-zinc-500 dark:placeholder-zinc-400"
                                 />
                                 {url && (
                                     <button onClick={() => setUrl('')} className="absolute right-3 top-3 text-black hover:text-red-500 dark:text-white">
                                         <X className="w-6 h-6" />
                                     </button>
                                 )}
                             </div>
                             <button 
                                onClick={handleInputSubmit}
                                disabled={appState === AppState.ANALYZING}
                                className="bg-[#fbbf24] text-black font-black uppercase px-6 py-3 border-2 border-black hover:bg-[#f59e0b] active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                             >
                                {appState === AppState.ANALYZING ? <Loader2 className="animate-spin w-6 h-6"/> : "Analyze"}
                             </button>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className="h-px bg-black/20 flex-1 dark:bg-white/20"></div>
                             <span className="text-xs font-bold uppercase text-gray-400">OR</span>
                             <div className="h-px bg-black/20 flex-1 dark:bg-white/20"></div>
                        </div>
                        <label className="cursor-pointer bg-white border-2 border-black border-dashed p-4 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors group dark:bg-zinc-700 dark:border-zinc-500">
                             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                             <div className="bg-black text-white p-2 rounded-full group-hover:scale-110 transition-transform dark:bg-white dark:text-black">
                                 <Download className="w-5 h-5" />
                             </div>
                             <span className="font-bold text-sm uppercase">Upload Thumbnail File</span>
                        </label>
                    </>
                )}

                {(activeTab === 'BOT_HUNTER') && (
                    <div className="flex flex-col md:flex-row gap-3">
                         <input 
                            type="text" 
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="Paste Channel URL (@handle)..." 
                            className="flex-1 bg-gray-50 border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-blue-400 text-base dark:bg-zinc-700 dark:border-zinc-500"
                         />
                         <button onClick={handleInputSubmit} className="bg-blue-400 text-black font-black uppercase px-6 py-3 border-2 border-black hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            Hunt Bots
                         </button>
                    </div>
                )}
                
                {(activeTab === 'VIDEO_CHAT') && (
                    <div className="flex flex-col md:flex-row gap-3">
                         <input 
                            type="text" 
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="Paste Video URL to Watch Anonymously..." 
                            className="flex-1 bg-gray-50 border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-zinc-400 text-base dark:bg-zinc-700 dark:border-zinc-500"
                         />
                         <button onClick={handleInputSubmit} className="bg-zinc-400 text-black font-black uppercase px-6 py-3 border-2 border-black hover:bg-zinc-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            Watch
                         </button>
                    </div>
                )}

                {(activeTab === 'DIRTY_TESTER') && (
                    <div className="flex flex-col gap-4">
                         <div className="flex flex-col md:flex-row gap-3">
                             <input 
                                type="text" 
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="Paste Video/Image Link..." 
                                className="flex-1 bg-gray-50 border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400 text-base dark:bg-zinc-700 dark:border-zinc-500"
                             />
                             <button onClick={handleInputSubmit} className="bg-yellow-400 text-black font-black uppercase px-6 py-3 border-2 border-black hover:bg-yellow-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Test Mind
                             </button>
                        </div>
                        <label className="cursor-pointer text-center text-sm font-bold underline hover:text-blue-600 dark:text-blue-300">
                             <input type="file" onChange={handleFileUpload} accept="image/*" className="hidden" />
                             Or upload an image to test
                        </label>
                    </div>
                )}
                
                {(activeTab === 'X_RATER') && (
                     <div className="flex flex-col md:flex-row gap-3">
                         <input 
                            type="text" 
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="Paste X/Twitter Post URL..." 
                            className="flex-1 bg-gray-50 border-2 border-black p-3 font-bold focus:outline-none focus:ring-4 focus:ring-black/20 text-base dark:bg-zinc-700 dark:border-zinc-500"
                         />
                         <button onClick={handleInputSubmit} className="bg-black text-white font-black uppercase px-6 py-3 border-2 border-black hover:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                            Rate Tweet
                         </button>
                    </div>
                )}
            </div>
        </div>

        {/* RESULTS AREA */}
        {appState === AppState.READY_TO_ANALYZE && (
            <div className="bg-white border-[3px] border-black p-6 hard-shadow animate-slide-up flex flex-col items-center gap-6 dark:bg-zinc-800 dark:border-white dark:text-white">
                 <h2 className="text-2xl font-black uppercase">Ready to Roast</h2>
                 {thumbnailSrc && (
                     <div className="relative w-full max-w-md aspect-video border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                         <img src={thumbnailSrc} className="w-full h-full object-cover" />
                         {showImageWarning && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold p-4 text-center">Using Uploaded Image (Metadata analysis disabled)</div>}
                     </div>
                 )}
                 {videoTitle && <p className="font-bold text-center text-lg leading-tight">"{videoTitle}"</p>}
                 
                 <button onClick={handleAnalyze} className="w-full md:w-auto bg-green-400 text-black font-black text-xl px-12 py-4 border-[3px] border-black hover:bg-green-500 hover:scale-105 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                     START ANALYSIS
                 </button>
            </div>
        )}

        {appState === AppState.ANALYZING && (
             <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
                 <div className="relative">
                     <div className="w-24 h-24 border-[6px] border-black border-t-transparent rounded-full animate-spin dark:border-white dark:border-t-transparent"></div>
                     <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">
                         {Math.floor(Math.random() * 99)}%
                     </div>
                 </div>
                 <div className="space-y-2">
                     <p className="font-black text-2xl uppercase italic">Processing...</p>
                     <p className="text-lg font-bold text-zinc-500 bg-white/50 px-2 dark:text-zinc-300 dark:bg-black/50">
                        {activeTab === 'RATER' && "Scanning for clickbait crimes..."}
                        {activeTab === 'BOT_HUNTER' && "Checking for human soul..."}
                        {activeTab === 'DIRTY_TESTER' && "Consulting the elders..."}
                        {activeTab === 'X_RATER' && "Measuring cringe levels..."}
                     </p>
                 </div>
             </div>
        )}

        {/* --- THUMB RATER RESULT --- */}
        {appState === AppState.SUCCESS && activeTab === 'RATER' && result && (
            <div className="animate-slide-up space-y-8">
                {isCelebrationMode && (
                    <div className="bg-yellow-300 border-[3px] border-black p-4 text-center font-black text-2xl animate-bounce shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        🏆 PERFECT SCORE! YOU COOKED! 🏆
                    </div>
                )}
                
                {/* Score Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div className="col-span-2 md:col-span-1 md:row-span-1 h-full">
                        <ScoreCard label="Overall" score={result.scores.overall} color="bg-white" rotation="rotate-[-2deg]" />
                     </div>
                     <ScoreCard label="Clarity" score={result.scores.clarity} rotation="rotate-1" />
                     <ScoreCard label="Curiosity" score={result.scores.curiosity} rotation="rotate-[-1deg]" />
                     <ScoreCard label="Text" score={result.scores.text_readability} rotation="rotate-2" />
                     <ScoreCard label="Emotion" score={result.scores.emotion} rotation="rotate-[-2deg]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Chart */}
                     <div className="bg-white p-4 border-[3px] border-black hard-shadow h-80 dark:bg-zinc-800 dark:border-white">
                         <div className="h-full w-full">
                            <AnalysisChart scores={result.scores} />
                         </div>
                     </div>

                     {/* Verdict */}
                     <div className="bg-white border-[3px] border-black hard-shadow p-6 flex flex-col justify-between dark:bg-zinc-800 dark:border-white dark:text-white">
                         <div>
                             <h3 className="text-xl font-black uppercase mb-4 border-b-2 border-black pb-2 inline-block dark:border-white">The Verdict</h3>
                             <p className="text-lg font-bold leading-relaxed mb-6">"{result.summary}"</p>
                             
                             <div className="space-y-3">
                                 {result.suggestions.map((s, i) => (
                                     <div key={i} className="flex items-start gap-3">
                                         <div className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm dark:bg-white dark:text-black">{i+1}</div>
                                         <p className="font-medium text-sm md:text-base">{s}</p>
                                     </div>
                                 ))}
                             </div>
                         </div>
                         {result.isSus && (
                             <div className="mt-6 bg-red-100 border-2 border-red-500 p-3 flex items-center gap-3 text-red-700">
                                 <Siren className="w-6 h-6 animate-pulse" />
                                 <div>
                                     <span className="font-black uppercase block text-sm">Sus Detected</span>
                                     <span className="text-xs font-bold">{result.susReason || "This might get demonetized."}</span>
                                 </div>
                             </div>
                         )}
                     </div>
                </div>

                {/* Save / Share Buttons */}
                <div className="flex flex-col md:flex-row gap-4 justify-center">
                    <button onClick={() => setShowSaveModal(true)} className="bg-white border-2 border-black px-8 py-3 font-bold uppercase hover:bg-gray-50 hard-shadow-sm flex items-center justify-center gap-2 dark:bg-zinc-800 dark:text-white dark:border-white">
                        <FolderOpen className="w-5 h-5"/> Save Result
                    </button>
                    <button onClick={() => {
                        window.open(`https://twitter.com/intent/tweet?text=I got a ${result.scores.overall}/10 on PotatoTool. "${result.summary}"&url=https://potatotool.app`, '_blank');
                    }} className="bg-[#1DA1F2] text-white border-2 border-black px-8 py-3 font-bold uppercase hover:bg-[#1a91da] hard-shadow-sm flex items-center justify-center gap-2">
                        <Twitter className="w-5 h-5"/> Share Shame
                    </button>
                </div>
            </div>
        )}

        {/* --- BOT HUNTER RESULT --- */}
        {appState === AppState.SUCCESS && activeTab === 'BOT_HUNTER' && botResult && (
             <div className="animate-slide-up bg-white border-[3px] border-black p-6 hard-shadow dark:bg-zinc-800 dark:border-white dark:text-white">
                 <div className="flex items-center justify-between mb-6 border-b-2 border-black pb-4 dark:border-white">
                     <h2 className="text-2xl font-black uppercase flex items-center gap-2">
                         Bot Hunter <Bot className="w-8 h-8"/>
                     </h2>
                     <div className={clsx("px-4 py-1 font-black uppercase text-xl border-2 border-black rotate-2",
                         botResult.verdict === 'HUMAN' ? 'bg-green-400' : 
                         botResult.verdict === 'CYBORG' ? 'bg-yellow-400' : 'bg-red-500 text-white'
                     )}>
                         {botResult.verdict}
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                     <div className="flex flex-col items-center justify-center bg-gray-100 border-2 border-black p-4 dark:bg-zinc-700 dark:border-zinc-500">
                         <span className="text-sm font-bold uppercase mb-2">Bot Probability Score</span>
                         <span className="text-6xl font-black">{botResult.botScore}%</span>
                         <div className="w-full h-4 bg-gray-300 mt-4 border border-black rounded-full overflow-hidden">
                             <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${botResult.botScore}%` }}></div>
                         </div>
                     </div>
                     <div className="space-y-4">
                         <p className="text-lg font-medium italic">"{botResult.summary}"</p>
                         <div className="space-y-2">
                             <span className="font-bold uppercase text-xs bg-black text-white px-2 py-0.5 dark:bg-white dark:text-black">Evidence:</span>
                             <ul className="list-disc pl-5 space-y-1 font-medium text-sm">
                                 {botResult.evidence.map((e, i) => <li key={i}>{e}</li>)}
                             </ul>
                         </div>
                     </div>
                 </div>
                 <button onClick={() => setShowSaveModal(true)} className="w-full bg-gray-100 border-2 border-black py-2 font-bold hover:bg-gray-200 uppercase text-sm dark:bg-zinc-700 dark:text-white dark:border-zinc-500">Save Report</button>
             </div>
        )}

        {/* --- DIRTY TESTER RESULT --- */}
        {appState === AppState.SUCCESS && activeTab === 'DIRTY_TESTER' && dirtyResult && (
             <div className="animate-slide-up bg-white border-[3px] border-black p-6 hard-shadow relative overflow-hidden dark:bg-zinc-800 dark:border-white dark:text-white">
                 <Tape className="top-[-10px] left-1/2 -translate-x-1/2 rotate-2" />
                 
                 <div className="text-center mb-8 mt-4">
                      <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">
                          {dirtyResult.verdict === 'PURE' ? '😇 PURE' : 
                           dirtyResult.verdict === 'SUS' ? '🤨 SUS' : 
                           dirtyResult.verdict === 'DOWN_BAD' ? '🥵 DOWN BAD' : '🚓 JAIL'}
                      </h2>
                      <div className="inline-block bg-black text-white px-4 py-1 text-sm font-bold uppercase rotate-[-1deg] dark:bg-white dark:text-black">
                          Dirty Mind Score: {dirtyResult.dirtyScore}/100
                      </div>
                 </div>

                 <div className="bg-[#fef9c3] border-2 border-black p-4 mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 dark:border-zinc-500">
                     <p className="font-bold text-lg leading-tight">"{dirtyResult.explanation}"</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-green-100 border-2 border-black p-4 relative dark:bg-green-900/30 dark:border-green-500">
                         <span className="absolute -top-3 left-4 bg-green-500 text-white px-2 py-0.5 text-xs font-black uppercase border border-black">Innocent Reality</span>
                         <p className="mt-2 font-bold">{dirtyResult.alternatives?.[0] || "Just a normal object."}</p>
                     </div>
                     <div className="bg-pink-100 border-2 border-black p-4 relative dark:bg-pink-900/30 dark:border-pink-500">
                         <span className="absolute -top-3 right-4 bg-pink-500 text-white px-2 py-0.5 text-xs font-black uppercase border border-black">Dirty Illusion</span>
                         <p className="mt-2 font-bold">{dirtyResult.alternatives?.[1] || "What you think it is."}</p>
                     </div>
                 </div>
                 
                 <button onClick={() => setShowSaveModal(true)} className="mt-6 w-full bg-white border-2 border-black py-2 font-bold hover:bg-gray-50 uppercase text-sm dark:bg-zinc-700 dark:border-zinc-500">Save For Therapy</button>
             </div>
        )}

        {/* --- X RATER RESULT --- */}
        {appState === AppState.SUCCESS && activeTab === 'X_RATER' && xResult && (
             <div className="animate-slide-up bg-black text-white border-[3px] border-zinc-500 p-6 hard-shadow shadow-white/20">
                 <div className="flex justify-between items-start mb-6">
                     <h2 className="text-3xl font-black italic">X-RATED</h2>
                     <div className="text-right">
                         <div className="text-sm text-zinc-400 font-mono">VERDICT_PROTOCOL</div>
                         <div className="text-2xl font-bold text-blue-400">{xResult.verdict}</div>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="bg-zinc-900 p-4 border border-zinc-700">
                         <div className="text-xs text-zinc-500 uppercase tracking-widest">Based Score</div>
                         <div className="text-4xl font-black">{xResult.basedScore}/10</div>
                     </div>
                     <div className="bg-zinc-900 p-4 border border-zinc-700">
                         <div className="text-xs text-zinc-500 uppercase tracking-widest">Cringe Score</div>
                         <div className="text-4xl font-black text-red-500">{xResult.cringeScore}/10</div>
                     </div>
                 </div>

                 <div className="mb-6">
                     <div className="flex justify-between text-xs font-bold uppercase mb-1">
                         <span>Ratio Risk Calculation</span>
                         <span>{xResult.ratioRisk}%</span>
                     </div>
                     <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-blue-500 to-red-500" style={{ width: `${xResult.ratioRisk}%` }}></div>
                     </div>
                 </div>

                 {xResult.communityNotePrediction && (
                     <div className="bg-zinc-900 border border-zinc-700 p-4 relative mt-8">
                         <div className="absolute -top-3 left-4 bg-zinc-800 text-zinc-300 px-2 py-0.5 text-xs font-bold uppercase border border-zinc-600 flex items-center gap-1">
                             <ShieldCheck className="w-3 h-3"/> Community Note
                         </div>
                         <p className="font-mono text-sm leading-relaxed">
                             "{xResult.communityNotePrediction}"
                         </p>
                     </div>
                 )}
                 <button onClick={() => setShowSaveModal(true)} className="mt-6 w-full bg-white text-black font-bold py-3 hover:bg-zinc-200">ARCHIVE TWEET DATA</button>
             </div>
        )}

        {/* --- ANON WATCH (NEW) --- */}
        {appState === AppState.SUCCESS && activeTab === 'VIDEO_CHAT' && activeVideoId && (
            <div className="animate-slide-up space-y-4">
                 <div className="bg-black p-1 border-[3px] border-black hard-shadow">
                     <div className="aspect-video w-full bg-black">
                         <iframe 
                             src={`https://www.youtube-nocookie.com/embed/${activeVideoId}`}
                             className="w-full h-full"
                             title="Anonymous Video Player"
                             frameBorder="0"
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                             allowFullScreen
                         ></iframe>
                     </div>
                 </div>
                 <div className="bg-zinc-100 p-4 border-2 border-black text-sm text-zinc-600 flex items-center gap-2 dark:bg-zinc-800 dark:border-zinc-500 dark:text-zinc-300">
                     <EyeOff className="w-5 h-5"/>
                     <span>You are watching in Anonymous Mode. No history, no algorithm tracking.</span>
                 </div>
            </div>
        )}

      </main>

      {/* --- POTATO BOT CHAT (For Analysis Tabs Only) --- */}
      {appState === AppState.SUCCESS && activeTab !== 'VIDEO_CHAT' && (
          <div className="container mx-auto px-4 max-w-4xl mt-12 mb-20">
               <div className="bg-white border-[3px] border-black hard-shadow flex flex-col md:flex-row h-[500px] md:h-96 dark:bg-zinc-800 dark:border-white">
                    <div className="bg-[#fbbf24] p-4 md:w-1/3 border-b-2 md:border-b-0 md:border-r-2 border-black flex flex-col items-center justify-center text-center gap-2 dark:bg-zinc-700 dark:border-white dark:text-white">
                        <PotatoBotAvatar />
                        <h3 className="font-black text-lg">PotatoBot</h3>
                        <p className="text-xs font-bold leading-tight opacity-80">
                            "I have seen things you people wouldn't believe. Mainly cringe thumbnails."
                        </p>
                    </div>
                    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-zinc-900">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                             {chatHistory.length === 0 && (
                                 <div className="text-center text-gray-400 text-sm mt-10 italic">
                                     Ask me anything about the analysis...
                                 </div>
                             )}
                             {chatHistory.map((msg, i) => (
                                 <div key={i} className={clsx("flex flex-col max-w-[85%]", msg.role === 'user' ? "self-end items-end" : "self-start items-start")}>
                                     <div className={clsx(
                                         "px-3 py-2 text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]",
                                         msg.role === 'user' ? "bg-white rounded-l-xl rounded-tr-xl dark:bg-zinc-700 dark:border-zinc-500 dark:text-white" : "bg-[#fbbf24] rounded-r-xl rounded-tl-xl text-black"
                                     )}>
                                         {msg.text}
                                     </div>
                                 </div>
                             ))}
                             {isChatLoading && (
                                 <div className="self-start bg-gray-200 px-3 py-2 rounded-xl text-xs animate-pulse">Typing...</div>
                             )}
                             <div ref={chatEndRef}></div>
                        </div>
                        <div className="p-3 border-t-2 border-black bg-white flex gap-2 dark:bg-zinc-800 dark:border-white">
                             <input 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Ask PotatoBot..." 
                                className="flex-1 bg-transparent focus:outline-none font-bold text-sm text-base dark:text-white"
                             />
                             <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-black text-white p-2 rounded hover:bg-zinc-800 dark:bg-white dark:text-black">
                                 <Send className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
               </div>
          </div>
      )}

      {/* Footer (No Border) */}
      <footer className="bg-white text-black py-8 text-center mt-20">
          <p className="font-black uppercase tracking-widest text-sm mb-2">PotatoTool v2.54</p>
          <div className="flex justify-center gap-4 text-zinc-500 text-xs font-bold uppercase mb-4">
              <button onClick={() => setShowChangelog(true)} className="hover:text-black">Changelog</button>
              <span>•</span>
              <button onClick={() => setShowHelp(true)} className="hover:text-black">FAQ</button>
              <span>•</span>
              <a href="#" className="hover:text-black">Terms (Lol)</a>
          </div>
          <p className="text-zinc-400 text-[10px] max-w-md mx-auto px-4">
              Not affiliated with YouTube. Data provided by magic and algorithms. 
              Don't blame the potato if your video flops.
          </p>
      </footer>

      {/* --- MODALS --- */}
      
      {/* Reporting Modal */}
      {showReporting && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-white border-4 border-red-600 p-8 max-w-sm w-full text-center space-y-4 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
                    <Siren className="w-16 h-16 text-red-600 mx-auto animate-bounce" />
                    <h2 className="text-2xl font-black uppercase text-red-600">REPORTING...</h2>
                    <p className="font-bold">Contacting the Internet Police. Please wait.</p>
                    <Loader2 className="w-8 h-8 mx-auto animate-spin" />
               </div>
           </div>
      )}

      {/* Save Vault Modal */}
      {showSavedList && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-white border-[3px] border-black w-full max-w-2xl h-[80vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800 dark:border-white dark:text-white">
                   <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-50 dark:bg-zinc-700 dark:border-white">
                       <h2 className="text-xl font-black uppercase flex items-center gap-2">
                           <FolderOpen className="w-6 h-6"/> The Vault
                       </h2>
                       <button onClick={() => setShowSavedList(false)}><X className="w-6 h-6"/></button>
                   </div>
                   
                   <div className="p-4 border-b-2 border-black bg-gray-100 flex gap-2 dark:bg-zinc-900 dark:border-white">
                        <label className="flex-1 bg-white border-2 border-black px-4 py-2 font-bold text-sm text-center cursor-pointer hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-500">
                             Import JSON
                             <input type="file" ref={importInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                        </label>
                   </div>

                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                       {savedItems.length === 0 ? (
                           <div className="text-center py-20 text-gray-400 italic">No saved items. Analyze something!</div>
                       ) : (
                           savedItems.map(item => (
                               <div key={item.id} className="border-2 border-black p-3 flex gap-4 hover:bg-gray-50 transition-colors dark:border-zinc-500 dark:hover:bg-zinc-700">
                                   {item.thumbnailBase64 ? (
                                       <img src={`data:image/jpeg;base64,${item.thumbnailBase64}`} className="w-20 h-12 object-cover border border-black" />
                                   ) : (
                                       <div className="w-20 h-12 bg-gray-200 border border-black flex items-center justify-center font-bold text-xs">{item.type}</div>
                                   )}
                                   <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2 mb-1">
                                           <span className={clsx("text-[10px] font-black uppercase px-1.5 py-0.5 border border-black text-white",
                                               item.type === 'THUMB_RATER' ? 'bg-pink-400' : 
                                               item.type === 'BOT_HUNTER' ? 'bg-blue-400' : 
                                               item.type === 'DIRTY_TESTER' ? 'bg-yellow-400' : 'bg-black'
                                           )}>{item.type.replace('_', ' ')}</span>
                                           <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.date).toLocaleDateString()}</span>
                                       </div>
                                       <h4 className="font-bold text-sm truncate">{item.videoTitle || item.channelDetails?.title || item.xUrl || "Untitled"}</h4>
                                   </div>
                                   <div className="flex flex-col gap-2">
                                       <button onClick={() => loadSavedItem(item)} className="p-1 hover:bg-blue-100 rounded text-blue-600"><MonitorPlay className="w-4 h-4"/></button>
                                       <button onClick={() => deleteSavedItem(item.id)} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 className="w-4 h-4"/></button>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
               </div>
           </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white border-[3px] border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative dark:bg-zinc-800 dark:border-white dark:text-white">
                 <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4"><X className="w-6 h-6"/></button>
                 <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2"><Settings className="w-6 h-6"/> Settings</h2>
                 
                 <div className="space-y-6">
                     <div>
                         <label className="block font-bold text-sm mb-2 uppercase">Custom YouTube API Key (Optional)</label>
                         <input 
                            type="password" 
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="w-full border-2 border-black p-2 font-mono text-sm dark:bg-zinc-700 dark:border-zinc-500"
                            placeholder="AIzaSy..."
                         />
                         <p className="text-xs text-gray-500 mt-1">If search stops working, add your own key. We don't save this on any server.</p>
                     </div>

                     <div className="flex items-center justify-between border-t-2 border-gray-200 pt-4 dark:border-zinc-700">
                         <span className="font-bold">Dark Mode</span>
                         <button onClick={toggleDarkMode} className="p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none dark:border-white dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                             {isDarkMode ? <SunIcon /> : <MoonIcon />}
                         </button>
                     </div>

                     <button onClick={handleSaveSettings} className="w-full bg-black text-white font-bold uppercase py-3 hover:bg-zinc-800 dark:bg-white dark:text-black">Save Changes</button>
                 </div>
            </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-white border-[3px] border-black p-6 w-full max-w-md text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800 dark:border-white dark:text-white">
                 <h2 className="text-2xl font-black uppercase mb-4">Save Analysis</h2>
                 <p className="mb-6 font-medium">Where do you want to keep this masterpiece?</p>
                 <div className="space-y-3">
                     <button onClick={handleSaveToApp} className="w-full bg-[#fbbf24] border-2 border-black py-3 font-bold uppercase hover:bg-[#f59e0b] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                         Save to App Vault
                     </button>
                     <button onClick={handleDownloadJSON} className="w-full bg-white border-2 border-black py-3 font-bold uppercase hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-700 dark:border-white">
                         Download JSON
                     </button>
                     <button onClick={() => setShowSaveModal(false)} className="mt-2 text-sm underline hover:text-gray-500">Cancel</button>
                 </div>
             </div>
          </div>
      )}

      {/* Changelog Modal */}
      {showChangelog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white border-[3px] border-black w-full max-w-lg max-h-[80vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative dark:bg-zinc-800 dark:border-white dark:text-white">
                  <button onClick={() => setShowChangelog(false)} className="absolute top-4 right-4"><X className="w-6 h-6"/></button>
                  <div className="p-6 border-b-2 border-black bg-[#fbbf24] dark:bg-zinc-700 dark:border-white">
                      <h2 className="text-2xl font-black uppercase">Changelog</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {CHANGELOG_DATA.map((entry, i) => (
                          <div key={i} className="border-l-4 border-black pl-4 dark:border-white">
                              <div className="flex justify-between items-baseline mb-1">
                                  <h3 className="font-black text-lg">{entry.version}</h3>
                                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{entry.date}</span>
                              </div>
                              <h4 className="font-bold mb-2 italic">"{entry.title}"</h4>
                              <ul className="list-disc pl-4 text-sm space-y-1">
                                  {entry.changes.map((c, j) => <li key={j}>{c}</li>)}
                              </ul>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-white border-[3px] border-black p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative dark:bg-zinc-800 dark:border-white dark:text-white">
                 <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4"><X className="w-6 h-6"/></button>
                 <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">How to use</h2>
                 
                 <div className="space-y-6">
                     <div>
                         <h3 className="font-black text-lg bg-pink-200 inline-block px-2 border border-black mb-2 dark:text-black">Thumb Rater</h3>
                         <p className="text-sm">Paste a YouTube link. Our AI (PotatoBot) analyzes the thumbnail for clickability, clarity, and "sus" factors. It gives you a score out of 10 and actionable roasting.</p>
                     </div>
                     <div>
                         <h3 className="font-black text-lg bg-blue-200 inline-block px-2 border border-black mb-2 dark:text-black">Bot Hunter</h3>
                         <p className="text-sm">Paste a Channel link. We scan their recent videos, titles, and stats to determine if they are a human, a "cyborg" (human using heavy tools), or a soulless NPC content farm.</p>
                     </div>
                     <div>
                         <h3 className="font-black text-lg bg-zinc-300 inline-block px-2 border border-black mb-2 dark:text-black">Anon Watch</h3>
                         <p className="text-sm">Paste a video link to watch it in a privacy-enhanced player. No algorithm tracking, no history, just the video.</p>
                     </div>
                     <div>
                         <h3 className="font-black text-lg bg-yellow-200 inline-block px-2 border border-black mb-2 dark:text-black">Dirty Tester</h3>
                         <p className="text-sm">Upload an image (or link). The AI checks if your thumbnail looks like something "inappropriate" at a glance. Helps avoid accidental demonetization.</p>
                     </div>
                 </div>
             </div>
        </div>
      )}

    </div>
  );
};

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);

export default App;