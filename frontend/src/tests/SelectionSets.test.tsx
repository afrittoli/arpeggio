import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfigPage from "../pages/ConfigPage";

// Mock the API client
vi.mock("../api/client", () => ({
  getScales: vi.fn().mockResolvedValue([
    {
      id: 1,
      note: "C",
      accidental: null,
      type: "major",
      octaves: 2,
      enabled: true,
      weight: 1.0,
      target_bpm: null,
      articulation_mode: "both",
      display_name: "C major - 2 octaves",
    },
    {
      id: 2,
      note: "D",
      accidental: null,
      type: "minor_harmonic",
      octaves: 2,
      enabled: false,
      weight: 1.0,
      target_bpm: null,
      articulation_mode: "both",
      display_name: "D minor harmonic - 2 octaves",
    },
  ]),
  getArpeggios: vi.fn().mockResolvedValue([
    {
      id: 1,
      note: "G",
      accidental: null,
      type: "major",
      octaves: 2,
      enabled: true,
      weight: 1.0,
      target_bpm: null,
      articulation_mode: "both",
      display_name: "G major arpeggio - 2 octaves",
    },
  ]),
  getAlgorithmConfig: vi.fn().mockResolvedValue({
    config: {
      total_items: 5,
      variation: 20,
      slots: [
        { name: "Tonal Scales", types: ["major"], item_type: "scale", percent: 100 },
      ],
      octave_variety: true,
      slurred_percent: 50,
      weighting: {
        base_multiplier: 1.0,
        days_since_practice_factor: 7,
        practice_count_divisor: 1,
      },
      default_scale_bpm: 60,
      default_arpeggio_bpm: 72,
      scale_bpm_unit: "crotchet",
      arpeggio_bpm_unit: "quaver",
      weekly_focus: {
        enabled: false,
        keys: [],
        types: [],
        categories: [],
        probability_increase: 80,
      },
    },
  }),
  getSelectionSets: vi.fn().mockResolvedValue([]),
  getActiveSelectionSet: vi.fn().mockResolvedValue(null),
  createSelectionSet: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Set",
    is_active: false,
    scale_ids: [1],
    arpeggio_ids: [1],
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-01T00:00:00",
  }),
  updateSelectionSet: vi.fn().mockResolvedValue({}),
  deleteSelectionSet: vi.fn().mockResolvedValue({ deleted: true }),
  loadSelectionSet: vi.fn().mockResolvedValue({
    loaded: true,
    scales_enabled: 1,
    scales_disabled: 1,
    arpeggios_enabled: 1,
    arpeggios_disabled: 0,
  }),
  deactivateSelectionSets: vi.fn().mockResolvedValue({ deactivated_count: 1 }),
  updateAlgorithmConfig: vi.fn().mockResolvedValue({}),
  updateScale: vi.fn(),
  updateArpeggio: vi.fn(),
  bulkEnableScales: vi.fn(),
  bulkEnableArpeggios: vi.fn(),
  bulkArticulationScales: vi.fn(),
  bulkArticulationArpeggios: vi.fn(),
  resetAlgorithmConfig: vi.fn(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("ConfigPage - Selection Sets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the selection set bar on Repertoire tab", async () => {
    render(<ConfigPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Select a set...")).toBeInTheDocument();
    });
  });

  it("should show Save button", async () => {
    render(<ConfigPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });

  it("should open save dialog when Save button is clicked", async () => {
    render(<ConfigPage />, { wrapper });

    await waitFor(() => screen.getByRole("button", { name: "Save" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Save Selection Set")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter set name...")).toBeInTheDocument();
    });
  });

  it("should call createSelectionSet when saving a new set", async () => {
    const { createSelectionSet } = await import("../api/client");

    render(<ConfigPage />, { wrapper });

    await waitFor(() => screen.getByRole("button", { name: "Save" }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => screen.getByPlaceholderText("Enter set name..."));

    const input = screen.getByPlaceholderText("Enter set name...");
    fireEvent.change(input, { target: { value: "My New Set" } });

    // Click the save button in the dialog
    const dialogSaveButton = screen.getAllByRole("button", { name: "Save" })[1];
    fireEvent.click(dialogSaveButton);

    await waitFor(() => {
      expect(createSelectionSet).toHaveBeenCalledWith({
        name: "My New Set",
        scale_ids: [1], // Only C major is enabled
        arpeggio_ids: [1], // G major arpeggio is enabled
      });
    });
  });

  it("should display selection sets in the dropdown", async () => {
    const { getSelectionSets } = await import("../api/client");
    (getSelectionSets as Mock).mockResolvedValueOnce([
      {
        id: 1,
        name: "Practice Set A",
        is_active: false,
        scale_ids: [1],
        arpeggio_ids: [],
        created_at: "2024-01-01T00:00:00",
        updated_at: "2024-01-01T00:00:00",
      },
      {
        id: 2,
        name: "Practice Set B",
        is_active: true,
        scale_ids: [2],
        arpeggio_ids: [1],
        created_at: "2024-01-01T00:00:00",
        updated_at: "2024-01-01T00:00:00",
      },
    ]);

    render(<ConfigPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Practice Set A")).toBeInTheDocument();
      expect(screen.getByText("Practice Set B (active)")).toBeInTheDocument();
    });
  });

  it("should call loadSelectionSet when selecting a set from dropdown", async () => {
    const { getSelectionSets, loadSelectionSet } = await import("../api/client");
    (getSelectionSets as Mock).mockResolvedValue([
      {
        id: 1,
        name: "Test Set",
        is_active: false,
        scale_ids: [1],
        arpeggio_ids: [],
        created_at: "2024-01-01T00:00:00",
        updated_at: "2024-01-01T00:00:00",
      },
    ]);

    render(<ConfigPage />, { wrapper });

    await waitFor(() => screen.getByText("Test Set"));

    const dropdown = screen.getByRole("combobox", { hidden: true }) as HTMLSelectElement;
    fireEvent.change(dropdown, { target: { value: "1" } });

    await waitFor(() => {
      expect(loadSelectionSet).toHaveBeenCalledWith(1);
    });
  });

  it("should show Delete and Deactivate buttons when a set is active", async () => {
    const { getActiveSelectionSet } = await import("../api/client");
    (getActiveSelectionSet as Mock).mockResolvedValueOnce({
      id: 1,
      name: "Active Set",
      is_active: true,
      scale_ids: [1],
      arpeggio_ids: [],
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:00:00",
    });

    render(<ConfigPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    });
  });

  it("should call deactivateSelectionSets when Deactivate button is clicked", async () => {
    const { getActiveSelectionSet, deactivateSelectionSets } = await import(
      "../api/client"
    );
    (getActiveSelectionSet as Mock).mockResolvedValueOnce({
      id: 1,
      name: "Active Set",
      is_active: true,
      scale_ids: [1],
      arpeggio_ids: [],
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:00:00",
    });

    render(<ConfigPage />, { wrapper });

    await waitFor(() => screen.getByRole("button", { name: "Deactivate" }));

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(deactivateSelectionSets).toHaveBeenCalled();
    });
  });

  it("should show delete confirmation dialog when Delete button is clicked", async () => {
    const { getActiveSelectionSet } = await import("../api/client");
    (getActiveSelectionSet as Mock).mockResolvedValueOnce({
      id: 1,
      name: "Active Set",
      is_active: true,
      scale_ids: [1],
      arpeggio_ids: [],
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:00:00",
    });

    render(<ConfigPage />, { wrapper });

    await waitFor(() => screen.getByRole("button", { name: "Delete" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Delete Selection Set")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete "Active Set"/)
      ).toBeInTheDocument();
    });
  });
});
