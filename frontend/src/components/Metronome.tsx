import { useState, useEffect, useRef } from "react";
import { useMetronome } from "../hooks/useMetronome";
import { BpmInput } from "./BpmInput";
import type { BpmUnit } from "../types";

interface MetronomeProps {
  defaultBpm?: number;
  onBpmChange?: (bpm: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onEnabledChange?: (isEnabled: boolean) => void;
}

const MIN_BPM = 20;
const MAX_BPM = 240;
// Slider labels for quaver mode (will be halved for crotchet)
const QUAVER_LABELS = [20, 60, 120, 180, 240];

function Metronome({
  defaultBpm = 60,
  onBpmChange,
  onRunningChange,
  onEnabledChange,
}: MetronomeProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [displayUnit, setDisplayUnit] = useState<BpmUnit>("quaver");
  const { isRunning, bpm, stop, toggle, setBpm } = useMetronome({
    initialBpm: defaultBpm,
  });
  const prevDefaultBpmRef = useRef(defaultBpm);

  // Convert BPM for display based on unit
  const displayBpm = displayUnit === "crotchet" ? Math.round(bpm / 2) : bpm;
  const bpmSymbol = displayUnit === "crotchet" ? "♩" : "♪";

  // Slider range in display units
  const minDisplayBpm = displayUnit === "crotchet" ? Math.round(MIN_BPM / 2) : MIN_BPM;
  const maxDisplayBpm = displayUnit === "crotchet" ? Math.round(MAX_BPM / 2) : MAX_BPM;

  // Slider labels based on display unit
  const sliderLabels = displayUnit === "crotchet"
    ? QUAVER_LABELS.map(v => Math.round(v / 2))
    : QUAVER_LABELS;

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

  // Handle BPM change - input is in display units, convert to quaver for storage
  const handleDisplayBpmChange = (newDisplayBpm: number) => {
    const quaverBpm = displayUnit === "crotchet" ? newDisplayBpm * 2 : newDisplayBpm;
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, quaverBpm)));
  };

  // Adjust buttons work in display units
  const adjustStep = displayUnit === "crotchet" ? 2 : 5;

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
          <div className="metronome-controls-left">
            <button
              className="metronome-adjust"
              onClick={() => handleDisplayBpmChange(displayBpm - adjustStep)}
              disabled={displayBpm <= minDisplayBpm}
            >
              -{adjustStep}
            </button>

            <div className="metronome-bpm">
              <span className="metronome-note">{bpmSymbol}=</span>
              <BpmInput
                value={displayBpm}
                onChange={handleDisplayBpmChange}
                onBlur={handleDisplayBpmChange}
                min={minDisplayBpm}
                max={maxDisplayBpm}
              />
            </div>

            <button
              className="metronome-adjust"
              onClick={() => handleDisplayBpmChange(displayBpm + adjustStep)}
              disabled={displayBpm >= maxDisplayBpm}
            >
              +{adjustStep}
            </button>
          </div>

          <button
            className={`metronome-play ${isRunning ? "playing" : ""}`}
            onClick={toggle}
          >
            {isRunning ? "Stop" : "Start"}
          </button>

          <div className="toggle-switch">
            <span className={`toggle-switch-label ${displayUnit === "quaver" ? "active" : ""}`}>♪</span>
            <div
              className={`toggle-switch-track tint-tonal ${displayUnit === "crotchet" ? "on" : ""}`}
              onClick={() => setDisplayUnit(displayUnit === "quaver" ? "crotchet" : "quaver")}
            >
              <div className="toggle-switch-thumb" />
            </div>
            <span className={`toggle-switch-label ${displayUnit === "crotchet" ? "active" : ""}`}>♩</span>
          </div>
        </div>
      )}

      {isEnabled && (
        <div className="metronome-slider">
          <input
            type="range"
            min={minDisplayBpm}
            max={maxDisplayBpm}
            value={displayBpm}
            onChange={(e) => handleDisplayBpmChange(Number(e.target.value))}
            className="metronome-slider-input"
          />

          <div className="metronome-slider-labels">
            {sliderLabels.map((value) => {
              const left = ((value - minDisplayBpm) / (maxDisplayBpm - minDisplayBpm)) * 100;
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
