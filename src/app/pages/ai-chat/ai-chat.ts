import { Component, ChangeDetectionStrategy, inject, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AIService } from '../../services/ai';
import { LocationService } from '../../services/location';

@Component({
  selector: 'app-ai-chat',
  imports: [ReactiveFormsModule],
  templateUrl: './ai-chat.html',
  styleUrl: './ai-chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChat {
  private fb = inject(FormBuilder);
  public aiService = inject(AIService);
  public locationService = inject(LocationService);
  private meta = inject(Meta);

  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef;

  public chatForm: FormGroup = this.fb.group({
    message: ['', [Validators.required]],
  });

  // Dynamic suggestion chips array
  public suggestions = [
    { label: '🏍 Ride Today?', prompt: 'Can I go for a motorcycle ride today? Assess wind and temperature.' },
    { label: '🏄 Surf Today?', prompt: 'How are the wave conditions today? Is it good for surfing?' },
    { label: '🎣 Fishing Today?', prompt: 'Are the wave and wind conditions favorable for dock fishing today?' },
    { label: '📸 Photography?', prompt: 'Is the weather good for photography? When is the best visibility?' },
    { label: '🌅 Best Time Today?', prompt: 'What is the absolute best time today to head outdoors based on the weather?' }
  ];

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Ask OceanCast AI weather assistant about outdoor activity feasibility, tide cycles, wind speeds, and wave reports.',
    });

    // Auto-scroll chat window when new messages arrive
    effect(() => {
      const messages = this.aiService.history();
      if (messages.length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  /**
   * Submit custom chat prompt message to Gemini.
   */
  public onSubmit(): void {
    if (this.chatForm.invalid || this.aiService.isLoading()) return;

    const message = this.chatForm.value.message;
    const location = this.locationService.selectedLocation();

    this.aiService.sendMessage(message, location.lat, location.lon);
    this.chatForm.reset();
  }

  /**
   * Submit prompt message automatically when suggestion chip is clicked.
   */
  public selectSuggestion(prompt: string): void {
    if (this.aiService.isLoading()) return;
    const location = this.locationService.selectedLocation();
    this.aiService.sendMessage(prompt, location.lat, location.lon);
  }

  /**
   * Truncate in-memory chat session history.
   */
  public clearChatHistory(): void {
    this.aiService.clearChat();
  }

  private scrollToBottom(): void {
    try {
      this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
    } catch (err) {
      // Ignore scroll failures
    }
  }
}
