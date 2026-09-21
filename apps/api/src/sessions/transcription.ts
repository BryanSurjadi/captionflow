import { SessionStatus, type Prisma } from "@prisma/client";
import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "../db.js";

const transcriptionDirectory = path.resolve(
  process.cwd(),
  "../../services/transcription",
);

const pythonPath = path.join(
  transcriptionDirectory,
  ".venv",
  "Scripts",
  "python.exe",
);

const scriptPath = path.join(
  transcriptionDirectory,
  "transcribe.py",
);

export async function startTranscription(
  sessionId: string,
  sourcePath: string,
) {
  const session = await prisma.captionSession.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.TRANSCRIBING,
      errorMessage: null,
      lastActivityAt: new Date(),
    },
  });

  const child = spawn(
    pythonPath,
    [
      scriptPath,
      sourcePath,
      "--model",
      process.env.WHISPER_MODEL ?? "turbo",
    ],
    {
      windowsHide: true,
    },
  );

  let stdout = "";
  let stderr = "";
  let finished = false;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  child.once("error", (error) => {
    void saveFailure(error.message);
  });

  child.once("close", (code) => {
    if (code !== 0) {
      void saveFailure(stderr || `Python exited with code ${code}`);
      return;
    }

    void saveSuccess();
  });

  async function saveSuccess() {
    if (finished) return;

    try {
      const captionData = parseCaptionData(stdout);
      finished = true;

      await prisma.captionSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.READY,
          captionData,
          errorMessage: null,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : "Invalid transcription output";
      console.error(`Unable to save transcription for ${sessionId}: ${details}`);
      await prisma.captionSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.FAILED,
          errorMessage: "Transcription failed. Please try again.",
        },
      });
    }
  }

  async function saveFailure(details: string) {
    if (finished) return;
    finished = true;

    console.error(`Transcription failed for ${sessionId}: ${details}`);

    await prisma.captionSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.FAILED,
        errorMessage: "Transcription failed. Please try again.",
      },
    });
  }

  return session;
}

function parseCaptionData(output: string): Prisma.InputJsonObject {
  const transcript: unknown = JSON.parse(output);

  if (
    !transcript ||
    typeof transcript !== "object" ||
    !("words" in transcript) ||
    !Array.isArray(transcript.words)
  ) {
    throw new Error("Python returned invalid transcript JSON");
  }

  return {
    ...(transcript as Prisma.InputJsonObject),
    version: 1,
    groups: [],
    emphasis: [],
  };
}
