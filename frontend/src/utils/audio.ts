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
  oscillators: OscillatorNode[];
  gains: GainNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  // Bow noise excitation
  bowNoise: AudioBufferSourceNode;
  bowNoiseGain: GainNode;
  bowFilter: BiquadFilterNode;
  // Bow pressure variation
  pressureLfo: OscillatorNode;
  pressureLfoGain: GainNode;
  // Filters
  filter: BiquadFilterNode;
  bodyResonances: BiquadFilterNode[];
  masterGain: GainNode;
}

// Create a noise buffer for bow friction simulation
function createNoiseBuffer(audioContext: AudioContext, duration = 2): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const bufferSize = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  // Pink-ish noise (more natural than white noise)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  return buffer;
}

export function createDroneNodes(
  audioContext: AudioContext,
  frequency: number
): DroneNodes {
  const now = audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  // Harmonic structure for cello-like timbre
  const harmonics = [
    { freqMult: 0.5, gain: 0.12, detune: 0 },     // Sub-octave
    { freqMult: 1.0, gain: 0.30, detune: 0 },     // Fundamental
    { freqMult: 1.0, gain: 0.25, detune: 5 },     // Fundamental slightly detuned (chorus)
    { freqMult: 1.5, gain: 0.06, detune: 0 },     // Fifth
    { freqMult: 2.0, gain: 0.10, detune: -3 },    // Octave
    { freqMult: 3.0, gain: 0.04, detune: 2 },     // Octave + fifth
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
  lfo.frequency.setValueAtTime(5.2, now); // ~5 Hz vibrato rate

  const lfoGain = audioContext.createGain();
  lfoGain.gain.setValueAtTime(4, now); // Vibrato depth in cents

  // === BOW NOISE EXCITATION (physical modeling) ===
  // Simulates the friction/rosin noise of bow on string
  const noiseBuffer = createNoiseBuffer(audioContext);
  const bowNoise = audioContext.createBufferSource();
  bowNoise.buffer = noiseBuffer;
  bowNoise.loop = true;

  // Filter the noise to focus on bow friction frequencies
  const bowFilter = audioContext.createBiquadFilter();
  bowFilter.type = "bandpass";
  bowFilter.frequency.setValueAtTime(frequency * 2, now); // Track the note
  bowFilter.Q.setValueAtTime(1.5, now);

  const bowNoiseGain = audioContext.createGain();
  bowNoiseGain.gain.setValueAtTime(0, now); // Start silent, fade in

  // === BOW PRESSURE VARIATION ===
  // Slow amplitude modulation simulating bow pressure changes
  const pressureLfo = audioContext.createOscillator();
  pressureLfo.type = "sine";
  pressureLfo.frequency.setValueAtTime(0.3, now); // Very slow ~0.3 Hz

  const pressureLfoGain = audioContext.createGain();
  pressureLfoGain.gain.setValueAtTime(0.03, now); // Subtle variation

  // === LOW-PASS FILTER ===
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, now);
  filter.Q.setValueAtTime(0.5, now);

  // === BODY RESONANCES (physical modeling) ===
  // Cello body has several resonant modes - model the main ones
  const bodyResonances: BiquadFilterNode[] = [];

  // Main body resonances for cello (approximate frequencies)
  const resonanceFreqs = [
    { freq: 175, q: 4, gain: 3 },   // Main air resonance (A0)
    { freq: 280, q: 5, gain: 4 },   // Main wood resonance (T1)
    { freq: 470, q: 3, gain: 2 },   // Higher body mode
    { freq: 700, q: 2, gain: 1.5 }, // Bridge resonance
  ];

  resonanceFreqs.forEach((r) => {
    const resonance = audioContext.createBiquadFilter();
    resonance.type = "peaking";
    resonance.frequency.setValueAtTime(r.freq, now);
    resonance.Q.setValueAtTime(r.q, now);
    resonance.gain.setValueAtTime(r.gain, now);
    bodyResonances.push(resonance);
  });

  // Master gain for fade in/out
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0, now);

  // === CONNECTIONS ===

  // Vibrato LFO -> oscillator detune
  lfo.connect(lfoGain);
  oscillators.forEach((osc) => {
    lfoGain.connect(osc.detune);
  });

  // Bow pressure LFO -> master gain (subtle amplitude variation)
  pressureLfo.connect(pressureLfoGain);
  pressureLfoGain.connect(masterGain.gain);

  // Bow noise chain: noise -> bandpass -> gain -> filter
  bowNoise.connect(bowFilter);
  bowFilter.connect(bowNoiseGain);
  bowNoiseGain.connect(filter);

  // Oscillators -> gains -> filter
  oscillators.forEach((osc, i) => {
    osc.connect(gains[i]);
    gains[i].connect(filter);
  });

  // Filter -> body resonances (in series) -> master -> destination
  let currentNode: AudioNode = filter;
  bodyResonances.forEach((resonance) => {
    currentNode.connect(resonance);
    currentNode = resonance;
  });
  currentNode.connect(masterGain);
  masterGain.connect(audioContext.destination);

  return {
    oscillators,
    gains,
    lfo,
    lfoGain,
    bowNoise,
    bowNoiseGain,
    bowFilter,
    pressureLfo,
    pressureLfoGain,
    filter,
    bodyResonances,
    masterGain,
  };
}

