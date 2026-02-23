import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiUser, FiTrendingUp, FiTarget, FiClock, FiAward, FiActivity,
    FiCheck, FiX, FiSearch, FiFilter, FiBarChart2, FiPieChart,
    FiArrowLeft
} from "react-icons/fi";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { fetchUserInfo, fetchUserRating, fetchUserSubmissions } from "../../utils/api";
import {
    getActiveHandle, getCachedUser, setCachedUser,
    getCachedRating, setCachedRating, getCachedSubmissions, setCachedSubmissions
} from "../../utils/storage";
import {
    getRatingColor, getRankName, formatDate, formatDateTime,
    getVerdictInfo, getDifficultyColor, timeAgo
} from "../../utils/helpers";
import "./Profile.css";

const CHART_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

/* ── Custom Chart Tooltips ─────────────────────── */
function RatingTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const { rating, change } = payload[0].payload;
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: "#818cf8" }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">{label}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Rating</span>
                    <span className="chart-tooltip-val" style={{ color: "#818cf8" }}>{rating}</span>
                </div>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Change</span>
                    <span className="chart-tooltip-val" style={{ color: change >= 0 ? "#34d399" : "#f87171" }}>
                        {change >= 0 ? "+" : ""}{change}
                    </span>
                </div>
            </div>
        </div>
    );
}

function VerdictTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const { fullName, value, color } = payload[0].payload;
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: color }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">{fullName}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Count</span>
                    <span className="chart-tooltip-val" style={{ color }}>{value}</span>
                </div>
            </div>
        </div>
    );
}

function LangTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0].payload;
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: "#818cf8" }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">{name}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Submissions</span>
                    <span className="chart-tooltip-val" style={{ color: "#818cf8" }}>{value}</span>
                </div>
            </div>
        </div>
    );
}

function DifficultyTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const count = payload[0].value;
    const barColor = getDifficultyColor(parseInt(label));
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: barColor }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">Rating {label}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Solved</span>
                    <span className="chart-tooltip-val" style={{ color: barColor, fontSize: 18 }}>{count}</span>
                </div>
                <span className="chart-tooltip-sub">problems</span>
            </div>
        </div>
    );
}

