import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Metronome from "../components/Metronome";

// Mock the hook
const mockSetBpm = vi.fn();
const mockToggle = vi.fn();
const mockStop = vi.fn();

vi.mock("../hooks/useMetronome", () => ({
  useMetronome: vi.fn(() => ({
    isRunning: false,
    bpm: 60,
    setBpm: mockSetBpm,
    toggle: mockToggle,
    stop: mockStop,
  })),
}));

describe("Metronome Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
