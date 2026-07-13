import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed, NgZone, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ToastService } from '../../services/toast';
import { AuthService } from '../../services/auth';
import { Spinner } from '../../components/spinner/spinner';
import type * as L from 'leaflet';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, Spinner, DatePipe, DecimalPipe],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private toastService = inject(ToastService);
  public authService = inject(AuthService);

  private zone = inject(NgZone);

  // Tab management
  public activeTab = signal<'users' | 'prompt' | 'presets' | 'announcement' | 'thresholds' | 'logs' | 'backup' | 'map'>('users');

  // Admin states
  public users = signal<any[]>([]);
  public stats = signal<any | null>(null);
  public systemPrompt = signal<string>('');
  public presets = signal<any[]>([]);
  public auditLogs = signal<any[]>([]);

  // Search & Filter state signals
  public searchQuery = signal<string>('');
  public roleFilter = signal<string>('all');

  // Computed signal to filter users dynamically
  public filteredUsers = computed(() => {
    const list = this.users();
    const query = this.searchQuery().toLowerCase().trim();
    const role = this.roleFilter();

    return list.filter((u) => {
      const matchesSearch =
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query);
      const matchesRole = role === 'all' || u.role === role;
      return matchesSearch && matchesRole;
    });
  });

  // Announcement state
  public announcementText = signal<string>('');
  public announcementActive = signal<boolean>(false);

  // Thresholds state
  public surfWaveMin = signal<number>(0.5);
  public surfWindMax = signal<number>(22);
  public rideWindMax = signal<number>(20);
  public rideTempMin = signal<number>(15);
  public fishWaveMax = signal<number>(1.5);
  public fishWindMax = signal<number>(15);
  
  public isLoading = signal<boolean>(false);
  public isSaving = signal<boolean>(false);

  // Selected preset for interactive radar display
  public activeRadarPreset = signal<any | null>(null);

  // Map Intelligence signals
  public mapLocations = signal<any[]>([]);
  public topLocations = signal<any[]>([]);
  public mapStats = signal<{ totalLocations: number; uniqueUsers: number; countryClusters: number; mostActiveRegion: string }>({
    totalLocations: 0, uniqueUsers: 0, countryClusters: 0, mostActiveRegion: '—'
  });
  public mapLayerMode = signal<'standard' | 'satellite' | 'topo'>('standard');
  public showHeatmap = signal<boolean>(false);
  public showClusters = signal<boolean>(true);
  private leafletMap: any = null;
  private tileLayer: any = null;
  private markerLayer: any = null;
  private heatLayer: any = null;
  private mapInitialized = false;

  // Preset location form
  public presetForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    lat: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
    lon: ['', [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  // Thresholds FormGroup
  public thresholdsForm: FormGroup = this.fb.group({
    surfWaveMin: [0.5, [Validators.required, Validators.min(0)]],
    surfWindMax: [22, [Validators.required, Validators.min(0)]],
    rideWindMax: [20, [Validators.required, Validators.min(0)]],
    rideTempMin: [15, [Validators.required]],
    fishWaveMax: [1.5, [Validators.required, Validators.min(0)]],
    fishWindMax: [15, [Validators.required, Validators.min(0)]],
  });

  // Compute 2D coordinate points for Featured Presets Radar Map
  public radarPoints = computed(() => {
    const list = this.presets();
    if (list.length === 0) return [];

    const lats = list.map((p) => p.lat);
    const lons = list.map((p) => p.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat || 1.0;
    const lonRange = maxLon - minLon || 1.0;

    return list.map((p) => {
      // Map presets on a 320x320 radar viewport grid
      const x = 40 + ((p.lon - minLon) / lonRange) * 320;
      const y = 360 - ((p.lat - minLat) / latRange) * 320; // Flip vertical axis
      return { name: p.name, x, y, lat: p.lat, lon: p.lon };
    });
  });

  public ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user && user.role === 'admin') {
      this.fetchTabDetails('users');
    }
  }

  /**
   * Set active tab and trigger dynamic fetch logic.
   */
  public selectTab(tab: 'users' | 'prompt' | 'presets' | 'announcement' | 'thresholds' | 'logs' | 'backup' | 'map'): void {
    this.activeTab.set(tab);
    this.fetchTabDetails(tab);
    // Re-init map after angular renders the container
    if (tab === 'map') {
      setTimeout(() => this.initMap(), 150);
    }
  }

  private fetchTabDetails(tab: string): void {
    this.isLoading.set(true);

    if (tab === 'users') {
      this.http.get<any[]>('/api/admin/users').subscribe({
        next: (res) => {
          this.users.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'prompt') {
      this.http.get<any>('/api/admin/prompt').subscribe({
        next: (res) => {
          this.systemPrompt.set(res.prompt);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'presets') {
      this.http.get<any[]>('/api/admin/presets').subscribe({
        next: (res) => {
          this.presets.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'announcement') {
      this.http.get<any>('/api/admin/announcement').subscribe({
        next: (res) => {
          this.announcementText.set(res.text);
          this.announcementActive.set(res.active);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'thresholds') {
      this.http.get<any>('/api/admin/thresholds').subscribe({
        next: (res) => {
          this.surfWaveMin.set(res.surf?.waveMin || 0.5);
          this.surfWindMax.set(res.surf?.windMax || 22);
          this.rideWindMax.set(res.ride?.windMax || 20);
          this.rideTempMin.set(res.ride?.tempMin || 15);
          this.fishWaveMax.set(res.fish?.waveMax || 1.5);
          this.fishWindMax.set(res.fish?.windMax || 15);

          this.thresholdsForm.setValue({
            surfWaveMin: res.surf?.waveMin || 0.5,
            surfWindMax: res.surf?.windMax || 22,
            rideWindMax: res.ride?.windMax || 20,
            rideTempMin: res.ride?.tempMin || 15,
            fishWaveMax: res.fish?.waveMax || 1.5,
            fishWindMax: res.fish?.windMax || 15,
          });
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'logs') {
      this.http.get<any[]>('/api/admin/audit-logs').subscribe({
        next: (res) => {
          this.auditLogs.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
    } else if (tab === 'backup') {
      this.isLoading.set(false);
    } else if (tab === 'map') {
      this.http.get<any>('/api/admin/map-data').subscribe({
        next: (res) => {
          this.mapLocations.set(res.locations || []);
          this.topLocations.set([...(res.locations || [])].sort((a, b) => b.saveCount - a.saveCount).slice(0, 20));
          this.mapStats.set(res.stats || { totalLocations: 0, uniqueUsers: 0, countryClusters: 0, mostActiveRegion: '—' });
          this.isLoading.set(false);
          setTimeout(() => this.initMap(), 200);
        },
        error: () => this.isLoading.set(false),
      });
    }
  }

  /**
   * Update active announcement broadcast banner.
   */
  public saveAnnouncementBroadcast(): void {
    this.isSaving.set(true);
    this.http.put('/api/admin/announcement', {
      text: this.announcementText(),
      active: this.announcementActive(),
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show('System announcement status updated', 'success');
      },
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * Save dynamic weather parametric score thresholds.
   */
  public saveThresholdParameters(): void {
    if (this.thresholdsForm.invalid) {
      this.thresholdsForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formVals = this.thresholdsForm.value;

    const payload = {
      surf: { waveMin: formVals.surfWaveMin, windMax: formVals.surfWindMax },
      ride: { windMax: formVals.rideWindMax, tempMin: formVals.rideTempMin },
      fish: { waveMax: formVals.fishWaveMax, windMax: formVals.fishWindMax },
    };

    this.http.put('/api/admin/thresholds', payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show('Activity threshold configurations saved', 'success');
      },
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * Download database settings JSON backup file.
   */
  public downloadSystemBackup(): void {
    this.http.get('/api/admin/backup', { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `oceancast_backup_${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        window.URL.revokeObjectURL(url);
        this.toastService.show('Backup file saved locally', 'success');
      },
      error: () => this.toastService.show('Failed to compile backup', 'error'),
    });
  }

  /**
   * Upload and restore database configurations from backup.
   */
  public uploadSystemRestore(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const configJson = JSON.parse(e.target?.result as string);
        this.isSaving.set(true);
        
        this.http.post('/api/admin/restore', configJson).subscribe({
          next: () => {
            this.isSaving.set(false);
            this.toastService.show('System registry configs restored successfully', 'success');
            input.value = ''; // clear input
          },
          error: () => this.isSaving.set(false),
        });
      } catch {
        this.toastService.show('Invalid backup file configuration formatting', 'error');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Promote or demote user roles.
   */
  public changeUserRole(userId: string, event: Event): void {
    const selectElem = event.target as HTMLSelectElement;
    const newRole = selectElem.value;

    this.http.put(`/api/admin/users/${userId}/role`, { role: newRole }).subscribe({
      next: () => {
        this.toastService.show('User permissions modified successfully', 'success');
        const list = this.users().map((u) => (u._id === userId ? { ...u, role: newRole } : u));
        this.users.set(list);
      },
    });
  }

  /**
   * Submit and save a new featured location coordinates preset.
   */
  public addPresetDestination(): void {
    if (this.presetForm.invalid) {
      this.presetForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const { name, lat, lon } = this.presetForm.value;

    this.http.post<any[]>('/api/admin/presets', { name, lat: Number(lat), lon: Number(lon) }).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.presets.set(res);
        this.presetForm.reset();
        this.toastService.show(`Preset destination "${name}" added`, 'success');
      },
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * Delete a featured coordinate preset.
   */
  public deletePresetDestination(index: number): void {
    if (confirm('Are you sure you want to delete this featured destination preset?')) {
      this.http.delete<any[]>(`/api/admin/presets/${index}`).subscribe({
        next: (res) => {
          this.presets.set(res);
          this.toastService.show('Preset destination removed', 'info');
        },
      });
    }
  }

  /**
   * Save the modified Gemini AI system prompt instructions.
   */
  public updateSystemPrompt(textAreaVal: string): void {
    if (!textAreaVal || textAreaVal.trim() === '') return;

    this.isSaving.set(true);
    this.http.put('/api/admin/prompt', { prompt: textAreaVal }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show('Gemini AI system prompt modified successfully', 'success');
      },
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * Delete user account and purge locations logs.
   */
  public deleteUser(userId: string): void {
    const targetUser = this.users().find((u) => u._id === userId);
    if (!targetUser) return;

    if (
      confirm(
        `Are you sure you want to permanently delete user "${targetUser.name}" (${targetUser.email}) and purge all their saved locations?`
      )
    ) {
      this.http.delete(`/api/admin/users/${userId}`).subscribe({
        next: () => {
          this.toastService.show(`User "${targetUser.name}" deleted successfully`, 'success');
          this.users.set(this.users().filter((u) => u._id !== userId));
        },
        error: (err) => {
          const errMsg = err.error?.error || 'Failed to delete user account';
          this.toastService.show(errMsg, 'error');
        },
      });
    }
  }

  // ─── Leaflet Map Methods ────────────────────────────────────────

  private async initMap(): Promise<void> {
    const container = document.getElementById('admin-map');
    if (!container) return;

    // Dynamically import Leaflet
    const L = await import('leaflet') as any;

    // Destroy existing map instance if re-initializing
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    this.zone.runOutsideAngular(() => {
      // Initialize map centered on world view
      this.leafletMap = L.map('admin-map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: true,
      });

      this.setTileLayer(L);
      this.plotMarkers(L);

      // Add scale control
      L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.leafletMap);
    });
  }

  private setTileLayer(L: any): void {
    if (this.tileLayer) {
      this.tileLayer.remove();
    }

    const mode = this.mapLayerMode();
    let tileUrl = '';
    let attribution = '';

    if (mode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '© Esri World Imagery';
    } else if (mode === 'topo') {
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '© OpenTopoMap contributors';
    } else {
      // Dark ocean-themed CartoDB Dark Matter
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '© OpenStreetMap © CartoDB';
    }

    this.tileLayer = L.tileLayer(tileUrl, { attribution, maxZoom: 18 }).addTo(this.leafletMap);
  }

  private plotMarkers(L: any): void {
    if (this.markerLayer) {
      this.markerLayer.remove();
    }

    const locations = this.mapLocations();
    if (!locations.length) return;

    const markers: any[] = [];

    if (this.showClusters()) {
      // Group by proximity (5deg grid)
      const grid: Record<string, any[]> = {};
      locations.forEach((loc) => {
        const key = `${Math.round(loc.lat / 3) * 3},${Math.round(loc.lon / 3) * 3}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(loc);
      });

      Object.entries(grid).forEach(([key, group]) => {
        const avgLat = group.reduce((s, l) => s + l.lat, 0) / group.length;
        const avgLon = group.reduce((s, l) => s + l.lon, 0) / group.length;
        const count = group.length;
        const size = Math.min(20 + count * 6, 60);

        const clusterIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;
            background:rgba(6,182,212,0.75);
            border:2px solid rgba(6,182,212,1);
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:${count > 9 ? 11 : 13}px;
            color:#0a0f1e;
            box-shadow:0 0 12px rgba(6,182,212,0.6);
            backdrop-filter:blur(4px);
          ">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([avgLat, avgLon], { icon: clusterIcon })
          .bindPopup(
            `<div style="font-family:system-ui;font-size:12px;min-width:160px">
              <strong style="color:#06b6d4">${count} Location${count > 1 ? 's' : ''}</strong><br/>
              <span style="color:#94a3b8">in this area</span><br/><br/>
              ${group.slice(0, 4).map(l => `<div style="color:#f1f5f9">📍 ${l.name} <span style="color:#64748b;font-size:10px">(${l.userName})</span></div>`).join('')}
              ${count > 4 ? `<div style="color:#64748b;font-size:10px">+${count - 4} more…</div>` : ''}
            </div>`,
            { maxWidth: 250 }
          );
        markers.push(marker);
      });
    } else {
      // Individual glowing dot markers
      locations.forEach((loc) => {
        const dotIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:12px;height:12px;
            background:#06b6d4;
            border:2px solid #22d3ee;
            border-radius:50%;
            box-shadow:0 0 8px rgba(6,182,212,0.8);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([loc.lat, loc.lon], { icon: dotIcon })
          .bindPopup(
            `<div style="font-family:system-ui;font-size:12px">
              <strong style="color:#06b6d4">📍 ${loc.name}</strong><br/>
              <span style="color:#94a3b8">By: ${loc.userName}</span><br/>
              <span style="color:#64748b;font-size:10px">${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°</span>
            </div>`
          );
        markers.push(marker);
      });
    }

    this.markerLayer = L.layerGroup(markers).addTo(this.leafletMap);

    // Draw heatmap if enabled
    if (this.showHeatmap()) {
      this.drawHeatmap(L);
    }
  }

  private drawHeatmap(L: any): void {
    // Use circle overlays to simulate a heatmap effect (no plugin needed)
    const heatCircles: any[] = [];
    this.mapLocations().forEach((loc) => {
      const circle = L.circle([loc.lat, loc.lon], {
        radius: 150000, // ~150km radius
        color: 'transparent',
        fillColor: '#06b6d4',
        fillOpacity: 0.07,
        weight: 0,
      });
      heatCircles.push(circle);
    });
    this.heatLayer = L.layerGroup(heatCircles).addTo(this.leafletMap);
  }

  public onMapLayerChange(mode: 'standard' | 'satellite' | 'topo'): void {
    this.mapLayerMode.set(mode);
    if (!this.leafletMap) return;
    import('leaflet').then((L: any) => {
      this.setTileLayer(L);
    });
  }

  public toggleHeatmap(): void {
    this.showHeatmap.update(v => !v);
    if (!this.leafletMap) return;
    import('leaflet').then((L: any) => {
      if (this.heatLayer) {
        this.heatLayer.remove();
        this.heatLayer = null;
      }
      if (this.showHeatmap()) this.drawHeatmap(L);
    });
  }

  public toggleClusters(): void {
    this.showClusters.update(v => !v);
    if (!this.leafletMap) return;
    import('leaflet').then((L: any) => this.plotMarkers(L));
  }

  public zoomToLocation(lat: number, lon: number): void {
    if (!this.leafletMap) return;
    this.leafletMap.flyTo([lat, lon], 10, { duration: 1.2 });
  }

  public fitAllMarkers(): void {
    if (!this.leafletMap || !this.mapLocations().length) return;
    import('leaflet').then((L: any) => {
      const bounds = L.latLngBounds(this.mapLocations().map((l) => [l.lat, l.lon]));
      this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
    });
  }

  public exportMapCsv(): void {
    const rows = ['Name,Latitude,Longitude,User'];
    this.mapLocations().forEach((l) => {
      rows.push(`"${l.name}",${l.lat},${l.lon},"${l.userName}"`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oceancast_locations.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.show('Locations exported as CSV', 'success');
  }

  public ngOnDestroy(): void {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }
}
