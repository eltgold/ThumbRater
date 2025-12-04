import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, BotAnalysisResult, VideoAnalysisResult, ChannelDetails, SearchResult, VideoMetadata, DirtyAnalysisResult, XAnalysisResult } from '../types';

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const cleanJsonString = (str: string): string => {
  return str.replace(/```json\n?|```/g, '').trim();
};

const sanitizeString = (str?: string | null): string => {
  if (!str) return "";
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
    Analyze this YouTube thumbnail as an OBJECTIVE, "dumb-smart" YouTube algorithm expert known as PotatoBot. You speak in slang, but your technical analysis is PhD level.
    
    METADATA EXTRACTED FROM LINK:
    ${contextPrompt}
    
    PHASE 1: SUS CHECK (SAFETY FILTER) - BE ACCURATE
    Analyze if the image is GENUINELY "SUS" (Explicit, Fetish, Gore, or Age-Restricted).
    - VERDICT: Only set isSus = true if it crosses the line into "Softcore" or "NSFW". If it's just "Clickbait Sexy", it is false.

    PHASE 2: SCORING (STRICT MATHEMATICAL FAIRNESS)
    Score 0-10. DO NOT BE AFRAID TO GIVE A 10.
    
    1. Clarity (20%): How quickly can I understand the subject?
    2. Curiosity (40%): Do I have a burning question? (Information Gap)
    3. Text/Hierarchy (10%): Readability & Contrast.
    4. Emotion/Vibe (30%): Facial expression, lighting mood.
    5. Overall (Calculated): (Curiosity * 0.4) + (Emotion * 0.3) + (Clarity * 0.2) + (Text * 0.1). Round to Integer.
    
    OUTPUT INSTRUCTIONS:
      - Return ONLY raw JSON.
      - isSus: Boolean.
      - susReason: Short warning if true.
      - Summary: 1-sentence verdict.
      - Suggestions: 3 SPECIFIC fixes.
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

export const analyzeBotProbability = async (
  channelDetails: ChannelDetails,
  recentVideos: SearchResult[]
): Promise<BotAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();

  const videoData = recentVideos.map(v => `- ${v.title} (${v.publishedAt})`).join("\n");
  
  const prompt = `
    You are a "Bot Hunter" AI. Analyze this YouTube channel to see if it's a HUMAN, a CYBORG (Assisted), or an NPC FARM (Soulless/AI Gen).
    
    CHANNEL DATA:
    Name: ${channelDetails.title}
    Subs: ${channelDetails.subscriberCount}
    Videos: ${channelDetails.videoCount}
    Desc: ${channelDetails.description}
    
    RECENT VIDEOS:
    ${videoData}
    
    CRITERIA:
    - Generic stock titles?
    - Spammy frequency?
    - Repetitive thumbnails/topics?
    - AI-generated descriptions?
    
    OUTPUT JSON:
    - botScore: 0 (Pure Human) to 100 (Total Bot).
    - verdict: 'HUMAN', 'CYBORG', or 'NPC_FARM'.
    - evidence: Array of 3 strings explaining why.
    - summary: A brutal 1-sentence roast or compliment.
  `;

  const response = (await withTimeout(ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
         type: Type.OBJECT,
         properties: {
             botScore: { type: Type.NUMBER },
             verdict: { type: Type.STRING, enum: ["HUMAN", "CYBORG", "NPC_FARM"] },
             evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
             summary: { type: Type.STRING }
         }
      }
    }
  }))) as GenerateContentResponse;

  if (!response.text) throw new Error("No response");
  return JSON.parse(cleanJsonString(response.text)) as BotAnalysisResult;
};

export const analyzeDirtyMind = async (
  imageBase64: string,
  title: string
): Promise<DirtyAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();

  const prompt = `
    You are the "Dirty Tester". Your job is to analyze images and titles for "Accidental Innuendo" vs "Deliberate Bait".
    
    CONTEXT:
    Video Title: "${sanitizeString(title)}"
    
    TASK:
    Look at the image. Does it look like something else? (e.g. A geode that looks like a body part, a mushroom that looks wrong).
    
    OUTPUT JSON:
    - dirtyScore: 0 (Pure) to 100 (Jail).
    - verdict: 'PURE' (Innocent), 'SUS' (Suggestive), 'DOWN_BAD' (Intentional Bait), 'JAIL' (Too far).
    - explanation: Why is it dirty? (Be funny).
    - alternatives: Array of 2 strings. [0] = The Innocent Reality (What it actually is), [1] = The Dirty Illusion (What it looks like).
  `;

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
             verdict: { type: Type.STRING, enum: ["PURE", "SUS", "DOWN_BAD", "JAIL"] },
             explanation: { type: Type.STRING },
             alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
         }
      }
    }
  }))) as GenerateContentResponse;

  if (!response.text) throw new Error("No response");
  return JSON.parse(cleanJsonString(response.text)) as DirtyAnalysisResult;
};

