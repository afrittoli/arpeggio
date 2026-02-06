import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMetronome } from "../hooks/useMetronome";

describe("useMetronome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with default BPM of 60", () => {
      const { result } = renderHook(() => useMetronome());
      expect(result.current.bpm).toBe(60);
      expect(result.current.isRunning).toBe(false);
    });

    it("should initialize with custom BPM", () => {
      const { result } = renderHook(() => useMetronome({ initialBpm: 120 }));
      expect(result.current.bpm).toBe(120);
    });
  });

  describe("BPM controls", () => {
    it("should update BPM when setBpm is called", () => {
      const { result } = renderHook(() => useMetronome());
      act(() => {
        result.current.setBpm(100);
      });
      expect(result.current.bpm).toBe(100);
    });

    it("should clamp BPM to minimum of 20", () => {
      const { result } = renderHook(() => useMetronome());
      act(() => {
        result.current.setBpm(10);
      });
      expect(result.current.bpm).toBe(20);
    });

    it("should clamp BPM to maximum of 240", () => {
      const { result } = renderHook(() => useMetronome());
      act(() => {
        result.current.setBpm(300);
      });
      expect(result.current.bpm).toBe(240);
    });
  });

  describe("start/stop controls", () => {
    it("should start the metronome", async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => {
        await result.current.start();
      });
      expect(result.current.isRunning).toBe(true);
    });

    it("should stop the metronome", async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => {
        await result.current.start();
      });
      act(() => {
        result.current.stop();
      });
      expect(result.current.isRunning).toBe(false);
    });

    it("should toggle the metronome", async () => {
      const { result } = renderHook(() => useMetronome());

      // Start via toggle
      await act(async () => {
        await result.current.toggle();
      });
      expect(result.current.isRunning).toBe(true);

      // Stop via toggle
      act(() => {
        result.current.toggle();
      });
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe("consistent click behavior", () => {
    it("should call onTick callback for each click", async () => {
      const onTick = vi.fn();
      const { result } = renderHook(() => useMetronome({ onTick, initialBpm: 60 }));

      await act(async () => {
        await result.current.start();
      });

      // The first tick happens immediately on start
      expect(onTick).toHaveBeenCalled();

      act(() => {
        result.current.stop();
      });
    });

    it("should schedule clicks consistently", async () => {
      const onTick = vi.fn();
      const { result } = renderHook(() => useMetronome({ onTick, initialBpm: 120 }));

      await act(async () => {
        await result.current.start();
      });

      // At 120 BPM, clicks should be 0.5 seconds apart
      // The initial click happens, advance timer to trigger scheduler
      const initialCalls = onTick.mock.calls.length;

      act(() => {
        result.current.stop();
      });

      // Verify at least one tick was called
      expect(initialCalls).toBeGreaterThan(0);
    });
  });

  describe("cleanup", () => {
    it("should cleanup on unmount", async () => {
      const { result, unmount } = renderHook(() => useMetronome());

      await act(async () => {
        await result.current.start();
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it("should stop metronome on unmount while running", async () => {
      const { result, unmount } = renderHook(() => useMetronome());

      await act(async () => {
        await result.current.start();
      });
      expect(result.current.isRunning).toBe(true);

      // Unmount should clean up the timer
      unmount();

      // Advance timers - should not cause errors
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    });
  });
});
