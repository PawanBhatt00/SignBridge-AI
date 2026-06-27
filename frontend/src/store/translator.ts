import { create } from "zustand";
import type { Landmark, PredictionResult } from "@/types";

interface TranslatorState {
  isActive: boolean;
  currentText: string;
  lastPrediction: PredictionResult | null;
  confidence: number;
  isSpeaking: boolean;
  landmarks: Landmark[] | null;
  setActive: (active: boolean) => void;
  setCurrentText: (text: string) => void;
  appendText: (char: string) => void;
  clearText: () => void;
  setLastPrediction: (prediction: PredictionResult | null) => void;
  setConfidence: (confidence: number) => void;
  setSpeaking: (speaking: boolean) => void;
  setLandmarks: (landmarks: Landmark[] | null) => void;
}

export const useTranslatorStore = create<TranslatorState>((set) => ({
  isActive: false,
  currentText: "",
  lastPrediction: null,
  confidence: 0,
  isSpeaking: false,
  landmarks: null,
  setActive: (isActive) => set({ isActive }),
  setCurrentText: (currentText) => set({ currentText }),
  appendText: (char) =>
    set((state) => ({ currentText: state.currentText + char })),
  clearText: () => set({ currentText: "", lastPrediction: null, confidence: 0 }),
  setLastPrediction: (lastPrediction) => set({ lastPrediction }),
  setConfidence: (confidence) => set({ confidence }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setLandmarks: (landmarks) => set({ landmarks }),
}));
