import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BpmSlider } from "../components/BpmSlider";

describe("BpmSlider Component", () => {
  const defaultProps = {
    value: 60,
    min: 20,
    max: 240,
    onChange: vi.fn(),
    tickMarks: [20, 60, 120, 180, 240],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render with correct ARIA attributes", () => {
      render(<BpmSlider {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute("aria-valuemin", "20");
      expect(slider).toHaveAttribute("aria-valuemax", "240");
      expect(slider).toHaveAttribute("aria-valuenow", "60");
    });

    it("should render with custom aria-label", () => {
      render(<BpmSlider {...defaultProps} ariaLabel="Custom BPM control" />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Custom BPM control");
    });

    it("should render tick marks", () => {
      const { container } = render(<BpmSlider {...defaultProps} />);

      const ticks = container.querySelectorAll(".bpm-slider-tick");
      expect(ticks).toHaveLength(5);
    });

    it("should render labels for tick marks", () => {
      render(<BpmSlider {...defaultProps} />);

      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("60")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
      expect(screen.getByText("180")).toBeInTheDocument();
      expect(screen.getByText("240")).toBeInTheDocument();
    });

    it("should render without tick marks when not provided", () => {
      const { container } = render(
        <BpmSlider value={60} min={20} max={240} onChange={vi.fn()} />
      );

      const ticks = container.querySelectorAll(".bpm-slider-tick");
      expect(ticks).toHaveLength(0);
    });
  });

  describe("Thumb positioning", () => {
    it("should position thumb at 0% when value equals min", () => {
      const { container } = render(
        <BpmSlider {...defaultProps} value={20} />
      );

      const thumb = container.querySelector(".bpm-slider-thumb");
      expect(thumb).toHaveStyle({ left: "0%" });
    });

    it("should position thumb at 100% when value equals max", () => {
      const { container } = render(
        <BpmSlider {...defaultProps} value={240} />
      );

      const thumb = container.querySelector(".bpm-slider-thumb");
      expect(thumb).toHaveStyle({ left: "100%" });
    });

    it("should position thumb at correct percentage for middle values", () => {
      // For value=130, min=20, max=240: (130-20)/(240-20) = 110/220 = 50%
      const { container } = render(
        <BpmSlider {...defaultProps} value={130} />
      );

      const thumb = container.querySelector(".bpm-slider-thumb");
      expect(thumb).toHaveStyle({ left: "50%" });
    });

    it("should update fill width to match thumb position", () => {
      const { container } = render(
        <BpmSlider {...defaultProps} value={130} />
      );

      const fill = container.querySelector(".bpm-slider-fill");
      expect(fill).toHaveStyle({ width: "50%" });
    });
  });

  describe("Keyboard navigation", () => {
    it("should increase value with ArrowRight", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(onChange).toHaveBeenCalledWith(61);
    });

    it("should decrease value with ArrowLeft", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowLeft" });

      expect(onChange).toHaveBeenCalledWith(59);
    });

    it("should increase value with ArrowUp", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowUp" });

      expect(onChange).toHaveBeenCalledWith(61);
    });

    it("should decrease value with ArrowDown", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowDown" });

      expect(onChange).toHaveBeenCalledWith(59);
    });

    it("should jump to min with Home key", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "Home" });

      expect(onChange).toHaveBeenCalledWith(20);
    });

    it("should jump to max with End key", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "End" });

      expect(onChange).toHaveBeenCalledWith(240);
    });

    it("should decrease by 10 with PageDown", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "PageDown" });

      expect(onChange).toHaveBeenCalledWith(50);
    });

    it("should increase by 10 with PageUp", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "PageUp" });

      expect(onChange).toHaveBeenCalledWith(70);
    });

    it("should not go below min value", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} value={20} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowLeft" });

      // onChange should not be called when value can't change
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should not go above max value", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} value={240} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      // onChange should not be called when value can't change
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should not call onChange for unhandled keys", () => {
      const onChange = vi.fn();
      render(<BpmSlider {...defaultProps} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "a" });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Mouse interactions", () => {
    it("should add dragging class when mouse is pressed on thumb", () => {
      const { container } = render(<BpmSlider {...defaultProps} />);

      const thumb = container.querySelector(".bpm-slider-thumb")!;
      fireEvent.mouseDown(thumb);

      expect(thumb).toHaveClass("dragging");
    });

    it("should remove dragging class on mouse up", () => {
      const { container } = render(<BpmSlider {...defaultProps} />);

      const thumb = container.querySelector(".bpm-slider-thumb")!;
      fireEvent.mouseDown(thumb);
      fireEvent.mouseUp(document);

      expect(thumb).not.toHaveClass("dragging");
    });
  });

  describe("Touch interactions", () => {
    it("should add dragging class when touch starts on thumb", () => {
      const { container } = render(<BpmSlider {...defaultProps} />);

      const thumb = container.querySelector(".bpm-slider-thumb")!;
      fireEvent.touchStart(thumb);

      expect(thumb).toHaveClass("dragging");
    });

    it("should remove dragging class on touch end", () => {
      const { container } = render(<BpmSlider {...defaultProps} />);

      const thumb = container.querySelector(".bpm-slider-thumb")!;
      fireEvent.touchStart(thumb);
      fireEvent.touchEnd(document);

      expect(thumb).not.toHaveClass("dragging");
    });
  });

  describe("Crotchet mode (half values)", () => {
    it("should work with crotchet range (10-120)", () => {
      const onChange = vi.fn();
      const { container } = render(
        <BpmSlider
          value={60}
          min={10}
          max={120}
          onChange={onChange}
          tickMarks={[10, 30, 60, 90, 120]}
        />
      );

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-valuemin", "10");
      expect(slider).toHaveAttribute("aria-valuemax", "120");
      expect(slider).toHaveAttribute("aria-valuenow", "60");

      // Thumb should be at 50% for value 60 in range 10-120
      // (60-10)/(120-10) = 50/110 ≈ 45.45%
      const thumb = container.querySelector(".bpm-slider-thumb");
      const expectedPosition = ((60 - 10) / (120 - 10)) * 100;
      expect(thumb).toHaveStyle({ left: `${expectedPosition}%` });
    });

    it("should render crotchet tick marks", () => {
      render(
        <BpmSlider
          value={60}
          min={10}
          max={120}
          onChange={vi.fn()}
          tickMarks={[10, 30, 60, 90, 120]}
        />
      );

      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("60")).toBeInTheDocument();
      expect(screen.getByText("90")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should be focusable", () => {
      render(<BpmSlider {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("tabIndex", "0");
    });

    it("should have proper role", () => {
      render(<BpmSlider {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toBeInTheDocument();
    });
  });
});
