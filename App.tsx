import React, { useState, useRef, useEffect } from 'react';
import { extractVideoId, blobToBase64, fetchVideoMetadata, searchYouTubeVideos, fetchChannelVideos, fetchChannelDetails, extractChannelId, fetchExploreFeed } from './utils/youtube';
import { analyzeThumbnail, sendChatMessage, analyzeBotProbability, analyzeVideoContext } from './services/geminiService';
import { AppState, AnalysisResult, ChatMessage, ChangelogEntry, BotAnalysisResult, SavedItem, VideoAnalysisResult, RiceTubeCategory, SearchResult, ChannelDetails, VideoMetadata } from './types';
import { ScoreCard } from './components/ScoreCard';
import { 
  Youtube, Search, CircleAlert, Loader2, Send, X, 
  TriangleAlert, Siren, Bot, FolderOpen, Trash2, 
  ShoppingBag, Check, Hammer, Settings, Key, MonitorPlay, Eye, 
  EyeOff, ArrowLeft, Link2, HelpCircle, Flame, 
  Home, Gamepad2, Music2, Cpu, Play, FileText, Download, MessageSquare, Megaphone,
  RotateCw, RefreshCcw, Lock, Unlock
} from 'lucide-react';
import clsx from 'clsx';
import { AnalysisChart } from './components/AnalysisChart';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
      version: "v2.29",
      date: "2025-12-19",
      title: "the deep web update",
      changes: [
          "added captcha to sus tab.",
          "added refresh button to ricetube.",
          "randomized sus queries."
      ]
  },
  {
      version: "v2.28",
      date: "2025-12-18",
      title: "the lowercase update",
      changes: [
          "everything is lowercase now.",
          "added report channel button.",
          "fixed changelog modal."
      ]
  }
];

type ActiveTab = 'RATER' | 'BOT_HUNTER' | 'VIDEO_CHAT';
type StoreView = 'SEARCH' | 'CHANNEL';

const SmashLogo = () => (
    <div className="relative group w-10 h-10 flex items-center justify-center cursor-pointer">
        <div className="absolute inset-0 bg-red-600 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:translate-y-1 group-hover:shadow-none transition-all duration-100 flex items-center justify-center overflow-hidden dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[10px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
             <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
        </div>
        <Hammer className="absolute -top-3 -right-3 w-8 h-8 text-black fill-zinc-300 drop-shadow-sm transition-transform duration-100 origin-bottom-left group-hover:rotate-[-45deg] z-10 dark:text-white dark:fill-zinc-600" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase text-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-yellow-300 px-1 border border-black rotate-[-5deg] font-sans">
           bonk!
        </div>
    </div>
);

const Tape = ({ className }: { className?: string }) => (
    <div className={clsx("absolute w-24 h-8 bg-white/60 border border-black/10 rotate-[-3deg] backdrop-blur-sm shadow-sm z-20", className)}></div>
);

