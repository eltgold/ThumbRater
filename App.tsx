import React, { useState, useRef, useEffect } from 'react';
import { extractVideoId, blobToBase64, fetchVideoMetadata, searchYouTubeVideos, fetchChannelLatestVideos, SearchResult, fetchChannelDetails, extractChannelId, ChannelDetails } from './utils/youtube';
import { analyzeThumbnail, sendChatMessage, analyzeBotProbability } from './services/geminiService';
import { AppState, AnalysisResult, ChatMessage, ChangelogEntry, BotAnalysisResult, SavedItem, SavedItemType } from './types';
import { AnalysisChart } from './components/AnalysisChart';
import { ScoreCard } from './components/ScoreCard';
import { 
  Youtube, 
  Search, 
  CloudUpload, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  Type, 
  Smile, 
  Target,
  Loader2,
  MessageSquare,
  Send,
  X,
  AlertTriangle,
  History,
  Siren,
  Bot,
  Save,
  Download,
  FolderOpen,
  Trash2,
  HardDrive,
  ShoppingBag,
  Check,
  Zap,
  Hammer,
  BoxSelect,
  FileText,
  Terminal
} from 'lucide-react';
import clsx from 'clsx';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: "v2.13",
    date: "2025-12-07",
    title: "Comic Sans Emergency",
    changes: [
      "Fixed Font Weights (No more broken Arial).",
      "Forced Comic Sans on Inputs.",
      "Fixed the Receipt Font.",
      "Patched the Patch Notes."
    ]
  },
  {
    version: "v2.12",
    date: "2025-12-07",
    title: "THE GREAT REVERT",
    changes: [
      "WE WENT BACK.",
      "Sorry for the corporate suit update.",
      "Dumb design is BACK FOREVER.",
      "Changelog is fixed (hopefully)."
    ]
  },
  {
    version: "v2.11",
    date: "2025-12-07",
    title: "The Mistake Update",
    changes: [
      "Tried to be professional.",
      "Hated it.",
      "Reverted immediately."
    ]
  },
  {
    version: "v2.2",
    date: "2025-12-06",
    title: "The Silly Update",
    changes: [
      "Added Hammer Logo.",
      "Added Chaos Mode.",
    ]
  }
];

type ActiveTab = 'RATER' | 'BOT_HUNTER';

