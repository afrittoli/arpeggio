import { useCallback } from "react";

interface DroneButtonProps {
  note: string;
  itemKey: string;
  isPlaying: boolean;
  isDisabled: boolean;
  onPlay: (itemKey: string, note: string) => void;
  onStop: () => void;
}

function DroneButton({
  note,
  itemKey,
  isPlaying,
  isDisabled,
  onPlay,
  onStop,
}: DroneButtonProps) {
  const handleClick = useCallback(() => {
    if (isPlaying) {
      onStop();
    } else {
      onPlay(itemKey, note);
    }
  }, [isPlaying, itemKey, note, onPlay, onStop]);

  return (
    <button
      className={`drone-btn ${isPlaying ? "playing" : ""}`}
      onClick={handleClick}
      disabled={isDisabled && !isPlaying}
      title={isPlaying ? "Stop drone" : `Play ${note} drone`}
      aria-label={isPlaying ? "Stop drone" : `Play ${note} drone`}
    >
      {isPlaying ? (
        // Stop icon (square with rounded corners)
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" ry="2" />
        </svg>
      ) : (
        // Play icon (triangle)
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}

export default DroneButton;
