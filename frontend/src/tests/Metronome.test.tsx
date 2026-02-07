import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Metronome from "../components/Metronome";

// Mock the hook
const mockSetBpm = vi.fn();
const mockToggle = vi.fn();
const mockStop = vi.fn();
const mockStart = vi.fn(() => Promise.resolve());
const mockWarmUp = vi.fn(() => Promise.resolve("ready" as const));
let mockAudioState: "ready" | "suspended" | "failed" = "ready";

vi.mock("../hooks/useMetronome", () => ({
  useMetronome: vi.fn(() => ({
    isRunning: false,
    bpm: 60,
    setBpm: mockSetBpm,
    toggle: mockToggle,
    stop: mockStop,
    start: mockStart,
    warmUp: mockWarmUp,
    audioState: mockAudioState,
  })),
}));

describe("Metronome Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAudioState = "ready";
    // Re-apply mock with current mockAudioState
    const { useMetronome } = vi.mocked(
      await import("../hooks/useMetronome")
    );
    useMetronome.mockReturnValue({
      isRunning: false,
      bpm: 60,
      setBpm: mockSetBpm,
      toggle: mockToggle,
      stop: mockStop,
      start: mockStart,
      warmUp: mockWarmUp,
      audioState: mockAudioState,
    });
  });

  it("should be initially disabled and hide controls", () => {
    render(<Metronome />);
    expect(screen.getByLabelText("Metronome")).not.toBeChecked();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
  });

  it("should show controls when enabled", () => {
    render(<Metronome />);
    const checkbox = screen.getByLabelText("Metronome");
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("♪=")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("60").length).toBeGreaterThanOrEqual(1);
  });

  it("should call setBpm when clicking adjust buttons", () => {
    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    fireEvent.click(screen.getByText("+5"));
    expect(mockSetBpm).toHaveBeenCalledWith(65);

    fireEvent.click(screen.getByText("-5"));
    expect(mockSetBpm).toHaveBeenCalledWith(55);
  });

  it("should call toggle when clicking play button", () => {
    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    fireEvent.click(screen.getByText("Start"));
    expect(mockToggle).toHaveBeenCalled();
  });

  it("should call warmUp when the metronome is enabled", () => {
    render(<Metronome />);
    const checkbox = screen.getByLabelText("Metronome");
    fireEvent.click(checkbox);

    expect(mockWarmUp).toHaveBeenCalled();
  });

  it("should show suspended warning when audioState is suspended", async () => {
    mockAudioState = "suspended";
    const { useMetronome } = vi.mocked(
      await import("../hooks/useMetronome")
    );
    useMetronome.mockReturnValue({
      isRunning: false,
      bpm: 60,
      setBpm: mockSetBpm,
      toggle: mockToggle,
      stop: mockStop,
      start: mockStart,
      warmUp: mockWarmUp,
      audioState: "suspended",
    });

    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    expect(screen.getByText("Audio blocked - tap Start")).toBeInTheDocument();
  });

  it("should show failed warning when audioState is failed", async () => {
    mockAudioState = "failed";
    const { useMetronome } = vi.mocked(
      await import("../hooks/useMetronome")
    );
    useMetronome.mockReturnValue({
      isRunning: false,
      bpm: 60,
      setBpm: mockSetBpm,
      toggle: mockToggle,
      stop: mockStop,
      start: mockStart,
      warmUp: mockWarmUp,
      audioState: "failed",
    });

    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    expect(screen.getByText("Audio unavailable")).toBeInTheDocument();
  });

  it("should not show audio warning when audioState is ready", () => {
    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    expect(screen.queryByText("Audio blocked - tap Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Audio unavailable")).not.toBeInTheDocument();
  });

  it("should add audio-suspended class to play button when suspended", async () => {
    const { useMetronome } = vi.mocked(
      await import("../hooks/useMetronome")
    );
    useMetronome.mockReturnValue({
      isRunning: false,
      bpm: 60,
      setBpm: mockSetBpm,
      toggle: mockToggle,
      stop: mockStop,
      start: mockStart,
      warmUp: mockWarmUp,
      audioState: "suspended",
    });

    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    const startButton = screen.getByText("Start");
    expect(startButton.classList.contains("audio-suspended")).toBe(true);
  });

  it("should disable play button when audioState is failed", async () => {
    const { useMetronome } = vi.mocked(
      await import("../hooks/useMetronome")
    );
    useMetronome.mockReturnValue({
      isRunning: false,
      bpm: 60,
      setBpm: mockSetBpm,
      toggle: mockToggle,
      stop: mockStop,
      start: mockStart,
      warmUp: mockWarmUp,
      audioState: "failed",
    });

    render(<Metronome />);
    fireEvent.click(screen.getByLabelText("Metronome"));

    const startButton = screen.getByText("Start");
    expect(startButton).toBeDisabled();
  });
});