export const analyzeXPost = async (
  url: string,
  imageBase64?: string | null
): Promise<XAnalysisResult> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();

  const prompt = `
    You are the "Based/Cringe Detector". Analyze this X (Twitter) post context.
    
    URL: ${url}
    ${imageBase64 ? "IMAGE PROVIDED: Yes" : "IMAGE PROVIDED: No (Analyze URL text/context if possible, otherwise roast the link)"}
    
    Determine if this post is BASED (Cool, Truthful, Funny) or CRINGE (Embarrassing, Wrong, Lame).
    Also predict if a Community Note is needed.
    
    OUTPUT JSON:
    - basedScore: 0-10.
    - cringeScore: 0-10.
    - ratioRisk: 0-100 (Probability of getting ratioed).
    - verdict: A short 2-3 word slang verdict (e.g. "MEGA BASED", "L + RATIO", "COOKED").
    - communityNotePrediction: null if fine, or a string containing the text of a hypothetical community note debunking it.
  `;

  const parts = [{ text: prompt }];
  if (imageBase64) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } } as any);
  }

  const response = (await withTimeout(ai.models.generateContent({
    model: modelId,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
         type: Type.OBJECT,
         properties: {
             basedScore: { type: Type.NUMBER },
             cringeScore: { type: Type.NUMBER },
             ratioRisk: { type: Type.NUMBER },
             verdict: { type: Type.STRING },
             communityNotePrediction: { type: Type.STRING, nullable: true }
         }
      }
    }
  }))) as GenerateContentResponse;

  if (!response.text) throw new Error("No response");
  return JSON.parse(cleanJsonString(response.text)) as XAnalysisResult;
};

export interface ChatContext {
  type: 'RATER' | 'BOT_HUNTER' | 'VIDEO_CHAT' | 'DIRTY_TESTER' | 'X_RATER';
  imageBase64?: string | null;
  raterResult?: AnalysisResult | null;
  botResult?: BotAnalysisResult | null;
  channelDetails?: ChannelDetails | null;
  videoResult?: VideoAnalysisResult | null;
  videoMetadata?: VideoMetadata | null;
  dirtyResult?: DirtyAnalysisResult | null;
  xResult?: XAnalysisResult | null;
  xUrl?: string;
}

export const sendChatMessage = async (
  history: ChatMessage[],
  newMessage: string,
  context: ChatContext
): Promise<string> => {
  const modelId = "gemini-2.5-flash";
  const ai = getAiClient();
  
  let systemPromptText = "You are PotatoBot. Helpful but snarky.";
  let parts: any[] = [];

  if (context.type === 'RATER' && context.raterResult) {
      const metaTitle = context.videoMetadata?.title ? `Title: "${sanitizeString(context.videoMetadata.title)}"` : "Title: Unknown";
      parts.push({ text: `
        ROLE: PotatoBot (YouTube Thumbnail Critic).
        CONTEXT:
        ${metaTitle}
        Verdict: ${context.raterResult.summary}
        Scores: ${JSON.stringify(context.raterResult.scores)}
        
        User asks: "${newMessage}"
        
        Be specific about visual elements.
      `});
      if (context.imageBase64) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: context.imageBase64 } });
      }

  } else if (context.type === 'BOT_HUNTER' && context.botResult) {
      parts.push({ text: `
        ROLE: Bot Hunter.
        CONTEXT:
        Channel: ${context.channelDetails?.title}
        Bot Score: ${context.botResult.botScore}
        Verdict: ${context.botResult.verdict}
        Evidence: ${JSON.stringify(context.botResult.evidence)}
        
        User asks: "${newMessage}"
        
        Roast the channel if it's a bot. Be skeptical.
      `});

  } else if (context.type === 'DIRTY_TESTER' && context.dirtyResult) {
      parts.push({ text: `
        ROLE: Dirty Mind Detector.
        CONTEXT:
        Title: ${context.videoMetadata?.title || "Unknown"}
        Dirty Score: ${context.dirtyResult.dirtyScore}
        Verdict: ${context.dirtyResult.verdict}
        Explanation: ${context.dirtyResult.explanation}
        
        User asks: "${newMessage}"
        
        Keep the jokes coming.
      `});
      if (context.imageBase64) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: context.imageBase64 } });
      }

  } else if (context.type === 'X_RATER' && context.xResult) {
      parts.push({ text: `
        ROLE: Based/Cringe Arbiter.
        CONTEXT:
        URL: ${context.xUrl}
        Based Score: ${context.xResult.basedScore}
        Cringe Score: ${context.xResult.cringeScore}
        Verdict: ${context.xResult.verdict}
        
        User asks: "${newMessage}"
        
        Speak in twitter slang.
      `});

  } else {
      // Fallback
      parts.push({ text: `User: ${newMessage}` });
  }

  // Append history
  // Note: For simplicity in this stateless call, we are summarizing history or just taking the last prompt + context.
  // Ideally, you'd format the whole history. Here we just rely on the immediate context prompt constructed above.

  try {
      const response = await ai.models.generateContent({
          model: modelId,
          contents: { parts }
      });
      return response.text || "I am speechless.";
  } catch (e) {
      console.error(e);
      return "Error contacting PotatoBot HQ.";
  }
};