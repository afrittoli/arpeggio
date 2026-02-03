import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useMetronome } from "../hooks/useMetronome";

interface MetronomeProps {
  defaultBpm?: number;
  onBpmChange?: (bpm: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onEnabledChange?: (isEnabled: boolean) => void;
}

const MIN_BPM = 20;
const MAX_BPM = 240;
const DEBOUNCE_MS = 300;
const SLIDER_LABELS = [20, 60, 120, 180, 240];

/** Debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

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

  /** UI-only input state */
  const [bpmInput, setBpmInput] = useState<string>(defaultBpm.toString());

  const prevDefaultBpmRef = useRef(defaultBpm);

  /** Clamp helper */
  const clampBpm = (value: number) =>
    Math.min(MAX_BPM, Math.max(MIN_BPM, value));

  /**
   * Sync defaultBpm prop → bpm (authoritative state only)
   * No UI state updates here (ESLint-safe)
   */
  useEffect(() => {
    if (prevDefaultBpmRef.current !== defaultBpm && !isRunning) {
      setBpm(clampBpm(defaultBpm));
    }
    prevDefaultBpmRef.current = defaultBpm;
  }, [defaultBpm, isRunning, setBpm]);

  /**
   * Keep input text in sync with actual bpm
   * This is derived state and allowed
   */
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBpmInput(bpm.toString());
  }, [bpm]);

  /** Debounced commit from text input → bpm */
  const debouncedInput = useDebounce(bpmInput, DEBOUNCE_MS);

  useEffect(() => {
    const value = parseInt(debouncedInput, 10);
    if (isNaN(value)) return;

    const clamped = clampBpm(value);
    if (clamped !== bpm) {
      setBpm(clamped);
    }
  }, [debouncedInput, bpm, setBpm]);

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

  /** Immediate BPM change (buttons / slider) */
  const handleBpmChange = (newBpm: number) => {
    setBpm(clampBpm(newBpm));
  };

  /** Text input typing */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setBpmInput(value);
    }
  };

  /** Finalize input on blur */
  const handleBlur = () => {
    const value = parseInt(bpmInput, 10);

    if (isNaN(value)) {
      setBpmInput(bpm.toString());
      return;
    }

    const clamped = clampBpm(value);
    setBpm(clamped);
    setBpmInput(clamped.toString());
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
            <input
              type="text"
              inputMode="numeric"
              value={bpmInput}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className="metronome-input"
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
        <div className="metronome-slider">
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            className="metronome-slider-input"
          />

          <div className="metronome-slider-labels">
            {SLIDER_LABELS.map((value) => {
              const left =
                ((value - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;

              return (
                <span
                  key={value}
                  className="metronome-slider-label"
                  style={{ left: `${left}%` }}
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
