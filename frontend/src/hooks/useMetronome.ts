import { useState, useRef, useCallback, useEffect } from "react";

interface MetronomeState {
  isRunning: boolean;
  bpm: number;
}

interface UseMetronomeOptions {
  initialBpm?: number;
  onTick?: () => void;
}

export function useMetronome(options: UseMetronomeOptions = {}) {
  const { initialBpm = 60, onTick } = options;

  const [state, setState] = useState<MetronomeState>({
    isRunning: false,
    bpm: initialBpm,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextTickTimeRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);
  const onTickRef = useRef(onTick);
  const bpmRef = useRef(state.bpm);
  const schedulerRef = useRef<(() => void) | null>(null);

  // Keep refs up to date
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    bpmRef.current = state.bpm;
  }, [state.bpm]);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

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
      oscillator.type = "sine";

      // Click duration - short enough to prevent overlap at high BPMs
      // At 240 BPM, beat interval is 0.25s, so 0.03s is safe
      const clickDuration = 0.03;
      const attackTime = 0.001;

      // Consistent gain envelope for every click:
      // 1. Set initial gain to exactly 0 at the scheduled time
      // 2. Linear attack to peak volume to avoid pops
      // 3. Exponential decay to near-zero
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + attackTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + clickDuration);

      // Schedule oscillator with precise start and stop times
      // Add a tiny bit of buffer for the stop time to ensure the ramp completes
      oscillator.start(time);
      oscillator.stop(time + clickDuration + 0.01);

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

  // Set up the scheduler function using a ref to avoid circular dependency
  useEffect(() => {
    schedulerRef.current = () => {
      const audioContext = getAudioContext();
      const secondsPerBeat = 60.0 / bpmRef.current;
      const scheduleAheadTime = 0.1; // Schedule 100ms ahead

      // If we've fallen behind (e.g. tab was backgrounded), catch up
      if (nextTickTimeRef.current < audioContext.currentTime) {
        nextTickTimeRef.current = audioContext.currentTime;
      }

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
    const audioContext = getAudioContext();

    // Resume audio context if suspended (required for Safari)
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Small lookahead to ensure the first tick isn't in the past
    nextTickTimeRef.current = audioContext.currentTime + 0.05;
    setState((prev) => ({ ...prev, isRunning: true }));
    schedulerRef.current?.();
  }, [getAudioContext]);

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
    start,
    stop,
    toggle,
    setBpm,
  };
}
