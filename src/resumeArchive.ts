/* Stores the original file so an employer can download it after unlocking the
   candidate. Best-effort: analysis already succeeded, so a failure here must
   never surface to the user. */
export async function archiveResumeFile(file: File, resumeVersionId: string | null | undefined): Promise<boolean> {
  if (!resumeVersionId || file.size === 0 || file.size > 9_000_000) return false;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const { apiFetch } = await import("./apiClient");
    const res = await apiFetch("/api/resume/upload-file", {
      resumeVersionId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileBase64: btoa(binary),
    });
    return res.ok;
  } catch {
    return false;
  }
}
