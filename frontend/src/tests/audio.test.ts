import { describe, it, expect } from "vitest";
import { parseNoteFromDisplayName, loadDroneBuffer, createDroneNodes } from "../utils/audio";

describe("audio utils", () => {
  describe("parseNoteFromDisplayName", () => {
    it("parses natural notes", () => {
      expect(parseNoteFromDisplayName("C major")).toBe("C");
      expect(parseNoteFromDisplayName("G major - 3 octaves")).toBe("G");
    });

    it("parses flat notes with ♭ symbol", () => {
      expect(parseNoteFromDisplayName("D♭ minor")).toBe("Db");
      expect(parseNoteFromDisplayName("E♭ major")).toBe("Eb");
    });

    it("parses flat notes with b character", () => {
      expect(parseNoteFromDisplayName("Bb major")).toBe("Bb");
    });

    it("parses sharp notes with ♯ symbol", () => {
      expect(parseNoteFromDisplayName("F♯ minor")).toBe("F#");
      expect(parseNoteFromDisplayName("C♯ major")).toBe("C#");
    });

    it("parses sharp notes with # character", () => {
      expect(parseNoteFromDisplayName("G# minor")).toBe("G#");
    });

    it("normalizes enharmonic equivalents", () => {
      expect(parseNoteFromDisplayName("E♯ major")).toBe("F");
      expect(parseNoteFromDisplayName("B♯ major")).toBe("C");
      expect(parseNoteFromDisplayName("Cb major")).toBe("B");
      expect(parseNoteFromDisplayName("Fb major")).toBe("E");
    });

    it("defaults to C if parsing fails", () => {
      expect(parseNoteFromDisplayName("Unknown")).toBe("C");
      expect(parseNoteFromDisplayName("")).toBe("C");
    });
  });

  describe("loadDroneBuffer", () => {
    it("loads and decodes audio data", async () => {
      const audioContext = new AudioContext();
      const buffer = await loadDroneBuffer(audioContext, "C");
      expect(buffer).toBeDefined();
      expect(globalThis.fetch).toHaveBeenCalledWith("/drones/C.m4a");
    });

    it("throws error for unknown note", async () => {
      const audioContext = new AudioContext();
      await expect(loadDroneBuffer(audioContext, "Z")).rejects.toThrow("No audio file for note: Z");
    });
  });

  describe("createDroneNodes", () => {
    it("creates source and gain nodes", async () => {
      const audioContext = new AudioContext();
      const buffer = await audioContext.decodeAudioData(new ArrayBuffer(0));
      const nodes = createDroneNodes(audioContext, buffer);

      expect(nodes.source).toBeDefined();
      expect(nodes.masterGain).toBeDefined();
      expect(nodes.source.loop).toBe(true);
      expect(nodes.source.buffer).toBe(buffer);
    });
  });
});
