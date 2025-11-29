import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeThumbnail = async (
  imageBase64: string, 
  mimeType: string = 'image/jpeg',
  metadata?: { title?: string | null, description?: string | null, keywords?: string[] | null }
): Promise<AnalysisResult> => {
  const modelId = "gemini-2.5-flash"; 

  let contextPrompt = "";
  if (metadata?.title) {
    contextPrompt += `\nVIDEO TITLE: "${metadata.title}"`;
  }
  if (metadata?.description) {
    contextPrompt += `\nVIDEO DESCRIPTION: "${metadata.description.substring(0, 500)}..."`;
  }
  if (metadata?.keywords && metadata.keywords.length > 0) {
    contextPrompt += `\nVIDEO KEYWORDS/TAGS: "${metadata.keywords.join(", ")}"`;
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
       - Example: Cur=10, Emo=9, Clar=9, Text=9 -> (4 + 2.7 + 1.8 + 0.9) = 9.4 -> 9.
       - Example: Cur=10, Emo=10, Clar=10, Text=8 -> (4 + 3 + 2 + 0.8) = 9.8 -> 10.

    OUTPUT INSTRUCTIONS:
      - isSus: Boolean.
      - susReason: If isSus is true, provide a short warning.
      - Summary: A 1-sentence verdict. Cite a SPECIFIC visual element.
      - Suggestions: 3 SPECIFIC, TECHNICAL fixes or compliments.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          },
          {
            text: normalPrompt
          }
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
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  imageBase64: string,
  history: ChatMessage[],
  newMessage: string,
  analysisContext: AnalysisResult
): Promise<string> => {
  const modelId = "gemini-2.5-flash";

  const contents = [];

  const normalContext = `
    You are a sarcastic, funny YouTube expert named "RiceDroid".
    You have analyzed this thumbnail.
    Scores: ${JSON.stringify(analysisContext.scores)}.
    Verdict: ${analysisContext.summary}.
    Sus Status: ${analysisContext.isSus ? "YES" : "NO"}.
    
    User Input: "${newMessage}"
    
    Reply in a short, punchy, slightly "dumb internet" style. Use slang. Be brutally honest but precise about technical details if asked.
  `;

  if (history.length === 0) {
    contents.push({
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: normalContext }
      ]
    });
  } else {
    // Reconstruct history with context
    const contextMsg = `I uploaded this thumbnail. You gave it a ${analysisContext.scores.overall}/10. Summary: ${analysisContext.summary}`;
    
    contents.push({
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: contextMsg }
      ]
    });
    
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
    const response = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        systemInstruction: "You are a Gen Z social media manager who is tired. Be helpful but snarky."
      }
    });

    return response.text || "I have no words.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Brain freeze. Try again.";
  }
};