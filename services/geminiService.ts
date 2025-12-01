import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, BotAnalysisResult, VideoAnalysisResult, ChannelDetails, SearchResult, VideoMetadata, DirtyAnalysisResult } from '../types';

const getAiClient = () => {
  // Fixed: 'env' does not exist on type 'ImportMeta'.
  // Guideline: API key must be obtained exclusively from process.env.API_KEY.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const cleanJsonString = (str: string): string => {
  return str.replace(/```json\n?|```/g, '').trim();
};

const sanitizeString = (str?: string | null): string => {
  if (!str) return "";
  // Escape double quotes and backticks to prevent breaking the prompt template
  return str.replace(/"/g, '\\"').replace(/`/g, '\\`');
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out (AI took too long)")), timeoutMs)
    )
  ]);
};

export const analyzeThumbnail = async (
  imageBase64: string, 
  mimeType: string = 'image/jpeg',
  metadata?: { title?: string | null, description?: string | null, keywords?: string[] | null }
): Promise<AnalysisResult> => {
  const modelId = "gemini-2.5-flash"; 
  const ai = getAiClient();

  let contextPrompt = "";
  if (metadata?.title) {
    contextPrompt += `\nVIDEO TITLE: "${sanitizeString(metadata.title)}"`;
  }
  if (metadata?.description) {
    contextPrompt += `\nVIDEO DESCRIPTION: "${sanitizeString(metadata.description.substring(0, 500))}..."`;
  }
  if (metadata?.keywords && metadata.keywords.length > 0) {
    const keywords = metadata.keywords.map(k => sanitizeString(k)).join(", ");
    contextPrompt += `\nVIDEO KEYWORDS/TAGS: "${keywords}"`;
  }

  const normalPrompt = `
    Analyze this YouTube thumbnail as an OBJECTIVE, "dumb-smart" YouTube algorithm expert. You speak in slang, but your technical analysis is PhD level.
    
    METADATA EXTRACTED FROM LINK:
    ${contextPrompt}
    
    PHASE 1: SUS CHECK (SAFETY FILTER)
    Analyze if the image is "SUS" (Inappropriate, Sexually Suggestive, Excessive Skin/Cleavage bait, Gore, or Dangerous).
    - If it looks like "Softcore Porn", "Clickbait Smut", or contains gore: Set isSus = true.
    - Otherwise: Set isSus = false.
    - IMPORTANT: EVEN IF IS SUS, YOU MUST PROCEED TO SCORE IT NORMALLY. Do not block the analysis. Just flag it.

    PHASE 2: SCORING (STRICT MATHEMATICAL FAIRNESS)
    You must score each category on a 0-10 scale. Use INTEGERS only.
    
    SCORING MINDSET: 
    - Use the FULL range (0-10). 
    - **DO NOT BE AFRAID TO GIVE A 10.** 
    - A "10" means "Top Tier / Industry Standard", it does NOT mean "Divine Impossible Perfection". 
    - If it's excellent, GIVE IT THE 10.
    
    1. Clarity (Weight: 20%): 
       - How quickly can I understand the subject? (0=Mess, 10=Crystal Clear)
    
    2. Curiosity (Weight: 40%): 
       - Do I have a burning question? Does it create an "Information Gap"? (0=Boring Stock Photo, 10=MUST CLICK NOW)
    
    3. Text/Hierarchy (Weight: 10%): 
       - Readability & Contrast. 
       - CRITICAL RULE: IF THERE IS NO TEXT, rate the "Visual Focal Point" instead. DO NOT give a low score just because there is no text. A text-free image can be a 10 if the visual hierarchy is perfect.
    
    4. Emotion/Vibe (Weight: 30%): 
       - Facial expression, lighting mood, or color psychology. (0=Dead/Bland, 10=Intense/Gripping)
    
    5. Overall (Calculated): 
       - YOU MUST CALCULATE THIS STRICTLY using this formula:
       - (Curiosity * 0.4) + (Emotion * 0.3) + (Clarity * 0.2) + (Text * 0.1)
       - Round the result to the nearest INTEGER (e.g. 9.5 rounds UP to 10).
    
    OUTPUT INSTRUCTIONS:
      - Return ONLY raw JSON.
      - isSus: Boolean.
      - susReason: If isSus is true, provide a short warning.
      - Summary: A 1-sentence verdict. Cite a SPECIFIC visual element.
      - Suggestions: 3 SPECIFIC, TECHNICAL fixes or compliments.
  `;

  try {
    const response = (await withTimeout(ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: imageBase64 } },
          { text: normalPrompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSus: { type: Type.BOOLEAN },
            susReason: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                clarity: { type: Type.NUMBER },
                curiosity: { type: Type.NUMBER },
                text_readability: { type: Type.NUMBER },
                emotion: { type: Type.NUMBER },
                overall: { type: Type.NUMBER },
              },
              required: ["clarity", "curiosity", "text_readability", "emotion", "overall"]
            },
            summary: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    }))) as GenerateContentResponse;

    if (!response.text) throw new Error("No response from Gemini");
    return JSON.parse(cleanJsonString(response.text)) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const analyzeVideoContext = async (
  metadata: VideoMetadata, 
  videoId: string
): Promise<VideoAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();
  
  const prompt = `
    Analyze this YouTube Video Metadata to provide a "Vibe Check" before we start chatting about it.
    
    VIDEO TITLE: "${sanitizeString(metadata.title)}"
    CHANNEL: "${sanitizeString(metadata.channelTitle)}"
    DESCRIPTION: "${sanitizeString(metadata.description?.substring(0, 1000))}"
    KEYWORDS: "${metadata.keywords ? metadata.keywords.map(k => sanitizeString(k)).join(', ') : ''}"
    
    Task:
    1. Summarize what this video is likely about in 1 snarky/funny sentence.
    2. Identify 3 main topics.
    3. Determine the "Tone" (e.g., Cringy, Educational, Clickbait, Wholesome).
    
    IMPORTANT: You have Google Search grounding enabled. If the metadata is vague, USE YOUR TOOLS to find out what this video is actually about.
    
    Output JSON (Do not use markdown code blocks):
    {
      "videoId": "${videoId}",
      "summary": "string",
      "topics": ["string", "string", "string"],
      "tone": "string"
    }
  `;

  try {
    const response = (await withTimeout(ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
           tools: [{ googleSearch: {} }],
        }
    }))) as GenerateContentResponse;
    if (!response.text) throw new Error("No response");
    try {
        return JSON.parse(cleanJsonString(response.text));
    } catch (e) {
        const match = response.text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Failed to parse JSON from search result");
    }
  } catch (e) {
      throw e;
  }
};

export interface ChatContext {
  type: 'RATER' | 'BOT_HUNTER' | 'VIDEO_CHAT' | 'DIRTY_TESTER';
  imageBase64?: string | null;
  raterResult?: AnalysisResult | null;
  botResult?: BotAnalysisResult | null;
  channelDetails?: ChannelDetails | null;
  videoResult?: VideoAnalysisResult | null;
  videoMetadata?: VideoMetadata | null;
  dirtyResult?: DirtyAnalysisResult | null;
}

export const sendChatMessage = async (
  history: ChatMessage[],
  newMessage: string,
  context: ChatContext
): Promise<string> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();
  const contents = [];

  let systemPromptText = "You are a Gen Z social media manager. Be helpful but snarky. ALWAYS be specific.";
  let initialUserParts = [];

  if (context.type === 'RATER' && context.raterResult && context.imageBase64) {
    const metaTitle = context.videoMetadata?.title ? `Title: "${sanitizeString(context.videoMetadata.title)}"` : "Title: Unknown";
    const metaDesc = context.videoMetadata?.description ? `Desc: "${sanitizeString(context.videoMetadata.description.substring(0, 300))}..."` : "";

    const normalContext = `
      You are a sarcastic, funny YouTube expert named "RiceDroid".
      
      CONTEXT OF ANALYSIS:
      ${metaTitle}
      ${metaDesc}
      Scores: ${JSON.stringify(context.raterResult.scores)}
      Verdict: "${sanitizeString(context.raterResult.summary)}"
      Key Fixes: ${JSON.stringify(context.raterResult.suggestions)}
      Sus Status: ${context.raterResult.isSus ? "YES" : "NO"}.
      
      USER QUESTION: "${sanitizeString(newMessage)}"
      
      CRITICAL INSTRUCTION: 
      - Do NOT give generic advice like "make it pop". 
      - You MUST reference specific visual elements from the image.
      - Connect the metadata title to the image visuals.
      - Be brutally honest but precise. Use slang/internet humor.
    `;
    initialUserParts = [
      { inlineData: { mimeType: 'image/jpeg', data: context.imageBase64 } },
      { text: normalContext }
    ];
  
  } else if (context.type === 'BOT_HUNTER' && context.botResult && context.channelDetails) {
    systemPromptText = "You are a suspicious, cynical investigator named 'Deckard'. You hunt bots.";
    const botContext = `
      You are analyzing a YouTube Channel for bot activity.
      
      TARGET INFO:
      Channel: "${sanitizeString(context.channelDetails.title)}"
      Subs: ${context.channelDetails.subscriberCount} | Videos: ${context.channelDetails.videoCount}
      
      ANALYSIS FINDINGS:
      Verdict: ${context.botResult.verdict} (${context.botResult.botScore}% Bot Probability)
      Specific Evidence Found: ${JSON.stringify(context.botResult.evidence)}
      Summary: "${sanitizeString(context.botResult.summary)}"
      
      USER QUESTION: "${sanitizeString(newMessage)}"
    `;
    initialUserParts = [
      { text: botContext }
    ];

  } else if (context.type === 'VIDEO_CHAT' && context.videoMetadata) {
      systemPromptText = "You are 'CouchBuddy', a friend watching this video with the user.";
      const vidContext = `
        We are "watching" a YouTube Video via its metadata.
        Title: "${sanitizeString(context.videoMetadata.title)}"
        Channel: "${sanitizeString(context.videoMetadata.channelTitle)}"
        Description: "${sanitizeString(context.videoMetadata.description?.substring(0, 800))}"
        Tags: "${context.videoMetadata.keywords?.join(', ')}"
        
        Initial Vibe Check: ${context.videoResult?.summary}
        Tone: ${context.videoResult?.tone}

        User Input: "${sanitizeString(newMessage)}"

        Instructions:
        - Act like you are watching it right now.
        - If the user asks about a specific visual moment you can't see, joke about it or make an educated guess based on description.
        - Be funny, opinionated, and use internet slang.
      `;
      initialUserParts = [
          { text: vidContext }
      ];
  } else if (context.type === 'DIRTY_TESTER' && context.dirtyResult) {
      systemPromptText = "You are an immature teenager who finds 'that's what she said' jokes in everything.";
      const dirtyContext = `
        We are analyzing a thumbnail and title for 'Dirty Mind' potential.
        
        Verdict: ${context.dirtyResult.verdict} (${context.dirtyResult.dirtyScore}% Dirty)
        Explanation: ${context.dirtyResult.explanation}
        
        User Input: "${sanitizeString(newMessage)}"
      `;
      initialUserParts = [{ text: dirtyContext }];
  }

  if (history.length === 0) {
    contents.push({
      role: 'user',
      parts: initialUserParts
    });
  } else {
    let contextMsg = "";
    if (context.type === 'RATER' && context.raterResult) {
       contextMsg = `Recall: Analyzing thumbnail "${sanitizeString(context.videoMetadata?.title || 'Unknown Video')}". Score: ${context.raterResult.scores.overall}/10.`;
       contents.push({
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: context.imageBase64 || '' } },
          { text: contextMsg }
        ]
      });
    } else if (context.type === 'BOT_HUNTER' && context.botResult) {
       contextMsg = `Recall: Analyzing channel "${sanitizeString(context.channelDetails?.title)}". Verdict: ${context.botResult.verdict}.`;
       contents.push({ role: 'user', parts: [{ text: contextMsg }]});
    } else if (context.type === 'VIDEO_CHAT' && context.videoMetadata) {
        contextMsg = `Recall: Discussing video "${sanitizeString(context.videoMetadata.title)}".`;
        contents.push({ role: 'user', parts: [{ text: contextMsg }]});
    } else if (context.type === 'DIRTY_TESTER') {
        contextMsg = `Recall: Dirty mind analysis. Score: ${context.dirtyResult?.dirtyScore}`;
        contents.push({ role: 'user', parts: [{ text: contextMsg }]});
    }

    history.forEach(msg => {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });
  }

  try {
    const response = (await withTimeout(ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        systemInstruction: systemPromptText,
        tools: [{ googleSearch: {} }]
      }
    }))) as GenerateContentResponse;

    return response.text || "I have no words.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Brain freeze. Try again.";
  }
};

export const analyzeBotProbability = async (
  channelDetails: ChannelDetails,
  videos: SearchResult[]
): Promise<BotAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();

  const prompt = `
    Analyze this YouTube channel data to detect if it is a HUMAN, a CYBORG (Human using Heavy AI tools), or an NPC FARM (Fully Automated Bot).
    
    CHANNEL INFO:
    Name: ${sanitizeString(channelDetails.title)}
    Description: ${sanitizeString(channelDetails.description)}
    Subs: ${channelDetails.subscriberCount}
    Videos: ${channelDetails.videoCount}
    
    RECENT VIDEOS (Last 15):
    ${videos.map(v => `- Title: "${sanitizeString(v.title)}" | Date: ${v.publishedAt}`).join('\n')}
    
    DETECT THESE PATTERNS:
    1. **Title Templating**: Are titles identical with 1 variable changed?
    2. **Upload Spam**: Are they uploading 5+ times a day?
    3. **Keyword Salad**: Does the description look like SEO vomit?
    4. **Low Effort**: Does it look like Reddit TTS or compilation spam?
    
    SCORING (0-100):
    0 = Authentic Human Vlogger.
    50 = High-Effort AI / Faceless Channel (The "Cyborg" Zone).
    100 = Soulless Content Farm / Bot.
    
    VERDICT:
    - HUMAN (0-39)
    - CYBORG (40-79)
    - NPC_FARM (80-100)
    
    RETURN RAW JSON ONLY.
    
    OUTPUT SCHEMA:
    {
       "botScore": number,
       "verdict": "HUMAN" | "CYBORG" | "NPC_FARM",
       "evidence": ["string", "string"],
       "summary": "string"
    }
  `;

  try {
    const response = (await withTimeout(ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            botScore: { type: Type.NUMBER },
            verdict: { type: Type.STRING, enum: ['HUMAN', 'CYBORG', 'NPC_FARM'] },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            summary: { type: Type.STRING }
          }
        }
      }
    }))) as GenerateContentResponse;
    
    if (!response.text) throw new Error("No response");
    return JSON.parse(cleanJsonString(response.text)) as BotAnalysisResult;
  } catch (e) {
    console.error("Bot analysis failed", e);
    throw e;
  }
};

export const analyzeDirtyMind = async (
  imageBase64: string,
  title: string
): Promise<DirtyAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();

  const prompt = `
    You are a Dirty Mind Detector. Your job is to analyze the combination of this YouTube Thumbnail and Video Title for double entendres, visual ambiguity, and "sus" baiting.
    
    CONTEXT:
    Title: "${sanitizeString(title)}"
    
    TASK:
    Rate how "Dirty" or "Sus" this thumbnail/title combo is. Creators often use innocent images with ambiguous titles (or vice versa) to trick dirty minds.
    
    SCORING (0-100):
    0 = Completely Innocent / Pure / Wholesome
    50 = Ambiguous / "Sus" if you squint / Clickbait Bait
    100 = Down Bad / Explicitly implied / "They knew what they were doing"
    
    VERDICT:
    - PURE (0-20)
    - SUS (21-60)
    - DOWN_BAD (61-90)
    - JAIL (91-100)
    
    Provide an explanation of WHY it's dirty (or why it's innocent).
    Provide innocent alternatives vs what a dirty mind sees.
  `;

  try {
    const response = (await withTimeout(ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dirtyScore: { type: Type.NUMBER },
            verdict: { type: Type.STRING, enum: ['PURE', 'SUS', 'DOWN_BAD', 'JAIL'] },
            explanation: { type: Type.STRING },
            alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }))) as GenerateContentResponse;
    
    if (!response.text) throw new Error("No response");
    return JSON.parse(cleanJsonString(response.text)) as DirtyAnalysisResult;
  } catch (e) {
    console.error("Dirty analysis failed", e);
    throw e;
  }
};
