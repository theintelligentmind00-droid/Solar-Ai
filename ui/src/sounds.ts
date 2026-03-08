export function playLaunchCountdown(): void {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance("3... 2... 1... Launch!");
    utterance.pitch = 0.75;
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Silently fail if speech synthesis is unavailable
  }
}

export function playShootingStarSound(): void {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);

    gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    oscillator.onended = () => {
      ctx.close();
    };
  } catch {
    // Silently fail if Web Audio API is unavailable
  }
}

export function playPlanetSelectSound(): void {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return;

    const ctx = new AudioContext();

    const playTone = (
      frequency: number,
      startTime: number,
      duration: number
    ): void => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(0.06, startTime);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    playTone(440, ctx.currentTime, 0.15);
    playTone(660, ctx.currentTime + 0.15, 0.15);

    setTimeout(() => {
      ctx.close();
    }, 500);
  } catch {
    // Silently fail if Web Audio API is unavailable
  }
}

export function playMissionControlBeep(): void {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);

    oscillator.onended = () => {
      ctx.close();
    };
  } catch {
    // Silently fail if Web Audio API is unavailable
  }
}
