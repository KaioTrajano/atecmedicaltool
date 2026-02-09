
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SearchIntent } from "../types";

export const analyzeSearchIntent = async (query: string): Promise<SearchIntent> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this medical equipment search query: "${query}". Extract keywords, price constraints, and category. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of relevant search keywords in Portuguese."
            },
            minPrice: { type: Type.NUMBER },
            maxPrice: { type: Type.NUMBER },
            category: { type: Type.STRING },
            sentiment: { type: Type.STRING }
          },
          required: ["keywords"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SearchIntent;
    }
    return { keywords: query.split(' ') };
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { keywords: query.split(' ') };
  }
};

export interface ExtractedItem {
  name: string;
  quantity: number;
}

export const extractShoppingItems = async (text: string): Promise<ExtractedItem[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract a list of surgical/medical instruments and supplies from this text: "${text}". 
      
      CRITICAL INSTRUCTIONS:
      1. IGNORE greetings, sign-offs, and conversational phrases.
      2. PRESERVE specific names like "Clips Mayo", "Afastador Sen Muller", "Pinça Kelly". Do NOT remove words like "Clips" or "Mayo".
      3. For each item, extract PRODUCT NAME and QUANTITY.
      4. If a number follows a product name (e.g., "Mayo clips 2"), that is the quantity.
      5. If no quantity is specified, return 1.
      6. If multiple items are listed, return each one.
      
      Format: JSON array of objects with "name" and "quantity".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Full descriptive name of the product" },
              quantity: { type: Type.NUMBER, description: "Number of units requested" }
            },
            required: ["name", "quantity"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ExtractedItem[];
    }
    return text.split(/[\n,]+/).map(s => ({ name: s.trim(), quantity: 1 })).filter(s => s.name.length > 0);
  } catch (e) {
    console.error("Failed to extract items", e);
    return text.split(/[\n,]+/).map(s => ({ name: s.trim(), quantity: 1 })).filter(s => s.name.length > 0);
  }
};
