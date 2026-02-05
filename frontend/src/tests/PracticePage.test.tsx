import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
});
