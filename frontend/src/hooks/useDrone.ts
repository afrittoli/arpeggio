import { useState, useRef, useCallback, useEffect } from "react";
import { useAudioContext } from "./useAudioContext";
import {
  loadDroneBuffer,
  createDroneNodes,
  startDrone,
  stopDrone,
} from "../utils/audio";
import type { DroneNodes } from "../utils/audio";

export function useDrone() {
  const [playingItemKey, setPlayingItemKey] = useState<string | null>(null);
  const droneNodesRef = useRef<DroneNodes | null>(null);
  const { getAudioContext, resumeAudioContext } = useAudioContext();

  const stop = useCallback(() => {
    if (droneNodesRef.current) {
      const audioContext = getAudioContext();
      stopDrone(droneNodesRef.current, audioContext);
      droneNodesRef.current = null;
    }
    setPlayingItemKey(null);
  }, [getAudioContext]);

  const play = useCallback(
    async (itemKey: string, note: string, gain = 0.8) => {
      // Stop any currently playing drone first
      if (droneNodesRef.current) {
        const audioContext = getAudioContext();
        stopDrone(droneNodesRef.current, audioContext);
        droneNodesRef.current = null;
      }

      const audioContext = getAudioContext();
      await resumeAudioContext();

      try {
        const buffer = await loadDroneBuffer(audioContext, note);
        const nodes = createDroneNodes(audioContext, buffer);
        droneNodesRef.current = nodes;

        startDrone(nodes, audioContext, gain);
        setPlayingItemKey(itemKey);
      } catch (error) {
        console.error("Failed to play drone:", error);
      }
    },
    [getAudioContext, resumeAudioContext]
  );

  // Stop drone when page visibility changes (user switches tabs/apps)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && playingItemKey) {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [playingItemKey, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (droneNodesRef.current) {
        const audioContext = getAudioContext();
        stopDrone(droneNodesRef.current, audioContext);
      }
    };
  }, [getAudioContext]);

  return {
    playingItemKey,
    play,
    stop,
    isPlaying: playingItemKey !== null,
  };
}
