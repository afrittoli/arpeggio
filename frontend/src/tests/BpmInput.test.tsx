import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BpmInput } from "../components/BpmInput";

describe("BpmInput Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with initial value", () => {
    render(<BpmInput value={60} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("60");
  });

  it("should call onChange with clamped value after debounce", async () => {
    const onChange = vi.fn();
    render(<BpmInput value={60} onChange={onChange} min={20} max={240} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "100" } });

    // Should not be called immediately
    expect(onChange).not.toHaveBeenCalled();

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onChange).toHaveBeenCalledWith(100);
  });

  it("should clamp values to min/max", async () => {
    const onChange = vi.fn();
    render(<BpmInput value={60} onChange={onChange} min={20} max={240} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "10" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledWith(20);

    fireEvent.change(input, { target: { value: "300" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledWith(240);
  });

  it("should call onChange(0) when input is cleared", async () => {
    const onChange = vi.fn();
    render(<BpmInput value={60} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("should NOT call onChange if value prop changes but matches current input", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<BpmInput value={60} onChange={onChange} />);

    // Initial sync should not trigger onChange
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).not.toHaveBeenCalled();

    // Rerender with same value
    rerender(<BpmInput value={60} onChange={onChange} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("should handle null value prop by showing empty string", () => {
    render(<BpmInput value={null} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("should call onChange(clamped) on blur", () => {
    const onChange = vi.fn();
    render(<BpmInput value={60} onChange={onChange} min={20} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "15" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(20);
    expect((input as HTMLInputElement).value).toBe("20");
  });

  it("should call onChange(0) on blur if cleared", () => {
    const onChange = vi.fn();
    render(<BpmInput value={60} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });
});
