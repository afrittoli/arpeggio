import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDrone } from "../hooks/useDrone";

// Mock the audio utils to avoid complex setup in hook tests
vi.mock("../utils/audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/audio")>();
  return {
    ...actual,
    loadDroneBuffer: vi.fn().mockResolvedValue({}),
    createDroneNodes: vi.fn().mockReturnValue({
      source: { start: vi.fn(), stop: vi.fn() },
      masterGain: { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), value: 0 } },
    }),
    startDrone: vi.fn(),
    stopDrone: vi.fn(),
  };
});

describe("useDrone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with no playing item", () => {
    const { result } = renderHook(() => useDrone());
    expect(result.current.playingItemKey).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });

  it("should play a drone and update state", async () => {
    const { result } = renderHook(() => useDrone());

    await act(async () => {
      await result.current.play("item-1", "C");
    });

    expect(result.current.playingItemKey).toBe("item-1");
    expect(result.current.isPlaying).toBe(true);
  });

  it("should stop the drone and clear state", async () => {
    const { result } = renderHook(() => useDrone());

    await act(async () => {
      await result.current.play("item-1", "C");
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.playingItemKey).toBeNull();
    expect(result.current.isPlaying).toBe(false);
  });

  it("should stop drone when document becomes hidden", async () => {
    const { result } = renderHook(() => useDrone());

    await act(async () => {
      await result.current.play("item-1", "C");
    });

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.playingItemKey).toBeNull();

    // Reset document.hidden
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
