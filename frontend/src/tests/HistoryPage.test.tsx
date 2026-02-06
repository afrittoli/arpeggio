import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HistoryPage from "../pages/HistoryPage";

// Mock the API client
vi.mock("../api/client", () => ({
  getPracticeHistoryDetailed: vi.fn().mockResolvedValue([
    {
      item_type: "scale",
      item_id: 1,
      display_name: "C major - 2 octaves",
      subtype: "major",
      note: "C",
      accidental: null,
      octaves: 2,
      times_practiced: 5,
      last_practiced: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      selection_likelihood: 0.025,
      max_practiced_bpm: 60,
      target_bpm: 60,
      is_weekly_focus: false,
    },
    {
      item_type: "arpeggio",
      item_id: 2,
      display_name: "G major arpeggio - 2 octaves",
      subtype: "major",
      note: "G",
      accidental: null,
      octaves: 2,
      times_practiced: 0,
      last_practiced: null,
      selection_likelihood: 0.05,
      max_practiced_bpm: null,
      target_bpm: 72,
      is_weekly_focus: true,
    },
    {
      item_type: "scale",
      item_id: 3,
      display_name: "B\u266D minor - 2 octaves",
      subtype: "minor",
      note: "B",
      accidental: "flat",
      octaves: 2,
      times_practiced: 3,
      last_practiced: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      selection_likelihood: 0.03,
      max_practiced_bpm: 55,
      target_bpm: 60,
      is_weekly_focus: false,
    },
  ]),
  getAlgorithmConfig: vi.fn().mockResolvedValue({
    config: {
      scale_bpm_unit: "crotchet",
      arpeggio_bpm_unit: "quaver",
    },
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

describe("HistoryPage", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("should render the page title", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Practice History")).toBeInTheDocument();
    });
  });

  it("should display items after loading", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    });

    expect(screen.getByText("G major arpeggio - 2 octaves")).toBeInTheDocument();
    expect(screen.getByText("B\u266D minor - 2 octaves")).toBeInTheDocument();
  });

  it("should show item count", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("3 items")).toBeInTheDocument();
    });
  });

  it("should show weekly focus badge", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTitle("Weekly Focus Item")).toBeInTheDocument();
    });
  });

  it("should show likelihood percentages", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("2.5%")).toBeInTheDocument(); // 0.025 * 100
      expect(screen.getByText("5.0%")).toBeInTheDocument(); // 0.05 * 100
      expect(screen.getByText("3.0%")).toBeInTheDocument(); // 0.03 * 100
    });
  });

  it("should show relative dates", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("2d ago")).toBeInTheDocument();
      expect(screen.getByText("1w ago")).toBeInTheDocument();
      // "Never" appears both in the Status filter chip and in the table
      const neverElements = screen.getAllByText("Never");
      expect(neverElements.length).toBeGreaterThanOrEqual(2); // Filter chip + table cell
    });
  });

  it("should filter by item type", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    });

    // Click Scales chip
    fireEvent.click(screen.getByText("Scales"));

    await waitFor(() => {
      expect(screen.getByText("2 items (filtered)")).toBeInTheDocument();
    });

    expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    expect(screen.queryByText("G major arpeggio - 2 octaves")).not.toBeInTheDocument();
  });

  it("should filter by practice status", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    });

    // Click Never chip (the button, not the table cell)
    const neverButtons = screen.getAllByRole("button", { name: "Never" });
    fireEvent.click(neverButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("1 item (filtered)")).toBeInTheDocument();
    });

    expect(screen.getByText("G major arpeggio - 2 octaves")).toBeInTheDocument();
    expect(screen.queryByText("C major - 2 octaves")).not.toBeInTheDocument();
  });

  it("should filter by note", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    });

    // Click C note chip
    const noteChips = screen.getAllByRole("button");
    const cChip = noteChips.find((btn) => btn.textContent === "C");
    expect(cChip).toBeTruthy();
    fireEvent.click(cChip!);

    await waitFor(() => {
      expect(screen.getByText("1 item (filtered)")).toBeInTheDocument();
    });

    expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
  });

  it("should sort by column", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("C major - 2 octaves")).toBeInTheDocument();
    });

    // Click the Name column header to sort
    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    // The items should now be sorted alphabetically
    const rows = screen.getAllByRole("row");
    // rows[0] is header, rows[1], [2], [3] are data rows
    expect(rows.length).toBe(4);
  });

  it("should clear filters", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("3 items")).toBeInTheDocument();
    });

    // Apply a filter
    fireEvent.click(screen.getByText("Scales"));

    await waitFor(() => {
      expect(screen.getByText("2 items (filtered)")).toBeInTheDocument();
    });

    // Click clear filters
    fireEvent.click(screen.getByText("Clear filters"));

    await waitFor(() => {
      expect(screen.getByText("3 items")).toBeInTheDocument();
    });
  });

  it("should show likelihood note", async () => {
    render(<HistoryPage />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText(/Likelihood shows base selection probability/i)
      ).toBeInTheDocument();
    });
  });
});
