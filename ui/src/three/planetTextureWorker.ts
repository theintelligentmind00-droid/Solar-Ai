/**
 * Web Worker for generating planet textures off the main thread.
 * Uses generatePlanetTexturesRaw to avoid ImageData dependency (not in all workers).
 */

import { generatePlanetTexturesRaw, type PlanetConfig } from './generatePlanetTextures';

interface WorkerMessage {
  planetId: string;
  config: PlanetConfig;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { planetId, config, width, height } = e.data;
  const result = generatePlanetTexturesRaw(planetId, config, width, height);

  // Transfer buffers for zero-copy performance
  const transfer: ArrayBuffer[] = [
    result.colorData.buffer,
    result.normalData.buffer,
    result.nightData.buffer,
  ];
  (self as unknown as { postMessage(msg: unknown, transfer: ArrayBuffer[]): void })
    .postMessage(result, transfer);
};
