import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffprobePath = (require("ffprobe-static") as { path: string }).path;

interface ProbeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    duration?: string;
    avg_frame_rate?: string;
    r_frame_rate?: string;
  }>;
  format?: {
    duration?: string;
    format_name?: string;
  };
}

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number;
  videoCodec: string;
}

export class InvalidVideoError extends Error {}

export function parseFrameRate(value: string | undefined) {
  if (!value) return 0;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!numerator || !denominator) return 0;
  return numerator / denominator;
}

export async function probeVideo(path: string): Promise<VideoMetadata> {
  const output = await runFfprobe(path);
  let data: ProbeOutput;

  try {
    data = JSON.parse(output) as ProbeOutput;
  } catch {
    throw new InvalidVideoError("FFprobe returned invalid metadata");
  }

  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const formatNames = data.format?.format_name?.split(",") ?? [];
  const durationSeconds = Number(data.format?.duration ?? video?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);
  const frameRate = parseFrameRate(video?.avg_frame_rate) || parseFrameRate(video?.r_frame_rate);

  if (!video || !formatNames.includes("mp4") || !durationSeconds || !width || !height || !frameRate) {
    throw new InvalidVideoError("The uploaded file is not a valid MP4 video");
  }

  return {
    durationSeconds,
    width,
    height,
    frameRate,
    videoCodec: video.codec_name ?? "unknown",
  };
}

function runFfprobe(path: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      ffprobePath,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new InvalidVideoError("Video inspection timed out"));
    }, 15_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new InvalidVideoError(stderr || "Unable to inspect video"));
    });
  });
}
