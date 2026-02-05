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

    expect(screen.getByText("2 octaves, ♪ = 60")).toBeInTheDocument();
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

    const recordBpmToggle = screen.getByTitle("Record practice BPM");
    const checkbox = recordBpmToggle.querySelector('input[type="checkbox"]')!;

    fireEvent.click(checkbox);

    const bpmInput = screen.getByRole("spinbutton");
    expect(bpmInput).toHaveValue(60); // Default to target_bpm

    fireEvent.change(bpmInput, { target: { value: "70" } });
    expect(bpmInput).toHaveValue(70);
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
});
