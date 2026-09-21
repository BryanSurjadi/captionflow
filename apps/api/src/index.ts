import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { sessionRouter } from "./sessions/session.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/sessions", sessionRouter);

const handleUnexpectedError: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

app.use(handleUnexpectedError);

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
