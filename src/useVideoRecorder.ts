import { useState, useRef, useCallback, useEffect } from "react";

export function useVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  /* The active camera stream. Held in state (not just a ref) so the
     consumer can `useEffect` against it to re-attach `srcObject` when
     the <video> element mounts. Without this, the SelfView tile only
     mounts AFTER `videoEnabled` flips to true, which means the
     `videoPreviewRef.current` was null at the moment we tried to
     assign srcObject — so the tile rendered with no feed (the
     "Camera feed not working" bug report). */
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false, // audio is handled separately by speech recognition
      });
      streamRef.current = stream;
      setMediaStream(stream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setMediaStream(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect data every second
      setIsRecording(true);
      setVideoEnabled(true);
    } catch (err) {
      console.warn("[video] Failed to start recording:", err);
      setVideoEnabled(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleVideo = useCallback(() => {
    if (videoEnabled && isRecording) {
      stopRecording();
      setVideoEnabled(false);
    } else if (!videoEnabled) {
      startRecording();
    }
  }, [videoEnabled, isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isRecording,
    videoEnabled,
    videoURL,
    videoPreviewRef,
    mediaStream,
    startRecording,
    stopRecording,
    toggleVideo,
  };
}
