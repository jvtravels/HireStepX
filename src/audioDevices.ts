const MIC_KEY = "hsx_mic_device";
const SPEAKER_KEY = "hsx_speaker_device";

function read(key: string): string | null {
  try { return localStorage.getItem(key) || null; } catch { return null; }
}
function write(key: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(key, id); else localStorage.removeItem(key);
  } catch { /* expected: storage blocked, choice just won't persist */ }
}

export const getPreferredMicId = () => read(MIC_KEY);
export const setPreferredMicId = (id: string | null) => write(MIC_KEY, id);
export const getPreferredSpeakerId = () => read(SPEAKER_KEY);
export const setPreferredSpeakerId = (id: string | null) => write(SPEAKER_KEY, id);

/* "ideal" (not "exact") so an unplugged saved device falls back to the system
   default instead of failing the whole interview with OverconstrainedError. */
export function micConstraints(): MediaTrackConstraints | true {
  const id = getPreferredMicId();
  return id ? { deviceId: { ideal: id } } : true;
}

export function supportsSpeakerSelection(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

export function applySpeaker(el: HTMLMediaElement): void {
  const id = getPreferredSpeakerId();
  if (!id || !supportsSpeakerSelection()) return;
  el.setSinkId(id).catch(() => { /* device gone: keep system default */ });
}

export function applySpeakerToContext(ctx: AudioContext): void {
  const id = getPreferredSpeakerId();
  if (!id || !("setSinkId" in ctx)) return;
  (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(id).catch(() => { /* keep default */ });
}

export async function listAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: all.filter((d) => d.kind === "audioinput" && d.deviceId !== ""),
      outputs: all.filter((d) => d.kind === "audiooutput" && d.deviceId !== ""),
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
}
