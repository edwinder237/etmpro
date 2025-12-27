import { useCallback, useRef } from "react";

// Type for webkit prefixed AudioContext
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Helper to trigger vibration on supported devices
function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail if vibration is not supported or blocked
    }
  }
}

export function useAudioFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playCompletionSound = useCallback(() => {
    // Vibrate on mobile: short double pulse for completion
    vibrate([50, 30, 50]);

    try {
      // Create audio context if it doesn't exist
      audioContextRef.current ??= new (window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext!)();

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Create oscillator for a pleasant "ding" sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // First note (E6 - 1318.51 Hz)
      oscillator.frequency.setValueAtTime(1318.51, now);

      // Second note (C6 - 1046.50 Hz) after a short delay
      oscillator.frequency.setValueAtTime(1046.50, now + 0.1);

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      oscillator.type = "sine";
      oscillator.start(now);
      oscillator.stop(now + 0.4);
    } catch (error) {
      // Silently fail if audio is not supported or blocked
      console.warn("Audio feedback not available:", error);
    }
  }, []);

  const playUncompleteSound = useCallback(() => {
    try {
      audioContextRef.current ??= new (window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext!)();

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Lower pitch for uncomplete (A4 - 440 Hz)
      oscillator.frequency.setValueAtTime(440, now);

      // Shorter, softer sound
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      oscillator.type = "sine";
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch (error) {
      console.warn("Audio feedback not available:", error);
    }
  }, []);

  const vibrateOnDelete = useCallback(() => {
    // Longer single pulse for delete action
    vibrate(100);
  }, []);

  return {
    playCompletionSound,
    playUncompleteSound,
    vibrateOnDelete,
  };
}
