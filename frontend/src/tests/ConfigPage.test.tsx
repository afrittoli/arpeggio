import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfigPage from "../pages/ConfigPage";

// Mock the API client
vi.mock("../api/client", () => ({
  getScales: vi.fn().mockResolvedValue([]),
  getArpeggios: vi.fn().mockResolvedValue([]),
  getAlgorithmConfig: vi.fn().mockResolvedValue({
    config: {
      total_items: 5,
      variation: 20,
      slots: [
        { name: "Tonal Scales", types: ["major"], item_type: "scale", percent: 100 }
      ],
      octave_variety: true,
      slurred_percent: 50,
      weighting: { base_multiplier: 1.0, days_since_practice_factor: 7, practice_count_divisor: 1 },
      default_scale_bpm: 60,
      default_arpeggio_bpm: 72,
      weekly_focus: {
        enabled: false,
        keys: [],
        types: [],
        probability_increase: 80
      }
    }
  }),
  updateAlgorithmConfig: vi.fn().mockResolvedValue({}),
  updateScale: vi.fn(),
  updateArpeggio: vi.fn(),
  bulkEnableScales: vi.fn(),
  bulkEnableArpeggios: vi.fn(),
  resetAlgorithmConfig: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("ConfigPage - Weekly Focus", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("should render Weekly Focus section in its own tab", async () => {
    render(<ConfigPage />, { wrapper });

    // Switch to Weekly Focus tab
    fireEvent.click(screen.getByText("Weekly Focus"));

    await waitFor(() => {
      expect(screen.getByText("Enable Weekly Focus:")).toBeInTheDocument();
    });
  });

  it("should show focus selectors when enabled", async () => {
    const { getAlgorithmConfig } = await import("../api/client");
    (getAlgorithmConfig as Mock).mockResolvedValueOnce({
      config: {
        weekly_focus: {
          enabled: true,
          keys: ["A"],
          types: ["major"],
          probability_increase: 80
        },
        slots: [],
        weighting: {}
      }
    });

    render(<ConfigPage />, { wrapper });
    fireEvent.click(screen.getByText("Weekly Focus"));

    await waitFor(() => {
      expect(screen.getByText("Focus Keys:")).toBeInTheDocument();
      expect(screen.getByText("Focus Types:")).toBeInTheDocument();
    });

    // Check if "A" chip is active
    const aChip = screen.getByText("A");
    expect(aChip).toHaveClass("active");

    // Check if "major" chip is active
    const majorChip = screen.getByText("major");
    expect(majorChip).toHaveClass("active");
  });

  it("should call updateAlgorithmConfig when a chip is clicked", async () => {
    const { getAlgorithmConfig, updateAlgorithmConfig } = await import("../api/client");
    const mockConfig = {
      total_items: 5,
      slots: [],
      weighting: {},
      weekly_focus: {
        enabled: true,
        keys: [],
        types: [],
        probability_increase: 80
      }
    };
    (getAlgorithmConfig as Mock).mockResolvedValue({ config: mockConfig });

    render(<ConfigPage />, { wrapper });
    fireEvent.click(screen.getByText("Weekly Focus"));

    await waitFor(() => screen.getByText("Focus Keys:"));

    const bChip = screen.getByText("B");
    fireEvent.click(bChip);

    await waitFor(() => {
      expect(updateAlgorithmConfig).toHaveBeenCalledWith(expect.objectContaining({
        weekly_focus: expect.objectContaining({
          keys: ["B"]
        })
      }));
    });
  });

  it("should update probability boost when slider changes", async () => {
    const { getAlgorithmConfig, updateAlgorithmConfig } = await import("../api/client");
    const mockConfig = {
      total_items: 5,
      slots: [],
      weighting: {},
      weekly_focus: {
        enabled: true,
        keys: [],
        types: [],
        probability_increase: 80
      }
    };
    (getAlgorithmConfig as Mock).mockResolvedValue({ config: mockConfig });

    render(<ConfigPage />, { wrapper });
    fireEvent.click(screen.getByText("Weekly Focus"));

    await waitFor(() => screen.getByText("Probability Boost:"));

    const sliderLabel = screen.getByText("Probability Boost:");
    const slider = sliderLabel.parentElement?.querySelector('input[type="range"]');
    if (!slider) throw new Error("Slider not found");
    fireEvent.change(slider, { target: { value: "90" } });

    await waitFor(() => {
      expect(updateAlgorithmConfig).toHaveBeenCalledWith(expect.objectContaining({
        weekly_focus: expect.objectContaining({
          probability_increase: 90
        })
      }));
    });
  });
});
