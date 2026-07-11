import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-1.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('Warning: GEMINI_API_KEY is not defined in environment variables. Running in Mock/Demo mode.');
    }
  }

  /**
   * Generates a context-aware response based on weather and marine conditions
   */
  public async askQuestion(
    message: string,
    weatherContext: string
  ): Promise<string> {
    try {
      if (!this.genAI) {
        return this.getMockResponse(message, weatherContext);
      }

      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      const prompt = `
You are OceanCast AI, an expert marine, weather, and outdoor activity assistant.
You are helping a user make decisions about outdoor activities (such as riding, surfing, fishing, photography, etc.) based on the following current weather and ocean conditions.

---
CURRENT CONDITIONS CONTEXT:
${weatherContext}
---

USER QUESTION:
"${message}"

INSTRUCTIONS:
1. Provide a direct, highly useful, and friendly answer.
2. Rely on the provided weather/marine context for your recommendation.
3. Be concise (limit to 3-5 sentences).
4. If the conditions are dangerous (e.g. wave height > 3m or wind speed > 30km/h), warn the user explicitly.
5. Suggest the best time or course of action based on the data.
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return text.trim();
    } catch (error: any) {
      console.error('Gemini API call failed, falling back to mock:', error);
      return this.getMockResponse(message, weatherContext);
    }
  }

  /**
   * Provides a fallback response using local heuristic rules if the Gemini API key is missing or fails
   */
  private getMockResponse(message: string, weatherContext: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Parse weatherContext to pull rough metrics for fallback response
    const tempMatch = weatherContext.match(/Temperature: ([\d.-]+)/);
    const windMatch = weatherContext.match(/Wind Speed: ([\d.-]+)/);
    const waveMatch = weatherContext.match(/Wave Height: ([\d.-]+)/);
    
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 22;
    const wind = windMatch ? parseFloat(windMatch[1]) : 10;
    const wave = waveMatch ? parseFloat(waveMatch[1]) : 0.5;

    let response = "Based on the conditions: ";

    if (lowerMessage.includes('ride') || lowerMessage.includes('motorcycle') || lowerMessage.includes('bike')) {
      if (wind > 25) {
        response += `It is currently quite windy (${wind} km/h), which is not ideal for riding. I recommend waiting for the winds to settle down.`;
      } else if (temp < 10) {
        response += `It is currently quite cold (${temp}°C) for a ride. If you go, make sure to layer up!`;
      } else {
        response += `Yes, conditions look great for a ride today! The weather is pleasant (${temp}°C) and wind is moderate (${wind} km/h). Leaving before 10 AM is recommended.`;
      }
    } else if (lowerMessage.includes('surf')) {
      if (wave < 0.5) {
        response += `The wave height is very low (${wave}m), which isn't suitable for surfing. You might want to wait for a stronger swell.`;
      } else if (wave > 3) {
        response += `Warning: Wave heights are dangerously high (${wave}m). Please stay safe on the shore!`;
      } else {
        response += `Great day for surfing! We have a healthy swell of ${wave}m. Enjoy the waves!`;
      }
    } else if (lowerMessage.includes('fish') || lowerMessage.includes('fishing')) {
      if (wind > 20 || wave > 2.0) {
        response += `Conditions are a bit rough (wind ${wind} km/h, waves ${wave}m) for a stable fishing trip. High tide or calmer hours are recommended.`;
      } else {
        response += `It's a wonderful day for fishing! Mild winds (${wind} km/h) and calm waters. Early morning or around tide changes will be your best bet.`;
      }
    } else if (lowerMessage.includes('photo') || lowerMessage.includes('photography') || lowerMessage.includes('camera')) {
      response += `It's a beautiful day for photography! Clear visibility and calm weather (${temp}°C) makes it perfect for catching natural landscapes. Shoot during golden hour!`;
    } else {
      response += `Currently it's ${temp}°C with ${wind} km/h winds and waves at ${wave}m. Let me know if you need specific advice for riding, surfing, or fishing!`;
    }

    return response;
  }
}
