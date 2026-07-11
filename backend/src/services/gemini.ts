import { GoogleGenAI } from '@google/genai';
import { Setting } from '../models/Setting';

export class GeminiService {
  private genAI: GoogleGenAI | null = null;
  private modelName = 'gemini-3.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
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

      // Query database for custom admin instructions
      let systemPrompt = 'You are OceanCast AI, an expert marine, weather, and outdoor activity assistant. You are helping a user make decisions about outdoor activities (such as riding, surfing, fishing, photography, etc.) based on the following current weather and ocean conditions.';
      try {
        const promptSetting = await Setting.findOne({ key: 'gemini_system_prompt' });
        if (promptSetting && typeof promptSetting.value === 'string' && promptSetting.value.trim() !== '') {
          systemPrompt = promptSetting.value;
        }
      } catch (err) {
        console.warn('Failed to query custom prompt setting, using default:', err);
      }

      const prompt = `
${systemPrompt}

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

      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      const text = result.text || '';
      return text.trim();
    } catch (error: any) {
      console.error('Gemini API call failed, falling back to mock:', error);
      return this.getMockResponse(message, weatherContext);
    }
  }

  /**
   * Generates a structured daily angler briefing report
   */
  public async generateAnglerReport(
    locationName: string,
    weatherContext: string
  ): Promise<string> {
    try {
      if (!this.genAI) {
        return this.getMockAnglerReport(locationName, weatherContext);
      }

      const prompt = `
You are OceanCast's Master Angler Assistant, a highly experienced fishing guide and marine safety officer.
Your task is to write a detailed, professional, and structured "Daily Angler Briefing Report" for a fisherman planning a trip to "${locationName}".

Rely on the following current weather, wave, and tide conditions context for your analysis:
---
${weatherContext}
---

INSTRUCTIONS & STRUCTURE:
1. Write in a clear, non-technical plain language but with professional formatting. Use markdown headings, bullet points, and clean lists.
2. Structure the report precisely as follows:
   - **Executive Advisory (Rating: X/10)**: Provide a summary of how favorable conditions are. Warn explicitly if winds, swell, or tide conditions present safety hazards.
   - **Target Species Recommendation**: Recommend 2-3 local species that are most active or favorable to target under these specific conditions. Explain why.
   - **Rigging & Tackle Setup**: Suggest specific rigs, bait, artificial lures, line test weight, and rod action appropriate for these conditions.
   - **Solunar & Tide Window Strategy**: Give precise tactical instructions on what hours to fish.
3. Do not add long introductions or conversational filler. Start directly with the Executive Advisory. Keep it concise enough to fit on a single page.
`;

      const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      return (result.text || '').trim();
    } catch (error: any) {
      console.error('Gemini report generation failed, falling back to mock:', error);
      return this.getMockAnglerReport(locationName, weatherContext);
    }
  }

  /**
   * Provides a fallback response using local heuristic rules if the Gemini API key is missing or fails
   */
  private getMockAnglerReport(locationName: string, weatherContext: string): string {
    const tempMatch = weatherContext.match(/Temperature: ([\d.-]+)/);
    const windMatch = weatherContext.match(/Wind Speed: ([\d.-]+)/);
    const waveMatch = weatherContext.match(/Wave Height: ([\d.-]+)/);
    
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 22;
    const wind = windMatch ? parseFloat(windMatch[1]) : 10;
    const wave = waveMatch ? parseFloat(waveMatch[1]) : 0.5;

    const rating = wave > 2.0 || wind > 25 ? 4 : (wave < 0.3 ? 6 : 8);

    return `# Daily Angler Briefing: ${locationName}

## Executive Advisory (Rating: ${rating}/10)
Conditions are currently ${rating >= 8 ? 'excellent' : (rating >= 6 ? 'fair' : 'poor/hazardous')} for fishing. We have a temperature of ${temp}°C, winds at ${wind} km/h, and waves at ${wave}m. ${wave > 2.0 ? '🚨 WARNING: Rough wave swells detected. Pier and shore casting is dangerous.' : 'Overall, calm sea conditions provide steady, safe casting.'}

## Target Species Recommendation
- **Snapper & Seabass**: Favorable due to the mild wave action of ${wave}m stir-up near rocky dropoffs.
- **Flathead / Flounder**: Highly active along sandy bottoms. Seek out tidal channels as current moves.

## Rigging & Tackle Setup
- **Rig**: Running sinker rig with a 2/0 hook for live bait presentation.
- **Bait**: Freshly caught sand worms, squid strips, or pilchards.
- **Artificial Lures**: 3-inch soft plastics in pearl or motor-oil colors on a 1/4oz jig head. 

## Solunar & Tide Window Strategy
- **Tide Plan**: Target the period 1.5 hours before and after the tide transitions.
- **Optimal Hours**: Early morning and around peak high water phases. Use the tides chart to identify your local slack water times.`;
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

