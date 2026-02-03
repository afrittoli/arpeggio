import { useState, useEffect, useRef } from "react";
import { useMetronome } from "../hooks/useMetronome";
import { BpmInput } from "./BpmInput";

interface MetronomeProps {
  defaultBpm?: number;
  onBpmChange?: (bpm: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onEnabledChange?: (isEnabled: boolean) => void;
}

const MIN_BPM = 20;
const MAX_BPM = 240;
const SLIDER_LABELS = [20, 60, 120, 180, 240];

function Metronome({
  defaultBpm = 60,
  onBpmChange,
  onRunningChange,
  onEnabledChange,
}: MetronomeProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const { isRunning, bpm, stop, toggle, setBpm } = useMetronome({
    initialBpm: defaultBpm,
  });
  const prevDefaultBpmRef = useRef(defaultBpm);

  /** Sync defaultBpm prop → bpm (only if not running) */
  useEffect(() => {
    if (prevDefaultBpmRef.current !== defaultBpm && !isRunning) {
      setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, defaultBpm)));
    }
    prevDefaultBpmRef.current = defaultBpm;
  }, [defaultBpm, isRunning, setBpm]);

  /** Notify parent of BPM changes */
  useEffect(() => {
    onBpmChange?.(bpm);
  }, [bpm, onBpmChange]);

  /** Notify parent of running state changes */
  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  /** Notify parent of enabled state changes */
  useEffect(() => {
    onEnabledChange?.(isEnabled);
  }, [isEnabled, onEnabledChange]);

  /** Stop metronome when disabled */
  useEffect(() => {
    if (!isEnabled && isRunning) {
      stop();
    }
  }, [isEnabled, isRunning, stop]);

  const handleBpmChange = (newBpm: number) => {
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, newBpm)));
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
            disabled={bpm <= MIN_BPM}
          >
            -5
          </button>

          <div className="metronome-bpm">
            <span className="metronome-note">♪=</span>

            <BpmInput
              value={bpm}
              onChange={handleBpmChange}
              onBlur={handleBpmChange}
            />

            <span className="metronome-crotchet">
              ♩={Math.round(bpm / 2)}
            </span>
          </div>

          <button
            className="metronome-adjust"
            onClick={() => handleBpmChange(bpm + 5)}
            disabled={bpm >= MAX_BPM}
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

      {isEnabled && (
        <div className="metronome-slider" style={{ position: "relative" }}>
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            className="metronome-slider-input"
          />

          <div className="metronome-slider-labels" style={{ position: "relative", width: "100%" }}>
            {SLIDER_LABELS.map((value) => {
              const left = ((value - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;
              return (
                <span
                  key={value}
                  className="metronome-slider-label"
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {value}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Metronome;
