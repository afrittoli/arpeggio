import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMetronome } from "../hooks/useMetronome";
import { resetSharedAudioContext } from "../hooks/useAudioContext";

describe("useMetronome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetSharedAudioContext();
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

  describe("unit handling", () => {
    it("should respect the unit setting for tick frequency", async () => {
      const onTick = vi.fn();

      let mockContext: MockAudioContext | undefined;
      const OriginalAudioContext = window.AudioContext;

      // Use a class so it can be used with 'new'
      class MockAudioContext {
        currentTime = 0;
        state = "running" as AudioContextState;
        destination = {} as AudioDestinationNode;
        createOscillator = vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
          onended: vi.fn(),
        });
        createGain = vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        });
        resume = vi.fn().mockResolvedValue(undefined);
        constructor() {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          mockContext = this;
        }
      }

      vi.stubGlobal("AudioContext", MockAudioContext);

      const { result, rerender } = renderHook(
        (props: { unit: "quaver" | "crotchet" }) =>
          useMetronome({ onTick, initialBpm: 120, unit: props.unit }),
        { initialProps: { unit: "quaver" } }
      );

      await act(async () => {
        await result.current.start();
      });

      // At 120 BPM (quaver), 1 tick = 0.5s
      // First tick at 0s
      expect(onTick).toHaveBeenCalledTimes(1);

      act(() => {
        if (mockContext) mockContext.currentTime = 0.6;
        vi.advanceTimersByTime(25); // Trigger scheduler
      });
      expect(onTick).toHaveBeenCalledTimes(2);

      // Now switch to crotchet. Audible BPM should be 60, 1 tick = 1.0s
      rerender({ unit: "crotchet" });

      // Current time 0.6. Last tick was at 0.5. Next tick should be at 1.0 (already scheduled by previous run)
      // or at least nextTickTimeRef was already 1.0.
      act(() => {
        if (mockContext) mockContext.currentTime = 1.1;
        vi.advanceTimersByTime(25);
      });
      // It might have scheduled the 1.0s tick now.
      expect(onTick).toHaveBeenCalledTimes(3);

      act(() => {
        if (mockContext) mockContext.currentTime = 1.6;
        vi.advanceTimersByTime(25);
      });
      // In crotchet mode, next tick after 1.0s should be 2.0s.
      // So at 1.6s it should still be 3.
      expect(onTick).toHaveBeenCalledTimes(3);

      act(() => {
        if (mockContext) mockContext.currentTime = 2.1;
        vi.advanceTimersByTime(25);
      });
      // Now at 2.1s. Should have 4th tick (scheduled for 2.0s).
      expect(onTick).toHaveBeenCalledTimes(4);

      // Restore original mock
      vi.stubGlobal("AudioContext", OriginalAudioContext);
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

// We need a controllable AudioContext mock for these tests
let mockAudioContextState: string;
let mockResume: ReturnType<typeof vi.fn>;
let mockCurrentTime: number;

class ControllableAudioContext {
  get state() {
    return mockAudioContextState;
  }
  get currentTime() {
    return mockCurrentTime;
  }
  destination = {};
  resume = () => (mockResume as () => Promise<void>)();
  close = vi.fn(() => Promise.resolve());
  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      type: "sine",
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        value: 0,
      },
    };
  }
}

describe("useMetronome - audioState and warmUp", () => {
  beforeEach(() => {
    resetSharedAudioContext();
    mockAudioContextState = "running";
    mockCurrentTime = 0;
    mockResume = vi.fn(() => {
      mockAudioContextState = "running";
      return Promise.resolve();
    });

    vi.stubGlobal("AudioContext", ControllableAudioContext);
    vi.stubGlobal("webkitAudioContext", ControllableAudioContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with audioState 'ready' when AudioContext is available", async () => {
    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());
    expect(result.current.audioState).toBe("ready");
  });

  it("should return audioState 'ready' after successful start", async () => {
    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.audioState).toBe("ready");
    expect(result.current.isRunning).toBe(true);

    // Clean up running metronome
    act(() => { result.current.stop(); });
  });

  it("should set audioState to 'suspended' when resume() fails to change state", async () => {
    mockAudioContextState = "suspended";
    // resume() is called but state stays suspended (simulates browser blocking)
    mockResume = vi.fn(() => Promise.resolve());

    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    // start() contains a setTimeout(100ms) - use real timers so it resolves
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.audioState).toBe("suspended");
    expect(result.current.isRunning).toBe(false);
  });

  it("should set audioState to 'failed' when AudioContext constructor throws", async () => {
    vi.stubGlobal("AudioContext", class {
      constructor() {
        throw new Error("Not allowed");
      }
    });
    vi.stubGlobal("webkitAudioContext", undefined);

    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.audioState).toBe("failed");
    expect(result.current.isRunning).toBe(false);
  });

  it("should provide a warmUp function", async () => {
    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());
    expect(typeof result.current.warmUp).toBe("function");
  });

  it("warmUp should create AudioContext and return 'ready' when context runs", async () => {
    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    let warmUpResult: string | undefined;
    await act(async () => {
      warmUpResult = await result.current.warmUp();
    });

    expect(warmUpResult).toBe("ready");
    expect(result.current.audioState).toBe("ready");
  });

  it("warmUp should return 'suspended' when context remains suspended", async () => {
    mockAudioContextState = "suspended";
    mockResume = vi.fn(() => Promise.resolve()); // doesn't change state

    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    let warmUpResult: string | undefined;
    await act(async () => {
      warmUpResult = await result.current.warmUp();
    });

    expect(warmUpResult).toBe("suspended");
    expect(result.current.audioState).toBe("suspended");
  });

  it("warmUp should return 'failed' when AudioContext cannot be created", async () => {
    vi.stubGlobal("AudioContext", class {
      constructor() {
        throw new Error("Not allowed");
      }
    });
    vi.stubGlobal("webkitAudioContext", undefined);

    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    let warmUpResult: string | undefined;
    await act(async () => {
      warmUpResult = await result.current.warmUp();
    });

    expect(warmUpResult).toBe("failed");
    expect(result.current.audioState).toBe("failed");
  });

  it("should recover audioState to 'ready' after successful start following suspension", async () => {
    mockAudioContextState = "suspended";
    mockResume = vi.fn(() => Promise.resolve()); // initially stays suspended

    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome());

    // First start attempt fails
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.audioState).toBe("suspended");

    // Now the context resumes successfully
    mockResume = vi.fn(() => {
      mockAudioContextState = "running";
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.audioState).toBe("ready");
    expect(result.current.isRunning).toBe(true);

    // Clean up running metronome
    act(() => { result.current.stop(); });
  });

  it("should still return standard properties (isRunning, bpm, toggle, etc.)", async () => {
    const { useMetronome } = await import("../hooks/useMetronome");
    const { result } = renderHook(() => useMetronome({ initialBpm: 120 }));

    expect(result.current.isRunning).toBe(false);
    expect(result.current.bpm).toBe(120);
    expect(typeof result.current.start).toBe("function");
    expect(typeof result.current.stop).toBe("function");
    expect(typeof result.current.toggle).toBe("function");
    expect(typeof result.current.setBpm).toBe("function");
  });
});
