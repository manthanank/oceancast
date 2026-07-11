import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { LocationService, SavedLocation } from '../../services/location';
import { ToastService } from '../../services/toast';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-angler-report',
  imports: [Spinner, FormsModule],
  templateUrl: './angler-report.html',
  styleUrl: './angler-report.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnglerReport implements OnInit {
  private http = inject(HttpClient);
  private meta = inject(Meta);
  private toastService = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  public locationService = inject(LocationService);

  public isLoading = signal<boolean>(false);
  public selectedLocationId = signal<string>('');
  public rawReport = signal<string>('');
  public formattedReport = signal<SafeHtml>('');
  public selectedDate = new Date().toLocaleDateString();

  constructor() {
    this.meta.updateTag({
      name: 'description',
      content: 'Generate a printable Daily Angler Briefing customized for your coordinates. Get weather summaries, target species, tackle setups, and tactical solunar windows.',
    });
  }

  public ngOnInit(): void {
    this.locationService.fetchLocations().subscribe({
      next: (locs) => {
        if (locs.length > 0) {
          const current = this.locationService.selectedLocation();
          const match = locs.find(l => l.lat === current.lat && l.lon === current.lon);
          if (match && match._id) {
            this.selectedLocationId.set(match._id);
          } else if (locs[0]._id) {
            this.selectedLocationId.set(locs[0]._id);
          }
        }
      }
    });
  }

  /**
   * Action to request Gemini to compile the custom briefing report.
   */
  public generateReport(): void {
    const locId = this.selectedLocationId();
    if (!locId) {
      this.toastService.show('Please select a saved spot to compile.', 'error');
      return;
    }

    const loc = this.locationService.savedLocations().find(l => l._id === locId);
    if (!loc) return;

    this.isLoading.set(true);

    this.http.post<any>('/api/ai/angler-report', {
      locationName: loc.name,
      lat: loc.lat,
      lon: loc.lon
    }).subscribe({
      next: (res) => {
        if (res && res.report) {
          this.rawReport.set(res.report);
          this.formattedReport.set(this.parseMarkdown(res.report));
          this.toastService.show('Angler briefing generated!', 'success');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to generate report', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Triggers the local native print layout utility.
   */
  public printReport(): void {
    window.print();
  }

  /**
   * Simple regex markdown-to-html converter to display structured output cleanly.
   */
  private parseMarkdown(md: string): SafeHtml {
    let html = md
      // Escaping HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-slate-900 border-b-2 border-slate-900 pb-2 mb-6 mt-2">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-md font-extrabold text-slate-850 mt-5 mb-3 uppercase tracking-wide border-b border-slate-300 pb-1">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-800 mt-4 mb-2">$1</h3>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      // List items
      .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 text-xs py-0.5">$1</li>')
      // Clean lists groupings
      .replace(/<\/li>\s*<li/g, '</li><li')
      // Newlines to breaks
      .replace(/\n/g, '<br/>');

    // Wrap list items in ul blocks if they exist
    html = html.replace(/(<li.*<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
