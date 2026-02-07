import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioContext } from "./useAudioContext";
import type { BpmUnit } from "../types";

export type AudioState = "ready" | "suspended" | "failed";

interface MetronomeState {
  isRunning: boolean;
  bpm: number;
  audioState: AudioState;
}

interface UseMetronomeOptions {
  initialBpm?: number;
  gain?: number;
  onTick?: () => void;
  unit?: BpmUnit;
}

export function useMetronome(options: UseMetronomeOptions = {}) {
  const { initialBpm = 60, gain = 0.3, onTick, unit = "quaver" } = options;

  const [state, setState] = useState<MetronomeState>({
    isRunning: false,
    bpm: initialBpm,
    audioState: "ready",
  });

  const { getAudioContext, resumeAudioContext } = useAudioContext();
  const nextTickTimeRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);
  const bpmRef = useRef(state.bpm);
  const unitRef = useRef(unit);
  const gainRef = useRef(gain);
  const schedulerRef = useRef<(() => void) | null>(null);

  // Keep refs up to date
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    gainRef.current = gain;
  }, [gain]);

  useEffect(() => {
    bpmRef.current = state.bpm;
  }, [state.bpm]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  const playClick = useCallback(
    (time: number) => {
      const audioContext = getAudioContext();

      // Create a short click sound using oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Fixed frequency for consistent pitch - set before any scheduling
      oscillator.frequency.setValueAtTime(1000, time);
      oscillator.type = "triangle"; // Use triangle for a punchier sound than sine

      // Click duration - short enough to prevent overlap at high BPMs
      // At 240 BPM, beat interval is 0.25s, so 0.03s is safe
      const clickDuration = 0.03;
      const attackTime = 0.001;

      // Consistent gain envelope for every click:
      // 1. Set initial gain to exactly 0 at the scheduled time
      // 2. Immediate attack to peak volume using setValueAtTime (not ramp)
      // 3. Exponential decay to near-zero
      // Using setValueAtTime for both initial and peak ensures identical clicks
      gainNode.gain.setValueAtTime(0, time);
      // Boost the gain slightly to compensate for triangle vs sine and perceived loudness
      gainNode.gain.setValueAtTime(gainRef.current * 2, time + attackTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + clickDuration);

      // Schedule oscillator with precise start and stop times
      oscillator.start(time);
      oscillator.stop(time + clickDuration);

      // Clean up nodes after the click completes to prevent memory leaks
      // and ensure no overlap from lingering audio nodes
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };

      onTickRef.current?.();
    },
    [getAudioContext]
  );

  // Play a silent oscillator to "kick-start" the AudioContext
  const playSilent = useCallback(
    (audioContext: AudioContext) => {
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.001);
      } catch {
        // Silently ignore - this is a best-effort unlock attempt
      }
    },
    []
  );

  // Set up the scheduler function using a ref to avoid circular dependency
  useEffect(() => {
    schedulerRef.current = () => {
      const audioContext = getAudioContext();
      // Adjust BPM based on unit: if crotchet, audible BPM is half of quaver BPM
      const effectiveBpm = unitRef.current === "crotchet" ? bpmRef.current / 2 : bpmRef.current;
      const secondsPerBeat = 60.0 / effectiveBpm;
      const scheduleAheadTime = 0.1; // Schedule 100ms ahead

      while (nextTickTimeRef.current < audioContext.currentTime + scheduleAheadTime) {
        playClick(nextTickTimeRef.current);
        nextTickTimeRef.current += secondsPerBeat;
      }

      timerIdRef.current = window.setTimeout(() => {
        schedulerRef.current?.();
      }, 25);
    };
  }, [getAudioContext, playClick]);

  const start = useCallback(async () => {
    let audioContext: AudioContext;

    // Try to get the AudioContext
    try {
      audioContext = getAudioContext();
    } catch {
      setState((prev) => ({ ...prev, audioState: "failed", isRunning: false }));
      return;
    }

    // Resume audio context if suspended (required for Safari and other browsers)
    if (audioContext.state === "suspended") {
      try {
        await resumeAudioContext();
      } catch {
        // resume() threw - context may be permanently blocked
      }

      // If still suspended after resume(), try a silent oscillator kick-start
      if (audioContext.state === "suspended") {
        playSilent(audioContext);

        // Give the browser a moment to process the resume + silent sound
        await new Promise<void>((resolve) => setTimeout(resolve, 100));

        // Final check: if still suspended, report and bail out
        if ((audioContext.state as string) !== "running") {
          setState((prev) => ({
            ...prev,
            audioState: "suspended",
            isRunning: false,
          }));
          return;
        }
      }
    }

    // AudioContext is running - proceed
    setState((prev) => ({ ...prev, audioState: "ready" }));
    nextTickTimeRef.current = audioContext.currentTime;
    setState((prev) => ({ ...prev, isRunning: true }));
    schedulerRef.current?.();
  }, [getAudioContext, resumeAudioContext, playSilent]);

  const stop = useCallback(() => {
    if (timerIdRef.current !== null) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(240, newBpm));
    setState((prev) => ({ ...prev, bpm: clampedBpm }));
  }, []);

  const toggle = useCallback(() => {
    if (state.isRunning) {
      stop();
    } else {
      start();
    }
  }, [state.isRunning, start, stop]);

  /**
   * Pre-warm the AudioContext on user interaction (e.g., enabling the metronome).
   * Creates the context if needed, plays a silent sound to unlock it,
   * and returns the resulting audio state.
   */
  const warmUp = useCallback(async (): Promise<AudioState> => {
    let audioContext: AudioContext;
    try {
      audioContext = getAudioContext();
    } catch {
      setState((prev) => ({ ...prev, audioState: "failed" }));
      return "failed";
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {
        // resume() threw
      }

      // Try silent sound to unlock
      playSilent(audioContext);

      if ((audioContext.state as string) !== "running") {
        setState((prev) => ({ ...prev, audioState: "suspended" }));
        return "suspended";
      }
    }

    setState((prev) => ({ ...prev, audioState: "ready" }));
    return "ready";
  }, [getAudioContext, playSilent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current !== null) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  return {
    isRunning: state.isRunning,
    bpm: state.bpm,
    audioState: state.audioState,
    start,
    stop,
    toggle,
    setBpm,
    warmUp,
  };
}