// --- CUSTOM COMPONENTS ---
const SmashLogo = () => (
    <div className="relative group w-10 h-10 flex items-center justify-center cursor-pointer">
        <div className="absolute inset-0 bg-red-600 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:translate-y-1 group-hover:shadow-none transition-all duration-100 flex items-center justify-center overflow-hidden">
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[10px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
             <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
        </div>
        <Hammer className="absolute -top-3 -right-3 w-8 h-8 text-black fill-zinc-300 drop-shadow-sm transition-transform duration-100 origin-bottom-left group-hover:rotate-[-45deg] z-10" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase text-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-yellow-300 px-1 border border-black rotate-[-5deg] font-sans">
           BONK!
        </div>
    </div>
);

const Tape = ({ className }: { className?: string }) => (
    <div className={clsx("absolute w-24 h-8 bg-white/60 border border-black/10 rotate-[-3deg] backdrop-blur-sm shadow-sm z-20", className)}></div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('RATER');
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Thumb Rater State
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoDesc, setVideoDesc] = useState<string | null>(null);
  const [videoKeywords, setVideoKeywords] = useState<string[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Store / Search State
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [storeQuery, setStoreQuery] = useState('');
  const [isStoreSearching, setIsStoreSearching] = useState(false);
  const [storeResults, setStoreResults] = useState<SearchResult[]>([]);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  
  // Bot Hunter State
  const [botResult, setBotResult] = useState<BotAnalysisResult | null>(null);
  const [analyzingChannel, setAnalyzingChannel] = useState<ChannelDetails | null>(null);
  
  // UI State
  const [showImageWarning, setShowImageWarning] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSusContent, setShowSusContent] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  
  // Storage State
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const isCelebrationMode = result?.scores.overall === 10;
  const isSusDetected = result?.isSus;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Load saved items from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('thumb_rate_saved');
      if (stored) {
        setSavedItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load saved items", e);
    }
  }, []);

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
    
    // Non-blocking metadata fetch
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

  const runBotAnalysis = async (channelId: string) => {
    setAppState(AppState.ANALYZING);
    setBotResult(null);
    
    try {
      const channelData = await fetchChannelDetails(channelId);
      if (!channelData) throw new Error("Could not find channel");
      setAnalyzingChannel(channelData);

      const videos = await fetchChannelLatestVideos(channelId);
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

  const handleInputSubmit = async () => {
    const input = url.trim();
    if (!input) return;

    if (activeTab === 'RATER') {
      const videoId = extractVideoId(input);
      if (videoId) {
        resetAnalysis();
        fetchImageFromVideoId(videoId);
      } else {
         setErrorMsg("Invalid YouTube Video URL.");
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
        setErrorMsg("Invalid Channel or Video Link.");
        setAppState(AppState.ERROR);
      }
    }
  };

  const handleStoreSearch = async () => {
    if(!storeQuery.trim()) return;
    setIsStoreSearching(true);
    setStoreResults([]);
    
    try {
      const results = await searchYouTubeVideos(storeQuery);
      setStoreResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsStoreSearching(false);
    }
  };

  const handleCopyLink = (item: SearchResult) => {
    let link = "";
    if (item.type === 'video') {
      link = `https://www.youtube.com/watch?v=${item.id}`;
    } else {
      link = `https://www.youtube.com/channel/${item.id}`;
    }
    
    navigator.clipboard.writeText(link);
    setCopiedItemId(item.id);
    setTimeout(() => setCopiedItemId(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeTab === 'BOT_HUNTER') {
        alert("Bot analysis requires a channel link.");
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
      setErrorMsg("Failed to process file.");
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
      setErrorMsg("Analysis failed. Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    if (activeTab === 'RATER' && (!imageBase64 || !result)) return;
    if (activeTab === 'BOT_HUNTER' && (!botResult || !analyzingChannel)) return;

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
          channelDetails: analyzingChannel
      });
      setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- SAVE SYSTEM ---

  const prepareSaveItem = (): SavedItem | null => {
    if (activeTab === 'RATER' && result && imageBase64) {
      return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: 'THUMB_RATER',
        thumbnailBase64: imageBase64,
        thumbnailResult: result,
        videoTitle,
        videoDesc,
        videoKeywords
      };
    } else if (activeTab === 'BOT_HUNTER' && botResult && analyzingChannel) {
      return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: 'BOT_HUNTER',
        botResult,
        channelDetails: analyzingChannel
      };
    }
    return null;
  };

  const handleSaveToApp = () => {
    const item = prepareSaveItem();
    if (!item) return;

    const newItems = [item, ...savedItems];
    setSavedItems(newItems);
    localStorage.setItem('thumb_rate_saved', JSON.stringify(newItems));
    setShowSaveModal(false);
    alert("Saved to Vault.");
  };

  const handleDownloadJSON = () => {
    const item = prepareSaveItem();
    if (!item) return;

    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricetool_${item.type.toLowerCase()}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowSaveModal(false);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const item = JSON.parse(event.target?.result as string) as SavedItem;
        loadSavedItem(item);
      } catch (err) {
        alert("Invalid JSON file format.");
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const loadSavedItem = (item: SavedItem) => {
    resetAnalysis();
    setShowSavedList(false);
    
    if (item.type === 'THUMB_RATER' && item.thumbnailBase64 && item.thumbnailResult) {
      setActiveTab('RATER');
      setImageBase64(item.thumbnailBase64);
      setThumbnailSrc(`data:image/jpeg;base64,${item.thumbnailBase64}`);
      setResult(item.thumbnailResult);
      setVideoTitle(item.videoTitle || null);
      setVideoDesc(item.videoDesc || null);
      setVideoKeywords(item.videoKeywords || []);
      setAppState(AppState.SUCCESS);
    } else if (item.type === 'BOT_HUNTER' && item.botResult && item.channelDetails) {
      setActiveTab('BOT_HUNTER');
      setAnalyzingChannel(item.channelDetails);
      setBotResult(item.botResult);
      setAppState(AppState.SUCCESS);
    } else {
      alert("Corrupted save data.");
    }
  };

  const deleteSavedItem = (id: string) => {
    const newItems = savedItems.filter(i => i.id !== id);
    setSavedItems(newItems);
    localStorage.setItem('thumb_rate_saved', JSON.stringify(newItems));
  };

  return (
    <div className="min-h-screen bg-dots text-black font-sans pb-20 relative overflow-hidden">
      
      {isCelebrationMode && (
        <div className="fixed inset-0 pointer-events-none z-10 opacity-30 bg-[url('https://media.giphy.com/media/26tOZ42Mg6pbTUPDa/giphy.gif')] bg-repeat mix-blend-screen"></div>
      )}
      
      {/* --- MODALS (BRUTALIST STYLE) --- */}
      
      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 font-sans">
           <div className="bg-white border-[3px] border-black p-6 max-w-sm w-full hard-shadow rounded-none rotate-1">
              <Tape className="-top-4 left-1/2 -translate-x-1/2" />
              <h2 className="text-xl font-bold mb-6 text-black border-b-[3px] border-black pb-2 text-center uppercase">Save Analysis?</h2>
              <div className="flex flex-col gap-3">
                <button onClick={handleSaveToApp} className="flex items-center justify-center gap-3 bg-[#fde047] hover:bg-yellow-400 text-black p-4 font-bold border-[3px] border-black hard-shadow-sm transition-transform active:translate-y-1 active:shadow-none uppercase">
                   <HardDrive className="w-5 h-5" /> Save to Vault
                </button>
                <button onClick={handleDownloadJSON} className="flex items-center justify-center gap-3 bg-[#67e8f9] hover:bg-cyan-400 text-black p-4 font-bold border-[3px] border-black hard-shadow-sm transition-transform active:translate-y-1 active:shadow-none uppercase">
                   <Download className="w-5 h-5" /> Export JSON
                </button>
                <button onClick={() => setShowSaveModal(false)} className="mt-2 text-black hover:underline font-bold text-sm text-center">NEVERMIND</button>
              </div>
           </div>
        </div>
      )}

      {/* Store Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4 font-sans">
           <div className="bg-white border-[3px] border-black w-full max-w-5xl max-h-[85vh] overflow-y-auto hard-shadow flex flex-col rotate-[-1deg]">
              <Tape className="-top-4 right-10 rotate-[2deg]" />
              <div className="bg-[#fde047] sticky top-0 p-4 border-b-[3px] border-black flex justify-between items-center z-10">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><ShoppingBag className="w-5 h-5 text-black" /></div>
                   <h2 className="text-xl font-bold text-black uppercase tracking-tight">Video Store</h2>
                 </div>
                 <button onClick={() => setShowStoreModal(false)} className="p-2 bg-[#ef4444] hover:bg-red-600 border-2 border-black text-white font-bold transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-6 bg-dots">
                 <div className="flex gap-2 max-w-2xl mx-auto mb-8">
                    <div className="flex-1 flex items-center bg-white border-[3px] border-black px-4 h-14 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <Search className="w-6 h-6 text-black mr-3" />
                      <input 
                        type="text" 
                        placeholder="SEARCH STUFF..."
                        className="w-full bg-transparent outline-none text-black placeholder-zinc-500 font-bold text-lg uppercase caret-black"
                        value={storeQuery}
                        onChange={(e) => setStoreQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStoreSearch()}
                      />
                    </div>
                    <button 
                      onClick={handleStoreSearch} 
                      className="bg-black text-white px-8 font-bold text-xl border-[3px] border-black hover:bg-zinc-800 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]"
                    >
                      {isStoreSearching ? <Loader2 className="animate-spin" /> : "GO"}
                    </button>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {storeResults.length === 0 && !isStoreSearching && (
                    <div className="col-span-full flex flex-col items-center justify-center text-center py-20 opacity-30 rotate-3">
                       <ShoppingBag className="w-24 h-24 mb-4 stroke-[1.5]" />
                       <p className="text-2xl font-bold uppercase">Search something bro</p>
                    </div>
                 )}
                 {storeResults.map((item, idx) => (
                    <div 
                    key={item.id}
                    onClick={() => handleCopyLink(item)}
                    className={clsx(
                        "group cursor-pointer bg-white border-[3px] border-black hard-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all relative",
                        idx % 2 === 0 ? "rotate-1" : "rotate-[-1deg]"
                    )}
                    >
                      {copiedItemId === item.id && (
                        <div className="absolute inset-0 bg-[#fde047] z-20 flex items-center justify-center flex-col animate-in fade-in duration-200 border-[3px] border-black">
                           <Check className="w-12 h-12 text-black" />
                           <p className="text-black text-sm font-bold mt-2 tracking-widest uppercase bg-white px-2 border-2 border-black rotate-[-2deg]">COPIED!</p>
                        </div>
                      )}

                      <div className="aspect-video bg-black relative border-b-[3px] border-black">
                          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                          <div className={clsx("absolute top-2 right-2 text-black text-[10px] font-bold px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", item.type === 'channel' ? "bg-[#f9a8d4] rotate-3" : "bg-white rotate-[-2deg]")}>
                             {item.type === 'channel' ? 'USER' : 'VID'}
                          </div>
                      </div>
                      <div className="p-3 bg-zinc-50">
                         <h3 className="font-bold text-sm text-black line-clamp-2 mb-1 leading-tight" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                         <p className="text-xs text-zinc-500 font-bold uppercase tracking-wide">{item.channelTitle}</p>
                      </div>
                    </div>
                ))}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Saved List Modal (The Vault) */}
      {showSavedList && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4 font-sans">
           <div className="bg-white border-[3px] border-black w-full max-w-3xl max-h-[85vh] overflow-y-auto hard-shadow flex flex-col rotate-1">
              <Tape className="-top-4 left-10 rotate-[-2deg]" />
              <div className="bg-[#67e8f9] sticky top-0 p-4 border-b-[3px] border-black flex justify-between items-center z-10">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><FolderOpen className="w-5 h-5 text-black" /></div>
                   <h2 className="text-xl font-bold text-black uppercase tracking-tight">The Vault</h2>
                 </div>
                 <div className="flex gap-3">
                     <button onClick={() => importInputRef.current?.click()} className="text-xs font-bold text-black flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]">
                        <CloudUpload className="w-4 h-4" /> IMPORT
                     </button>
                     <button onClick={() => setShowSavedList(false)} className="p-2 bg-[#ef4444] hover:bg-red-600 border-2 border-black text-white font-bold transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px]">
                       <X className="w-5 h-5" />
                     </button>
                 </div>
              </div>
              
              <div className="p-6 bg-dots grid grid-cols-1 md:grid-cols-2 gap-6">
                 {savedItems.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-black font-bold text-2xl uppercase opacity-40 rotate-[-2deg]">Vault is Empty</div>
                 ) : (
                    savedItems.map((item, idx) => (
                      <div key={item.id} className={clsx("bg-white border-[3px] border-black p-4 hard-shadow-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col gap-3 group relative", idx % 2 === 0 ? "rotate-1" : "rotate-[-1deg]")}>
                         <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-1 border-dashed">
                            <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", item.type === 'THUMB_RATER' ? "bg-[#f9a8d4]" : "bg-[#86efac]")}>
                              {item.type === 'THUMB_RATER' ? 'RATER' : 'BOT'}
                            </span>
                            <button onClick={() => deleteSavedItem(item.id)} className="text-black hover:text-[#ef4444] transition-colors"><Trash2 className="w-5 h-5" /></button>
                         </div>
                         
                         {item.type === 'THUMB_RATER' ? (
                           <>
                             <div className="aspect-video bg-black border-2 border-black overflow-hidden rotate-1">
                               <img src={`data:image/jpeg;base64,${item.thumbnailBase64}`} className="w-full h-full object-cover" />
                             </div>
                             <div className="flex justify-between items-center mt-1">
                                <h3 className="font-bold text-sm text-black truncate pr-4">{item.videoTitle || "Untitled"}</h3>
                                <div className="bg-black px-2 py-1 text-white text-xs font-bold rotate-3 border-2 border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{item.thumbnailResult?.scores.overall}/10</div>
                             </div>
                           </>
                         ) : (
                           <div className="py-2">
                             <div className="flex items-center gap-3">
                               {item.channelDetails?.thumbnailUrl && <img src={item.channelDetails.thumbnailUrl} className="w-12 h-12 rounded-full border-[3px] border-black bg-white" />}
                               <h3 className="font-bold text-sm text-black uppercase leading-tight">{item.channelDetails?.title}</h3>
                             </div>
                             <div className="mt-4 flex items-center gap-2">
                               <span className={clsx("text-xs font-bold px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", item.botResult?.verdict === 'NPC_FARM' ? 'bg-[#ef4444] text-white' : 'bg-[#86efac] text-black')}>
                                 {item.botResult?.verdict}
                               </span>
                               <span className="text-xs text-black font-bold">({item.botResult?.botScore}%)</span>
                             </div>
                           </div>
                         )}

                         <button onClick={() => loadSavedItem(item)} className="mt-auto w-full bg-black text-white hover:bg-zinc-800 font-bold uppercase py-3 text-xs transition-colors border-2 border-transparent shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                           LOAD DATA
                         </button>
                      </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Changelog Modal */}
      {showChangelog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 font-sans">
           <div className="bg-white border-[3px] border-black w-full max-w-2xl max-h-[80vh] overflow-y-auto hard-shadow flex flex-col rotate-1">
              <Tape className="-top-4 right-1/2 translate-x-1/2 rotate-2" />
              <div className="bg-[#f9a8d4] sticky top-0 p-4 border-b-[3px] border-black flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-black flex items-center gap-3 uppercase tracking-tighter">
                   <History className="w-6 h-6" /> Patch Notes
                 </h2>
                 <button onClick={() => setShowChangelog(false)} className="p-2 bg-black text-white hover:bg-zinc-800 font-bold transition-colors border-2 border-transparent">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-8 space-y-6 bg-dots">
                 {CHANGELOG_DATA.map((log, i) => (
                    <div key={i} className="relative pl-6 border-l-[6px] border-black">
                       <div className="absolute -left-[13px] top-1.5 w-5 h-5 bg-[#fde047] rounded-full border-[3px] border-black"></div>
                       <div className="flex items-baseline gap-3 mb-1">
                         <h3 className="text-xl font-bold text-black uppercase">{log.version}</h3>
                         <span className="text-xs text-black font-bold bg-white px-1 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{log.date}</span>
                       </div>
                       <p className="text-sm text-black font-bold mb-3 italic bg-white inline-block px-1">"{log.title}"</p>
                       <ul className="list-disc pl-4 space-y-1 text-sm text-black font-bold marker:text-black">
                          {log.changes.map((change, j) => (<li key={j}>{change}</li>))}
                       </ul>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Warning Popup */}
      {showImageWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 font-sans">
          <div className="bg-[#fde047] border-[3px] border-black p-8 max-w-md hard-shadow relative rotate-2">
             <Tape className="-top-5 left-10 rotate-[-4deg]" />
             <div className="flex justify-between items-start mb-4">
                <AlertTriangle className="w-12 h-12 text-black stroke-[2.5]" />
             </div>
             <h2 className="text-3xl font-bold mb-2 text-black uppercase tracking-tighter">Local File??</h2>
             <p className="text-black mb-6 leading-relaxed font-bold border-l-4 border-black pl-4 text-lg">
               If you upload a file, I can't read the Title or Keywords. I'm just looking at the pixels. It's dumber, but it works.
             </p>
             <div className="flex gap-4">
                <button onClick={() => setShowImageWarning(false)} className="flex-1 bg-black text-white py-4 font-bold hover:bg-zinc-800 transition-colors border-2 border-transparent shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] uppercase">WHATEVER</button>
                <button onClick={() => { setShowImageWarning(false); setThumbnailSrc(null); setAppState(AppState.IDLE); }} className="flex-1 bg-white text-black py-4 font-bold border-[3px] border-black hover:bg-zinc-100 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase">CANCEL</button>
             </div>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportJSON} />

      {/* --- HEADER --- */}
      <header className="bg-[#fde047] border-b-[3px] border-black sticky top-0 z-50 font-sans shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAnalysis}>
            <SmashLogo />
            {/* CHANGE APP NAME HERE */}
            <h1 className="font-bold text-3xl tracking-tighter text-black italic bg-white px-2 border-2 border-black rotate-[-2deg] group-hover:rotate-[2deg] transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              RICETOOL
            </h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowStoreModal(true)} className="flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-4 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase">
                <ShoppingBag className="w-4 h-4" /> STORE
            </button>
            <button onClick={() => setShowSavedList(true)} className="flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-4 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all uppercase">
                <FolderOpen className="w-4 h-4" /> VAULT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 relative z-10 font-sans">
        
        {/* TAB SWITCHER */}
        <div className="flex justify-center mb-16">
            <div className="bg-white p-2 border-[3px] border-black hard-shadow rotate-1 inline-flex gap-3 relative">
                <Tape className="-top-4 right-1/2 translate-x-1/2 rotate-[-1deg] w-32" />
                <button 
                    onClick={() => { setActiveTab('RATER'); resetAnalysis(); }}
                    className={clsx(
                        "px-8 py-3 text-lg font-bold uppercase transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5",
                        activeTab === 'RATER' ? "bg-[#f9a8d4] text-black border-black" : "bg-zinc-100 text-zinc-400 border-transparent hover:text-black hover:border-black"
                    )}
                >
                    Thumb Rater
                </button>
                <button 
                    onClick={() => { setActiveTab('BOT_HUNTER'); resetAnalysis(); }}
                    className={clsx(
                        "px-8 py-3 text-lg font-bold uppercase transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5",
                        activeTab === 'BOT_HUNTER' ? "bg-[#67e8f9] text-black border-black" : "bg-zinc-100 text-zinc-400 border-transparent hover:text-black hover:border-black"
                    )}
                >
                    Bot Hunter
                </button>
            </div>
        </div>

        {/* HERO TEXT */}
        <div className="text-center mb-12 relative">
            <h1 className="text-6xl md:text-8xl font-bold text-black uppercase tracking-tighter leading-none relative z-10 drop-shadow-xl">
                IS YOUR THUMB <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ef4444] to-[#ec4899] drop-shadow-none">TRASH?</span>
            </h1>
            <p className="mt-4 text-xl font-bold text-black bg-[#fde047] inline-block px-4 py-1 border-[3px] border-black rotate-[-2deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                {activeTab === 'RATER' ? "Find out if you are cooked." : "Find out if they are NPCs."}
            </p>
            
            {/* Decor elements */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-12 hidden md:block">
                <div className="text-9xl font-bold text-black/5 rotate-[-12deg] select-none">?</div>
            </div>
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-12 hidden md:block">
                <div className="text-9xl font-bold text-black/5 rotate-[12deg] select-none">!</div>
            </div>
        </div>

        {/* INPUT SECTION */}
        <div className="max-w-3xl mx-auto mb-16 relative">
          <div className="absolute -top-6 -left-6 bg-black text-white px-3 py-1 font-bold text-xs rotate-[-5deg] border-2 border-white shadow-md z-10">
              {activeTab === 'RATER' ? "PASTE IT" : "EXPOSE THEM"}
          </div>
          <div className="relative group hover:scale-[1.01] transition-transform duration-200">
            <div className="relative flex bg-[#67e8f9] p-3 border-[3px] border-black hard-shadow">
               <div className="flex items-center justify-center w-14 text-black border-r-[3px] border-black mr-3 bg-white/30">
                  {activeTab === 'RATER' ? <Youtube className="w-8 h-8" /> : <Bot className="w-8 h-8" />}
               </div>
               <input 
                 type="text" 
                 placeholder={activeTab === 'RATER' ? "PASTE YOUTUBE LINK HERE..." : "PASTE CHANNEL LINK HERE..."}
                 className="w-full bg-transparent outline-none text-black placeholder-black/50 px-2 font-bold text-xl uppercase caret-black"
                 value={url}
                 onChange={handleUrlChange}
                 onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
               />
               <button 
                 onClick={handleInputSubmit} 
                 className="bg-[#ec4899] hover:bg-pink-400 text-black px-8 font-bold text-xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 transition-all uppercase"
               >
                 JUDGE ME
               </button>
            </div>
            {/* Corner decorations */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-black"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-black"></div>
          </div>
          
          {activeTab === 'RATER' && (
              <div className="text-center mt-4">
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-black hover:underline uppercase tracking-wide bg-white px-2 py-1 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all">
                    or upload a raw file (Dumber)
                  </button>
              </div>
          )}

          {errorMsg && (
            <div className="mt-6 bg-[#ef4444] text-white p-4 font-bold border-[3px] border-black hard-shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 rotate-1">
              <AlertCircle className="w-6 h-6 stroke-[3px]" />
              {errorMsg}
            </div>
          )}
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        
        {/* Loading State */}
        {appState === AppState.LOADING_IMAGE && (
           <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
              <div className="w-20 h-20 bg-white border-[3px] border-black flex items-center justify-center animate-spin hard-shadow mb-8">
                 <Loader2 className="w-10 h-10 text-black" />
              </div>
              <p className="text-2xl font-bold bg-white px-4 py-2 border-[3px] border-black rotate-2">STEALING DATA...</p>
           </div>
        )}

        {/* Analyzing State */}
        {appState === AppState.ANALYZING && (
           <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
              <div className="w-24 h-24 bg-[#fde047] border-[3px] border-black flex items-center justify-center animate-bounce hard-shadow mb-8 rounded-full">
                 <Zap className="w-12 h-12 text-black fill-white" />
              </div>
              <p className="text-4xl font-bold bg-white px-6 py-3 border-[3px] border-black -rotate-2 uppercase tracking-tighter">COOKING...</p>
              <p className="mt-4 text-sm font-bold opacity-60">Do not turn off your console.</p>
           </div>
        )}

        {/* RATER RESULTS */}
        {appState === AppState.READY_TO_ANALYZE && activeTab === 'RATER' && thumbnailSrc && (
          <div className="max-w-4xl mx-auto animate-slide-up">
             <div className="bg-white border-[3px] border-black p-2 hard-shadow rotate-1 mb-8 relative group">
                <Tape className="-top-3 left-1/2 -translate-x-1/2" />
                <div className="relative aspect-video bg-black border-2 border-black overflow-hidden">
                   <img src={thumbnailSrc} className="w-full h-full object-contain" />
                   {/* Stolen Data Receipt */}
                   <div className="absolute top-4 left-4 max-w-xs bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[-2deg] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="text-center border-b-2 border-black border-dashed pb-2 mb-2">
                        <h3 className="text-xl font-bold uppercase">STOLEN DATA</h3>
                        <p className="text-[10px]">{new Date().toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-2 text-xs font-bold uppercase">
                         <div className="flex justify-between"><span>TITLE:</span> <span>{videoTitle ? "FOUND" : "MISSING"}</span></div>
                         <div className="flex justify-between"><span>DESC:</span> <span>{videoDesc ? "FOUND" : "MISSING"}</span></div>
                         <div className="flex justify-between"><span>TAGS:</span> <span>{videoKeywords.length} FOUND</span></div>
                      </div>
                      <div className="mt-3 text-center text-[10px] font-bold border-t-2 border-black border-dashed pt-2">
                         THANK YOU FOR SHOPPING
                      </div>
                   </div>
                </div>
             </div>
             <div className="flex justify-center">
               <button 
                 onClick={handleAnalyze} 
                 className="bg-[#86efac] hover:bg-green-400 text-black text-2xl px-12 py-4 font-bold border-[3px] border-black hard-shadow transition-transform active:translate-y-1 active:shadow-none uppercase tracking-tight"
               >
                 START JUDGEMENT
               </button>
             </div>
          </div>
        )}

        {/* RATER SUCCESS */}
        {appState === AppState.SUCCESS && activeTab === 'RATER' && result && (
          <div className="animate-slide-up space-y-12">
             
             {/* Main Score & Chart */}
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left: Image & Receipt */}
                <div className="lg:col-span-5 space-y-6">
                   <div className="bg-white border-[3px] border-black p-2 hard-shadow rotate-[-1deg] relative">
                      <Tape className="-top-3 -right-2 rotate-[4deg]" />
                      <div className="aspect-video bg-black border-2 border-black overflow-hidden relative group">
                         <img src={thumbnailSrc!} className={clsx("w-full h-full object-contain", isSusDetected && !showSusContent && "blur-xl scale-110 transition-all")} />
                         {isSusDetected && !showSusContent && (
                            <div onClick={() => setShowSusContent(true)} className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-black/20 hover:bg-black/10 transition-colors z-10">
                               <Siren className="w-16 h-16 text-red-500 animate-pulse drop-shadow-lg" />
                               <p className="text-white font-black text-2xl uppercase mt-2 drop-shadow-md">SUS DETECTED</p>
                               <p className="text-white text-xs font-bold bg-red-500 px-2 py-1 mt-2">CLICK TO VIEW ANYWAY</p>
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Metadata Receipt (Always visible now) */}
                   <div className="bg-[#fff1f2] border-[3px] border-black p-4 relative shadow-sm mx-4">
                       <div className="w-4 h-4 rounded-full bg-black absolute -top-2 left-1/2 -translate-x-1/2"></div>
                       <h3 className="font-bold text-center border-b-[3px] border-black pb-2 mb-3 text-lg uppercase">Evidence</h3>
                       <div className="space-y-2 text-xs font-bold font-sans">
                          <p><span className="bg-black text-white px-1">TITLE</span> {videoTitle || "N/A"}</p>
                          <p className="line-clamp-3 opacity-70"><span className="bg-black text-white px-1">DESC</span> {videoDesc || "N/A"}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {videoKeywords.slice(0, 5).map(k => (
                               <span key={k} className="px-1 border border-black bg-white text-[10px] uppercase">{k}</span>
                            ))}
                          </div>
                       </div>
                   </div>
                </div>

                {/* Right: Scores */}
                <div className="lg:col-span-7">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <ScoreCard label="CLARITY" score={result.scores.clarity} rotation="rotate-[-2deg]" />
                      <ScoreCard label="CURIOSITY" score={result.scores.curiosity} rotation="rotate-[1deg]" />
                      <ScoreCard label="TEXT" score={result.scores.text_readability} rotation="rotate-[-1deg]" />
                      <ScoreCard label="EMOTION" score={result.scores.emotion} rotation="rotate-[2deg]" />
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Chart */}
                      <div className="aspect-square relative">
                         <div className="absolute -top-6 left-0 bg-black text-white px-3 py-1 font-bold rotate-[-3deg] z-10 text-sm border-2 border-white shadow-md">PENTAGON OF PAIN</div>
                         <AnalysisChart scores={result.scores} />
                      </div>

                      {/* Overall Score */}
                      <div className="flex flex-col justify-center">
                         <div className="bg-white border-[3px] border-black p-6 hard-shadow flex flex-col items-center justify-center h-full relative rotate-1">
                            <Tape className="-top-3 right-10 rotate-[2deg]" />
                            <h3 className="text-xl font-black uppercase mb-2">Final Verdict</h3>
                            <div className="relative">
                               <span className={clsx("text-9xl font-black tracking-tighter drop-shadow-md", 
                                  result.scores.overall >= 8 ? "text-[#86efac]" : 
                                  result.scores.overall >= 5 ? "text-[#fde047]" : "text-[#fca5a5]"
                               )}>
                                 {result.scores.overall}
                               </span>
                               <span className="text-4xl font-black text-black absolute -right-6 top-4">/10</span>
                            </div>
                            {isCelebrationMode && <div className="text-sm font-bold bg-[#fde047] px-3 py-1 border-2 border-black rotate-[-3deg] animate-pulse">LEGENDARY STATUS</div>}
                            
                            <div className="mt-6 flex w-full gap-2">
                               <button onClick={() => setShowSaveModal(true)} className="flex-1 bg-black text-white py-2 font-bold text-xs hover:bg-zinc-800 transition-colors border-2 border-transparent uppercase">SAVE</button>
                               <button onClick={resetAnalysis} className="flex-1 bg-white text-black py-2 font-bold text-xs border-2 border-black hover:bg-zinc-100 transition-colors uppercase">RESET</button>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Summary & Suggestions */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-[#fde047] border-[3px] border-black p-6 hard-shadow relative">
                    <div className="absolute -top-4 -left-2 bg-black text-white px-4 py-1 font-bold rotate-[-2deg] border-2 border-white shadow-md text-lg">THE ROAST</div>
                    <p className="text-xl font-bold leading-relaxed mt-4">"{result.summary}"</p>
                 </div>
                 
                 <div className="bg-white border-[3px] border-black p-6 hard-shadow relative">
                    <div className="absolute -top-4 -left-2 bg-[#67e8f9] text-black px-4 py-1 font-bold rotate-[1deg] border-[3px] border-black shadow-sm text-lg uppercase">Fix It</div>
                    <ul className="mt-4 space-y-3">
                       {result.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm font-bold">
                             <div className="min-w-[24px] h-6 bg-black text-white flex items-center justify-center text-xs mt-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">{i+1}</div>
                             <span>{s}</span>
                          </li>
                       ))}
                    </ul>
                 </div>
             </div>
             
             {/* Chat Room */}
             <div className="border-[3px] border-black bg-white hard-shadow relative flex flex-col h-[500px]">
                 <div className="bg-[#f9a8d4] p-4 border-b-[3px] border-black flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-6 h-6 text-black" />
                       <h3 className="font-bold text-xl uppercase tracking-tight">The Roast Room</h3>
                    </div>
                    <div className="flex gap-1">
                       <div className="w-3 h-3 rounded-full bg-black border border-white"></div>
                       <div className="w-3 h-3 rounded-full bg-white border border-black"></div>
                       <div className="w-3 h-3 rounded-full bg-black border border-white"></div>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dots">
                    {chatHistory.length === 0 && (
                       <div className="text-center opacity-40 mt-10">
                          <p className="font-bold uppercase text-lg">Say something...</p>
                       </div>
                    )}
                    {chatHistory.map((msg, i) => (
                       <div key={i} className={clsx("flex flex-col max-w-[80%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                          <div className={clsx(
                             "p-3 border-[3px] border-black font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
                             msg.role === 'user' ? "bg-[#67e8f9] rounded-tl-xl rounded-bl-xl rounded-tr-xl" : "bg-white rounded-tr-xl rounded-br-xl rounded-tl-xl"
                          )}>
                             {msg.text}
                          </div>
                          <span className="text-[10px] font-bold mt-1 opacity-50 uppercase">{msg.role === 'user' ? 'YOU' : 'RICEDROID'}</span>
                       </div>
                    ))}
                    {isChatLoading && (
                       <div className="mr-auto flex items-center gap-1 bg-white p-3 border-[3px] border-black rounded-xl">
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-75"></div>
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-150"></div>
                       </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>
                 
                 <div className="p-4 bg-zinc-100 border-t-[3px] border-black flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 bg-white border-[3px] border-black px-4 font-bold outline-none placeholder-zinc-400 focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                      placeholder="Comment with the AI..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage} className="bg-black text-white p-3 border-[3px] border-black hover:bg-zinc-800 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                       <Send className="w-5 h-5" />
                    </button>
                 </div>
             </div>
          </div>
        )}

        {/* BOT HUNTER SUCCESS */}
        {appState === AppState.SUCCESS && activeTab === 'BOT_HUNTER' && botResult && analyzingChannel && (
          <div className="max-w-4xl mx-auto animate-slide-up space-y-8">
             
             {/* Verdict Header */}
             <div className="bg-white border-[3px] border-black p-8 hard-shadow relative overflow-hidden">
                <Tape className="-top-3 right-20 rotate-1" />
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                   <div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">{analyzingChannel.title}</h2>
                      <div className="flex gap-2 text-sm font-bold">
                         <span className="bg-zinc-100 px-2 border border-black">{analyzingChannel.subscriberCount || "???"} SUBS</span>
                         <span className="bg-zinc-100 px-2 border border-black">{analyzingChannel.videoCount || "???"} VIDS</span>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <div className={clsx(
                         "text-4xl font-black uppercase px-6 py-2 border-[3px] border-black rotate-[-2deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2",
                         botResult.verdict === 'HUMAN' ? "bg-[#86efac] text-black" : 
                         botResult.verdict === 'CYBORG' ? "bg-[#fde047] text-black" : "bg-[#ef4444] text-white"
                      )}>
                         {botResult.verdict}
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest bg-black text-white px-2">Probability: {botResult.botScore}%</span>
                   </div>
                </div>
                
                {/* Background Decor */}
                <Bot className="absolute -bottom-4 -right-4 w-48 h-48 text-black/5 rotate-12" />
             </div>

             {/* Evidence & Save */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white border-[3px] border-black p-6 hard-shadow flex flex-col">
                   <h3 className="text-xl font-bold uppercase border-b-[3px] border-black pb-2 mb-4 flex items-center gap-2">
                     <FileText className="w-5 h-5" /> Evidence
                   </h3>
                   <ul className="space-y-3 flex-1">
                      {botResult.evidence.map((e, i) => (
                         <li key={i} className="flex items-start gap-2 text-sm font-bold">
                            <AlertCircle className="w-4 h-4 mt-0.5 text-[#ef4444] shrink-0" />
                            <span>{e}</span>
                         </li>
                      ))}
                   </ul>
                </div>
                
                <div className="space-y-4">
                   <div className="bg-[#fde047] border-[3px] border-black p-6 hard-shadow">
                      <h3 className="font-bold uppercase text-xs mb-2 opacity-60">Detective Notes</h3>
                      <p className="font-bold text-lg leading-tight">"{botResult.summary}"</p>
                   </div>
                   
                   <div className="flex gap-2">
                      <button onClick={() => setShowSaveModal(true)} className="flex-1 bg-black text-white py-4 font-bold uppercase hover:bg-zinc-800 transition-colors border-2 border-transparent shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                         FILE REPORT (SAVE)
                      </button>
                      <button onClick={resetAnalysis} className="flex-1 bg-white text-black py-4 font-bold uppercase hover:bg-zinc-100 transition-colors border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                         NEXT SUSPECT
                      </button>
                   </div>
                </div>
             </div>

             {/* Chat Interrogation */}
             <div className="border-[3px] border-black bg-white hard-shadow relative flex flex-col h-[400px]">
                 <div className="bg-[#67e8f9] p-4 border-b-[3px] border-black flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <Siren className="w-6 h-6 text-black" />
                       <h3 className="font-bold text-xl uppercase tracking-tight">The Interrogation</h3>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dots">
                    {chatHistory.length === 0 && (
                       <div className="text-center opacity-40 mt-10">
                          <p className="font-bold uppercase text-lg">Question the suspect...</p>
                       </div>
                    )}
                    {chatHistory.map((msg, i) => (
                       <div key={i} className={clsx("flex flex-col max-w-[80%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                          <div className={clsx(
                             "p-3 border-[3px] border-black font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
                             msg.role === 'user' ? "bg-[#fde047] rounded-tl-xl rounded-bl-xl rounded-tr-xl" : "bg-white rounded-tr-xl rounded-br-xl rounded-tl-xl"
                          )}>
                             {msg.text}
                          </div>
                          <span className="text-[10px] font-bold mt-1 opacity-50 uppercase">{msg.role === 'user' ? 'DETECTIVE' : 'SYSTEM'}</span>
                       </div>
                    ))}
                    {isChatLoading && (
                       <div className="mr-auto flex items-center gap-1 bg-white p-3 border-[3px] border-black rounded-xl">
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-75"></div>
                          <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-150"></div>
                       </div>
                    )}
                    <div ref={chatEndRef} />
                 </div>
                 
                 <div className="p-4 bg-zinc-100 border-t-[3px] border-black flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 bg-white border-[3px] border-black px-4 font-bold outline-none placeholder-zinc-400 focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                      placeholder="Comment with the AI..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage} className="bg-black text-white p-3 border-[3px] border-black hover:bg-zinc-800 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                       <Send className="w-5 h-5" />
                    </button>
                 </div>
             </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="absolute bottom-4 w-full text-center font-bold text-xs pointer-events-none">
         <button onClick={() => setShowChangelog(true)} className="pointer-events-auto bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] transition-all uppercase">
           v2.13 Changelog
         </button>
         <p className="mt-2 opacity-50">BUILT WITH HATE & LOVE</p>
      </footer>
    </div>
  );
};

export default App;