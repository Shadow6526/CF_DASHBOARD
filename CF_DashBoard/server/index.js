const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const CF_API = "https://codeforces.com/api";

// ── Helper: fetch from CF API ──
async function cfFetch(endpoint, params = {}) {
    const url = `${CF_API}/${endpoint}`;
    const res = await axios.get(url, { params, timeout: 15000 });
    if (res.data.status !== "OK") {
        throw new Error(res.data.comment || "Codeforces API error");
    }
    return res.data.result;
}

// ── GET /api/user/:handle ──
app.get("/api/user/:handle", async (req, res) => {
    try {
        const data = await cfFetch("user.info", { handles: req.params.handle });
        res.json({ status: "OK", result: data[0] });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── GET /api/user/:handle/rating ──
app.get("/api/user/:handle/rating", async (req, res) => {
    try {
        const data = await cfFetch("user.rating", { handle: req.params.handle });
        res.json({ status: "OK", result: data });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── GET /api/user/:handle/submissions ──
app.get("/api/user/:handle/submissions", async (req, res) => {
    try {
        const count = parseInt(req.query.count) || 100;
        const from = parseInt(req.query.from) || 1;
        const data = await cfFetch("user.status", {
            handle: req.params.handle,
            from,
            count,
        });
        res.json({ status: "OK", result: data });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── GET /api/contests ──
app.get("/api/contests", async (req, res) => {
    try {
        const gym = req.query.gym === "true";
        const data = await cfFetch("contest.list", { gym });
        res.json({ status: "OK", result: data });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── GET /api/contest/:contestId/standings ──
app.get("/api/contest/:contestId/standings", async (req, res) => {
    try {
        const { from = 1, count = 50, handle } = req.query;
        const params = {
            contestId: req.params.contestId,
            from: parseInt(from),
            count: parseInt(count),
        };
        if (handle) params.handles = handle;
        const data = await cfFetch("contest.standings", params);
        res.json({ status: "OK", result: data });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── GET /api/problemset ──
app.get("/api/problemset", async (req, res) => {
    try {
        const params = {};
        if (req.query.tags) params.tags = req.query.tags;
        const data = await cfFetch("problemset.problems", params);
        res.json({ status: "OK", result: data });
    } catch (err) {
        res.status(err.response?.status || 500).json({
            status: "FAILED",
            comment: err.response?.data?.comment || err.message,
        });
    }
});

// ── Health check ──
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`🚀 Codeforces API server running on http://localhost:${PORT}`);
});
