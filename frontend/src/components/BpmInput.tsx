import { useState, useEffect, useRef } from "react";

const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 240;

interface BpmInputProps {
  value: number | "" | null; // controlled value
  onChange: (value: number) => void; // debounced or live callback
  debounceMs?: number; // optional debounce
  onBlur?: (value: number) => void; // optional final commit on blur
  min?: number; // optional min value
  max?: number; // optional max value
  placeholder?: string; // optional placeholder
}

export function BpmInput({
  value,
  onChange,
  debounceMs = 500,
  onBlur,
  min = DEFAULT_MIN_BPM,
  max = DEFAULT_MAX_BPM,
  placeholder,
}: BpmInputProps) {
  const [inputValue, setInputValue] = useState<string>(value?.toString() ?? "");
  const lastPropValueRef = useRef(value);

  /** Sync prop → state */
  useEffect(() => {
    if (value !== lastPropValueRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(value?.toString() ?? "");
      lastPropValueRef.current = value;
    }
  }, [value]);

  /** Debounce input changes */
  useEffect(() => {
    // Skip if inputValue matches current prop (already synced)
    if (inputValue === (lastPropValueRef.current?.toString() ?? "")) {
      return;
    }

    const handler = setTimeout(() => {
      if (inputValue === "") {
        onChange(0); // 0 means clear/default
        return;
      }

      const num = parseInt(inputValue, 10);
      if (!isNaN(num)) {
        const clamped = Math.min(max, Math.max(min, num));
        // If it was 0 or invalid before and now we have a valid number, we call onChange
        // OR if it changed from the last prop value
        if (clamped !== lastPropValueRef.current) {
          onChange(clamped);
        }
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [inputValue, debounceMs, onChange, min, max]);

  const handleBlur = () => {
    if (inputValue === "") {
      if (lastPropValueRef.current !== 0 && lastPropValueRef.current !== null) {
        onChange(0);
      }
      onBlur?.(0);
      return;
    }

    const num = parseInt(inputValue, 10);
    const clamped = isNaN(num) ? (value || min) : Math.min(max, Math.max(min, num));
    setInputValue(clamped.toString());

    if (clamped !== lastPropValueRef.current) {
      onChange(clamped as number);
    }
    onBlur?.(clamped as number);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={inputValue}
      placeholder={placeholder}
      onChange={(e) => {
        // allow empty string so user can type
        if (/^\d*$/.test(e.target.value)) setInputValue(e.target.value);
      }}
      onBlur={handleBlur}
    />
  );
}
