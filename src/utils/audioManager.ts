/**
 * Native-grade Audio Engine & MediaSession Lifecycle Manager
 * Provides synthesized audio alerts, background survivability, and lock-screen controls.
 */

class AudioManager {
  private audioCtx: AudioContext | null = null;
  private silentAudioElement: HTMLAudioElement | null = null;
  private isSoundEnabled = true;

  constructor() {
    // Lazy AudioContext initialization on first user gesture
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.getAudioContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Generates a tone using Web Audio API oscillator with an exponential decay envelope
   */
  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', startTimeOffset = 0, volume = 0.3) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTimeOffset);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startTimeOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTimeOffset);
      osc.stop(ctx.currentTime + startTimeOffset + duration + 0.05);
    } catch (e) {
      console.warn('[AudioManager] Tone playback failed:', e);
    }
  }

  /**
   * Sound played upon successfully logging a workout set
   */
  public playSetLoggedSound() {
    if (!this.isSoundEnabled) return;
    // Ascending dual chime C5 (523.25Hz) -> E5 (659.25Hz)
    this.playTone(523.25, 0.12, 'triangle', 0, 0.25);
    this.playTone(659.25, 0.2, 'triangle', 0.12, 0.3);
  }

  /**
   * Short beep for rest timer countdown warning (3, 2, 1)
   */
  public playCountdownBeep(secondsLeft: number) {
    if (!this.isSoundEnabled) return;
    const freq = secondsLeft === 1 ? 987.77 : 880; // B5 for 1s, A5 for 2s/3s
    this.playTone(freq, 0.08, 'sine', 0, 0.25);
  }

  /**
   * Completion fanfare when rest period ends (Ready for next set!)
   */
  public playRestCompleteFanfare() {
    if (!this.isSoundEnabled) return;
    // Triple ascending fanfare: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
    this.playTone(523.25, 0.14, 'triangle', 0, 0.3);
    this.playTone(659.25, 0.14, 'triangle', 0.14, 0.35);
    this.playTone(783.99, 0.35, 'triangle', 0.28, 0.4);
  }

  /**
   * Speech Synthesis / TTS announcement with screen-off accessibility
   */
  public speak(text: string) {
    if (!this.isSoundEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Cancel any lingering utterances
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[AudioManager] Speech synthesis failed:', e);
    }
  }

  /**
   * Ensures the mobile OS audio session stays active during countdown when screen turns off.
   * Generates a 1-second silent WAV data-uri in an audio element.
   */
  public startBackgroundKeepAlive() {
    if (typeof window === 'undefined') return;
    if (!this.silentAudioElement) {
      // 1-second silent stereo WAV
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const audio = new Audio(silentWav);
      audio.loop = true;
      audio.volume = 0.01;
      this.silentAudioElement = audio;
    }

    this.silentAudioElement.play().catch(() => {
      // Ignored if autoplay policy intervenes
    });
  }

  public stopBackgroundKeepAlive() {
    if (this.silentAudioElement) {
      this.silentAudioElement.pause();
      this.silentAudioElement.currentTime = 0;
    }
  }

  /**
   * MediaSession API integration for Android Lock Screen & Notification Drawer controls
   */
  public updateRestTimerMediaSession(
    exercise: string,
    secondsRemaining: number,
    totalSeconds: number,
    actions?: {
      onSkip?: () => void;
      onAdd30?: () => void;
    }
  ) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Repos : ${exercise}`,
        artist: 'Gym Lift Track',
        album: `${secondsRemaining}s restantes / ${totalSeconds}s`,
        artwork: [
          { src: '/Gym-Lift-Track_Icon.png', sizes: '192x192', type: 'image/png' },
          { src: '/Gym-Lift-Track_Icon.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = secondsRemaining > 0 ? 'playing' : 'paused';

      if (actions?.onSkip) {
        navigator.mediaSession.setActionHandler('nexttrack', actions.onSkip);
        navigator.mediaSession.setActionHandler('stop', actions.onSkip);
      }
      if (actions?.onAdd30) {
        navigator.mediaSession.setActionHandler('seekforward', actions.onAdd30);
      }
    } catch (err) {
      console.warn('[AudioManager] MediaSession update failed:', err);
    }
  }

  public clearMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    } catch (err) {
      // ignore
    }
  }
}

export const audioManager = new AudioManager();
