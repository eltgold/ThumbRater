
import React, { useState, useRef, useEffect } from 'react';
import { extractVideoId, getThumbnailUrl, blobToBase64, fetchVideoMetadata, searchYouTubeVideos, fetchChannelLatestVideos, SearchResult } from './utils/youtube';
import { analyzeThumbnail, sendChatMessage } from './services/geminiService';
import { AppState, AnalysisResult, ChatMessage, ChangelogEntry } from './types';
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
  Image as ImageIcon,
  Loader2,
  Video,
  MessageSquare,
  Send,
  Ghost,
  X,
  AlertTriangle,
  Zap,
  FileText,
  Tags,
  PlayCircle,
  User,
  Tv,
  Cpu,
  History,
  Hammer,
  Siren
} from 'lucide-react';
import clsx from 'clsx';

const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: "v1.6",
    date: "2025-12-01",
    title: "The Fairness Update",
    changes: [
      "Scoring Fixed: Getting a 10 is actually possible now.",
      "Math Tweaked: We stopped rounding down your dreams.",
      "General unfairness removed."
    ]
  },
  {
    version: "v1.5",
    date: "2025-11-30",
    title: "The Wallpaper Update",
    changes: [
      "Added Cat Wallpaper: It bezels the site.",
      "Sus Filter Relaxed: We warn you, but let you look.",
      "General chaos improvements."
    ]
  },
  {
    version: "v1.4",
    date: "2025-11-29",
    title: "The Law & Order Update",
    changes: [
      "Added Sus Checker: The AI now sends you to horny jail.",
      "Added Patch Notes: So you know what I broke.",
      "Fixed metadata fetching for real this time."
    ]
  },
  {
    version: "v1.3",
    date: "2025-11-28",
    title: "Video Store Update",
    changes: [
      "Added Video Search: Find videos without leaving the site.",
      "Added Channel Support: Stalk your favorite creators.",
      "VHS Aesthetics: Because nostalgia sells."
    ]
  },
  {
    version: "v1.2",
    date: "2025-11-27",
    title: "Yap Update",
    changes: [
      "Added 'The Roast Room': Chat with the AI about your failure.",
      "Dumber UI: More rotations, thicker borders.",
      "God Mode Removed: Life isn't fair."
    ]
  },
  {
    version: "v1.0",
    date: "2025-11-25",
    title: "Genesis",
    changes: [
      "Initial Release.",
      "It judges thumbnails.",
      "It hurts feelings."
    ]
  }
];

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  // Metadata State
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoDesc, setVideoDesc] = useState<string | null>(null);
  const [videoKeywords, setVideoKeywords] = useState<string[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchContext, setSearchContext] = useState<string>('VIDEOS & CHANNELS');
  
  // UI State
  const [showImageWarning, setShowImageWarning] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSusContent, setShowSusContent] = useState(false);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state for celebrations (natural 10/10)
  const isCelebrationMode = result?.scores.overall === 10;
  const isSusDetected = result?.isSus;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (appState === AppState.ERROR) {
      setAppState(AppState.IDLE);
      setErrorMsg(null);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setVideoTitle(null);
    setVideoDesc(null);
    setVideoKeywords([]);
    setAppState(AppState.IDLE);
    setErrorMsg(null);
    setChatHistory([]);
    setChatInput('');
    setShowSearchResults(false);
    setShowSusContent(false);
  };

  const fetchImageFromVideoId = async (videoId: string) => {
    setAppState(AppState.LOADING_IMAGE);
    setIsMetadataLoading(true);
    setShowSearchResults(false); // Hide search results when picking a video
    
    // Non-blocking metadata fetch
    fetchVideoMetadata(videoId).then(meta => {
      setVideoTitle(meta.title || "Unknown Title (Hidden by YT)");
      setVideoDesc(meta.description || "No description found.");
      setVideoKeywords(meta.keywords || []);
      setIsMetadataLoading(false);
    }).catch(e => {
      console.error("Metadata fetch error (non-fatal):", e);
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
        console.log("Maxres failed, trying hqdefault...");
        blob = await tryFetch('hqdefault');
      }

      const base64 = await blobToBase64(blob);
      setImageBase64(base64);

      const objectUrl = URL.createObjectURL(blob);
      setThumbnailSrc(objectUrl);
      
      setAppState(AppState.READY_TO_ANALYZE);
    } catch (err) {
      console.error(err);
      setErrorMsg("YOUTUBE SAID NO. (Upload it yourself?)");
      setAppState(AppState.ERROR);
    }
  };

  const handleInputSubmit = async () => {
    const input = url.trim();
    if (!input) return;

    // Check if it's a URL/Video ID
    const videoId = extractVideoId(input);

    if (videoId) {
      // It's a direct link
      resetAnalysis();
      fetchImageFromVideoId(videoId);
    } else {
      // It's a Search Query
      handleSearch(input);
    }
  };

  const handleSearch = async (query: string) => {
    resetAnalysis();
    setIsSearching(true);
    setSearchResults([]);
    setShowSearchResults(true);
    setSearchContext('VIDEOS & CHANNELS');
    
    try {
      const results = await searchYouTubeVideos(query);
      if (results.length === 0) {
        setErrorMsg("NO VIDEOS FOUND. TRY BEING LESS WEIRD.");
        setAppState(AppState.ERROR);
        setShowSearchResults(false);
      } else {
        setSearchResults(results);
      }
    } catch (e) {
      setErrorMsg("SEARCH BROKE. BLAME GOOGLE.");
      setAppState(AppState.ERROR);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (item: SearchResult) => {
    if (item.type === 'channel') {
        // Fetch videos for this channel
        setIsSearching(true);
        setSearchContext(`VIDEOS BY ${item.title.toUpperCase()}`);
        setSearchResults([]);
        try {
            const videos = await fetchChannelLatestVideos(item.id);
            setSearchResults(videos);
        } catch (e) {
            setErrorMsg("COULD NOT LOAD CHANNEL.");
        } finally {
            setIsSearching(false);
        }
    } else {
        // It's a video
        setUrl(`https://www.youtube.com/watch?v=${item.id}`);
        resetAnalysis(); // Ensure fresh state
        fetchImageFromVideoId(item.id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show warning popup for image uploads
    setShowImageWarning(true);

    resetAnalysis();
    setAppState(AppState.LOADING_IMAGE);
    
    try {
      const objectUrl = URL.createObjectURL(file);
      setThumbnailSrc(objectUrl);
      const base64 = await blobToBase64(file);
      setImageBase64(base64);
      setAppState(AppState.READY_TO_ANALYZE);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg("BAD FILE.");
      setAppState(AppState.ERROR);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;

    setAppState(AppState.ANALYZING);
    setShowSusContent(false);

    try {
      const data = await analyzeThumbnail(
        imageBase64, 
        'image/jpeg', 
        {
          title: videoTitle,
          description: videoDesc,
          keywords: videoKeywords
        }
      );
      setResult(data);
      setAppState(AppState.SUCCESS);
    } catch (err) {
      console.error(err);
      setErrorMsg("THE AI DIED. TRY AGAIN.");
      setAppState(AppState.ERROR);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !imageBase64 || !result) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const aiResponse = await sendChatMessage(
        imageBase64, 
        chatHistory, 
        userMsg, 
        result
      );
      setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', text: "I broke. My bad." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div 
      className={clsx("min-h-screen text-black pb-20 font-comic overflow-x-hidden transition-colors duration-500 bg-cover bg-center bg-fixed")}
      style={{
        backgroundImage: isCelebrationMode ? undefined : "url('https://media.tenor.com/2P6J_r-A628AAAAC/cat-cat-meme.gif')"
      }}
    >
      {/* Background Overlay for readability/effects */}
      <div className={clsx("fixed inset-0 z-0 pointer-events-none", 
          isCelebrationMode ? "bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-yellow-200 via-pink-200 to-cyan-200 opacity-95" : 
          (isSusDetected ? "bg-red-900/40" : "bg-white/10")
      )}></div>

      {/* Absolute chaos background elements */}
      {!isSusDetected && (
          <>
            <div className="fixed top-20 left-10 text-9xl opacity-10 -rotate-12 pointer-events-none select-none z-0">💩</div>
            <div className="fixed bottom-40 right-10 text-9xl opacity-10 rotate-45 pointer-events-none select-none z-0">🤡</div>
          </>
      )}
      
      {isCelebrationMode && (
        <div className="fixed inset-0 pointer-events-none z-0 opacity-20 bg-[url('https://media.giphy.com/media/26tOZ42Mg6pbTUPDa/giphy.gif')] bg-repeat"></div>
      )}
      
      {/* Changelog Modal */}
      {showChangelog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
           <div className="bg-white border-8 border-black w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-[16px_16px_0px_0px_#fff] relative">
              <div className="bg-black text-white p-4 sticky top-0 flex justify-between items-center border-b-8 border-black">
                 <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                   <History className="w-8 h-8" />
                   Patch Notes
                 </h2>
                 <button onClick={() => setShowChangelog(false)} className="hover:text-red-500 transition-colors">
                   <X className="w-8 h-8 stroke-[4px]" />
                 </button>
              </div>
              <div className="p-8 space-y-8 bg-[linear-gradient(#e5e7eb_1px,transparent_1px)] [background-size:100%_2rem]">
                 {CHANGELOG_DATA.map((log, i) => (
                    <div key={i} className="relative pl-8 border-l-4 border-black border-dashed">
                       <div className="absolute -left-3 top-0 w-5 h-5 bg-black rounded-full"></div>
                       <h3 className="text-2xl font-black">{log.version} - {log.title}</h3>
                       <p className="text-sm font-bold opacity-50 mb-4 font-mono">{log.date}</p>
                       <ul className="list-disc pl-5 space-y-2 font-bold text-lg">
                          {log.changes.map((change, j) => (
                             <li key={j}>{change}</li>
                          ))}
                       </ul>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Warning Popup */}
      {showImageWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#fef08a] border-8 border-black p-8 max-w-md shadow-[16px_16px_0px_0px_#000] rotate-2 animate-bounce-in">
             <div className="flex justify-between items-start mb-4">
                <AlertTriangle className="w-16 h-16 text-red-500 stroke-[3px]" />
                <button onClick={() => setShowImageWarning(false)} className="bg-black text-white p-2 hover:bg-gray-800">
                  <X className="w-6 h-6" />
                </button>
             </div>
             <h2 className="text-4xl font-black mb-4 leading-none uppercase">Deprecated!</h2>
             <p className="text-xl font-bold mb-6">
               Uploading plain images is for grandmas. 
               <br/><br/>
               For the <span className="bg-red-500 text-white px-1">FULL EXPERIENCE</span>, use a YouTube link or Video so I can judge the metadata too.
             </p>
             <button 
               onClick={() => setShowImageWarning(false)}
               className="w-full bg-white border-4 border-black py-3 text-2xl font-black shadow-[4px_4px_0px_0px_#000] hover:translate-y-1 hover:shadow-none transition-all"
             >
               WHATEVER, I'M BORING
             </button>
          </div>
        </div>
      )}

      {/* Ugly Header */}
      <header className={clsx("bg-[#67e8f9] border-b-8 border-black p-4 sticky top-0 z-50 shadow-[0px_8px_0px_0px_rgba(0,0,0,1)]", isSusDetected && "bg-gray-800")}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 transform hover:rotate-3 transition-transform cursor-pointer" onClick={resetAnalysis}>
            <div className={clsx("bg-red-500 border-4 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]", isCelebrationMode && "animate-spin")}>
              <Youtube className="w-10 h-10 text-white fill-white stroke-black stroke-[3px]" />
            </div>
            <h1 className="font-black text-4xl tracking-tighter italic drop-shadow-md">
              THUMB<span className="text-red-500 bg-yellow-300 px-2 border-4 border-black ml-1">RATE</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 relative z-10">
        
        {/* Brutalist Hero */}
        <div className={clsx(
            "text-center mb-16 border-8 border-black p-8 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden transform -rotate-1 transition-colors",
            isCelebrationMode ? "bg-yellow-100" : "bg-white"
          )}>
          <h1 className="text-6xl md:text-8xl font-black mb-6 leading-none">
            THUMBNAIL
            <br/>
            <span className={clsx("px-4 border-4 border-black inline-block transform rotate-2 mt-2 shadow-[4px_4px_0px_0px_#000]", isCelebrationMode ? "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white" : "bg-[#a5f3fc]")}>CHECKER</span>
          </h1>
          <p className="text-2xl font-bold mb-8 max-w-2xl mx-auto bg-black text-yellow-300 p-2 border-2 border-yellow-300 inline-block transform -rotate-1">
            IT WILL HURT YOUR FEELINGS.
          </p>

          <div className="flex flex-col gap-6 max-w-2xl mx-auto relative z-10">
            {/* Input Group */}
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex items-center bg-white border-8 border-black h-16 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.02] transition-transform">
                <Search className="w-8 h-8 ml-3 mr-2 stroke-[3px]" />
                <input 
                  type="text" 
                  placeholder="PASTE URL OR SEARCH..."
                  className="w-full h-full outline-none font-black text-xl placeholder-gray-400 bg-transparent uppercase"
                  value={url}
                  onChange={handleUrlChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                />
              </div>
              <button 
                onClick={handleInputSubmit}
                disabled={!url || appState === AppState.ANALYZING || isSearching}
                className={clsx(
                  "text-black font-black text-2xl px-8 py-3 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]",
                  isCelebrationMode ? "bg-yellow-400 hover:bg-yellow-300" : "bg-[#c4b5fd] hover:bg-[#a78bfa]"
                )}
              >
                {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : (extractVideoId(url) ? "GO" : "SEARCH")}
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 font-black text-2xl">
              <span className="bg-black h-2 w-10"></span>
              OR
              <span className="bg-black h-2 w-10"></span>
            </div>

            <button 
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto flex items-center gap-3 bg-[#86efac] hover:bg-[#4ade80] text-black font-black text-xl px-8 py-4 border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:rotate-1 active:scale-95 transition-all"
              >
                <CloudUpload className="w-6 h-6 stroke-[3px]" />
                UPLOAD A FILE
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
          </div>
        </div>

        {/* Error Box */}
        {errorMsg && (
          <div className="max-w-2xl mx-auto mb-8 p-6 bg-red-200 border-8 border-red-600 flex items-center gap-6 shadow-[12px_12px_0px_0px_#dc2626] animate-bounce">
            <AlertCircle className="w-12 h-12 text-red-600 stroke-[3px]" />
            <p className="font-black text-red-600 text-3xl uppercase tracking-tighter">{errorMsg}</p>
          </div>
        )}

        {/* SEARCH RESULTS (The Video Store) */}
        {showSearchResults && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="bg-[#fb923c] border-8 border-black p-2 mb-6 inline-block transform -rotate-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-4xl font-black text-white uppercase px-4 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                {searchContext}
              </h2>
            </div>
            
            {isSearching ? (
                 <div className="flex justify-center p-10 bg-white border-8 border-black">
                    <Loader2 className="w-16 h-16 animate-spin stroke-[3px]" />
                 </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {searchResults.map((item) => (
                    <div 
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className={clsx(
                        "group cursor-pointer bg-white border-8 border-black p-3 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fef08a] transition-all",
                        item.type === 'channel' ? "bg-blue-50" : "bg-white"
                    )}
                    >
                    <div className={clsx(
                        "aspect-video bg-black overflow-hidden mb-3 border-4 border-black relative",
                        item.type === 'channel' ? "rounded-full aspect-square w-32 mx-auto border-4" : ""
                    )}>
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        {item.type === 'channel' ? (
                             <User className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                        ) : (
                             <PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                        )}
                        </div>
                    </div>
                    
                    {item.type === 'channel' && (
                        <div className="flex justify-center mb-2">
                             <span className="bg-blue-500 text-white font-black text-xs px-2 py-1 border-2 border-black rotate-3">CHANNEL</span>
                        </div>
                    )}

                    <h3 className="font-black text-lg leading-tight line-clamp-2 uppercase" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
                    
                    <div className="mt-2 flex justify-between items-center text-xs font-bold font-mono">
                        <span className="bg-black text-white px-1 truncate max-w-[70%]">
                            {item.channelTitle || (item.type === 'channel' ? 'CREATOR' : '')}
                        </span>
                        {item.publishedAt && <span>{item.publishedAt.split('T')[0]}</span>}
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        )}

        {/* Content Area */}
        {(thumbnailSrc || result) && !showSearchResults && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Left Column: Image */}
            <div className="flex flex-col gap-6">
              <div className={clsx("bg-white border-8 border-black p-4 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rotate-1", isCelebrationMode && "border-yellow-500 shadow-yellow-800", isSusDetected && "border-red-600 bg-red-100")}>
                <div className="relative aspect-video bg-black border-4 border-black group overflow-hidden">
                  <img 
                    src={thumbnailSrc || ''} 
                    alt="Thumbnail Preview" 
                    className={clsx("w-full h-full object-contain transition-all duration-300", isSusDetected && !showSusContent && "blur-xl scale-110 opacity-50")}
                  />
                  
                  {isSusDetected && !showSusContent && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 cursor-pointer" onClick={() => setShowSusContent(true)}>
                          <div className="bg-red-600 text-white font-black text-3xl px-6 py-4 rotate-12 border-4 border-white shadow-[0px_0px_20px_rgba(0,0,0,0.5)] mb-4 hover:scale-110 transition-transform">
                              SENSITIVE CONTENT
                          </div>
                          <button className="bg-black text-white px-4 py-2 font-black border-2 border-white hover:bg-gray-800 uppercase">
                              Click to reveal
                          </button>
                      </div>
                  )}

                  {appState === AppState.ANALYZING && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center flex-col gap-4 z-20">
                      <Loader2 className="w-24 h-24 text-black animate-spin stroke-[3px]" />
                      <p className="text-4xl font-black animate-pulse bg-[#67e8f9] px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_black] rotate-2">
                        JUDGING YOU...
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Data Proof Box */}
              {(videoTitle || isMetadataLoading) && (
                <div className="bg-gray-100 border-8 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -rotate-1 text-sm font-bold font-mono">
                  <div className="flex items-center gap-2 mb-2 bg-black text-white p-2 w-fit">
                    <FileText className="w-4 h-4" />
                    <span>STOLEN METADATA (I READ THIS)</span>
                  </div>
                  {isMetadataLoading ? (
                    <div className="flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Stealing data from YouTube...</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      <div className="border-b-2 border-black pb-1">
                        <span className="bg-yellow-300 px-1 border border-black mr-2">TITLE</span>
                        {videoTitle}
                      </div>
                      <div className="border-b-2 border-black pb-1">
                         <span className="bg-green-300 px-1 border border-black mr-2">DESC</span>
                         <span className="opacity-70">{videoDesc ? videoDesc.substring(0, 100) + '...' : 'NONE'}</span>
                      </div>
                      <div>
                        <span className="bg-pink-300 px-1 border border-black mr-2">KEYS</span>
                        {videoKeywords.length > 0 ? videoKeywords.join(', ') : 'NONE'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {appState === AppState.READY_TO_ANALYZE && (
                 <button 
                 onClick={handleAnalyze}
                 className={clsx(
                   "w-full text-black font-black text-4xl py-6 border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:translate-y-2 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95",
                   isCelebrationMode ? "bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300" : "bg-[#fcd34d] hover:bg-[#fbbf24]"
                 )}
               >
                 <span className="flex items-center justify-center gap-4">
                   <Sparkles className="w-10 h-10 fill-white stroke-black stroke-[3px]" />
                   ROAST IT!
                 </span>
               </button>
              )}
            </div>

            {/* Right Column: Results */}
            <div className="flex flex-col h-full gap-6">
              {!result ? (
                 appState === AppState.ANALYZING ? (
                   // LOADING SCREEN (COOKING)
                    <div className="h-full flex flex-col items-center justify-center p-12 border-8 border-black bg-yellow-300 min-h-[400px] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] animate-pulse rotate-1">
                        <Loader2 className="w-32 h-32 text-black animate-spin stroke-[3px] mb-8" />
                        <h2 className="text-4xl font-black uppercase text-center animate-bounce">
                            COOKING...
                        </h2>
                        <p className="font-bold text-xl mt-4 bg-black text-white px-4 py-1 -rotate-2">
                            DO NOT TURN OFF CONSOLE
                        </p>
                    </div>
                 ) : (
                    // STANDBY SCREEN
                    <div className="h-full flex flex-col items-center justify-center p-12 border-8 border-black border-dashed bg-white/50 min-h-[400px] -rotate-1">
                         <div className="w-32 h-32 border-8 border-black rounded-full flex items-center justify-center mb-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Tv className="w-16 h-16 stroke-[2px]" />
                         </div>
                         <h3 className="font-black text-4xl opacity-50 uppercase text-center mb-2">
                            SYSTEM READY
                         </h3>
                         <p className="font-bold text-xl opacity-40 bg-black text-white px-2">
                             INSERT THUMBNAIL TO BEGIN
                         </p>
                    </div>
                 )
              ) : (
                <>
                  {/* SUS WARNING BANNER */}
                  {isSusDetected && (
                      <div className="bg-red-500 border-8 border-black p-4 text-white font-black animate-pulse flex items-center gap-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                          <Siren className="w-12 h-12 stroke-[3px]" />
                          <div>
                              <h3 className="text-3xl uppercase leading-none">CONTENT WARNING</h3>
                              <p className="text-sm font-mono mt-1 bg-black inline-block px-1">AI DETECTED: {result.susReason}</p>
                          </div>
                      </div>
                  )}

                  {/* Summary Box */}
                  <div className={clsx(
                      "border-8 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] -rotate-1 relative transition-colors",
                      isCelebrationMode ? "bg-yellow-200" : "bg-white"
                    )}>
                    <div className="absolute -top-6 -right-4 bg-[#fca5a5] border-4 border-black px-4 py-1 transform rotate-6 shadow-[4px_4px_0px_0px_black]">
                        <h3 className="text-xl font-black uppercase">The Verdict</h3>
                    </div>
                    <p className="text-2xl font-bold leading-relaxed font-comic mt-2">
                      "{result.summary}"
                    </p>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <ScoreCard label="Clarity" score={result.scores.clarity} icon={<Eye className="w-8 h-8 stroke-[3px]"/>} />
                    <ScoreCard label="Curiosity" score={result.scores.curiosity} icon={<Target className="w-8 h-8 stroke-[3px]"/>} />
                    <ScoreCard label="Text" score={result.scores.text_readability} icon={<Type className="w-8 h-8 stroke-[3px]"/>} />
                    <ScoreCard label="Emotion" score={result.scores.emotion} icon={<Smile className="w-8 h-8 stroke-[3px]"/>} />
                  </div>

                  {/* Analysis Chart */}
                  <div className="bg-white border-8 border-black p-0 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rotate-1">
                      <div className="bg-black text-white font-black text-center py-2 text-xl uppercase tracking-widest">The Pentagon of Pain</div>
                      <div className="p-4">
                        <AnalysisChart scores={result.scores} />
                      </div>
                  </div>

                  {/* Overall Score */}
                  <div className={clsx(
                      "border-8 border-black p-6 flex items-center justify-between shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 hover:rotate-0 transition-transform",
                      isCelebrationMode ? "bg-gradient-to-r from-yellow-400 to-orange-500" : "bg-[#67e8f9]"
                    )}>
                    <div>
                      <h3 className="font-black text-3xl uppercase italic">Final Grade</h3>
                    </div>
                    <div className="text-7xl font-black text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] stroke-black stroke-[3px]" style={{ WebkitTextStroke: '3px black' }}>
                      {result.scores.overall}/10
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="border-8 border-black bg-white p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                       <h3 className="font-black text-2xl mb-4 flex items-center gap-3 bg-yellow-300 inline-block px-2 border-4 border-black transform -rotate-2">
                         <Sparkles className="w-6 h-6 text-black fill-white stroke-[3px]" />
                         {isCelebrationMode ? "WHY IT'S PERFECT:" : "FIX IT NOW:"}
                       </h3>
                       <ul className="space-y-4">
                         {result.suggestions.map((s, i) => (
                           <li key={i} className="flex items-start gap-3 text-lg font-bold bg-gray-100 p-3 border-4 border-black hover:bg-green-100 transition-colors">
                             <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0 mt-0.5 fill-black stroke-white stroke-[3px]" />
                             <span className="leading-tight">{s}</span>
                           </li>
                         ))}
                       </ul>
                  </div>

                </>
              )}
            </div>
          </div>
        )}

        {/* THE ROAST ROOM (Chat) - Hidden if Sus */}
        {result && !isSusDetected && (
            <div className="mt-20 max-w-4xl mx-auto">
                <div className={clsx(
                    "border-8 border-black p-8 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]",
                    isCelebrationMode ? "bg-yellow-300" : "bg-[#fdba74]"
                  )}>
                    <div className="flex items-center gap-4 mb-8 border-b-8 border-black pb-4">
                        <MessageSquare className="w-12 h-12 stroke-[3px]" />
                        <h2 className="text-5xl font-black uppercase tracking-tighter">{isCelebrationMode ? "THE GLAZE ROOM" : "The Roast Room"}</h2>
                    </div>
                    
                    <div className="bg-white border-4 border-black h-96 overflow-y-auto p-6 flex flex-col gap-4 mb-6 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.1)]">
                        {chatHistory.length === 0 && (
                            <div className="text-center opacity-50 font-bold text-2xl mt-10">
                                {isCelebrationMode ? "💬 Accept my praise..." : "💬 Ask why your score sucks..."}
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={clsx(
                                "flex flex-col max-w-[80%]",
                                msg.role === 'user' ? "self-end items-end" : "self-start items-start"
                            )}>
                                <div className={clsx(
                                    "p-4 border-4 border-black text-xl font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                                    msg.role === 'user' ? "bg-[#86efac] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl" : "bg-[#fcd34d] rounded-tl-2xl rounded-tr-2xl rounded-br-2xl"
                                )}>
                                    {msg.text}
                                </div>
                                <span className="text-xs font-black uppercase mt-1 px-2 bg-black text-white">
                                    {msg.role === 'user' ? 'YOU' : 'THE JUDGE'}
                                </span>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="self-start bg-[#fcd34d] p-4 border-4 border-black rounded-2xl animate-pulse">
                                <Loader2 className="w-6 h-6 animate-spin stroke-[3px]" />
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 border-4 border-black p-4 text-xl font-bold outline-none focus:bg-gray-50 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            placeholder={isCelebrationMode ? "Bask in glory..." : "Defend yourself..."}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            disabled={isChatLoading}
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={isChatLoading || !chatInput.trim()}
                            className="bg-[#67e8f9] border-4 border-black p-4 px-8 font-black text-2xl hover:bg-[#22d3ee] active:translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all disabled:opacity-50"
                        >
                            <span className="hidden md:inline">YAP</span>
                            <Send className="md:hidden w-8 h-8 stroke-[3px]" />
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>

      <footer className="border-t-8 border-black bg-white py-12 mt-24">
        <div className="max-w-7xl mx-auto px-4 text-center flex flex-col items-center gap-4">
          <p className="font-black text-xl">Powered by <span className="text-blue-600 bg-blue-100 px-2 border-2 border-blue-600 rounded-lg mx-1">Gemini 2.5 Flash</span> (Smart AI, Dumb UI)</p>
          <button 
             onClick={() => setShowChangelog(true)}
             className="flex items-center gap-2 font-bold text-lg hover:underline decoration-4 underline-offset-4 decoration-black"
          >
             <History className="w-5 h-5" />
             PATCH NOTES
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
