require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { authRouter } = require("./auth");

const app = express();

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173"
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/postman/no-origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
