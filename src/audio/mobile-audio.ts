/**
 * Helpers that get Web Audio playing on phones.
 *
 * iOS (Safari and every iOS browser, including Chrome) puts web audio in the
 * "ambient" category by default, so the ring/silent switch mutes it. Asking
 * for the "playback" audio session, or playing a media element once from a
 * user gesture, moves the page to the playback category so it is heard.
 */

let primed = false;

/** Call from inside a user gesture. Safe to call repeatedly; does its work once it succeeds. */
export function primeMediaPlayback(): void {
  // iOS 17+ / Safari 17+: the direct way.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== "playback") {
    try {
      session.type = "playback";
    } catch {
      // Not allowed here; the media-element fallback below still runs.
    }
  }

  if (primed) return;
  primed = true;
  // Older iOS: playing any <audio> from a gesture switches the category.
  const audio = new Audio(silentWavDataUri());
  audio.setAttribute("playsinline", "");
  audio.setAttribute("x-webkit-airplay", "deny");
  audio.preload = "auto";
  audio.volume = 0;
  audio.play().catch(() => {
    primed = false; // try again on the next gesture
  });
}

/** A 50 ms silent mono 8 kHz WAV, as a data URI. */
export function silentWavDataUri(): string {
  const sampleRate = 8000;
  const samples = sampleRate / 20;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  // Samples stay zero: silence.
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}
