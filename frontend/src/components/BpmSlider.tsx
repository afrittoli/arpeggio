import { useRef, useCallback, useEffect, useState } from "react";

interface BpmSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  tickMarks?: number[];
  ariaLabel?: string;
}

/**
 * Custom BPM slider component with precise thumb positioning.
 * Uses a div-based track instead of native range input to ensure
 * the thumb visually aligns exactly with the displayed BPM value.
 */
export function BpmSlider({
  value,
  min,
  max,
  onChange,
  tickMarks = [],
  ariaLabel = "BPM slider",
}: BpmSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate thumb position as exact percentage
  const thumbPosition = ((value - min) / (max - min)) * 100;

  // Convert a position on the track to a BPM value
  const positionToValue = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return value;

      const rect = trackRef.current.getBoundingClientRect();
      const position = (clientX - rect.left) / rect.width;
      const clampedPosition = Math.max(0, Math.min(1, position));
      const newValue = Math.round(min + clampedPosition * (max - min));

      return Math.max(min, Math.min(max, newValue));
    },
    [min, max, value]
  );

  // Handle click on track
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const newValue = positionToValue(e.clientX);
      onChange(newValue);
    },
    [positionToValue, onChange]
  );

  // Handle mouse down on thumb
  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  // Handle touch start on thumb
  const handleThumbTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  // Handle mouse/touch move during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = positionToValue(e.clientX);
      onChange(newValue);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const newValue = positionToValue(e.touches[0].clientX);
        onChange(newValue);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, positionToValue, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let newValue = value;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          newValue = Math.max(min, value - 1);
          e.preventDefault();
          break;
        case "ArrowRight":
        case "ArrowUp":
          newValue = Math.min(max, value + 1);
          e.preventDefault();
          break;
        case "Home":
          newValue = min;
          e.preventDefault();
          break;
        case "End":
          newValue = max;
          e.preventDefault();
          break;
        case "PageDown":
          newValue = Math.max(min, value - 10);
          e.preventDefault();
          break;
        case "PageUp":
          newValue = Math.min(max, value + 10);
          e.preventDefault();
          break;
        default:
          return;
      }

      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [value, min, max, onChange]
  );

  return (
    <div className="bpm-slider-container">
      <div
        ref={trackRef}
        className="bpm-slider-track"
        onClick={handleTrackClick}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Filled portion of track */}
        <div
          className="bpm-slider-fill"
          style={{ width: `${thumbPosition}%` }}
        />

        {/* Tick marks */}
        {tickMarks.map((tick) => {
          const tickPosition = ((tick - min) / (max - min)) * 100;
          return (
            <div
              key={tick}
              className="bpm-slider-tick"
              style={{ left: `${tickPosition}%` }}
            />
          );
        })}

        {/* Thumb */}
        <div
          className={`bpm-slider-thumb ${isDragging ? "dragging" : ""}`}
          style={{ left: `${thumbPosition}%` }}
          onMouseDown={handleThumbMouseDown}
          onTouchStart={handleThumbTouchStart}
        />
      </div>

      {/* Labels */}
      <div className="bpm-slider-labels">
        {tickMarks.map((tick) => {
          const tickPosition = ((tick - min) / (max - min)) * 100;
          return (
            <span
              key={tick}
              className="bpm-slider-label"
              style={{
                position: "absolute",
                left: `${tickPosition}%`,
                transform: "translateX(-50%)",
              }}
            >
              {tick}
            </span>
          );
        })}
      </div>
    </div>
  );
}
