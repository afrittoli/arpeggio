import { useState, useEffect, useRef } from "react";
import { useMetronome } from "../hooks/useMetronome";

interface MetronomeProps {
  defaultBpm?: number;
  onBpmChange?: (bpm: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
}

function Metronome({
  defaultBpm = 60,
  onBpmChange,
  onRunningChange,
}: MetronomeProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const { isRunning, bpm, stop, toggle, setBpm } = useMetronome({
    initialBpm: defaultBpm,
  });
  const prevDefaultBpmRef = useRef(defaultBpm);

  // Only update BPM when the default prop actually changes (not when isRunning changes)
  useEffect(() => {
    if (prevDefaultBpmRef.current !== defaultBpm && !isRunning) {
      setBpm(defaultBpm);
    }
    prevDefaultBpmRef.current = defaultBpm;
  }, [defaultBpm, isRunning, setBpm]);

  // Notify parent of BPM changes
  useEffect(() => {
    onBpmChange?.(bpm);
  }, [bpm, onBpmChange]);

  // Notify parent of running state changes
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  // Stop metronome when disabled
  useEffect(() => {
    if (!isEnabled && isRunning) {
      stop();
    }
  }, [isEnabled, isRunning, stop]);

  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      handleBpmChange(value);
    }
  };

  return (
    <div className={`metronome ${isEnabled ? "enabled" : ""}`}>
      <div className="metronome-header">
        <label className="metronome-toggle">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          <span>Metronome</span>
        </label>
      </div>

      {isEnabled && (
        <div className="metronome-controls">
          <button
            className="metronome-adjust"
            onClick={() => handleBpmChange(bpm - 5)}
            disabled={bpm <= 20}
          >
            -5
          </button>

          <div className="metronome-bpm">
            <input
              type="number"
              value={bpm}
              onChange={handleInputChange}
              min={20}
              max={240}
              className="metronome-input"
            />
            <span className="metronome-unit">BPM</span>
          </div>

          <button
            className="metronome-adjust"
            onClick={() => handleBpmChange(bpm + 5)}
            disabled={bpm >= 240}
          >
            +5
          </button>

          <button
            className={`metronome-play ${isRunning ? "playing" : ""}`}
            onClick={toggle}
          >
            {isRunning ? "Stop" : "Start"}
          </button>
        </div>
      )}
    </div>
  );
}

export default Metronome;
