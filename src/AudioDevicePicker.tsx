import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tokens as T, fonts as F } from "./auth/_tokens";
import {
  applySpeaker, getPreferredMicId, getPreferredSpeakerId, listAudioDevices,
  setPreferredMicId, setPreferredSpeakerId, supportsSpeakerSelection,
} from "./audioDevices";

const DEFAULT_VALUE = "__default__";
const WRAP: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginTop: 12 };
const TRIGGER: React.CSSProperties = { flex: 1, minWidth: 0, height: 36, borderRadius: 8, fontFamily: F.sans, fontSize: 13 };
const TEST_BTN: React.CSSProperties = { height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.white, color: T.coal, fontFamily: F.sans, fontSize: 13, cursor: "pointer" };
const ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const LABEL: React.CSSProperties = { width: 64, flexShrink: 0, fontFamily: F.sans, fontSize: 13, color: T.inkSoft };

/* Shown only once the mic is granted (device labels are empty before that) and
   only when there is an actual choice to make. */
export default function AudioDevicePicker({ onMicChange }: { onMicChange: () => void }) {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState(getPreferredMicId() ?? "");
  const [speakerId, setSpeakerId] = useState(getPreferredSpeakerId() ?? "");
  const canPickSpeaker = supportsSpeakerSelection();

  useEffect(() => {
    const refresh = () => { void listAudioDevices().then((d) => { setInputs(d.inputs); setOutputs(d.outputs); }); };
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, []);

  const showMic = inputs.length > 1;
  const showSpeaker = canPickSpeaker && outputs.length > 1;
  if (!showMic && !showSpeaker) return null;

  const playTest = () => {
    const a = new Audio("/sounds/receive.mp3");
    a.volume = 0.6;
    applySpeaker(a);
    a.play().catch(() => {});
  };

  return (
    <div data-testid="audio-device-picker" style={WRAP}>
      {showMic && (
        <div style={ROW}>
          <span id="hsx-mic-select-label" style={LABEL}>Microphone</span>
          <Select
            value={inputs.some((d) => d.deviceId === micId) ? micId : DEFAULT_VALUE}
            onValueChange={(v) => { const id = v === DEFAULT_VALUE ? "" : v; setMicId(id); setPreferredMicId(id || null); onMicChange(); }}
          >
            <SelectTrigger aria-labelledby="hsx-mic-select-label" style={TRIGGER}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VALUE}>System default</SelectItem>
              {inputs.filter((d) => d.deviceId !== "default").map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showSpeaker && (
        <div style={ROW}>
          <span id="hsx-speaker-select-label" style={LABEL}>Speaker</span>
          <Select
            value={outputs.some((d) => d.deviceId === speakerId) ? speakerId : DEFAULT_VALUE}
            onValueChange={(v) => { const id = v === DEFAULT_VALUE ? "" : v; setSpeakerId(id); setPreferredSpeakerId(id || null); }}
          >
            <SelectTrigger id="hsx-speaker-select" aria-labelledby="hsx-speaker-select-label" style={TRIGGER}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VALUE}>System default</SelectItem>
              {outputs.filter((d) => d.deviceId !== "default").map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${i + 1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" onClick={playTest} style={TEST_BTN}>
            Test
          </button>
        </div>
      )}
    </div>
  );
}
