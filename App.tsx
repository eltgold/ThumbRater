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
  },
  {
    version: "v2.1",
    date: "2025-12-05",
    title: "RICETOOL Rebrand",
    changes: [
      "Project Renamed: RICETOOL.",
    ]
  }
];

type ActiveTab = 'RATER' | 'BOT_HUNTER';

// --- CUSTOM LOGO COMPONENT ---
const SmashLogo = () => (
    <div className="relative group w-10 h-10 flex items-center justify-center cursor-pointer">
        <div className="absolute inset-0 bg-red-600 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:translate-y-1 group-hover:shadow-none transition-all duration-100 flex items-center justify-center overflow-hidden">
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[10px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
             <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none"></div>
        </div>
        <Hammer className="absolute -top-3 -right-3 w-8 h-8 text-black fill-zinc-300 drop-shadow-sm transition-transform duration-100 origin-bottom-left group-hover:rotate-[-45deg] z-10" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase text-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-yellow-300 px-1 border border-black rotate-[-5deg] font-sans">
           BONK!
        </div>
    </div>
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
           <div className="bg-white border-thick p-6 max-w-sm w-full hard-shadow rounded-none">
              <h2 className="text-xl font-bold mb-6 text-black border-b-2 border-black pb-2">SAVE ANALYSIS?</h2>
              <div className="flex flex-col gap-3">
                <button onClick={handleSaveToApp} className="flex items-center justify-center gap-3 bg-yellow-300 hover:bg-yellow-400 text-black p-4 font-bold border-thick hard-shadow-sm transition-transform active:translate-y-1 active:shadow-none">
                   <HardDrive className="w-5 h-5" /> SAVE TO VAULT
                </button>
                <button onClick={handleDownloadJSON} className="flex items-center justify-center gap-3 bg-cyan-300 hover:bg-cyan-400 text-black p-4 font-bold border-thick hard-shadow-sm transition-transform active:translate-y-1 active:shadow-none">
                   <Download className="w-5 h-5" /> EXPORT JSON
                </button>
                <button onClick={() => setShowSaveModal(false)} className="mt-2 text-black hover:underline font-bold text-sm">NEVERMIND</button>
              </div>
           </div>
        </div>
      )}

      {/* Store Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4 font-sans">
           <div className="bg-white border-thick w-full max-w-5xl max-h-[85vh] overflow-y-auto hard-shadow flex flex-col">
              <div className="bg-yellow-300 sticky top-0 p-4 border-b-2 border-black flex justify-between items-center z-10">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-white border-2 border-black rounded-full"><ShoppingBag className="w-5 h-5 text-black" /></div>
                   <h2 className="text-xl font-black text-black uppercase">Video Store</h2>
                 </div>
                 <button onClick={() => setShowStoreModal(false)} className="p-2 bg-red-500 hover:bg-red-600 border-2 border-black text-white font-bold transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-6 bg-dots">
                 <div className="flex gap-2 max-w-2xl mx-auto mb-8">
                    <div className="flex-1 flex items-center bg-white border-thick px-4 h-12">
                      <Search className="w-5 h-5 text-black mr-3" />
                      <input 
                        type="text" 
                        placeholder="SEARCH STUFF..."
                        className="w-full bg-transparent outline-none text-black placeholder-zinc-500 font-bold"
                        value={storeQuery}
                        onChange={(e) => setStoreQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStoreSearch()}
                      />
                    </div>
                    <button 
                      onClick={handleStoreSearch} 
                      className="bg-black text-white px-6 font-bold border-thick hover:bg-zinc-800 transition-colors"
                    >
                      {isStoreSearching ? <Loader2 className="animate-spin" /> : "GO"}
                    </button>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {storeResults.length === 0 && !isStoreSearching && (
                    <div className="col-span-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                       <ShoppingBag className="w-16 h-16 mb-4 stroke-2" />
                       <p className="text-lg font-black">SEARCH SOMETHING BRO</p>
                    </div>
                 )}
                 {storeResults.map((item) => (
                    <div 
                    key={item.id}
                    onClick={() => handleCopyLink(item)}
                    className="group cursor-pointer bg-white border-thick hard-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all relative"
                    >
                      {copiedItemId === item.id && (
                        <div className="absolute inset-0 bg-yellow-300 z-20 flex items-center justify-center flex-col animate-in fade-in duration-200 border-thick">
                           <Check className="w-10 h-10 text-black" />
                           <p className="text-black text-xs font-black mt-2 tracking-widest uppercase">COPIED!</p>
                        </div>
                      )}

                      <div className="aspect-video bg-black relative border-b-2 border-black">
                          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 bg-white text-black text-[10px] font-black px-2 py-0.5 border-2 border-black rotate-3">
                             {item.type === 'channel' ? 'USER' : 'VID'}
                          </div>
                      </div>
                      <div className="p-3">
                         <h3 className="font-bold text-sm text-black line-clamp-2 mb-1" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                         <p className="text-xs text-zinc-500 font-bold uppercase">{item.channelTitle}</p>
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
           <div className="bg-white border-thick w-full max-w-3xl max-h-[85vh] overflow-y-auto hard-shadow flex flex-col">
              <div className="bg-cyan-300 sticky top-0 p-4 border-b-2 border-black flex justify-between items-center z-10">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-white border-2 border-black rounded-full"><FolderOpen className="w-5 h-5 text-black" /></div>
                   <h2 className="text-xl font-black text-black uppercase">The Vault</h2>
                 </div>
                 <div className="flex gap-3">
                     <button onClick={() => importInputRef.current?.click()} className="text-xs font-bold text-black flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black hover:bg-gray-100 transition-colors">
                        <CloudUpload className="w-4 h-4" /> IMPORT
                     </button>
                     <button onClick={() => setShowSavedList(false)} className="p-2 bg-red-500 hover:bg-red-600 border-2 border-black text-white font-bold transition-colors">
                       <X className="w-5 h-5" />
                     </button>
                 </div>
              </div>
              
              <div className="p-6 bg-dots grid grid-cols-1 md:grid-cols-2 gap-4">
                 {savedItems.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-black font-bold text-xl">VAULT IS EMPTY</div>
                 ) : (
                    savedItems.map((item) => (
                      <div key={item.id} className="bg-white border-thick p-4 hard-shadow-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col gap-3 group">
                         <div className="flex justify-between items-start">
                            <span className={clsx("text-[10px] font-black uppercase tracking-wider px-2 py-1 border-2 border-black", item.type === 'THUMB_RATER' ? "bg-pink-300" : "bg-green-300")}>
                              {item.type === 'THUMB_RATER' ? 'RATER' : 'BOT'}
                            </span>
                            <button onClick={() => deleteSavedItem(item.id)} className="text-black hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                         </div>
                         
                         {item.type === 'THUMB_RATER' ? (
                           <>
                             <div className="aspect-video bg-black border-2 border-black overflow-hidden">
                               <img src={`data:image/jpeg;base64,${item.thumbnailBase64}`} className="w-full h-full object-cover" />
                             </div>
                             <div className="flex justify-between items-center">
                                <h3 className="font-bold text-sm text-black truncate pr-4">{item.videoTitle || "Untitled"}</h3>
                                <div className="bg-black px-2 py-1 text-white text-xs font-bold rotate-2">{item.thumbnailResult?.scores.overall}/10</div>
                             </div>
                           </>
                         ) : (
                           <div className="py-2">
                             <div className="flex items-center gap-3">
                               {item.channelDetails?.thumbnailUrl && <img src={item.channelDetails.thumbnailUrl} className="w-10 h-10 rounded-full border-2 border-black" />}
                               <h3 className="font-bold text-sm text-black">{item.channelDetails?.title}</h3>
                             </div>
                             <div className="mt-3 flex items-center gap-2">
                               <span className={clsx("text-xs font-black px-2 py-0.5 border-2 border-black", item.botResult?.verdict === 'NPC_FARM' ? 'bg-red-500 text-white' : 'bg-green-400 text-black')}>
                                 {item.botResult?.verdict}
                               </span>
                               <span className="text-xs text-black font-bold">({item.botResult?.botScore}%)</span>
                             </div>
                           </div>
                         )}

                         <button onClick={() => loadSavedItem(item)} className="mt-auto w-full bg-black text-white hover:bg-zinc-800 font-bold py-2 text-xs transition-colors border-2 border-transparent">
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
           <div className="bg-white border-thick w-full max-w-2xl max-h-[80vh] overflow-y-auto hard-shadow flex flex-col rotate-1">
              <div className="bg-pink-400 sticky top-0 p-4 border-b-thick flex justify-between items-center">
                 <h2 className="text-2xl font-black text-black flex items-center gap-3 uppercase">
                   <History className="w-6 h-6" /> Patch Notes
                 </h2>
                 <button onClick={() => setShowChangelog(false)} className="p-2 bg-black text-white hover:bg-zinc-800 font-bold transition-colors border-2 border-transparent">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-8 space-y-8 bg-dots">
                 {CHANGELOG_DATA.map((log, i) => (
                    <div key={i} className="relative pl-6 border-l-4 border-black">
                       <div className="absolute -left-[10px] top-1.5 w-4 h-4 bg-yellow-400 rounded-full border-2 border-black"></div>
                       <div className="flex items-baseline gap-3 mb-1">
                         <h3 className="text-xl font-black text-black uppercase">{log.version}</h3>
                         <span className="text-xs text-zinc-500 font-bold bg-white px-1 border border-black">{log.date}</span>
                       </div>
                       <p className="text-sm text-black font-bold mb-3 italic">"{log.title}"</p>
                       <ul className="list-disc pl-4 space-y-1 text-sm text-black font-medium">
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
          <div className="bg-yellow-300 border-thick p-8 max-w-md hard-shadow relative">
             <div className="flex justify-between items-start mb-4">
                <AlertTriangle className="w-12 h-12 text-black" />
             </div>
             <h2 className="text-2xl font-black mb-2 text-black uppercase">Local File??</h2>
             <p className="text-black mb-6 leading-relaxed font-bold border-l-4 border-black pl-4">
               If you upload a file, I can't read the Title or Keywords. I'm just looking at the pixels. It's dumber, but it works.
             </p>
             <div className="flex gap-3">
                <button onClick={() => setShowImageWarning(false)} className="flex-1 bg-black text-white py-3 font-black hover:bg-zinc-800 transition-colors border-2 border-transparent">WHATEVER</button>
                <button onClick={() => { setShowImageWarning(false); setThumbnailSrc(null); setAppState(AppState.IDLE); }} className="flex-1 bg-white text-black py-3 font-black border-thick hover:bg-zinc-100 transition-colors">CANCEL</button>
             </div>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportJSON} />

      {/* --- HEADER --- */}
      <header className="bg-yellow-400 border-b-thick sticky top-0 z-50 font-sans">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAnalysis}>
            <SmashLogo />
            {/* CHANGE APP NAME HERE */}
            <h1 className="font-black text-2xl tracking-tighter text-black italic bg-white px-2 border-2 border-black rotate-[-2deg] group-hover:rotate-[2deg] transition-transform">
              RICETOOL
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowStoreModal(true)} className="flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-3 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all">
                <ShoppingBag className="w-4 h-4" /> STORE
            </button>
            <button onClick={() => setShowSavedList(true)} className="flex items-center gap-2 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-3 py-2 border-2 border-black hard-shadow-sm active:translate-y-0.5 active:shadow-none transition-all">
                <FolderOpen className="w-4 h-4" /> VAULT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 relative z-10 font-sans">
        
        {/* TAB SWITCHER */}
        <div className="flex justify-center mb-12">
            <div className="bg-white p-1.5 border-thick hard-shadow rotate-1 inline-flex gap-2">
                <button 
                    onClick={() => { setActiveTab('RATER'); resetAnalysis(); }}
                    className={clsx(
                        "px-6 py-2 text-sm font-black uppercase transition-all border-2",
                        activeTab === 'RATER' ? "bg-pink-400 text-black border-black" : "bg-transparent text-zinc-400 border-transparent hover:text-black"
                    )}
                >
                    Thumb Rater
                </button>
                <button 
                    onClick={() => { setActiveTab('BOT_HUNTER'); resetAnalysis(); }}
                    className={clsx(
                        "px-6 py-2 text-sm font-black uppercase transition-all border-2",
                        activeTab === 'BOT_HUNTER' ? "bg-cyan-400 text-black border-black" : "bg-transparent text-zinc-400 border-transparent hover:text-black"
                    )}
                >
                    Bot Hunter
                </button>
            </div>
        </div>

        {/* INPUT SECTION */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="relative group">
            <div className="relative flex bg-cyan-300 p-2 border-thick hard-shadow">
               <div className="flex items-center justify-center w-12 text-black border-r-2 border-black mr-2">
                  {activeTab === 'RATER' ? <Youtube className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
               </div>
               <input 
                 type="text" 
                 placeholder={activeTab === 'RATER' ? "PASTE YOUTUBE LINK HERE..." : "PASTE CHANNEL LINK HERE..."}
                 className="w-full bg-transparent outline-none text-black placeholder-black/50 px-2 font-bold uppercase"
                 value={url}
                 onChange={handleUrlChange}
                 onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
               />
               <div className="flex gap-2">
                 {activeTab === 'RATER' && (
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-black bg-white border-2 border-black hover:bg-zinc-100 transition-all"
                        title="Upload File"
                     >
                        <CloudUpload className="w-5 h-5" />
                     </button>
                 )}
                 <button 
                    onClick={handleInputSubmit}
                    disabled={!url || appState === AppState.ANALYZING}
                    className="bg-black text-white px-6 font-black uppercase hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-2 border-transparent"
                 >
                    {appState === AppState.ANALYZING ? <Loader2 className="w-4 h-4 animate-spin" /> : "JUDGE ME"}
                 </button>
               </div>
            </div>
          </div>
          {activeTab === 'RATER' && <p className="text-center text-xs font-bold text-black mt-4 bg-white inline-block px-2 border-2 border-black rotate-1 mx-auto block w-fit">LINKS OR FILES IDK</p>}
        </div>

        {/* ERROR STATE */}
        {errorMsg && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-100 border-thick flex items-center gap-4 animate-slide-up text-red-600">
            <AlertCircle className="w-8 h-8 shrink-0 text-black" />
            <p className="text-sm font-bold text-black">{errorMsg}</p>
          </div>
        )}

        {/* --- BOT HUNTER RESULTS --- */}
        {activeTab === 'BOT_HUNTER' && (botResult || appState === AppState.ANALYZING) && (
             <div className="max-w-4xl mx-auto animate-slide-up">
                {appState === AppState.ANALYZING ? (
                    <div className="bg-white border-thick p-12 text-center hard-shadow">
                         <Loader2 className="w-12 h-12 mx-auto mb-6 text-black animate-spin" />
                         <h2 className="text-2xl font-black text-black mb-2 uppercase">Interrogating User...</h2>
                         <p className="text-black font-bold">Checking if they have a soul.</p>
                    </div>
                ) : botResult && (
                    <div className="bg-white border-thick hard-shadow">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-8 border-b-thick pb-8 bg-dots">
                                <div className="flex items-center gap-6">
                                    {analyzingChannel?.thumbnailUrl && (
                                        <img src={analyzingChannel.thumbnailUrl} className="w-20 h-20 rounded-full border-thick bg-white" />
                                    )}
                                    <div>
                                        <h2 className="text-3xl font-black text-black uppercase bg-yellow-300 px-2 inline-block border-2 border-black rotate-1">{analyzingChannel?.title}</h2>
                                        <div className="flex gap-3 mt-3 text-xs font-bold font-mono text-black">
                                            <span className="bg-white border-2 border-black px-2 py-1">{analyzingChannel?.subscriberCount} Subs</span>
                                            <span className="bg-white border-2 border-black px-2 py-1">{analyzingChannel?.videoCount} Vids</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setShowSaveModal(true)} className="bg-black hover:bg-zinc-800 text-white px-4 py-3 font-bold transition-colors flex items-center gap-2 border-2 border-transparent">
                                    <Save className="w-4 h-4" /> SAVE REPORT
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1 bg-zinc-100 border-thick p-6 flex flex-col items-center justify-center text-center">
                                    <h3 className="text-sm font-black uppercase text-black mb-3 border-b-2 border-black w-full pb-1">Bot Meter</h3>
                                    
                                    <div className="relative w-32 h-32 flex items-center justify-center mb-3">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="60" stroke="#000" strokeWidth="8" fill="white" />
                                            <circle cx="64" cy="64" r="60" stroke={botResult.verdict === 'NPC_FARM' ? '#ef4444' : (botResult.verdict === 'CYBORG' ? '#fbbf24' : '#10b981')} strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * botResult.botScore) / 100} strokeLinecap="round" />
                                        </svg>
                                        <span className="absolute text-3xl font-black text-black">{botResult.botScore}%</span>
                                    </div>

                                    <div className={clsx(
                                        "text-lg font-black px-4 py-1 border-2 border-black rotate-[-2deg]",
                                        botResult.verdict === 'HUMAN' ? "bg-green-300 text-black" : (botResult.verdict === 'CYBORG' ? "bg-yellow-300 text-black" : "bg-red-500 text-white")
                                    )}>
                                        {botResult.verdict}
                                    </div>
                                </div>
                                
                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2 uppercase"><FileText className="w-5 h-5" /> Evidence</h3>
                                    <ul className="space-y-3">
                                        {(botResult.evidence || []).map((ev, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm font-bold text-black bg-white p-3 border-2 border-black hard-shadow-sm">
                                                <AlertTriangle className="w-5 h-5 text-black shrink-0" />
                                                {ev}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="mt-8 bg-zinc-100 border-l-[6px] border-black pl-4 py-4 italic">
                                <p className="text-black text-lg font-bold">"{botResult.summary}"</p>
                            </div>

                        </div>
                    </div>
                )}
             </div>
        )}

        {/* --- THUMB RATER RESULTS DASHBOARD --- */}
        {activeTab === 'RATER' && (thumbnailSrc || result) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-slide-up">
            
            {/* Left Column (4/12): Image & Metadata */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Thumbnail Card */}
              <div className="bg-white border-thick p-2 hard-shadow rotate-1 relative group">
                <div className={clsx("relative aspect-video bg-black overflow-hidden border-2 border-black", isSusDetected && "border-4 border-red-500")}>
                  <img 
                    src={thumbnailSrc || ''} 
                    alt="Thumbnail" 
                    className={clsx("w-full h-full object-contain transition-all duration-500", isSusDetected && !showSusContent && "blur-xl opacity-50")}
                  />
                  
                  {isSusDetected && !showSusContent && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setShowSusContent(true)}>
                          <div className="bg-red-500 text-white border-2 border-white px-4 py-2 font-black mb-2 flex items-center gap-2 uppercase rotate-[-5deg] text-xl">
                             <Siren className="w-6 h-6" /> SUS CONTENT
                          </div>
                          <button className="text-sm text-white font-bold underline">CLICK TO RISK IT</button>
                      </div>
                  )}

                  {appState === AppState.ANALYZING && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center flex-col gap-3 z-20">
                      <Loader2 className="w-12 h-12 text-black animate-spin" />
                      <span className="text-xl font-black text-black uppercase">COOKING...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Card */}
              {(videoTitle || isMetadataLoading) && (
                <div className="bg-white border-thick p-6 relative hard-shadow-sm rotate-[-1deg]">
                  <div className="flex items-center gap-2 mb-4 text-black text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2">
                     <BoxSelect className="w-4 h-4" /> Video Metadata
                  </div>
                  
                  {isMetadataLoading ? (
                    <div className="space-y-3">
                        <div className="h-4 bg-zinc-200 w-3/4 animate-pulse border-2 border-zinc-300"></div>
                        <div className="h-3 bg-zinc-200 w-1/2 animate-pulse border-2 border-zinc-300"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                          <p className="text-black font-bold leading-snug">{videoTitle}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-black">
                          <div>
                             <span className="text-[10px] text-zinc-500 font-black uppercase block mb-1">Keywords</span>
                             <div className="flex flex-wrap gap-1">
                                {videoKeywords.slice(0, 3).map((k, i) => (
                                    <span key={i} className="text-[10px] text-black bg-zinc-100 border border-black px-1.5 py-0.5">{k}</span>
                                ))}
                                {videoKeywords.length > 3 && <span className="text-[10px] text-zinc-500 pl-1 font-bold">+{videoKeywords.length - 3}</span>}
                             </div>
                          </div>
                          <div>
                             <span className="text-[10px] text-zinc-500 font-black uppercase block mb-1">Description</span>
                             <span className={clsx("text-xs flex items-center gap-1 font-bold", videoDesc ? "text-green-600" : "text-red-500")}>
                                {videoDesc ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />} {videoDesc ? 'FOUND' : 'MISSING'}
                             </span>
                          </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {appState === AppState.READY_TO_ANALYZE && (
                 <button 
                 onClick={handleAnalyze}
                 className="w-full bg-pink-500 hover:bg-pink-400 text-white font-black text-xl py-4 border-thick hard-shadow transition-transform active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
               >
                 <Sparkles className="w-6 h-6" /> START ROAST
               </button>
              )}
            </div>

            {/* Right Column (8/12): Dashboard Results */}
            <div className="lg:col-span-8 flex flex-col h-full gap-8">
              {!result ? (
                 appState === AppState.ANALYZING ? (
                    <div className="flex-1 bg-white border-thick flex flex-col items-center justify-center p-12 min-h-[400px] hard-shadow">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-black rounded-full animate-ping absolute bg-yellow-200"></div>
                            <div className="w-20 h-20 bg-yellow-400 rounded-full border-thick flex items-center justify-center relative z-10">
                                <Zap className="w-10 h-10 text-black fill-white" />
                            </div>
                        </div>
                        <h3 className="mt-8 text-2xl font-black text-black uppercase">JUDGING YOU...</h3>
                        <p className="text-black font-bold mt-2">Trying not to laugh.</p>
                    </div>
                 ) : (
                    <div className="flex-1 bg-zinc-5 border-thick border-dashed flex flex-col items-center justify-center p-12 min-h-[400px]">
                         <div className="w-20 h-20 bg-white border-thick rounded-full flex items-center justify-center mb-6 rotate-3"><BoxSelect className="w-8 h-8 text-black" /></div>
                         <h3 className="text-black font-black text-xl uppercase">WAITING FOR VICTIMS</h3>
                         <p className="text-zinc-500 font-bold mt-2">Paste a link to begin the roast.</p>
                    </div>
                 )
              ) : (
                <>
                   {/* Row 1: Score & Chart */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Overall Score Card */}
                        <div className={clsx("bg-white border-thick p-6 relative overflow-hidden flex flex-col justify-between hard-shadow rotate-[-1deg]", 
                            result.scores.overall >= 8 ? "bg-green-100" : (result.scores.overall >= 5 ? "bg-yellow-100" : "bg-red-100")
                        )}>
                            <div className="flex justify-between items-start z-10">
                                <div>
                                    <h3 className="text-sm font-black text-black uppercase tracking-wider border-b-2 border-black">FINAL SCORE</h3>
                                    <p className="text-black text-xs mt-1 font-bold">Based on pure vibes & math</p>
                                </div>
                                <button onClick={() => setShowSaveModal(true)} className="text-black hover:scale-110 transition-transform">
                                    <Save className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="flex items-baseline gap-2 mt-4 z-10 justify-center py-6">
                                <span className="text-8xl font-black tracking-tighter text-black drop-shadow-[4px_4px_0_rgba(255,255,255,1)]">
                                    {result.scores.overall}
                                </span>
                                <span className="text-black font-black text-2xl rotate-[-5deg]">/ 10</span>
                            </div>
                        </div>
                        
                        {/* Radar Chart Card */}
                        <div className="bg-white border-thick p-4 flex items-center justify-center relative hard-shadow rotate-1">
                             <div className="absolute top-4 left-4 text-xs font-black text-black uppercase bg-yellow-300 px-2 border-2 border-black">PENTAGON OF PAIN</div>
                             <div className="w-full h-64 mt-4">
                                <AnalysisChart scores={result.scores} />
                             </div>
                        </div>
                   </div>

                   {/* Row 2: Detailed Scores */}
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <ScoreCard label="Clarity" score={result.scores.clarity} />
                      <ScoreCard label="Curiosity" score={result.scores.curiosity} />
                      <ScoreCard label="Text" score={result.scores.text_readability} />
                      <ScoreCard label="Emotion" score={result.scores.emotion} />
                   </div>

                   {/* Row 3: Verdict & Suggestions */}
                   <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white border-thick p-6 hard-shadow">
                             <h3 className="text-lg font-black text-black uppercase mb-3 flex items-center gap-2 bg-pink-300 w-fit px-2 border-2 border-black rotate-[-1deg]">
                                <Terminal className="w-5 h-5" /> THE VERDICT
                             </h3>
                             <p className="text-black text-xl leading-relaxed font-bold italic">
                                "{result.summary}"
                             </p>
                        </div>
                        
                        <div className="bg-white border-thick p-6 hard-shadow">
                           <h3 className="text-lg font-black text-black uppercase mb-4 flex items-center gap-2 bg-cyan-300 w-fit px-2 border-2 border-black rotate-1">
                              <Target className="w-5 h-5" /> HOW TO FIX IT
                           </h3>
                           <div className="grid gap-3">
                             {(result.suggestions || []).map((s, i) => (
                               <div key={i} className="flex items-start gap-4 p-4 border-2 border-black bg-zinc-50 hover:bg-yellow-100 transition-colors">
                                 <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-lg font-bold shrink-0">{i+1}</div>
                                 <span className="text-base text-black font-bold pt-0.5">{s}</span>
                               </div>
                             ))}
                           </div>
                        </div>
                   </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* CHAT ROOM */}
        {((activeTab === 'RATER' && result && !isSusDetected) || (activeTab === 'BOT_HUNTER' && botResult)) && (
            <div className="mt-16 max-w-4xl mx-auto animate-slide-up">
                <div className="bg-white border-thick hard-shadow overflow-hidden">
                    <div className="bg-purple-400 border-b-thick p-4 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-black animate-pulse"></div>
                        <h2 className="text-xl font-black text-black uppercase tracking-wide">
                            {activeTab === 'BOT_HUNTER' ? "THE INTERROGATION" : "THE ROAST ROOM"}
                        </h2>
                    </div>
                    
                    <div className="h-96 overflow-y-auto p-6 flex flex-col gap-4 bg-dots">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={clsx("flex flex-col max-w-[85%]", msg.role === 'user' ? "self-end items-end" : "self-start items-start")}>
                                <div className={clsx(
                                    "px-6 py-4 text-sm font-bold shadow-[2px_2px_0_0_#000] border-2 border-black", 
                                    msg.role === 'user' ? "bg-blue-400 text-white rounded-2xl rounded-br-none" : "bg-white text-black rounded-2xl rounded-bl-none"
                                )}>
                                    {msg.text}
                                </div>
                                <span className="text-[10px] font-black text-black mt-1 px-1 uppercase">{msg.role === 'user' ? 'YOU' : 'RICE DROID'}</span>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="self-start bg-white px-6 py-4 rounded-2xl rounded-bl-none border-2 border-black flex gap-2 shadow-[2px_2px_0_0_#000]">
                                <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-200"></div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    
                    <div className="p-4 bg-purple-100 border-t-thick">
                        <div className="flex gap-2 bg-white p-2 border-thick focus-within:ring-2 focus-within:ring-black transition-all">
                            <input 
                                type="text" 
                                className="flex-1 bg-transparent px-2 font-bold text-black outline-none placeholder-zinc-500 uppercase" 
                                placeholder="SAY SOMETHING..." 
                                value={chatInput} 
                                onChange={(e) => setChatInput(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                                disabled={isChatLoading}
                            />
                            <button 
                                onClick={handleSendMessage} 
                                disabled={isChatLoading || !chatInput.trim()} 
                                className="bg-black hover:bg-zinc-800 text-white p-3 font-bold transition-colors disabled:opacity-50"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </main>

      <footer className="border-t-thick bg-yellow-300 py-12 mt-20 font-sans">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
             <div className="bg-black p-2"><Zap className="w-4 h-4 text-white" /></div>
             <span className="font-black text-xl text-black italic">RICETOOL</span>
          </div>
          <div className="flex items-center gap-6">
             <span className="text-xs text-black font-bold">v2.12 (THE REVERT)</span>
             <button onClick={() => setShowChangelog(true)} className="text-xs font-black text-black hover:underline uppercase bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0_0_#000] hover:translate-y-[1px] hover:shadow-none transition-all">
                 READ LOGS
             </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;