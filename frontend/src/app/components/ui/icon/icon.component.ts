import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'instagram'
  | 'sparkles'
  | 'trend-up'
  | 'bar-chart'
  | 'hash'
  | 'clock'
  | 'message-square'
  | 'users'
  | 'download'
  | 'terminal'
  | 'shield'
  | 'heart'
  | 'flame'
  | 'calendar'
  | 'search'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'external-link'
  | 'copy'
  | 'check'
  | 'alert-triangle'
  | 'settings'
  | 'refresh-cw'
  | 'filter'
  | 'x'
  | 'lock'
  | 'briefcase'
  | 'pin'
  | 'play'
  | 'music'
  | 'mail'
  | 'phone'
  | 'map-pin'
  | 'globe'
  | 'info'
  | 'file-text'
  | 'database'
  | 'eye'
  | 'cpu'
  | 'share-2'
  | 'award'
  | 'compass'
  | 'zap'
  | 'image';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class]="customClass"
      aria-hidden="true"
    >
      <!-- Instagram -->
      <ng-container *ngIf="name === 'instagram'">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </ng-container>

      <!-- Sparkles / AI -->
      <ng-container *ngIf="name === 'sparkles'">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
        <path d="M20 3v4"></path>
        <path d="M22 5h-4"></path>
      </ng-container>

      <!-- Trend Up -->
      <ng-container *ngIf="name === 'trend-up'">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
      </ng-container>

      <!-- Bar Chart -->
      <ng-container *ngIf="name === 'bar-chart'">
        <line x1="12" y1="20" x2="12" y2="10"></line>
        <line x1="18" y1="20" x2="18" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="16"></line>
      </ng-container>

      <!-- Hash / Hashtag -->
      <ng-container *ngIf="name === 'hash'">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" y1="3" x2="14" y2="21"></line>
      </ng-container>

      <!-- Clock -->
      <ng-container *ngIf="name === 'clock'">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </ng-container>

      <!-- Message Square -->
      <ng-container *ngIf="name === 'message-square'">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </ng-container>

      <!-- Users -->
      <ng-container *ngIf="name === 'users'">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </ng-container>

      <!-- Download -->
      <ng-container *ngIf="name === 'download'">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </ng-container>

      <!-- Terminal -->
      <ng-container *ngIf="name === 'terminal'">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </ng-container>

      <!-- Shield / OSINT -->
      <ng-container *ngIf="name === 'shield'">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </ng-container>

      <!-- Heart -->
      <ng-container *ngIf="name === 'heart'">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </ng-container>

      <!-- Flame -->
      <ng-container *ngIf="name === 'flame'">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
      </ng-container>

      <!-- Calendar -->
      <ng-container *ngIf="name === 'calendar'">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </ng-container>

      <!-- Search -->
      <ng-container *ngIf="name === 'search'">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </ng-container>

      <!-- Chevron Down -->
      <ng-container *ngIf="name === 'chevron-down'">
        <polyline points="6 9 12 15 18 9"></polyline>
      </ng-container>

      <!-- Chevron Right -->
      <ng-container *ngIf="name === 'chevron-right'">
        <polyline points="9 18 15 12 9 6"></polyline>
      </ng-container>

      <!-- Chevron Left -->
      <ng-container *ngIf="name === 'chevron-left'">
        <polyline points="15 18 9 12 15 6"></polyline>
      </ng-container>

      <!-- External Link -->
      <ng-container *ngIf="name === 'external-link'">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </ng-container>

      <!-- Copy -->
      <ng-container *ngIf="name === 'copy'">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </ng-container>

      <!-- Check -->
      <ng-container *ngIf="name === 'check'">
        <polyline points="20 6 9 17 4 12"></polyline>
      </ng-container>

      <!-- Alert Triangle -->
      <ng-container *ngIf="name === 'alert-triangle'">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </ng-container>

      <!-- Settings -->
      <ng-container *ngIf="name === 'settings'">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </ng-container>

      <!-- Refresh CW -->
      <ng-container *ngIf="name === 'refresh-cw'">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </ng-container>

      <!-- Filter -->
      <ng-container *ngIf="name === 'filter'">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </ng-container>

      <!-- X / Close -->
      <ng-container *ngIf="name === 'x'">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </ng-container>

      <!-- Lock -->
      <ng-container *ngIf="name === 'lock'">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </ng-container>

      <!-- Briefcase -->
      <ng-container *ngIf="name === 'briefcase'">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
      </ng-container>

      <!-- Pin -->
      <ng-container *ngIf="name === 'pin'">
        <line x1="12" y1="17" x2="12" y2="22"></line>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24Z"></path>
      </ng-container>

      <!-- Play -->
      <ng-container *ngIf="name === 'play'">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </ng-container>

      <!-- Music -->
      <ng-container *ngIf="name === 'music'">
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
      </ng-container>

      <!-- Mail -->
      <ng-container *ngIf="name === 'mail'">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </ng-container>

      <!-- Phone -->
      <ng-container *ngIf="name === 'phone'">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
      </ng-container>

      <!-- Map Pin -->
      <ng-container *ngIf="name === 'map-pin'">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </ng-container>

      <!-- Globe -->
      <ng-container *ngIf="name === 'globe'">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </ng-container>

      <!-- Info -->
      <ng-container *ngIf="name === 'info'">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </ng-container>

      <!-- File Text -->
      <ng-container *ngIf="name === 'file-text'">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </ng-container>

      <!-- Database -->
      <ng-container *ngIf="name === 'database'">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </ng-container>

      <!-- Eye -->
      <ng-container *ngIf="name === 'eye'">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </ng-container>

      <!-- CPU -->
      <ng-container *ngIf="name === 'cpu'">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
        <rect x="9" y="9" width="6" height="6"></rect>
        <line x1="9" y1="1" x2="9" y2="4"></line>
        <line x1="15" y1="1" x2="15" y2="4"></line>
        <line x1="9" y1="20" x2="9" y2="23"></line>
        <line x1="15" y1="20" x2="15" y2="23"></line>
        <line x1="20" y1="9" x2="23" y2="9"></line>
        <line x1="20" y1="14" x2="23" y2="14"></line>
        <line x1="1" y1="9" x2="4" y2="9"></line>
        <line x1="1" y1="14" x2="4" y2="14"></line>
      </ng-container>

      <!-- Share 2 -->
      <ng-container *ngIf="name === 'share-2'">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </ng-container>

      <!-- Award -->
      <ng-container *ngIf="name === 'award'">
        <circle cx="12" cy="8" r="7"></circle>
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
      </ng-container>

      <!-- Compass -->
      <ng-container *ngIf="name === 'compass'">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </ng-container>

      <!-- Zap -->
      <ng-container *ngIf="name === 'zap'">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </ng-container>

      <!-- Image -->
      <ng-container *ngIf="name === 'image'">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </ng-container>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
    }
    svg {
      display: block;
      transition: stroke 0.2s ease, transform 0.2s ease;
    }
  `]
})
export class IconComponent {
  @Input() name: IconName = 'sparkles';
  @Input() size: number = 18;
  @Input() strokeWidth: number = 1.85;
  @Input() customClass: string = '';
}
