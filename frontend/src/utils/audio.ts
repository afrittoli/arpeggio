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

// Parse note from display name (e.g., "C major - 2 octaves" -> "C", "D♭ minor - 1 octave" -> "Db")
export function parseNoteFromDisplayName(displayName: string): string {
  // Match note letter, optional accidental (♭, ♯, b, #), at the start
  const match = displayName.match(/^([A-G])([♭♯b#])?/);
  if (!match) return "C"; // Default to C if parsing fails

  const note = match[1];
  const accidental = match[2];

  if (accidental === "♭" || accidental === "b") {
    return `${note}b`;
  } else if (accidental === "♯" || accidental === "#") {
    return `${note}#`;
  }
  return note;
}

// Get frequency for a note, defaulting to octave 2 for cello
export function getFrequencyForNote(note: string, octave = 2): number {
  const key = `${note}${octave}`;
  return NOTE_FREQUENCIES[key] ?? NOTE_FREQUENCIES["C2"];
}

export interface DroneNodes {
  oscillator1: OscillatorNode;
  oscillator2: OscillatorNode;
  gain1: GainNode;
  gain2: GainNode;
  filter: BiquadFilterNode;
  masterGain: GainNode;
}

export function createDroneNodes(
  audioContext: AudioContext,
  frequency: number
): DroneNodes {
  // Create two sawtooth oscillators with slight detune for richness
  const oscillator1 = audioContext.createOscillator();
  oscillator1.type = "sawtooth";
  oscillator1.frequency.setValueAtTime(frequency, audioContext.currentTime);

  const oscillator2 = audioContext.createOscillator();
  oscillator2.type = "sawtooth";
  oscillator2.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator2.detune.setValueAtTime(5, audioContext.currentTime); // Slight detune

  // Individual gain nodes for oscillators
  const gain1 = audioContext.createGain();
  gain1.gain.setValueAtTime(0.3, audioContext.currentTime);

  const gain2 = audioContext.createGain();
  gain2.gain.setValueAtTime(0.25, audioContext.currentTime);

  // Low-pass filter for warmth (cello-like)
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, audioContext.currentTime);
  filter.Q.setValueAtTime(1, audioContext.currentTime);

  // Master gain for fade in/out
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, audioContext.currentTime);

  // Connect: oscillators -> individual gains -> filter -> master gain -> destination
  oscillator1.connect(gain1);
  oscillator2.connect(gain2);
  gain1.connect(filter);
  gain2.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(audioContext.destination);

  return {
    oscillator1,
    oscillator2,
    gain1,
    gain2,
    filter,
    masterGain,
  };
}

export function startDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.3
): void {
  const now = audioContext.currentTime;

  // Start oscillators
  nodes.oscillator1.start(now);
  nodes.oscillator2.start(now);

  // Fade in
  nodes.masterGain.gain.setValueAtTime(0, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0.5, now + fadeTime);
}

export function stopDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.3
): void {
  const now = audioContext.currentTime;

  // Fade out
  nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

  // Stop oscillators after fade
  nodes.oscillator1.stop(now + fadeTime + 0.01);
  nodes.oscillator2.stop(now + fadeTime + 0.01);
}

export function changeDroneNote(
  nodes: DroneNodes,
  audioContext: AudioContext,
  newFrequency: number,
  glideTime = 0.1
): void {
  const now = audioContext.currentTime;

  nodes.oscillator1.frequency.setValueAtTime(
    nodes.oscillator1.frequency.value,
    now
  );
  nodes.oscillator1.frequency.linearRampToValueAtTime(
    newFrequency,
    now + glideTime
  );

  nodes.oscillator2.frequency.setValueAtTime(
    nodes.oscillator2.frequency.value,
    now
  );
  nodes.oscillator2.frequency.linearRampToValueAtTime(
    newFrequency,
    now + glideTime
  );
}