export function startDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.6
): void {
  const now = audioContext.currentTime;

  // Start all oscillators and LFOs
  nodes.oscillators.forEach((osc) => osc.start(now));
  nodes.lfo.start(now);
  nodes.pressureLfo.start(now);
  nodes.bowNoise.start(now);

  // Fade in master gain (simulates bow engaging string)
  nodes.masterGain.gain.setValueAtTime(0, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0.55, now + fadeTime);

  // Bow noise fades in slightly after attack (rosin catching)
  nodes.bowNoiseGain.gain.setValueAtTime(0, now);
  nodes.bowNoiseGain.gain.linearRampToValueAtTime(0.015, now + fadeTime * 0.5);
  nodes.bowNoiseGain.gain.linearRampToValueAtTime(0.008, now + fadeTime);

  // Filter sweep simulates bow attack - starts narrow, opens up
  nodes.filter.frequency.setValueAtTime(300, now);
  nodes.filter.frequency.linearRampToValueAtTime(600, now + fadeTime * 0.4);
  nodes.filter.frequency.linearRampToValueAtTime(500, now + fadeTime);

  // Bow filter tracks note with slight variation during attack
  const currentBowFreq = nodes.bowFilter.frequency.value;
  nodes.bowFilter.frequency.setValueAtTime(currentBowFreq * 0.8, now);
  nodes.bowFilter.frequency.linearRampToValueAtTime(currentBowFreq, now + fadeTime * 0.3);
}

export function stopDrone(
  nodes: DroneNodes,
  audioContext: AudioContext,
  fadeTime = 0.5
): void {
  const now = audioContext.currentTime;

  // Fade out master gain (bow lifting from string)
  nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, now);
  nodes.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

  // Bow noise fades out faster (friction stops)
  nodes.bowNoiseGain.gain.setValueAtTime(nodes.bowNoiseGain.gain.value, now);
  nodes.bowNoiseGain.gain.linearRampToValueAtTime(0, now + fadeTime * 0.6);

  // Filter closes as bow lifts
  nodes.filter.frequency.setValueAtTime(nodes.filter.frequency.value, now);
  nodes.filter.frequency.linearRampToValueAtTime(150, now + fadeTime);

  // Stop all oscillators and sources after fade
  const stopTime = now + fadeTime + 0.01;
  nodes.oscillators.forEach((osc) => osc.stop(stopTime));
  nodes.lfo.stop(stopTime);
  nodes.pressureLfo.stop(stopTime);
  nodes.bowNoise.stop(stopTime);
}

// Harmonic multipliers must match createDroneNodes
const HARMONIC_MULTIPLIERS = [0.5, 1.0, 1.0, 1.5, 2.0, 3.0];

export function changeDroneNote(
  nodes: DroneNodes,
  audioContext: AudioContext,
  newFrequency: number,
  glideTime = 0.15
): void {
  const now = audioContext.currentTime;

  // Glide oscillators to new note
  nodes.oscillators.forEach((osc, i) => {
    const targetFreq = newFrequency * HARMONIC_MULTIPLIERS[i];
    osc.frequency.setValueAtTime(osc.frequency.value, now);
    osc.frequency.linearRampToValueAtTime(targetFreq, now + glideTime);
  });

  // Update bow filter to track the new note
  const bowFilterTarget = newFrequency * 2;
  nodes.bowFilter.frequency.setValueAtTime(nodes.bowFilter.frequency.value, now);
  nodes.bowFilter.frequency.linearRampToValueAtTime(bowFilterTarget, now + glideTime);
}