const RiceDroidAvatar = () => (
    <div className="w-10 h-10 rounded-full border-[3px] border-black overflow-hidden bg-white shrink-0 hard-shadow-sm dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
        <img src="https://i.imgur.com/gL1bk4m.png" alt="RiceDroid" className="w-full h-full object-cover scale-110" />
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
  
  // RiceTube State
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

  const [videoAnalysisResult, setVideoAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [currentVideoMetadata, setCurrentVideoMetadata] = useState<VideoMetadata | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  
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
      
      const storedKey = localStorage.getItem('ricetool_api_key');
      if (storedKey) setApiKeyInput(storedKey);
    } catch (e) { console.error(e); }
  }, []);

  const handleSaveSettings = () => {
      localStorage.setItem('ricetool_api_key', apiKeyInput);
      setShowSettings(false);
      alert("settings saved.");
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  // RiceTube Functions
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
          alert("wrong code. are you a robot?");
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
    setVideoAnalysisResult(null);
    setCurrentVideoMetadata(null);
    setActiveVideoId(null);
    setVideoTitle(null);
    setVideoDesc(null);
    setVideoKeywords([]);
    setAppState(AppState.IDLE);
    setErrorMsg(null);
    setChatHistory([]);
    setChatInput('');
    setShowSusContent(false);
    setShowSaveModal(false);
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
      setErrorMsg("could not fetch thumbnail. the video might be private or invalid.");
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
      setErrorMsg("could not analyze channel. check the link.");
      setAppState(AppState.ERROR);
    }
  };

  const runVideoChatInit = async (videoId: string) => {
      setAppState(AppState.ANALYZING);
      setActiveVideoId(videoId);
      try {
          const meta = await fetchVideoMetadata(videoId);
          if (!meta.title) throw new Error("Could not fetch metadata");
          setCurrentVideoMetadata(meta);

          const result = await analyzeVideoContext(meta, videoId);
          setVideoAnalysisResult(result);
          setAppState(AppState.SUCCESS);
          setChatHistory([{
              role: 'model',
              text: `yo! i'm watching "${meta.title}" with you. ${result.summary}`
          }]);
      } catch (e) {
          console.error(e);
          setErrorMsg("could not process video. check the link.");
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
         setErrorMsg("invalid youtube video url.");
         setAppState(AppState.ERROR);
      }
    } else if (activeTab === 'VIDEO_CHAT') {
        const videoId = extractVideoId(input);
        if (videoId) {
            resetAnalysis();
            runVideoChatInit(videoId);
        } else {
            setErrorMsg("invalid youtube video url.");
            setAppState(AppState.ERROR);
        }
    } else {
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
        setErrorMsg("invalid channel or video link.");
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
        alert("this mode requires a youtube link.");
        return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setShowImageWarning(true);
    resetAnalysis();
    setAppState(AppState.LOADING_IMAGE);
    try {
      const objectUrl = URL.createObjectURL(file);
      setThumbnailSrc(objectUrl);
      const base64 = await blobToBase64(file);
      setImageBase64(base64);
      setAppState(AppState.READY_TO_ANALYZE);
    } catch (err) {
      setErrorMsg("failed to process file.");
      setAppState(AppState.ERROR);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setAppState(AppState.ANALYZING);
    setShowSusContent(false);
    try {
      const data = await analyzeThumbnail(imageBase64, 'image/jpeg', {
          title: videoTitle,
          description: videoDesc,
          keywords: videoKeywords
        });
      setResult(data);
      setAppState(AppState.SUCCESS);
    } catch (err) {
      setErrorMsg("analysis failed. please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    if (activeTab === 'RATER' && (!imageBase64 || !result)) return;
    if (activeTab === 'BOT_HUNTER' && (!botResult || !analyzingChannel)) return;
    if (activeTab === 'VIDEO_CHAT' && (!videoAnalysisResult || !currentVideoMetadata)) return;

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
          videoResult: videoAnalysisResult,
          videoMetadata: activeTab === 'RATER' ? { title: videoTitle, description: videoDesc, keywords: videoKeywords } : currentVideoMetadata
      });
      setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const prepareSaveItem = (): SavedItem | null => {
      if (activeTab === 'RATER' && result && imageBase64) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'THUMB_RATER', thumbnailBase64: imageBase64, thumbnailResult: result, videoTitle, videoDesc, videoKeywords };
      if (activeTab === 'BOT_HUNTER' && botResult && analyzingChannel) return { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'BOT_HUNTER', botResult, channelDetails: analyzingChannel };
      return null;
  };

  const handleSaveToApp = () => {
    const item = prepareSaveItem();
    if (!item) { alert("saving not supported yet."); return; }
    const newItems = [item, ...savedItems];
    setSavedItems(newItems);
    localStorage.setItem('thumb_rate_saved', JSON.stringify(newItems));
    setShowSaveModal(false);
    alert("saved to vault.");
  };

  const handleDownloadJSON = () => {
      const item = prepareSaveItem();
      if (!item) return;
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `ricetool_${item.type}_${item.id.substring(0,8)}.json`);
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
      } catch (err) { alert("invalid json file."); }
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
    }
  };

  const handleReportChannel = () => {
      setShowReporting(true);
      setTimeout(() => {
          setShowReporting(false);
          alert("channel reported to the internet police.");
      }, 3000);
  };

  return (
    <div className="min-h-screen bg-bliss text-black font-sans pb-20 relative overflow-hidden dark:bg-zinc-900">
      
      {showRiceTube && (
          <div className="fixed inset-0 z-[200] bg-zinc-900 font-sans text-white flex flex-col">
              <div className="h-16 bg-[#202020] flex items-center justify-between px-4 border-b border-zinc-700 shrink-0">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setShowRiceTube(false)} className="p-2 hover:bg-zinc-700 rounded-full">
                          <ArrowLeft className="w-6 h-6" />
                      </button>
                      <div className="flex items-center gap-1">
                          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                          <span className="font-bold text-xl tracking-tighter">ricetube™</span>
                      </div>
                  </div>
                  <div className="flex-1 max-w-2xl mx-8">
                      <div className="flex bg-[#121212] border border-zinc-700 rounded-full overflow-hidden">
                          <input 
                             type="text" 
                             className="flex-1 bg-transparent px-4 py-2 outline-none"
                             placeholder="search the riceverse..."
                             value={rtQuery}
                             onChange={(e) => setRtQuery(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && handleRiceTubeSearch()}
                          />
                          <button onClick={handleRiceTubeSearch} className="px-6 bg-zinc-800 hover:bg-zinc-700 border-l border-zinc-700">
                              <Search className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
                  <div className="flex items-center gap-4">
                      <button onClick={refreshRiceTube} className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white" title="refresh">
                         <RotateCw className={clsx("w-6 h-6", rtIsLoading && "animate-spin")} />
                      </button>
                      <div className={clsx("flex items-center gap-2 px-3 py-1 rounded-full border", isSusUnlocked ? "bg-red-900/50 border-red-500 text-red-200" : "bg-[#303030] border-zinc-600")}>
                         {isSusUnlocked ? <Unlock className="w-3 h-3"/> : <Lock className="w-3 h-3 text-zinc-400"/>}
                         <span className="text-xs font-bold text-zinc-400">{isSusUnlocked ? "SafeSearch: OFF" : "locked"}</span>
                      </div>
                  </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                  <div className="w-64 bg-[#202020] border-r border-zinc-700 flex flex-col p-4 space-y-2 shrink-0 overflow-y-auto">
                      <button onClick={() => loadRiceTubeCategory('HOME')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'HOME' ? "bg-red-600 text-white" : "hover:bg-zinc-700")}>
                          <Home className="w-5 h-5" /> home
                      </button>
                      <button onClick={() => loadRiceTubeCategory('TRENDING')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'TRENDING' ? "bg-red-600 text-white" : "hover:bg-zinc-700")}>
                          <Flame className="w-5 h-5" /> trending
                      </button>
                      <button onClick={() => loadRiceTubeCategory('GAMING')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'GAMING' ? "bg-red-600 text-white" : "hover:bg-zinc-700")}>
                          <Gamepad2 className="w-5 h-5" /> gaming
                      </button>
                      <button onClick={() => loadRiceTubeCategory('TECH')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'TECH' ? "bg-red-600 text-white" : "hover:bg-zinc-700")}>
                          <Cpu className="w-5 h-5" /> tech
                      </button>
                      <button onClick={() => loadRiceTubeCategory('MUSIC')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'MUSIC' ? "bg-red-600 text-white" : "hover:bg-zinc-700")}>
                          <Music2 className="w-5 h-5" /> music
                      </button>
                      <div className="border-t border-zinc-700 my-2"></div>
                      <button onClick={() => rtCategory === 'SUS' && !isSusUnlocked ? null : loadRiceTubeCategory('SUS')} className={clsx("flex items-center gap-4 p-3 rounded-xl font-bold transition-colors", rtCategory === 'SUS' ? "bg-purple-600 text-white" : "hover:bg-zinc-700")}>
                          <Siren className="w-5 h-5" /> the deep web (sus)
                      </button>
                  </div>

                  <div className="flex-1 bg-[#181818] p-6 overflow-y-auto">
                      {rtCategory === 'SUS' && !isSusUnlocked ? (
                          <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-zinc-800 border-2 border-red-500 p-8 rounded-xl max-w-md w-full text-center shadow-xl">
                                  <Siren className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
                                  <h2 className="text-2xl font-black text-red-500 mb-2 uppercase">restricted area</h2>
                                  <p className="mb-6 font-bold text-zinc-400">complete verification to enter the deep web.</p>
                                  
                                  <div className="bg-black p-4 mb-4 rounded border border-zinc-600 flex items-center justify-between">
                                      <span className="font-mono text-3xl tracking-widest text-white line-through decoration-red-500 decoration-4 select-none blur-[1px]">{susCaptchaString}</span>
                                      <button onClick={refreshCaptcha} className="p-2 hover:bg-zinc-800 rounded text-zinc-400"><RefreshCcw className="w-5 h-5"/></button>
                                  </div>
                                  
                                  <input 
                                      type="text" 
                                      value={susCaptchaInput}
                                      onChange={(e) => setSusCaptchaInput(e.target.value)}
                                      placeholder="enter code..."
                                      className="w-full bg-zinc-900 border border-zinc-600 p-3 rounded mb-4 text-center font-bold text-xl uppercase"
                                  />
                                  <button onClick={handleCaptchaSubmit} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded uppercase">
                                      verify human
                                  </button>
                              </div>
                          </div>
                      ) : (
                        <>
                            {rtView === 'CHANNEL' && rtSelectedChannel && (
                                <div className="mb-8">
                                    <button onClick={() => setRtView('SEARCH')} className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white">
                                        <ArrowLeft className="w-4 h-4" /> back to search
                                    </button>
                                    <div className="flex items-center gap-6 bg-[#202020] p-6 rounded-2xl border border-zinc-700">
                                        <img src={rtSelectedChannel.thumbnail} className="w-24 h-24 rounded-full border-2 border-white" />
                                        <div>
                                            <h2 className="text-3xl font-black">{rtSelectedChannel.title}</h2>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={(e) => handleCopy(rtSelectedChannel.id, 'channel', e)} className="px-4 py-2 bg-white text-black font-bold rounded-full hover:bg-zinc-200">
                                                    copy link
                                                </button>
                                                <button onClick={() => handleRtItemClick(rtSelectedChannel)} className="px-4 py-2 bg-zinc-700 text-white font-bold rounded-full hover:bg-zinc-600">
                                                    reload
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {rtIsLoading ? (
                                    <div className="col-span-full flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin" /></div>
                                ) : rtResults.map(item => {
                                    const isBlurred = item.isSus && !revealedItems.has(item.id);
                                    return (
                                        <div key={item.id} onClick={() => handleRtItemClick(item)} className="group cursor-pointer bg-[#202020] rounded-xl overflow-hidden hover:bg-[#303030] transition-colors ring-1 ring-white/10">
                                            <div className="aspect-video bg-black relative">
                                                <img src={item.thumbnail} className={clsx("w-full h-full object-cover", isBlurred && "blur-xl opacity-50")} />
                                                {item.type === 'video' && (
                                                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded font-bold">vid</span>
                                                )}
                                                {isBlurred && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Siren className="w-8 h-8 text-red-500 animate-pulse" />
                                                    </div>
                                                )}
                                                {item.isSus && (
                                                    <button onClick={(e) => toggleReveal(item.id, e)} className="absolute top-2 left-2 p-1 bg-black/50 hover:bg-black rounded-lg text-white">
                                                        {isBlurred ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                                    </button>
                                                )}
                                                <button onClick={(e) => handleCopy(item.id, item.type, e)} className="absolute bottom-2 left-2 p-1.5 bg-black/50 hover:bg-red-600 rounded-lg text-white transition-colors">
                                                    {copiedItemId === item.id ? <Check className="w-4 h-4"/> : <Link2 className="w-4 h-4"/>}
                                                </button>
                                            </div>
                                            <div className="p-3">
                                                <h3 className="font-bold line-clamp-2 leading-tight" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                                                <p className="text-sm text-zinc-400 mt-1">{item.channelTitle}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {rtView === 'CHANNEL' && rtNextPageToken && !rtIsLoading && (
                                <div className="flex justify-center mt-8">
                                    <button onClick={handleLoadMore} className="bg-white text-black font-bold uppercase py-3 px-8 rounded-full hover:bg-zinc-200">
                                        load more videos
                                    </button>
                                </div>
                            )}
                        </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
              <div className="bg-white max-w-md w-full border-[3px] border-black hard-shadow rotate-1 relative dark:bg-zinc-800 dark:border-white">
                  <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:text-white"><X className="w-5 h-5"/></button>
                  <div className="p-8 flex flex-col items-center text-center">
                      <h2 className="text-2xl font-black uppercase mb-4 dark:text-white">settings</h2>
                      
                      <div className="w-full text-left mb-6">
                          <label className="text-xs font-black uppercase ml-1 dark:text-white">custom api key</label>
                          <div className="relative mt-1">
                              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                              <input 
                                  type="text" 
                                  value={apiKeyInput}
                                  onChange={(e) => setApiKeyInput(e.target.value)}
                                  placeholder="AIzaSy... (optional)"
                                  className="w-full border-2 border-black p-3 pl-10 font-mono text-sm outline-none focus:bg-yellow-50 dark:bg-zinc-900 dark:border-white dark:text-white dark:focus:bg-zinc-800"
                              />
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 mt-1">use your own key to bypass rate limits.</p>
                      </div>
                      
                      <div className="w-full text-left mb-6 flex items-center justify-between">
                         <label className="text-xs font-black uppercase ml-1 dark:text-white">dark mode</label>
                         <button onClick={toggleDarkMode} className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                            {isDarkMode ? <span className="text-xs">on</span> : <span className="text-xs">off</span>}
                         </button>
                      </div>

                      <button onClick={handleSaveSettings} className="w-full bg-green-500 text-black font-bold py-3 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none hover:bg-green-400 transition-all uppercase flex items-center justify-center gap-2 dark:border-white dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                          <Check className="w-5 h-5" /> save changes
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 font-sans backdrop-blur-sm">
          <div className="bg-white border-[3px] border-black hard-shadow p-6 max-w-sm w-full rotate-[-1deg] relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
             <button onClick={() => setShowSaveModal(false)} className="absolute top-2 right-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:text-white"><X className="w-5 h-5"/></button>
             <h2 className="text-2xl font-black uppercase mb-4 text-center dark:text-white">secure evidence</h2>
             <div className="space-y-3">
               <button onClick={handleSaveToApp} className="w-full bg-[#86efac] border-[3px] border-black p-3 font-bold hard-shadow-sm hover:-translate-y-1 transition-transform dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                 save to vault (local)
               </button>
               <button onClick={handleDownloadJSON} className="w-full bg-[#67e8f9] border-[3px] border-black p-3 font-bold hard-shadow-sm hover:-translate-y-1 transition-transform dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                 export .json file
               </button>
             </div>
          </div>
        </div>
      )}

      {showSavedList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
           <div className="bg-white border-[3px] border-black hard-shadow w-full max-w-2xl h-[80vh] flex flex-col relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
               <div className="bg-[#fde047] border-b-[3px] border-black p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-white">
                  <h2 className="text-2xl font-black uppercase flex items-center gap-2 dark:text-white"><FolderOpen className="w-6 h-6"/> the vault</h2>
                  <button onClick={() => setShowSavedList(false)} className="hover:bg-black/10 p-1 dark:text-white"><X className="w-6 h-6"/></button>
               </div>
               
               <div className="flex-1 overflow-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] dark:bg-zinc-800">
                  {savedItems.length === 0 && (
                    <div className="text-center py-10 opacity-50 font-bold dark:text-white">
                       <p>vault empty</p>
                       <p className="text-xs mt-2">start scanning to collect evidence.</p>
                       <button onClick={() => importInputRef.current?.click()} className="mt-4 text-blue-600 underline dark:text-blue-400">import .json</button>
                    </div>
                  )}
                  {savedItems.map(item => (
                    <div key={item.id} className="bg-white border-[3px] border-black p-4 hard-shadow-sm flex justify-between items-center group hover:scale-[1.01] transition-transform dark:bg-zinc-700 dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                       <div onClick={() => loadSavedItem(item)} className="cursor-pointer flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={clsx("text-[10px] font-bold px-1 border border-black dark:border-white dark:text-white", item.type === 'THUMB_RATER' ? 'bg-pink-300' : 'bg-cyan-300')}>{item.type}</span>
                             <span className="text-xs text-zinc-500 font-bold dark:text-zinc-300">{new Date(item.date).toLocaleDateString()}</span>
                          </div>
                          <h3 className="font-bold text-lg leading-tight dark:text-white">
                            {item.type === 'THUMB_RATER' ? (item.videoTitle || "untitled thumbnail") : item.channelDetails?.title}
                          </h3>
                       </div>
                       <button onClick={() => deleteSavedItem(item.id)} className="p-2 hover:bg-red-100 text-red-600 rounded dark:hover:bg-red-900">
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  ))}
               </div>
           </div>
        </div>
      )}

      {showChangelog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
           <div className="bg-white border-[3px] border-black hard-shadow w-full max-w-lg relative rotate-1 dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
               <button onClick={() => setShowChangelog(false)} className="absolute top-2 right-2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:text-white"><X className="w-5 h-5"/></button>
               <div className="p-6">
                   <h2 className="text-3xl font-black uppercase mb-6 bg-pink-300 inline-block px-2 border-2 border-black dark:text-black">patch notes</h2>
                   <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                       {CHANGELOG_DATA.map((entry, i) => (
                           <div key={i} className="border-l-[3px] border-black pl-4 dark:border-white">
                               <div className="flex items-center gap-2 mb-1">
                                   <span className="font-black text-lg dark:text-white">{entry.version}</span>
                                   <span className="text-xs bg-black text-white px-1 font-bold dark:bg-white dark:text-black">{entry.date}</span>
                               </div>
                               <h3 className="font-bold uppercase text-zinc-500 mb-2 dark:text-zinc-400">"{entry.title}"</h3>
                               <ul className="list-disc pl-4 space-y-1">
                                   {entry.changes.map((change, j) => (
                                       <li key={j} className="text-sm font-bold dark:text-zinc-300">{change}</li>
                                   ))}
                               </ul>
                           </div>
                       ))}
                   </div>
               </div>
           </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
           <div className="bg-white border-[3px] border-black hard-shadow w-full max-w-2xl max-h-[90vh] flex flex-col relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
               <div className="bg-[#a78bfa] border-b-[3px] border-black p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-white">
                  <h2 className="text-2xl font-black uppercase flex items-center gap-2 dark:text-white"><HelpCircle className="w-6 h-6"/> instruction manual</h2>
                  <button onClick={() => setShowHelp(false)} className="hover:bg-black/10 p-1 dark:text-white"><X className="w-6 h-6"/></button>
               </div>
               <div className="p-8 overflow-y-auto dark:text-white">
                  <div className="space-y-8">
                      <section>
                          <h3 className="text-xl font-black mb-2 bg-yellow-300 inline-block px-2 border border-black dark:text-black">1. thumb rater</h3>
                          <p>paste a youtube link or upload an image. the ai analyzes it based on curiosity, clarity, and emotion. it gives you a score out of 10 and tells you why your thumbnail sucks (or why it rules).</p>
                      </section>
                      <section>
                          <h3 className="text-xl font-black mb-2 bg-cyan-300 inline-block px-2 border border-black dark:text-black">2. bot hunter</h3>
                          <p>paste a channel link. the ai scans their last 24 videos for repetitive titles, spammy uploads, and soulless descriptions to determine if they are a human or an npc farm.</p>
                      </section>
                      <section>
                          <h3 className="text-xl font-black mb-2 bg-purple-300 inline-block px-2 border border-black dark:text-black">3. ask video</h3>
                          <p>paste a video link. the ai "watches" the metadata (and uses google search) so you can chat about the video content without watching it yourself.</p>
                      </section>
                      <section>
                          <h3 className="text-xl font-black mb-2 bg-white border border-black dark:text-black">portable & free</h3>
                          <p>this tool runs in your browser. you can download the source code and run it locally. no login required.</p>
                      </section>
                  </div>
               </div>
           </div>
        </div>
      )}
      
      {showReporting && (
          <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-red-600/90 font-sans text-white p-8 text-center backdrop-blur-md animate-in fade-in">
              <Megaphone className="w-24 h-24 mb-6 animate-bounce" />
              <h1 className="text-6xl font-black uppercase tracking-tighter mb-4">reporting...</h1>
              <p className="text-2xl font-bold">contacting the internet police.</p>
          </div>
      )}

      {isCelebrationMode && (
        <div className="fixed inset-0 pointer-events-none z-10 opacity-30 bg-[url('https://media.giphy.com/media/26tOZ42Mg6pbTUPDa/giphy.gif')] bg-repeat mix-blend-screen"></div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportJSON} />

      <header className="bg-[#fde047] border-b-[3px] border-black sticky top-0 z-50 font-sans shadow-md dark:bg-zinc-800 dark:border-white">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAnalysis}>
            <SmashLogo />
            {/* CHANGE APP NAME HERE */}
            <h1 className="font-bold text-3xl tracking-tighter text-black italic bg-white px-2 border-2 border-black rotate-[-2deg] group-hover:rotate-[2deg] transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 dark:text-white dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
              ricetool
            </h1>
          </div>
          <div className="flex gap-3">
            <button onClick={openRiceTube} className="hidden sm:flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-4 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase relative dark:bg-zinc-900 dark:text-white dark:border-white dark:hover:bg-zinc-800 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                <ShoppingBag className="w-4 h-4" /> ricetube™
            </button>
            <button onClick={() => setShowSavedList(true)} className="flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-4 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase dark:bg-zinc-900 dark:text-white dark:border-white dark:hover:bg-zinc-800 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                <FolderOpen className="w-4 h-4" /> vault
            </button>
            <button onClick={() => setShowHelp(true)} className="p-2 bg-[#a78bfa] text-black hover:bg-purple-300 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                <HelpCircle className="w-4 h-4" />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-zinc-200 text-black hover:bg-zinc-300 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all dark:bg-zinc-700 dark:text-white dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 relative z-10 font-sans">
        
        <div className="flex justify-center mb-16">
            <div className="bg-white p-2 border-[3px] border-black hard-shadow rotate-1 inline-flex gap-3 relative flex-wrap justify-center dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                <Tape className="-top-4 right-1/2 translate-x-1/2 rotate-[-1deg] w-32" />
                <button 
                    onClick={() => { setActiveTab('RATER'); resetAnalysis(); }}
                    className={clsx(
                        "px-6 py-3 text-lg font-bold uppercase transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                        activeTab === 'RATER' ? "bg-[#f9a8d4] text-black border-black dark:border-white" : "bg-zinc-100 text-zinc-400 border-transparent hover:text-black hover:border-black dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-white dark:hover:text-white"
                    )}
                >
                    thumb rater
                </button>
                <button 
                    onClick={() => { setActiveTab('BOT_HUNTER'); resetAnalysis(); }}
                    className={clsx(
                        "px-6 py-3 text-lg font-bold uppercase transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                        activeTab === 'BOT_HUNTER' ? "bg-[#67e8f9] text-black border-black dark:border-white" : "bg-zinc-100 text-zinc-400 border-transparent hover:text-black hover:border-black dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-white dark:hover:text-white"
                    )}
                >
                    bot hunter
                </button>
                <button 
                    onClick={() => { setActiveTab('VIDEO_CHAT'); resetAnalysis(); }}
                    className={clsx(
                        "px-6 py-3 text-lg font-bold uppercase transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 relative group dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                        activeTab === 'VIDEO_CHAT' ? "bg-[#a78bfa] text-black border-black dark:border-white" : "bg-zinc-100 text-zinc-400 border-transparent hover:text-black hover:border-black dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-white dark:hover:text-white"
                    )}
                >
                    ask video
                </button>
            </div>
        </div>

        <div className="text-center mb-12 relative">
            <h1 className="text-6xl md:text-8xl font-bold text-black uppercase tracking-tighter leading-none relative z-10 drop-shadow-xl dark:text-white">
                {activeTab === 'RATER' && (
                   <>
                     is your thumb <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ef4444] to-[#ec4899] drop-shadow-none">trash?</span>
                   </>
                )}
                {activeTab === 'BOT_HUNTER' && (
                   <>
                     are they an <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#67e8f9] to-[#3b82f6] drop-shadow-none">npc?</span>
                   </>
                )}
                {activeTab === 'VIDEO_CHAT' && (
                   <>
                     does it <br/>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] to-[#8b5cf6] drop-shadow-none">suck?</span>
                   </>
                )}
            </h1>
            <p className="mt-4 text-xl font-bold text-black bg-[#fde047] inline-block px-4 py-1 border-[3px] border-black rotate-[-2deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                {activeTab === 'RATER' ? "find out if you are cooked." : activeTab === 'BOT_HUNTER' ? "find out if they are fake." : "chat about any video."}
            </p>
        </div>

        <div className="max-w-3xl mx-auto mb-16 relative">
          <div className="absolute -top-6 -left-6 bg-black text-white px-3 py-1 font-bold text-xs rotate-[-5deg] border-2 border-white shadow-md z-10 dark:bg-white dark:text-black dark:border-black">
              {activeTab === 'RATER' ? "paste it" : activeTab === 'BOT_HUNTER' ? "expose them" : "watch it"}
          </div>
          <div className="relative group hover:scale-[1.01] transition-transform duration-200">
            <div className={clsx("relative flex p-3 border-[3px] border-black hard-shadow dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", 
                 activeTab === 'RATER' ? "bg-[#67e8f9]" : activeTab === 'BOT_HUNTER' ? "bg-[#86efac]" : "bg-[#a78bfa]")}>
               <div className="flex items-center justify-center w-14 text-black border-r-[3px] border-black mr-3 bg-white/30">
                  {activeTab === 'RATER' ? <Youtube className="w-8 h-8" /> : activeTab === 'BOT_HUNTER' ? <Bot className="w-8 h-8" /> : <MonitorPlay className="w-8 h-8" />}
               </div>
               <input 
                 type="text" 
                 placeholder={activeTab === 'RATER' ? "paste youtube link..." : activeTab === 'BOT_HUNTER' ? "paste channel link..." : "paste video link..."}
                 className="w-full bg-transparent outline-none text-black placeholder-black/50 px-2 font-bold text-xl uppercase caret-black cursor-text"
                 value={url}
                 onChange={handleUrlChange}
                 onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
               />
               <button 
                 onClick={handleInputSubmit} 
                 className="bg-[#ec4899] hover:bg-pink-400 text-black px-8 font-bold text-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 transition-all uppercase"
               >
                 {activeTab === 'RATER' ? "judge me" : activeTab === 'BOT_HUNTER' ? "scan" : "chat"}
               </button>
            </div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-black dark:bg-white"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-black dark:bg-white"></div>
          </div>
          
          {activeTab === 'RATER' && (
              <div className="text-center mt-4">
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-black hover:underline uppercase tracking-wide bg-white px-2 py-1 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all dark:bg-zinc-800 dark:text-white dark:border-white dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                    or upload a raw file (dumber)
                  </button>
              </div>
          )}

          {errorMsg && (
            <div className="mt-6 bg-[#ef4444] text-white p-4 font-bold border-[3px] border-black hard-shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 rotate-1 dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
              <CircleAlert className="w-6 h-6 stroke-[3px]" />
              {errorMsg}
            </div>
          )}
        </div>

        {appState === AppState.LOADING_IMAGE && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
            <Loader2 className="w-16 h-16 text-black animate-spin mb-4 dark:text-white" />
            <p className="text-2xl font-black bg-white px-4 py-1 border-2 border-black -rotate-2 dark:bg-zinc-800 dark:text-white dark:border-white">stealing data...</p>
          </div>
        )}

        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
             {activeTab === 'VIDEO_CHAT' ? (
                 <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#a78bfa] rounded-full border-[4px] border-black flex items-center justify-center animate-bounce mb-6 dark:border-white">
                        <MonitorPlay className="w-10 h-10 text-black" />
                    </div>
                    <div className="bg-[#a78bfa] border-[3px] border-black p-4 hard-shadow rotate-1 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                        <h2 className="text-3xl font-black uppercase">watching video...</h2>
                        <p className="font-bold text-center mt-2">skipping ads for you.</p>
                    </div>
                 </div>
             ) : (
                <>
                    <div className="w-20 h-20 bg-[#fde047] rounded-full border-[4px] border-black flex items-center justify-center animate-spin mb-6 dark:border-white">
                        <Loader2 className="w-10 h-10 text-black" />
                    </div>
                    <div className="bg-white border-[3px] border-black p-4 hard-shadow rotate-1 dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                        <h2 className="text-4xl font-black uppercase dark:text-white">cooking...</h2>
                        <p className="text-xs font-bold text-center mt-2 opacity-50 dark:text-zinc-400">do not turn off your console.</p>
                    </div>
                </>
             )}
          </div>
        )}

        {appState === AppState.READY_TO_ANALYZE && activeTab === 'RATER' && thumbnailSrc && (
          <div className="max-w-4xl mx-auto animate-slide-up">
             <div className="bg-white border-[3px] border-black p-6 hard-shadow mb-8 relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                <Tape className="-top-3 -left-3 rotate-[-10deg]" />
                <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2 dark:text-white"><FileText className="w-6 h-6"/> stolen data</h2>
                <div className="space-y-2 font-mono text-sm bg-zinc-100 p-4 border-2 border-black dark:bg-zinc-900 dark:border-white dark:text-zinc-300">
                    <p><span className="font-bold bg-black text-white px-1 dark:bg-white dark:text-black">title:</span> {isMetadataLoading ? "fetching..." : videoTitle}</p>
                    <p><span className="font-bold bg-black text-white px-1 dark:bg-white dark:text-black">desc:</span> {isMetadataLoading ? "..." : (videoDesc ? videoDesc.substring(0, 100) + "..." : "none")}</p>
                    <p><span className="font-bold bg-black text-white px-1 dark:bg-white dark:text-black">tags:</span> {isMetadataLoading ? "..." : (videoKeywords.length > 0 ? videoKeywords.slice(0, 5).join(", ") : "none")}</p>
                </div>
             </div>

             <div className="bg-white border-[3px] border-black p-2 hard-shadow rotate-1 mb-8 relative group dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                <Tape className="-top-3 left-1/2 -translate-x-1/2" />
                <div className="relative aspect-video bg-black border-2 border-black overflow-hidden dark:border-white">
                   <img src={thumbnailSrc} className="w-full h-full object-contain" />
                   {showImageWarning && (
                       <div className="absolute top-2 right-2 bg-yellow-300 text-black text-xs font-bold px-2 py-1 border border-black rotate-2 shadow-sm">
                           raw file mode (dumb)
                       </div>
                   )}
                </div>
             </div>
             <div className="flex justify-center">
               <button onClick={handleAnalyze} className="bg-[#86efac] hover:bg-green-400 text-black text-2xl px-12 py-4 font-bold border-[3px] border-black hard-shadow transition-transform active:translate-y-1 active:shadow-none uppercase tracking-tight dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">start judgement</button>
             </div>
          </div>
        )}

        {appState === AppState.SUCCESS && activeTab === 'RATER' && result && (
           <div className="animate-slide-up space-y-12">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                <div className="lg:col-span-8 bg-white border-[3px] border-black p-1 hard-shadow dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                   <div className="relative aspect-video bg-black border-2 border-black dark:border-white overflow-hidden group">
                      <img src={thumbnailSrc || ''} className={clsx("w-full h-full object-contain transition-all duration-300", showSusContent ? "blur-none" : (result.isSus ? "blur-2xl" : "blur-none"))} />
                      {result.isSus && !showSusContent && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                              <TriangleAlert className="w-16 h-16 text-red-500 mb-2 animate-pulse" />
                              <h3 className="text-3xl font-black text-white uppercase text-center px-4">sus content detected</h3>
                              <p className="text-white font-bold mb-6 text-center max-w-md">{result.susReason}</p>
                              <button onClick={() => setShowSusContent(true)} className="bg-white text-black font-bold px-6 py-2 border-2 border-black hover:bg-red-500 hover:text-white transition-colors">
                                  i am an adult (show me)
                              </button>
                          </div>
                      )}
                      {result.scores.overall === 10 && (
                          <div className="absolute -top-4 -right-4 bg-yellow-400 text-black border-[3px] border-black p-2 rotate-[10deg] shadow-lg z-20 font-black text-xl animate-bounce">
                              legendary!
                          </div>
                      )}
                   </div>
                </div>

                <div className="lg:col-span-4 h-full min-h-[300px]">
                   <AnalysisChart scores={result.scores} />
                </div>

                <div className="lg:col-span-12">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <ScoreCard label="clarity" score={result.scores.clarity} rotation="rotate-[-2deg]" />
                      <ScoreCard label="curiosity" score={result.scores.curiosity} rotation="rotate-[1deg]" />
                      <ScoreCard label="text" score={result.scores.text_readability} rotation="rotate-[-1deg]" />
                      <ScoreCard label="emotion" score={result.scores.emotion} rotation="rotate-[2deg]" />
                   </div>
                   <div className="flex justify-center">
                       <ScoreCard label="overall" score={result.scores.overall} rotation="rotate-0" color={result.scores.overall === 10 ? "bg-gradient-to-br from-yellow-300 to-yellow-500" : undefined} icon={result.scores.overall === 10 ? <Flame className="w-6 h-6"/> : undefined} />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-[#fde047] border-[3px] border-black p-6 hard-shadow relative dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                    <Tape className="-top-3 left-4" />
                    <h3 className="text-xl font-black uppercase border-b-2 border-black pb-2 mb-2">the verdict</h3>
                    <p className="text-xl font-bold leading-relaxed mt-4 text-black">"{result.summary}"</p>
                 </div>
                 <div className="bg-white border-[3px] border-black p-6 hard-shadow relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] dark:text-white">
                    <Tape className="-top-3 right-4 rotate-[2deg]" />
                    <h3 className="text-xl font-black uppercase border-b-2 border-black pb-2 mb-2 dark:border-white">fix this trash</h3>
                    <ul className="mt-4 space-y-3">
                       {result.suggestions?.map((s, i) => (
                           <li key={i} className="flex gap-3 items-start font-medium">
                               <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5 stroke-[3px]" />
                               {s}
                           </li>
                       ))}
                    </ul>
                 </div>
             </div>

             <div className="flex justify-center gap-4">
                 <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-2 bg-zinc-200 hover:bg-zinc-300 text-black px-6 py-3 font-bold border-[3px] border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase dark:bg-zinc-700 dark:text-white dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                     <Download className="w-5 h-5" /> save evidence
                 </button>
                 <button onClick={resetAnalysis} className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-black px-6 py-3 font-bold border-[3px] border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase dark:bg-zinc-800 dark:text-white dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                     <Trash2 className="w-5 h-5" /> trash it
                 </button>
             </div>
             
             {/* CHAT ROOM */}
             <div className="max-w-3xl mx-auto bg-white border-[3px] border-black hard-shadow flex flex-col h-[500px] relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                <div className="bg-[#ec4899] border-b-[3px] border-black p-3 flex items-center gap-2 dark:border-white">
                   <MessageSquare className="w-6 h-6 text-black fill-white" />
                   <h3 className="font-black text-xl text-white uppercase tracking-wider drop-shadow-md">the roast room</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                   {chatHistory.map((msg, idx) => (
                      <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                         {msg.role === 'model' && <RiceDroidAvatar />}
                         <div className={clsx(
                           "p-3 max-w-[80%] font-bold text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                           msg.role === 'user' ? "bg-white text-black rounded-tl-xl rounded-bl-xl rounded-br-xl dark:bg-zinc-200" : "bg-yellow-300 text-black rounded-tr-xl rounded-br-xl rounded-bl-xl"
                         )}>
                            {msg.text}
                         </div>
                      </div>
                   ))}
                   {isChatLoading && (
                      <div className="flex gap-3">
                         <RiceDroidAvatar />
                         <div className="bg-zinc-200 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border-2 border-black animate-pulse flex gap-1">
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-200"></div>
                         </div>
                      </div>
                   )}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-3 bg-zinc-100 border-t-[3px] border-black flex gap-2 dark:bg-zinc-800 dark:border-white">
                   <input 
                     type="text" 
                     className="flex-1 bg-white border-2 border-black px-3 py-2 font-bold outline-none focus:bg-yellow-50 dark:bg-zinc-700 dark:border-zinc-500 dark:text-white"
                     placeholder="defend yourself..."
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                   />
                   <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-black text-white p-2 hover:bg-zinc-800 border-2 border-transparent disabled:opacity-50 dark:bg-white dark:text-black">
                      <Send className="w-5 h-5" />
                   </button>
                </div>
             </div>
           </div>
        )}

        {appState === AppState.SUCCESS && activeTab === 'BOT_HUNTER' && botResult && (
           <div className="animate-slide-up space-y-12">
               <div className="bg-white border-[3px] border-black p-8 hard-shadow text-center relative overflow-hidden dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                   <div className={clsx(
                       "absolute top-0 left-0 w-full h-4",
                       botResult.verdict === 'HUMAN' ? 'bg-green-500' : botResult.verdict === 'CYBORG' ? 'bg-yellow-500' : 'bg-red-600'
                   )}></div>
                   <h2 className="text-4xl font-black uppercase mb-2 mt-4 dark:text-white">{analyzingChannel?.title}</h2>
                   <div className="flex justify-center gap-4 text-sm font-bold text-zinc-500 mb-8 dark:text-zinc-400">
                       <span>{analyzingChannel?.subscriberCount} subs</span>
                       <span>•</span>
                       <span>{analyzingChannel?.videoCount} videos</span>
                   </div>
                   
                   <div className="inline-block relative">
                       <div className={clsx(
                           "text-8xl font-black px-8 py-4 border-[6px] border-black rotate-[-2deg] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]",
                           botResult.verdict === 'HUMAN' ? 'bg-[#86efac] text-black' : botResult.verdict === 'CYBORG' ? 'bg-[#fde047] text-black' : 'bg-[#ef4444] text-white'
                       )}>
                           {botResult.verdict}
                       </div>
                       <div className="mt-4 font-mono font-bold text-lg dark:text-white">bot probability: {botResult.botScore}%</div>
                   </div>
                   
                   <div className="mt-12 text-left bg-zinc-50 border-2 border-black p-6 dark:bg-zinc-900 dark:border-white dark:text-white">
                       <h3 className="font-black uppercase text-xl mb-4 border-b-2 border-black pb-2 flex gap-2 items-center dark:border-white">
                           <Siren className="w-6 h-6 text-red-600"/> evidence locker
                       </h3>
                       <ul className="space-y-2 list-disc pl-5">
                           {botResult.evidence?.map((e, i) => (
                               <li key={i} className="font-medium">{e}</li>
                           ))}
                       </ul>
                       <div className="mt-6 p-4 bg-yellow-200 border-2 border-black border-dashed dark:bg-yellow-900/50 dark:border-white">
                           <p className="font-bold italic">"{botResult.summary}"</p>
                       </div>
                   </div>
               </div>
               
               <div className="flex justify-center gap-4">
                 <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-2 bg-zinc-200 hover:bg-zinc-300 text-black px-6 py-3 font-bold border-[3px] border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase dark:bg-zinc-700 dark:text-white dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                     <Download className="w-5 h-5" /> archive case
                 </button>
                 <button onClick={handleReportChannel} className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white px-6 py-3 font-bold border-[3px] border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase dark:border-white dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                     <Megaphone className="w-5 h-5" /> report channel
                 </button>
               </div>

               {/* CHAT ROOM BOT */}
               <div className="max-w-3xl mx-auto bg-white border-[3px] border-black hard-shadow flex flex-col h-[500px] relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                <div className="bg-[#67e8f9] border-b-[3px] border-black p-3 flex items-center gap-2 dark:border-white">
                   <MessageSquare className="w-6 h-6 text-black fill-white" />
                   <h3 className="font-black text-xl text-black uppercase tracking-wider drop-shadow-md">the interrogation room</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                   {chatHistory.map((msg, idx) => (
                      <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                         {msg.role === 'model' && <RiceDroidAvatar />}
                         <div className={clsx(
                           "p-3 max-w-[80%] font-bold text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                           msg.role === 'user' ? "bg-white text-black rounded-tl-xl rounded-bl-xl rounded-br-xl dark:bg-zinc-200" : "bg-cyan-200 text-black rounded-tr-xl rounded-br-xl rounded-bl-xl"
                         )}>
                            {msg.text}
                         </div>
                      </div>
                   ))}
                   {isChatLoading && (
                      <div className="flex gap-3">
                         <RiceDroidAvatar />
                         <div className="bg-zinc-200 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border-2 border-black animate-pulse flex gap-1">
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-200"></div>
                         </div>
                      </div>
                   )}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-3 bg-zinc-100 border-t-[3px] border-black flex gap-2 dark:bg-zinc-800 dark:border-white">
                   <input 
                     type="text" 
                     className="flex-1 bg-white border-2 border-black px-3 py-2 font-bold outline-none focus:bg-cyan-50 dark:bg-zinc-700 dark:border-zinc-500 dark:text-white"
                     placeholder="comment with the ai..."
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                   />
                   <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-black text-white p-2 hover:bg-zinc-800 border-2 border-transparent disabled:opacity-50 dark:bg-white dark:text-black">
                      <Send className="w-5 h-5" />
                   </button>
                </div>
             </div>
           </div>
        )}

        {appState === AppState.SUCCESS && activeTab === 'VIDEO_CHAT' && videoAnalysisResult && (
            <div className="animate-slide-up space-y-8">
                <div className="max-w-5xl mx-auto bg-black border-[4px] border-black hard-shadow relative overflow-hidden dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                     <iframe 
                        className="w-full aspect-video" 
                        src={`https://www.youtube.com/embed/${activeVideoId}`} 
                        title="youtube video player" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                     ></iframe>
                </div>
                
                <div className="max-w-5xl mx-auto bg-[#a78bfa] border-[3px] border-black p-6 hard-shadow rotate-1 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                    <h2 className="text-2xl font-black uppercase mb-2">vibe check</h2>
                    <p className="text-xl font-bold">"{videoAnalysisResult.summary}"</p>
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {videoAnalysisResult.topics?.map((topic, i) => (
                            <span key={i} className="bg-black text-white px-3 py-1 font-bold text-sm border-2 border-white">{topic}</span>
                        ))}
                        <span className="bg-white text-black px-3 py-1 font-bold text-sm border-2 border-black">tone: {videoAnalysisResult.tone}</span>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto bg-white border-[3px] border-black hard-shadow flex flex-col h-[600px] relative dark:bg-zinc-800 dark:border-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                    <div className="bg-[#a78bfa] border-b-[3px] border-black p-3 flex items-center gap-2 dark:border-white">
                        <MonitorPlay className="w-6 h-6 text-black fill-white" />
                        <h3 className="font-black text-xl text-black uppercase tracking-wider drop-shadow-md">live chat</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                                {msg.role === 'model' && <RiceDroidAvatar />}
                                <div className={clsx(
                                "p-3 max-w-[80%] font-bold text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                msg.role === 'user' ? "bg-white text-black rounded-tl-xl rounded-bl-xl rounded-br-xl dark:bg-zinc-200" : "bg-[#d8b4fe] text-black rounded-tr-xl rounded-br-xl rounded-bl-xl"
                                )}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="flex gap-3">
                                <RiceDroidAvatar />
                                <div className="bg-zinc-200 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border-2 border-black animate-pulse flex gap-1">
                                    <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-100"></div>
                                    <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 bg-zinc-100 border-t-[3px] border-black flex gap-2 dark:bg-zinc-800 dark:border-white">
                        <input 
                            type="text" 
                            className="flex-1 bg-white border-2 border-black px-3 py-2 font-bold outline-none focus:bg-[#ebdcfc] dark:bg-zinc-700 dark:border-zinc-500 dark:text-white"
                            placeholder="chat about the video..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-black text-white p-2 hover:bg-zinc-800 border-2 border-transparent disabled:opacity-50 dark:bg-white dark:text-black">
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>

      <footer className="absolute bottom-4 w-full text-center font-bold text-xs pointer-events-none">
         <button onClick={() => setShowChangelog(true)} className="pointer-events-auto bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] transition-all uppercase dark:bg-zinc-800 dark:text-white dark:border-white dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
           v2.29 changelog
         </button>
         <p className="mt-2 opacity-50 bg-white/50 inline-block px-1 dark:text-white dark:bg-zinc-900/50">built with hate & love</p>
      </footer>
    </div>
  );
};

export default App;