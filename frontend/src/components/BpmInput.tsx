import { useState, useEffect } from "react";

const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 240;

interface BpmInputProps {
  value: number | ""; // controlled value
  onChange: (value: number) => void; // debounced or live callback
  debounceMs?: number; // optional debounce
  onBlur?: (value: number) => void; // optional final commit on blur
  min?: number; // optional min value
  max?: number; // optional max value
}

export function BpmInput({
  value,
  onChange,
  debounceMs = 500,
  onBlur,
  min = DEFAULT_MIN_BPM,
  max = DEFAULT_MAX_BPM,
}: BpmInputProps) {
  const [inputValue, setInputValue] = useState<string>(value?.toString() ?? "");

  /** Debounce helper */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value?.toString() ?? "");
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const num = parseInt(inputValue, 10);
      if (!isNaN(num)) {
        const clamped = Math.min(max, Math.max(min, num));
        onChange(clamped);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [inputValue, debounceMs, onChange, min, max]);

  const handleBlur = () => {
    const num = parseInt(inputValue, 10);
    const clamped = isNaN(num) ? value || min : Math.min(max, Math.max(min, num));
    setInputValue(clamped.toString());
    onBlur?.(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={inputValue}
      onChange={(e) => {
        // allow empty string so user can type
        if (/^\d*$/.test(e.target.value)) setInputValue(e.target.value);
      }}
      onBlur={handleBlur}
    />
  );
}
