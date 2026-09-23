import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";
import {
  createSession,
  getSession,
  streamSourceVideo,
  transcribeSession,
  updateSession,
  temporaryUploadDirectory,
} from "./session.controller.js";

mkdirSync(temporaryUploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryUploadDirectory,
    filename: (_request, _file, callback) => callback(null, `${randomUUID()}.upload`),
  }),
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype === "video/mp4" && path.extname(file.originalname).toLowerCase() === ".mp4");
  },
});

export const sessionRouter = Router();

sessionRouter.post("/", upload.single("video"), createSession);
sessionRouter.get("/:id", getSession);
sessionRouter.patch("/:id", updateSession);
sessionRouter.post("/:id/transcription", transcribeSession);
sessionRouter.get("/:id/source", streamSourceVideo);

const handleUploadError: ErrorRequestHandler = (error, _request, response, next) => {
  if (!(error instanceof multer.MulterError)) {
    next(error);
    return;
  }

  const message = error.code === "LIMIT_FILE_SIZE" ? "Video exceeds the 250 MB limit" : "Invalid video upload";
  response.status(400).json({ error: message });
};

sessionRouter.use(handleUploadError);

