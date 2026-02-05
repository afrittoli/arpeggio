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
const SLIDER_LABELS = [20, 60, 120, 180, 240];

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

  // Handle slider change - works directly with quaver BPM (actual tick rate)
  const handleSliderChange = (quaverBpm: number) => {
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, quaverBpm)));
  };

  // Handle BPM change - input is in display units, convert to quaver for storage
  const handleDisplayBpmChange = (newDisplayBpm: number) => {
    const quaverBpm = displayUnit === "crotchet" ? newDisplayBpm * 2 : newDisplayBpm;
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, quaverBpm)));
  };

  // Adjust buttons work in display units
  const adjustStep = displayUnit === "crotchet" ? 2 : 5;
  const minDisplayBpm = displayUnit === "crotchet" ? Math.round(MIN_BPM / 2) : MIN_BPM;
  const maxDisplayBpm = displayUnit === "crotchet" ? Math.round(MAX_BPM / 2) : MAX_BPM;

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
            />
          </div>

          <button
            className="metronome-adjust"
            onClick={() => handleDisplayBpmChange(displayBpm + adjustStep)}
            disabled={displayBpm >= maxDisplayBpm}
          >
            +{adjustStep}
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
        <div className="metronome-unit-toggle">
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
        <div className="metronome-slider" style={{ position: "relative" }}>
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
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
