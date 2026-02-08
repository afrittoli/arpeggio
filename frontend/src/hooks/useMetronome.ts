import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioContext } from "./useAudioContext";
import type { BpmUnit } from "../types";

interface MetronomeState {
  isRunning: boolean;
  bpm: number;
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
    const audioContext = getAudioContext();

    // Resume audio context if suspended (required for Safari)
    await resumeAudioContext();

    nextTickTimeRef.current = audioContext.currentTime;
    setState((prev) => ({ ...prev, isRunning: true }));
    schedulerRef.current?.();
  }, [getAudioContext, resumeAudioContext]);

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
