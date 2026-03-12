import { useCallback } from "react";
import { soundManager } from "../sounds/SoundManager";

export function useSound(): {
  play: (id: string) => boolean;
  stop: (id: string) => void;
  soundManager: typeof soundManager;
} {
  const play = useCallback((id: string) => soundManager.play(id), []);
  const stop = useCallback((id: string) => soundManager.stop(id), []);

  return { play, stop, soundManager };
}
