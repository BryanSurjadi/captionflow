export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  probability: number;
}

export interface CaptionData {
  version: number;
  language: string;
  durationSeconds: number;
  text: string;
  words: TranscriptWord[];
}

export interface Session {
  id: string;
  status: string;
  sourceFileName: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  videoCodec: string | null;
  captionData: CaptionData | null;
  errorMessage: string | null;
  expiresAt: string;
}

export function uploadVideo(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("video", file);

    request.open("POST", `${apiUrl}/sessions`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The upload could not reach CaptionFlow. Check that the API is running."));
    request.onload = () => {
      let result: { session?: { id: string }; error?: string } = {};
      try {
        result = JSON.parse(request.responseText) as typeof result;
      } catch {
        // The status-based message below covers an empty or non-JSON response.
      }

      if (request.status >= 200 && request.status < 300 && result.session) resolve(result.session.id);
      else reject(new Error(result.error ?? "The video could not be uploaded."));
    };
    request.send(form);
  });
}

export async function getSession(id: string, signal: AbortSignal) {
  const response = await fetch(`${apiUrl}/sessions/${id}`, {
    credentials: "include",
    signal,
  });
  const result = (await response.json()) as { session?: Session; error?: string };
  if (!response.ok || !result.session) throw new Error(result.error ?? "Unable to open this video.");
  return result.session;
}

export async function startTranscription(id: string) {
  const response = await fetch(
    `${apiUrl}/sessions/${id}/transcription`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  const result = (await response.json()) as {
    session?: Session;
    error?: string;
  };

  if (!response.ok || !result.session) {
    throw new Error(
      result.error ?? "Unable to start transcription.",
    );
  }

  return result.session;
}

export const sessionVideoUrl = (id: string) => `${apiUrl}/sessions/${id}/source`;
