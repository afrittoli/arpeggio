import { useRef, useCallback, useEffect } from "react";

let sharedAudioContext: AudioContext | null = null;

export function useAudioContext() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback((): AudioContext => {
    // Use shared context if available and not closed
    if (sharedAudioContext && sharedAudioContext.state !== "closed") {
      audioContextRef.current = sharedAudioContext;
      return sharedAudioContext;
    }

    // Create new context
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
    audioContextRef.current = sharedAudioContext;
    return sharedAudioContext;
  }, []);

  const resumeAudioContext = useCallback(async (): Promise<void> => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
  }, []);

  // Cleanup on unmount - but don't close shared context
  useEffect(() => {
    return () => {
      // Don't close the shared context, just clear the ref
      audioContextRef.current = null;
    };
  }, []);

  return {
    getAudioContext,
    resumeAudioContext,
  };
}
