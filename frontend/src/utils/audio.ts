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
  oscillators: OscillatorNode[];
  gains: GainNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  formantFilter: BiquadFilterNode;
  masterGain: GainNode;
}

export function createDroneNodes(
  audioContext: AudioContext,
  frequency: number
): DroneNodes {
  const now = audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  // Harmonic structure for cello-like timbre:
  // - Fundamental with sawtooth (rich harmonics)
  // - Sub-octave for depth
  // - Octave above at lower volume
  // - Fifth (3:2 ratio) for richness
  const harmonics = [
    { freqMult: 0.5, gain: 0.15, detune: 0 },     // Sub-octave
    { freqMult: 1.0, gain: 0.35, detune: 0 },     // Fundamental
    { freqMult: 1.0, gain: 0.30, detune: 6 },     // Fundamental slightly detuned (chorus)
    { freqMult: 1.5, gain: 0.08, detune: 0 },     // Fifth
    { freqMult: 2.0, gain: 0.12, detune: -4 },    // Octave
  ];

  harmonics.forEach((h) => {
    const osc = audioContext.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(frequency * h.freqMult, now);
    osc.detune.setValueAtTime(h.detune, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(h.gain, now);

    oscillators.push(osc);
    gains.push(gain);
  });

  // Vibrato LFO - subtle pitch wobble characteristic of bowed strings
  const lfo = audioContext.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(5.5, now); // ~5-6 Hz vibrato rate

  const lfoGain = audioContext.createGain();
  lfoGain.gain.setValueAtTime(3, now); // Subtle vibrato depth in cents

  // Low-pass filter for warmth
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, now); // Lower cutoff for warmer sound
  filter.Q.setValueAtTime(0.7, now);

  // Formant/body resonance filter - simulates cello body
  const formantFilter = audioContext.createBiquadFilter();
  formantFilter.type = "peaking";
  formantFilter.frequency.setValueAtTime(250, now); // Cello body resonance ~200-300Hz
  formantFilter.Q.setValueAtTime(2, now);
  formantFilter.gain.setValueAtTime(4, now);

  // Master gain for fade in/out
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, now);

  // Connect LFO to oscillator frequencies for vibrato
  lfo.connect(lfoGain);
  oscillators.forEach((osc) => {
    lfoGain.connect(osc.detune);
  });

  // Connect: oscillators -> gains -> filter -> formant -> master -> destination
  oscillators.forEach((osc, i) => {
    osc.connect(gains[i]);
    gains[i].connect(filter);
  });
  filter.connect(formantFilter);
  formantFilter.connect(masterGain);
  masterGain.connect(audioContext.destination);

  return {
    oscillators,
    gains,
    lfo,
    lfoGain,
    filter,
    formantFilter,
    masterGain,
  };
}

export function startDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.5
): void {
  const now = audioContext.currentTime;

  // Start all oscillators and LFO
  nodes.oscillators.forEach((osc) => osc.start(now));
  nodes.lfo.start(now);

  // Fade in with slight filter sweep for bow attack simulation
  nodes.masterGain.gain.setValueAtTime(0, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0.6, now + fadeTime);

  // Open up filter slightly during attack, then settle
  nodes.filter.frequency.setValueAtTime(400, now);
  nodes.filter.frequency.linearRampToValueAtTime(700, now + fadeTime * 0.3);
  nodes.filter.frequency.linearRampToValueAtTime(600, now + fadeTime);
}

export function stopDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.4
): void {
  const now = audioContext.currentTime;

  // Fade out with filter closing (bow lift simulation)
  nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

  nodes.filter.frequency.setValueAtTime(nodes.filter.frequency.value, now);
  nodes.filter.frequency.linearRampToValueAtTime(200, now + fadeTime);

  // Stop all oscillators and LFO after fade
  const stopTime = now + fadeTime + 0.01;
  nodes.oscillators.forEach((osc) => osc.stop(stopTime));
  nodes.lfo.stop(stopTime);
}

// Harmonic multipliers must match createDroneNodes
const HARMONIC_MULTIPLIERS = [0.5, 1.0, 1.0, 1.5, 2.0];

export function changeDroneNote(
  nodes: DroneNodes,
  audioContext: AudioContext,
  newFrequency: number,
  glideTime = 0.1
): void {
  const now = audioContext.currentTime;

  nodes.oscillators.forEach((osc, i) => {
    const targetFreq = newFrequency * HARMONIC_MULTIPLIERS[i];
    osc.frequency.setValueAtTime(osc.frequency.value, now);
    osc.frequency.linearRampToValueAtTime(targetFreq, now + glideTime);
  });
}
