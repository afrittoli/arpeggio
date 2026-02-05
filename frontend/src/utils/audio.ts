// Note frequencies for cello range (C2 to A3)
export const NOTE_FREQUENCIES: Record<string, number> = {
  C2: 65.41,
  "C#2": 69.3,
  "Db2": 69.3,
  D2: 73.42,
  "D#2": 77.78,
  "Eb2": 77.78,
  E2: 82.41,
  F2: 87.31,
  "F#2": 92.5,
  "Gb2": 92.5,
  G2: 98.0,
  "G#2": 103.83,
  "Ab2": 103.83,
  A2: 110.0,
  "A#2": 116.54,
  "Bb2": 116.54,
  B2: 123.47,
  C3: 130.81,
  "C#3": 138.59,
  "Db3": 138.59,
  D3: 146.83,
  "D#3": 155.56,
  "Eb3": 155.56,
  E3: 164.81,
  F3: 174.61,
  "F#3": 185.0,
  "Gb3": 185.0,
  G3: 196.0,
  "G#3": 207.65,
  "Ab3": 207.65,
  A3: 220.0,
};

export const DRONE_NOTES = Object.keys(NOTE_FREQUENCIES);

// Normalize enharmonic equivalents to notes that exist in our frequency table
// E# -> F, B# -> C, Cb -> B, Fb -> E
function normalizeNote(note: string): string {
  const enharmonicMap: Record<string, string> = {
    "E#": "F",
    "B#": "C",
    "Cb": "B",
    "Fb": "E",
  };
  return enharmonicMap[note] ?? note;
}

// Parse note from display name (e.g., "C major - 2 octaves" -> "C", "D♭ minor - 1 octave" -> "Db")
export function parseNoteFromDisplayName(displayName: string): string {
  // Match note letter, optional accidental (♭, ♯, b, #), at the start
  const match = displayName.match(/^([A-G])([♭♯b#])?/);
  if (!match) return "C"; // Default to C if parsing fails

  const note = match[1];
  const accidental = match[2];

  let result: string;
  if (accidental === "♭" || accidental === "b") {
    result = `${note}b`;
  } else if (accidental === "♯" || accidental === "#") {
    result = `${note}#`;
  } else {
    result = note;
  }

  return normalizeNote(result);
}

// Get frequency for a note, defaulting to octave 3 for cello
export function getFrequencyForNote(note: string, octave = 3): number {
  const key = `${note}${octave}`;
  return NOTE_FREQUENCIES[key] ?? NOTE_FREQUENCIES["C3"];
}

export interface DroneNodes {
  source: AudioBufferSourceNode;
  masterGain: GainNode;
}

// Map of notes to their corresponding audio files
const NOTE_TO_FILE: Record<string, string> = {
  "A": "A.m4a",
  "A#": "Bb.m4a",
  "Ab": "Ab.m4a",
  "B": "B.m4a",
  "Bb": "Bb.m4a",
  "C": "C.m4a",
  "C#": "Db.m4a",
  "D": "D.m4a",
  "Db": "Db.m4a",
  "D#": "Eb.m4a",
  "Eb": "Eb.m4a",
  "E": "E.m4a",
  "F": "F.m4a",
  "F#": "Gb.m4a",
  "Gb": "Gb.m4a",
  "G": "G.m4a",
  "G#": "Ab.m4a",
};

export async function loadDroneBuffer(
  audioContext: AudioContext,
  note: string
): Promise<AudioBuffer> {
  const fileName = NOTE_TO_FILE[note];
  if (!fileName) {
    throw new Error(`No audio file for note: ${note}`);
  }

  const response = await fetch(`/drones/${fileName}`);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

export function createDroneNodes(
  audioContext: AudioContext,
  buffer: AudioBuffer
): DroneNodes {
  const now = audioContext.currentTime;

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, now);

  source.connect(masterGain);
  masterGain.connect(audioContext.destination);

  return {
    source,
    masterGain,
  };
}

export function startDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.6
): void {
  const now = audioContext.currentTime;

  nodes.source.start(now);

  // Fade in master gain
  nodes.masterGain.gain.setValueAtTime(0, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0.8, now + fadeTime);
}

export function stopDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.5
): void {
  const now = audioContext.currentTime;

  // Fade out master gain
  nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

  // Stop source after fade
  nodes.source.stop(now + fadeTime + 0.01);
}
