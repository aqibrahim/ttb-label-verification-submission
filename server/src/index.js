import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import verifyRouter from "./routes/verify.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Verifying a label calls an external model and costs real money/quota per
// request, so it gets its own, tighter limit than a typical read endpoint.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification requests. Please wait a few minutes and try again." },
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/verify", verifyLimiter);
app.use("/api", verifyRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Label verification API listening on port ${PORT}`);
});
