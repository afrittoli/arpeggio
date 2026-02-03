import { useState, useEffect } from "react";

const MIN_BPM = 20;
const MAX_BPM = 240;

interface BpmInputProps {
  value: number | ""; // controlled value
  onChange: (value: number) => void; // debounced or live callback
  debounceMs?: number; // optional debounce
  onBlur?: (value: number) => void; // optional final commit on blur
}

export function BpmInput({
  value,
  onChange,
  debounceMs = 500,
  onBlur,
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
        const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, num));
        onChange(clamped);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [inputValue, debounceMs, onChange]);

  const handleBlur = () => {
    const num = parseInt(inputValue, 10);
    const clamped = isNaN(num) ? value || MIN_BPM : Math.min(MAX_BPM, Math.max(MIN_BPM, num));
    setInputValue(clamped.toString());
    onBlur?.(clamped);
  };

  return (
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      value={inputValue}
      onChange={(e) => {
        // allow empty string so user can type
        if (/^\d*$/.test(e.target.value)) setInputValue(e.target.value);
      }}
      onBlur={handleBlur}
    />
  );
}
