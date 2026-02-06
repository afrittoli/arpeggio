import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PracticePage from "../pages/PracticePage";

// Mock the API client
vi.mock("../api/client", () => ({
  generateSet: vi.fn().mockResolvedValue({
    items: [
      { id: 1, type: "scale", display_name: "C major - 2 octaves", target_bpm: 60, articulation: "slurred", octaves: 2 },
    ],
  }),
  createPracticeSession: vi.fn().mockResolvedValue({ id: 100 }),
  getPracticeHistory: vi.fn().mockResolvedValue([]),
  getAlgorithmConfig: vi.fn().mockResolvedValue({
    config: {
      scale_bpm_unit: "crotchet",
      arpeggio_bpm_unit: "quaver",
    },
  }),
}));

// Mock the drone hook
vi.mock("../hooks/useDrone", () => ({
  useDrone: () => ({
    playingItemKey: null,
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: false,
  }),
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

describe("PracticePage", () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should show generate button initially", () => {
    render(<PracticePage />, { wrapper });
    expect(screen.getByText("Generate Practice Set")).toBeInTheDocument();
  });

  it("should generate a practice set and display items", async () => {
    render(<PracticePage />, { wrapper });

    fireEvent.click(screen.getByText("Generate Practice Set"));

    await waitFor(() => {
      expect(screen.getByText("C major")).toBeInTheDocument();
    });

    // With default crotchet unit for scales, 60 quaver = 30 crotchet
    expect(screen.getByText("2 octaves, ♩ = 30")).toBeInTheDocument();
  });

  it("should toggle articulation checkboxes", async () => {
    render(<PracticePage />, { wrapper });

    fireEvent.click(screen.getByText("Generate Practice Set"));

    await waitFor(() => screen.getByText("C major"));

    const checkboxes = screen.getAllByRole("checkbox");
    // [0] is slurred, [1] is separate, [2] is record bpm
    // Wait, let's find by label content if possible or just use index for now

    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();
  });

  it("should allow recording BPM", async () => {
    render(<PracticePage />, { wrapper });

    fireEvent.click(screen.getByText("Generate Practice Set"));

    await waitFor(() => screen.getByText("C major"));

    // First, check an articulation to enable BPM recording
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // slurred

    const recordBpmToggle = screen.getByTitle("Record practice BPM");
    const checkbox = recordBpmToggle.querySelector('input[type="checkbox"]')!;

    fireEvent.click(checkbox);

    const bpmInput = screen.getByRole("spinbutton");
    // Default to target_bpm (60 quaver), displayed as crotchet (30)
    expect(bpmInput).toHaveValue(30);

    fireEvent.change(bpmInput, { target: { value: "35" } });
    expect(bpmInput).toHaveValue(35);
  });

  it("should allow generating a new set when one is already present", async () => {
    const { generateSet } = await import("../api/client");
    render(<PracticePage />, { wrapper });

    // Initial generation
    fireEvent.click(screen.getByText("Generate Practice Set"));
    await waitFor(() => screen.getByText("C major"));

    // Button should now say "Generate New Set"
    const generateNewBtn = screen.getByText("Generate New Set");
    expect(generateNewBtn).toBeInTheDocument();

    // Click it again
    fireEvent.click(generateNewBtn);

    await waitFor(() => {
      // It should have been called twice now
      expect(generateSet).toHaveBeenCalledTimes(2);
    });
  });

  it("should allow generating another set after submission", async () => {
    const { generateSet } = await import("../api/client");
    render(<PracticePage />, { wrapper });

    // Generate and display items
    fireEvent.click(screen.getByText("Generate Practice Set"));
    await waitFor(() => screen.getByText("C major"));

    // Check one articulation to make it a valid practice
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    // Submit
    fireEvent.click(screen.getByText("Submit to History"));
    await waitFor(() => screen.getByText(/Practice session saved!/));

    // Button should say "Generate Another Set"
    const generateAnotherBtn = screen.getByText("Generate Another Set");
    fireEvent.click(generateAnotherBtn);

    await waitFor(() => {
      // It should have been called twice (once initially, once after submission)
      expect(generateSet).toHaveBeenCalledTimes(2);
      expect(screen.getByText("C major")).toBeInTheDocument();
    });
  });

  it("should show error message when generation fails", async () => {
    const { generateSet } = await import("../api/client");
    (generateSet as Mock).mockRejectedValueOnce(new Error("Failed to generate"));

    render(<PracticePage />, { wrapper });

    fireEvent.click(screen.getByText("Generate Practice Set"));

    await waitFor(() => {
      expect(screen.getByText(/Error generating practice set/)).toBeInTheDocument();
    });
  });

  it("should show weekly focus badge for items with is_weekly_focus", async () => {
    const { generateSet } = await import("../api/client");
    (generateSet as Mock).mockResolvedValueOnce({
      items: [
        {
          id: 1,
          type: "scale",
          display_name: "C major - 2 octaves",
          target_bpm: 60,
          articulation: "slurred",
          octaves: 2,
          is_weekly_focus: true,
        },
      ],
    });

    render(<PracticePage />, { wrapper });

    fireEvent.click(screen.getByText("Generate Practice Set"));

    await waitFor(() => {
      expect(screen.getByTitle("Weekly Focus Item")).toBeInTheDocument();
      expect(screen.getByText("★")).toBeInTheDocument();
    });
  });

  it("should clear previous practice state when generating a new set", async () => {
    const { generateSet } = await import("../api/client");
    (generateSet as Mock).mockResolvedValue({
      items: [
        { id: 1, type: "scale", display_name: "C major - 2 octaves", target_bpm: 60, articulation: "slurred", octaves: 2 },
      ],
    });

    render(<PracticePage />, { wrapper });

    // Generate first set
    fireEvent.click(screen.getByText("Generate Practice Set"));
    await waitFor(() => screen.getByText("C major"));

    // Check an item
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Generate new set
    fireEvent.click(screen.getByText("Generate New Set"));

    await waitFor(() => {
      // It should still have C major (since mock returns same)
      expect(screen.getByText("C major")).toBeInTheDocument();
      // But the checkbox should be unchecked now
      const newCheckboxes = screen.getAllByRole("checkbox");
      expect(newCheckboxes[0]).not.toBeChecked();
    });
  });

  describe("BPM unit display", () => {
    it("should display BPM in quaver notation when scale_bpm_unit is quaver", async () => {
      const { getAlgorithmConfig } = await import("../api/client");
      (getAlgorithmConfig as Mock).mockResolvedValue({
        config: { scale_bpm_unit: "quaver", arpeggio_bpm_unit: "quaver" },
      });

      render(<PracticePage />, { wrapper });
      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => {
        expect(screen.getByText(/♪ = 60/)).toBeInTheDocument();
      });
    });

    it("should display BPM in crotchet notation when scale_bpm_unit is crotchet", async () => {
      const { generateSet, getAlgorithmConfig } = await import("../api/client");
      (generateSet as Mock).mockResolvedValue({
        items: [
          { id: 1, type: "scale", display_name: "C major - 2 octaves", target_bpm: 120, articulation: "slurred", octaves: 2 },
        ],
      });
      (getAlgorithmConfig as Mock).mockResolvedValue({
        config: { scale_bpm_unit: "crotchet", arpeggio_bpm_unit: "quaver" },
      });

      render(<PracticePage />, { wrapper });
      fireEvent.click(screen.getByText("Generate Practice Set"));

      // 120 quaver = 60 crotchet
      await waitFor(() => {
        expect(screen.getByText(/♩ = 60/)).toBeInTheDocument();
      });
    });

    it("should use different BPM units for scales and arpeggios", async () => {
      const { generateSet, getAlgorithmConfig } = await import("../api/client");
      (generateSet as Mock).mockResolvedValue({
        items: [
          { id: 1, type: "scale", display_name: "C major - 2 octaves", target_bpm: 120, articulation: "slurred", octaves: 2 },
          { id: 2, type: "arpeggio", display_name: "C major arpeggio - 2 octaves", target_bpm: 80, articulation: "separate", octaves: 2 },
        ],
      });
      (getAlgorithmConfig as Mock).mockResolvedValue({
        config: { scale_bpm_unit: "crotchet", arpeggio_bpm_unit: "quaver" },
      });

      render(<PracticePage />, { wrapper });
      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => {
        // Scale: 120 quaver displayed as 60 crotchet
        expect(screen.getByText(/♩ = 60/)).toBeInTheDocument();
        // Arpeggio: 80 quaver displayed as 80 quaver
        expect(screen.getByText(/♪ = 80/)).toBeInTheDocument();
      });
    });

    it("should convert BPM input to quaver when unit is crotchet", async () => {
      const { generateSet, getAlgorithmConfig, createPracticeSession } = await import("../api/client");
      (generateSet as Mock).mockResolvedValue({
        items: [
          { id: 1, type: "scale", display_name: "C major - 2 octaves", target_bpm: 120, articulation: "slurred", octaves: 2 },
        ],
      });
      (getAlgorithmConfig as Mock).mockResolvedValue({
        config: { scale_bpm_unit: "crotchet", arpeggio_bpm_unit: "quaver" },
      });

      render(<PracticePage />, { wrapper });
      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // First check slurred articulation to enable BPM recording
      const slurredCheckbox = screen.getAllByRole("checkbox")[0];
      fireEvent.click(slurredCheckbox);

      // Enable record BPM
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const checkbox = recordBpmToggle.querySelector('input[type="checkbox"]')!;
      fireEvent.click(checkbox);

      // BPM input should show crotchet value (120 quaver = 60 crotchet)
      const bpmInput = screen.getByRole("spinbutton");
      expect(bpmInput).toHaveValue(60);

      // Change to 65 crotchet (should be stored as 130 quaver)
      fireEvent.change(bpmInput, { target: { value: "65" } });
      expect(bpmInput).toHaveValue(65);

      // Submit
      fireEvent.click(screen.getByText("Submit to History"));

      await waitFor(() => {
        // Verify the submitted BPM is in quaver (65 * 2 = 130)
        expect(createPracticeSession).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              practiced_bpm: 130,
              target_bpm: 120,
            }),
          ])
        );
      });
    });
  });

  describe("BPM recording requires articulation", () => {
    it("should disable BPM recording checkbox when no articulation is checked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // The record BPM checkbox should be disabled initially
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const recordBpmCheckbox = recordBpmToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

      expect(recordBpmCheckbox).toBeDisabled();
    });

    it("should enable BPM recording checkbox when slurred articulation is checked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Check slurred articulation
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // slurred

      // The record BPM checkbox should now be enabled
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const recordBpmCheckbox = recordBpmToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

      expect(recordBpmCheckbox).not.toBeDisabled();
    });

    it("should enable BPM recording checkbox when separate articulation is checked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Check separate articulation
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]); // separate

      // The record BPM checkbox should now be enabled
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const recordBpmCheckbox = recordBpmToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

      expect(recordBpmCheckbox).not.toBeDisabled();
    });

    it("should auto-disable BPM recording when both articulations are unchecked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Check slurred articulation first
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // slurred - now checked

      // Enable BPM recording
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const recordBpmCheckbox = recordBpmToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(recordBpmCheckbox);

      expect(recordBpmCheckbox).toBeChecked();

      // Now uncheck slurred articulation
      fireEvent.click(checkboxes[0]); // slurred - now unchecked

      // BPM recording should be auto-disabled
      expect(recordBpmCheckbox).not.toBeChecked();
      expect(recordBpmCheckbox).toBeDisabled();
    });

    it("should keep BPM recording enabled when one articulation remains checked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Check both articulations
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // slurred
      fireEvent.click(checkboxes[1]); // separate

      // Enable BPM recording
      const recordBpmToggle = screen.getByTitle("Record practice BPM");
      const recordBpmCheckbox = recordBpmToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(recordBpmCheckbox);

      expect(recordBpmCheckbox).toBeChecked();

      // Uncheck slurred, but separate is still checked
      fireEvent.click(checkboxes[0]); // slurred - now unchecked

      // BPM recording should remain enabled and checked
      expect(recordBpmCheckbox).toBeChecked();
      expect(recordBpmCheckbox).not.toBeDisabled();
    });

    it("should show hint text when BPM recording is disabled", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Should show hint about marking practice first
      expect(screen.getByText("Mark practiced first")).toBeInTheDocument();
    });

    it("should hide hint text when articulation is checked", async () => {
      render(<PracticePage />, { wrapper });

      fireEvent.click(screen.getByText("Generate Practice Set"));

      await waitFor(() => screen.getByText("C major"));

      // Check slurred articulation
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // slurred

      // Hint should no longer be visible
      expect(screen.queryByText("Mark practiced first")).not.toBeInTheDocument();
    });
  });
});
