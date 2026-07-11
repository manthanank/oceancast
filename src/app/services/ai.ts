import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';

export interface ChatMessage {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AIService {
  private http = inject(HttpClient);

  // Signals to track chat history and request loading state reactively
  public history = signal<ChatMessage[]>([]);
  public isLoading = signal<boolean>(false);
  private messageCounter = 0;

  /**
   * Post user question to backend and record response in-memory.
   */
  public sendMessage(message: string, lat: number, lon: number): void {
    if (!message.trim()) return;

    // 1. Append User Message
    const userMsg: ChatMessage = {
      id: ++this.messageCounter,
      sender: 'user',
      text: message,
      timestamp: new Date(),
    };
    this.history.update(list => [...list, userMsg]);

    // 2. Set loading spinner state
    this.isLoading.set(true);

    // 3. Post to API
    this.http.post<{ reply: string }>('/api/ai/chat', { message, lat, lon }).subscribe({
      next: (res) => {
        const aiMsg: ChatMessage = {
          id: ++this.messageCounter,
          sender: 'ai',
          text: res.reply,
          timestamp: new Date(),
        };
        this.history.update(list => [...list, aiMsg]);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('AI chat retrieval error:', err);
        const errMsg: ChatMessage = {
          id: ++this.messageCounter,
          sender: 'ai',
          text: 'Unable to get AI response. Please try again.',
          timestamp: new Date(),
        };
        this.history.update(list => [...list, errMsg]);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Reset in-memory chat session history.
   */
  public clearChat(): void {
    this.history.set([]);
    this.messageCounter = 0;
  }
}
