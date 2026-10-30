import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface BackButtonHandler {
  id: string;
  priority: number; // Higher number = executed first
  fn: () => boolean | void; // return true or void to consume event, return false to pass to next
}

class BackButtonManager {
  private handlers: BackButtonHandler[] = [];
  private isListening = false;

  constructor() {
    this.init();
  }

  private init() {
    if (!Capacitor.isNativePlatform() || this.isListening) return;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // Sort descending by priority
      const sorted = [...this.handlers].sort((a, b) => b.priority - a.priority);

      for (const handler of sorted) {
        try {
          const consumed = handler.fn();
          if (consumed !== false) {
            // Handled!
            return;
          }
        } catch (err) {
          console.warn('[BackButtonManager] Handler error:', err);
        }
      }

      // If no handler consumed, check browser history
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });

    this.isListening = true;
  }

  public register(id: string, priority: number, fn: () => boolean | void): () => void {
    // Remove existing if any
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, priority, fn });

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }
}

export const backButtonManager = new BackButtonManager();
