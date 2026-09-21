import { SessionStatus, type CaptionSession } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Request, RequestHandler, Response } from "express";
import { prisma } from "../db.js";
import { parseByteRange } from "./http-range.js";
import { InvalidVideoError, probeVideo } from "./media.js";
import {
  createSessionCookieValue,
  readSessionAccessToken,
  sessionCookieName,
} from "./session-cookie.js";
import { startTranscription } from "./transcription.js";

const sessionTtlMilliseconds = 60 * 60 * 1000;
export const storageRoot = path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "../../storage");
export const temporaryUploadDirectory = path.join(storageRoot, "tmp");

class SessionHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const createSession: RequestHandler = async (request, response) => {
  const upload = request.file;
  console.log("isi file",upload)
  if (!upload) {
    response.status(400).json({ error: "A valid MP4 video is required" });
    return;
  }


  const id = randomUUID();
  const accessToken = randomBytes(32).toString("base64url");
  const accessTokenHash = hashToken(accessToken);
  const sessionDirectory = path.join(storageRoot, "sessions", id);
  const sourcePath = path.join(sessionDirectory, "source.mp4");

  try {
    const metadata = await probeVideo(upload.path);
    await mkdir(sessionDirectory, { recursive: true });
    await rename(upload.path, sourcePath);

    const session = await prisma.captionSession.create({
      data: {
        id,
        accessTokenHash,
        status: SessionStatus.UPLOADED,
        sourceFileName: path.basename(upload.originalname),
        sourcePath: `sessions/${id}/source.mp4`,
        ...metadata,
      },
    });

    setSessionCookie(response, id, accessToken);
    response.status(201).json({ session: publicSession(session) });
  } catch (error) {
    await Promise.allSettled([
      rm(upload.path, { force: true }),
      rm(sessionDirectory, { force: true, recursive: true }),
    ]);
    sendError(response, error);
  }
};

export const getSession: RequestHandler = async (request, response) => {
  try {
    const { session } = await authorizedSession(request);
    response.json({ session: publicSession(session) });
  } catch (error) {
    sendError(response, error);
  }
};

export const transcribeSession: RequestHandler = async (
  request,
  response,
) => {
  try {
    const { session, accessToken } = await authorizedSession(request);

    if (
      session.status !== SessionStatus.UPLOADED &&
      session.status !== SessionStatus.FAILED
    ) {
      throw new SessionHttpError(
        409,
        `Cannot start transcription while session is ${session.status}`,
      );
    }

    const sourcePath = path.join(
      storageRoot,
      "sessions",
      session.id,
      "source.mp4",
    );

    const updatedSession = await startTranscription(
      session.id,
      sourcePath,
    );

    setSessionCookie(response, session.id, accessToken);

    response.status(202).json({
      session: publicSession(updatedSession),
    });
  } catch (error) {
    sendError(response, error);
  }
};

export const streamSourceVideo: RequestHandler = async (request, response) => {
  try {
    const { session, accessToken } = await authorizedSession(request);
    const sourcePath = path.join(storageRoot, "sessions", session.id, "source.mp4");
    const sourceStat = await stat(sourcePath);
    const rangeHeader = request.header("range");

    await prisma.captionSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });
    setSessionCookie(response, session.id, accessToken);

    if (!rangeHeader) {
      response.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": sourceStat.size,
        "Content-Type": "video/mp4",
      });
      createReadStream(sourcePath).pipe(response);
      return;
    }

    const range = parseByteRange(rangeHeader, sourceStat.size);
    if (!range) {
      response.status(416).set("Content-Range", `bytes */${sourceStat.size}`).end();
      return;
    }

    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": range.end - range.start + 1,
      "Content-Range": `bytes ${range.start}-${range.end}/${sourceStat.size}`,
      "Content-Type": "video/mp4",
    });
    createReadStream(sourcePath, range).pipe(response);
  } catch (error) {
    sendError(response, error);
  }
};

async function authorizedSession(request: Request) {
  const sessionId = request.params.id;
  if (typeof sessionId !== "string") throw new SessionHttpError(400, "Invalid session ID");

  const accessToken = readSessionAccessToken(request.header("cookie"), sessionId);
  if (!accessToken) throw new SessionHttpError(401, "Session access token required");

  const session = await prisma.captionSession.findFirst({
    where: {
      id: sessionId,
      accessTokenHash: hashToken(accessToken),
    },
  });

  if (!session) throw new SessionHttpError(404, "Session not found");
  if (Date.now() - session.lastActivityAt.getTime() >= sessionTtlMilliseconds) {
    throw new SessionHttpError(410, "Session expired");
  }

  return { session, accessToken };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response: Response, sessionId: string, accessToken: string) {
  response.cookie(sessionCookieName, createSessionCookieValue(sessionId, accessToken), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtlMilliseconds,
    path: `/sessions/${sessionId}`,
  });
}

function publicSession(session: CaptionSession) {
  return {
    id: session.id,
    status: session.status,
    sourceFileName: session.sourceFileName,
    durationSeconds: session.durationSeconds,
    width: session.width,
    height: session.height,
    frameRate: session.frameRate,
    videoCodec: session.videoCodec,
    captionData: session.captionData,
    errorMessage: session.errorMessage,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: new Date(session.lastActivityAt.getTime() + sessionTtlMilliseconds),
  };
}

function sendError(response: Response, error: unknown) {
  if (error instanceof SessionHttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof InvalidVideoError) {
    response.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Unable to process session" });
}