export default function Profile() {
    const navigate = useNavigate();
    const handle = getActiveHandle();
    const [user, setUser] = useState(null);
    const [ratingHistory, setRatingHistory] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!handle) {
            navigate("/");
            return;
        }
        loadAll();
    }, [handle]);

    async function loadAll() {
        setLoading(true);
        try {
            // User info
            let userData = getCachedUser(handle);
            if (!userData) {
                userData = await fetchUserInfo(handle);
                setCachedUser(handle, userData);
            }
            setUser(userData);

            // Rating
            let ratingData = getCachedRating(handle);
            if (!ratingData) {
                ratingData = await fetchUserRating(handle);
                setCachedRating(handle, ratingData);
            }
            setRatingHistory(ratingData);

            // Submissions
            let subData = getCachedSubmissions(handle);
            if (!subData) {
                subData = await fetchUserSubmissions(handle, 20000);
                setCachedSubmissions(handle, subData);
            }
            setSubmissions(subData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // ── Computed stats ──
    const stats = useMemo(() => {
        if (!submissions.length) return null;

        const accepted = submissions.filter((s) => s.verdict === "OK");
        const solvedSet = new Set(accepted.map((s) => `${s.problem.contestId}-${s.problem.index}`));

        // Build a map of unique solved problems (deduped by contestId-index)
        const solvedProblems = new Map();
        accepted.forEach((s) => {
            const key = `${s.problem.contestId}-${s.problem.index}`;
            if (!solvedProblems.has(key)) {
                solvedProblems.set(key, s.problem);
            }
        });

        const langs = {};
        const tags = {};
        const verdicts = {};
        const difficultyBuckets = {};

        // Verdicts & languages count ALL submissions (correct)
        const unsolvedMap = new Map();
        submissions.forEach((s) => {
            const lang = s.programmingLanguage;
            langs[lang] = (langs[lang] || 0) + 1;

            const v = s.verdict || "TESTING";
            verdicts[v] = (verdicts[v] || 0) + 1;

            const key = `${s.problem.contestId}-${s.problem.index}`;
            if (!solvedSet.has(key) && !unsolvedMap.has(key) && s.problem.contestId) {
                unsolvedMap.set(key, { ...s.problem, lastAttemptTime: s.creationTimeSeconds });
            }
        });

        // Tags & difficulty count UNIQUE SOLVED problems only
        solvedProblems.forEach((problem) => {
            // Tags
            problem.tags?.forEach((t) => {
                tags[t] = (tags[t] || 0) + 1;
            });

            // Difficulty — individual bars per rating
            if (problem.rating) {
                const key = problem.rating.toString();
                difficultyBuckets[key] = (difficultyBuckets[key] || 0) + 1;
            }
        });

        const topLangs = Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }));

        const topTags = Object.entries(tags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, value]) => ({ name, value }));

        const verdictData = Object.entries(verdicts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({
                name: getVerdictInfo(name).label,
                fullName: getVerdictInfo(name).label,
                value,
                color: getVerdictInfo(name).color,
            }));

        const diffData = Object.entries(difficultyBuckets)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([name, value]) => ({ name, value }));


        const unsolvedProblems = Array.from(unsolvedMap.values()).sort((a, b) => (b.lastAttemptTime || 0) - (a.lastAttemptTime || 0));

        return {
            totalSubmissions: submissions.length,
            solved: solvedSet.size,
            acceptRate: ((accepted.length / submissions.length) * 100).toFixed(1),
            topLangs,
            topTags,
            verdictData,
            diffData,
            unsolvedProblems,
        };
    }, [submissions]);

    const ratingChartData = useMemo(() => {
        return ratingHistory.map((r) => ({
            name: formatDate(r.ratingUpdateTimeSeconds),
            rating: r.newRating,
            contest: r.contestName,
            change: r.newRating - r.oldRating,
        }));
    }, [ratingHistory]);

    const ratingVolatility = useMemo(() => {
        if (!ratingHistory.length) return { maxUp: 0, maxDown: 0 };
        let maxUp = 0;
        let maxDown = 0;
        ratingHistory.forEach((r) => {
            const diff = r.newRating - r.oldRating;
            if (diff > maxUp) maxUp = diff;
            if (diff < maxDown) maxDown = diff;
        });
        return { maxUp, maxDown };
    }, [ratingHistory]);


    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
                <p>Loading profile data...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="empty-state" style={{ minHeight: "60vh" }}>
                <FiUser className="empty-icon" />
                <h3>No Profile Selected</h3>
                <p>Search for a Codeforces handle on the dashboard to get started.</p>
                <button className="btn btn-primary" onClick={() => navigate("/")}>
                    <FiArrowLeft /> Go to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="profile-page" id="profile-page">
            {/* Profile Header */}
            <div className="profile-header">
                <div className="profile-header-bg" />
                <div className="profile-header-content">
                    <div className="profile-header-left">
                        <div className="profile-header-avatar">
                            {user.titlePhoto && !user.titlePhoto.includes("no-title") ? (
                                <img src={user.titlePhoto.startsWith("//") ? `https:${user.titlePhoto}` : user.titlePhoto} alt={user.handle} />
                            ) : (
                                <div className="avatar-placeholder">{user.handle[0].toUpperCase()}</div>
                            )}
                            <div className="avatar-ring" style={{ borderColor: getRatingColor(user.rating) }} />
                        </div>
                        <div className="profile-header-info">
                            <h1 style={{ color: getRatingColor(user.rating) }}>{user.handle}</h1>
                            <p className="rank-name" style={{ color: getRatingColor(user.rating) }}>
                                {(user.rank || getRankName(user.rating))
                                    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </p>
                            {(user.firstName || user.lastName) && (
                                <p className="real-name">{user.firstName} {user.lastName}</p>
                            )}
                            {user.organization && (
                                <p className="org">{user.organization}</p>
                            )}
                        </div>
                    </div>
                    <div className="profile-header-stats">
                        <div className="header-stat">
                            <span className="header-stat-value" style={{ color: getRatingColor(user.rating) }}>
                                {user.rating || "—"}
                            </span>
                            <span className="header-stat-label">Rating</span>
                        </div>
                        <div className="header-stat-divider" />
                        <div className="header-stat">
                            <span className="header-stat-value" style={{ color: getRatingColor(user.maxRating) }}>
                                {user.maxRating || "—"}
                            </span>
                            <span className="header-stat-label">Max Rating</span>
                        </div>
                        <div className="header-stat-divider" />
                        <div className="header-stat">
                            <span className="header-stat-value" style={{ color: "#34d399" }}>
                                +{ratingVolatility.maxUp}
                            </span>
                            <span className="header-stat-label">Max Up</span>
                        </div>
                        <div className="header-stat-divider" />
                        <div className="header-stat">
                            <span className="header-stat-value" style={{ color: "#f87171" }}>
                                {ratingVolatility.maxDown}
                            </span>
                            <span className="header-stat-label">Max Down</span>
                        </div>
                        <div className="header-stat-divider" />
                        <div className="header-stat">
                            <span className="header-stat-value">{user.friendOfCount || 0}</span>
                            <span className="header-stat-label">Friends</span>
                        </div>
                    </div>
                </div>
            </div>


            {/* User Info Tab */}
            {stats && (
                <div className="tab-content animate-fade-in">
                    {/* Summary stats */}
                    <div className="overview-stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                                <FiTarget />
                            </div>
                            <span className="stat-label">Problems Solved</span>
                            <span className="stat-value">{stats.solved}</span>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                                <FiCheck />
                            </div>
                            <span className="stat-label">Accept Rate</span>
                            <span className="stat-value">{stats.acceptRate}%</span>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                                <FiActivity />
                            </div>
                            <span className="stat-label">Total Submissions</span>
                            <span className="stat-value">{stats.totalSubmissions}</span>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}>
                                <FiAward />
                            </div>
                            <span className="stat-label">Contests</span>
                            <span className="stat-value">{ratingHistory.length}</span>
                        </div>
                    </div>

                    {/* Rating Chart */}
                    {ratingChartData.length > 0 && (
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiTrendingUp /> Rating History</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={ratingChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                                    <Tooltip content={<RatingTooltip />} cursor={{ stroke: 'rgba(129,140,248,0.2)', strokeWidth: 1 }} />
                                    <Line
                                        type="monotone"
                                        dataKey="rating"
                                        stroke="#818cf8"
                                        strokeWidth={2.5}
                                        dot={{ r: 4, fill: "#818cf8", stroke: "#0f1420", strokeWidth: 2 }}
                                        activeDot={{ r: 6, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Charts Section */}
                    <div className="charts-grid">
                        {/* Verdict Distribution */}
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiPieChart /> Verdict Distribution</h3>
                            <ResponsiveContainer width="100%" height={450}>
                                <PieChart>
                                    <Pie
                                        data={stats.verdictData}
                                        cx="55%"
                                        cy="50%"
                                        innerRadius={110}
                                        outerRadius={180}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {stats.verdictData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<VerdictTooltip />} />
                                    <Legend
                                        layout="vertical"
                                        align="left"
                                        verticalAlign="middle"
                                        formatter={(value, entry) => (
                                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Language Distribution */}
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiPieChart /> Languages Used</h3>
                            <ResponsiveContainer width="100%" height={450}>
                                <PieChart>
                                    <Pie
                                        data={stats.topLangs}
                                        cx="55%"
                                        cy="50%"
                                        innerRadius={110}
                                        outerRadius={180}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {stats.topLangs.map((entry, index) => (
                                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<LangTooltip />} />
                                    <Legend
                                        layout="vertical"
                                        align="left"
                                        verticalAlign="middle"
                                        formatter={(value, entry) => (
                                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Difficulty Distribution — full width, larger */}
                        <div className="chart-card glass-card chart-full-width">
                            <h3 className="chart-title"><FiTarget /> Solved Question Distribution</h3>
                            <ResponsiveContainer width="100%" height={450}>
                                <BarChart data={stats.diffData} margin={{ bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={12}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={0}
                                        tick={{ fill: "#94a3b8" }}
                                    />
                                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                                    <Tooltip content={<DifficultyTooltip />} cursor={{ fill: 'rgba(129,140,248,0.06)' }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                        {stats.diffData.map((entry, index) => (
                                            <Cell key={index} fill={getDifficultyColor(parseInt(entry.name))} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Tags */}
                    {stats.topTags.length > 0 && (
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiTarget /> Problem Tags</h3>
                            <div className="tags-cloud">
                                {stats.topTags.map((t) => (
                                    <span key={t.name} className="problem-tag">
                                        {t.name}
                                        <span className="tag-count">{t.value}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Attended Contests Table */}
                    {ratingHistory.length > 0 && (
                        <div className="chart-card glass-card chart-full-width">
                            <h3 className="chart-title"><FiActivity /> Attended Contests</h3>
                            <div className="table-container" style={{ maxHeight: "500px", overflowY: "auto" }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Contest Name</th>
                                            <th>Rank</th>
                                            <th>Rating Change</th>
                                            <th>Updated Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...ratingHistory].reverse().map((r, idx) => {
                                            const change = r.newRating - r.oldRating;
                                            const isUp = change >= 0;
                                            return (
                                                <tr key={idx}>
                                                    <td>{r.contestName}</td>
                                                    <td>{r.rank}</td>
                                                    <td style={{ color: isUp ? "#34d399" : "#f87171", fontWeight: 600 }}>
                                                        {isUp ? "+" : ""}{change}
                                                    </td>
                                                    <td style={{ color: getRatingColor(r.newRating), fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {r.newRating}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Unsolved Problems Section */}
                    {stats.unsolvedProblems.length > 0 && (
                        <div className="chart-card glass-card chart-full-width">
                            <h3 className="chart-title"><FiX /> Unsolved Problems</h3>
                            <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Problem</th>
                                            <th>Rating</th>
                                            <th>Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.unsolvedProblems.map((p) => (
                                            <tr key={`${p.contestId}-${p.index}`}>
                                                <td>
                                                    <a
                                                        href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="problem-link"
                                                    >
                                                        {p.contestId}{p.index} - {p.name}
                                                    </a>
                                                </td>
                                                <td style={{ color: getDifficultyColor(p.rating), fontWeight: 700 }}>
                                                    {p.rating || "—"}
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                        {(p.tags || []).slice(0, 3).map(tag => (
                                                            <span key={tag} className="tag">{tag}</span>
                                                        ))}
                                                        {p.tags?.length > 3 && (
                                                            <span className="tag">+{p.tags.length - 3}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
