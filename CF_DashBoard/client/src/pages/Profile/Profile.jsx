import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiUser, FiTrendingUp, FiTarget, FiAward, FiActivity,
    FiCheck, FiX, FiBarChart2, FiPieChart,
    FiArrowLeft, FiCalendar
} from "react-icons/fi";
import { ActivityCalendar } from 'react-activity-calendar';
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend,
    AreaChart, Area
} from "recharts";
import { fetchUserInfo, fetchUserRating, fetchUserSubmissions } from "../../utils/api";
import {
    getActiveHandle, getCachedUser, setCachedUser,
    getCachedRating, setCachedRating, getCachedSubmissions, setCachedSubmissions
} from "../../utils/storage";
import {
    getRatingColor, getRankName, formatDate,
    getVerdictInfo, getDifficultyColor
} from "../../utils/helpers";
import "./Profile.css";

const CHART_COLORS = ["#818cf8", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

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
    const color = payload[0].payload?.fill || payload[0].color || "var(--primary-500)";
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: color }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">{name}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Submissions</span>
                    <span className="chart-tooltip-val" style={{ color: color }}>{value}</span>
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

function IndexTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const count = payload[0].value;
    const color = payload[0].payload?.fill || payload[0].color || "var(--primary-500)";
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-accent" style={{ background: color }} />
            <div className="chart-tooltip-body">
                <span className="chart-tooltip-label">Index {label}</span>
                <div className="chart-tooltip-row">
                    <span className="chart-tooltip-key">Solved</span>
                    <span className="chart-tooltip-val" style={{ color: color, fontSize: 18 }}>{count}</span>
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
    const [selectedYear, setSelectedYear] = useState("last12");
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (!handle) {
            navigate("/");
            return;
        }
        setSelectedYear("last12");
        loadAll();
    }, [handle]);

    async function loadAll() {
        setLoading(true);
        try {
            // Check caches first
            let userData = getCachedUser(handle);
            let ratingData = getCachedRating(handle);
            let subData = getCachedSubmissions(handle);

            // Fetch only what's missing — in parallel
            const fetches = [];
            if (!userData) fetches.push(fetchUserInfo(handle).then(d => { userData = d; setCachedUser(handle, d); }));
            if (!ratingData) fetches.push(fetchUserRating(handle).then(d => { ratingData = d; setCachedRating(handle, d); }));
            if (!subData) fetches.push(fetchUserSubmissions(handle).then(d => { subData = d; setCachedSubmissions(handle, d); }));

            if (fetches.length) await Promise.all(fetches);

            setUser(userData);
            setRatingHistory(ratingData);
            setSubmissions(subData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // ── Computed stats — SINGLE PASS over submissions ──
    const stats = useMemo(() => {
        if (!submissions.length) return null;

        const solvedSet = new Set();
        const solvedProblems = new Map();
        const langs = {};
        const verdicts = {};
        const unsolvedMap = new Map();
        const yearsSet = new Set();
        let acceptedCount = 0;

        // SINGLE PASS: process every submission once
        const len = submissions.length;
        for (let i = 0; i < len; i++) {
            const s = submissions[i];
            const problem = s.problem;
            const key = `${problem.contestId}-${problem.index}`;

            // Language counts
            const lang = s.programmingLanguage;
            langs[lang] = (langs[lang] || 0) + 1;

            // Verdict counts
            const v = s.verdict || "TESTING";
            verdicts[v] = (verdicts[v] || 0) + 1;

            // Years for heatmap dropdown
            if (s.creationTimeSeconds) {
                yearsSet.add(new Date(s.creationTimeSeconds * 1000).getFullYear());
            }

            // Accepted → track solved
            if (v === "OK") {
                acceptedCount++;
                if (!solvedSet.has(key)) {
                    solvedSet.add(key);
                    solvedProblems.set(key, problem);
                }
            } else if (!solvedSet.has(key) && !unsolvedMap.has(key) && problem.contestId) {
                // Unsolved: only first unseen attempt
                unsolvedMap.set(key, { ...problem, lastAttemptTime: s.creationTimeSeconds });
            }
        }

        // Process unique solved problems for tags, difficulty, index buckets
        const tags = {};
        const difficultyBuckets = {};
        const indexBuckets = {};

        solvedProblems.forEach((problem) => {
            // Tags
            const problemTags = problem.tags;
            if (problemTags) {
                for (let j = 0; j < problemTags.length; j++) {
                    const t = problemTags[j];
                    tags[t] = (tags[t] || 0) + 1;
                }
            }

            // Difficulty
            if (problem.rating) {
                const rKey = problem.rating.toString();
                difficultyBuckets[rKey] = (difficultyBuckets[rKey] || 0) + 1;
            }

            // Index — group A1, A2 → A
            if (problem.index) {
                const iKey = problem.index[0].toUpperCase();
                if (iKey >= 'A' && iKey <= 'Z') {
                    indexBuckets[iKey] = (indexBuckets[iKey] || 0) + 1;
                }
            }
        });

        // Build sorted output arrays
        const topLangs = Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }));

        const topTags = Object.entries(tags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, value]) => ({ name, value }));

        // Cache verdict info lookups — each key looked up only once
        const verdictEntries = Object.entries(verdicts);
        const verdictData = new Array(verdictEntries.length);
        for (let i = 0; i < verdictEntries.length; i++) {
            verdictEntries[i][2] = i; // stash original index for stable sort
        }
        verdictEntries.sort((a, b) => b[1] - a[1]);
        for (let i = 0; i < verdictEntries.length; i++) {
            const [name, value] = verdictEntries[i];
            const info = getVerdictInfo(name);
            verdictData[i] = { name: info.label, fullName: info.label, value, color: info.color };
        }

        const diffData = Object.entries(difficultyBuckets)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([name, value]) => ({ name, value }));

        const indexData = Object.entries(indexBuckets)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }));

        const unsolvedProblems = Array.from(unsolvedMap.values())
            .sort((a, b) => (b.lastAttemptTime || 0) - (a.lastAttemptTime || 0));

        const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

        return {
            totalSubmissions: len,
            solved: solvedSet.size,
            acceptRate: ((acceptedCount / len) * 100).toFixed(1),
            topLangs,
            topTags,
            verdictData,
            diffData,
            indexData,
            unsolvedProblems,
            availableYears,
        };
    }, [submissions]);

    // ── Rating: chart data + volatility in single pass ──
    const { ratingChartData, ratingVolatility } = useMemo(() => {
        if (!ratingHistory.length) return { ratingChartData: [], ratingVolatility: { maxUp: 0, maxDown: 0 } };

        const chartData = new Array(ratingHistory.length);
        let maxUp = 0;
        let maxDown = 0;

        for (let i = 0; i < ratingHistory.length; i++) {
            const r = ratingHistory[i];
            const change = r.newRating - r.oldRating;
            chartData[i] = {
                name: formatDate(r.ratingUpdateTimeSeconds),
                rating: r.newRating,
                contest: r.contestName,
                change,
            };
            if (change > maxUp) maxUp = change;
            if (change < maxDown) maxDown = change;
        }

        return { ratingChartData: chartData, ratingVolatility: { maxUp, maxDown } };
    }, [ratingHistory]);

    // availableYears is now computed inside stats — derive from there
    const availableYears = stats?.availableYears || [];

    // ── Heatmap: single computation for both data + months ──
    const { heatmapData, heatmapMonths } = useMemo(() => {
        if (!submissions.length) return { heatmapData: [], heatmapMonths: [] };

        // Build date→count maps (total + AC) in a single pass
        const counts = {};
        const acCounts = {};
        const len = submissions.length;
        for (let i = 0; i < len; i++) {
            const s = submissions[i];
            const ts = s.creationTimeSeconds;
            if (!ts) continue;
            const d = new Date(ts * 1000);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            // Fast string key without padStart
            const dateStr = `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
            counts[dateStr] = (counts[dateStr] || 0) + 1;
            if (s.verdict === 'OK') {
                acCounts[dateStr] = (acCounts[dateStr] || 0) + 1;
            }
        }

        // Generate day range and group by month simultaneously
        const data = [];
        const monthGroups = {};
        const monthOrder = [];
        const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        let startDate, endDate;
        if (selectedYear === "last12") {
            endDate = new Date();
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 365);
        } else {
            const yearNum = parseInt(selectedYear);
            startDate = new Date(yearNum, 0, 1);
            endDate = new Date(yearNum, 11, 31);
        }

        const cur = new Date(startDate);
        while (cur <= endDate) {
            const y = cur.getFullYear();
            const m = cur.getMonth();
            const day = cur.getDate();
            const mPad = m + 1;
            const dateStr = `${y}-${mPad < 10 ? '0' : ''}${mPad}-${day < 10 ? '0' : ''}${day}`;

            const count = counts[dateStr] || 0;
            const ac = acCounts[dateStr] || 0;
            const level = count >= 10 ? 4 : count >= 6 ? 3 : count >= 3 ? 2 : count > 0 ? 1 : 0;
            const item = { date: dateStr, count, level, ac };
            data.push(item);

            // Group into months inline — no re-parsing needed
            const monthKey = `${y}-${m}`;
            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = { name: MONTH_NAMES[m], year: y, days: [] };
                monthOrder.push(monthKey);
            }
            monthGroups[monthKey].days.push(item);

            cur.setDate(day + 1);
        }

        const months = monthOrder.map(k => monthGroups[k]);
        return { heatmapData: data, heatmapMonths: months };
    }, [submissions, selectedYear]);


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
                            <div className="stat-icon" style={{ background: "rgba(229, 169, 59, 0.15)", color: "#e5a93b" }}>
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

                    {/* Heatmap */}
                    {heatmapData.length > 0 && (
                        <div className="chart-card glass-card chart-full-width">
                            <div className="heatmap-header">
                                <h3 className="chart-title" style={{ margin: 0 }}><FiCalendar /> Submission Heatmap</h3>
                                <select 
                                    className="year-dropdown"
                                    value={selectedYear} 
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    <option value="last12">Last 12 Months</option>
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="heatmap-months-wrapper">
                                <div className="heatmap-months-container">
                                    {heatmapMonths.map((month, idx) => (
                                        <div className="heatmap-month-block" key={`${month.year}-${month.name}-${idx}`}>
                                            <div className="heatmap-month-calendar">
                                                <ActivityCalendar 
                                                    data={month.days} 
                                                    theme={{
                                                        light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
                                                        dark: ['#282828', '#004b1c', '#006d32', '#26a641', '#39d353']
                                                    }}
                                                    colorScheme="dark"
                                                    blockRadius={2}
                                                    blockSize={13}
                                                    blockMargin={3}
                                                    showMonthLabels={false}
                                                    showColorLegend={false}
                                                    showTotalCount={false}
                                                    showWeekdayLabels={false}
                                                    renderBlock={(block, activity) => {
                                                        const m = new Date(activity.date).getMonth();
                                                        const ac = activity.ac || 0;
                                                        const titleText = activity.count > 0
                                                            ? `${activity.count} submissions, ${ac} AC ✔ on ${activity.date}`
                                                            : `No submissions on ${activity.date}`;
                                                        return React.cloneElement(block, {
                                                            "data-month": m,
                                                            "data-is-even-month": m % 2 === 0,
                                                        }, [
                                                            <title key="t">{titleText}</title>
                                                        ]);
                                                    }}
                                                />
                                            </div>
                                            <div className="heatmap-month-label">{month.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="heatmap-footer">
                                <span className="heatmap-count">
                                    {heatmapData.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} submissions in the selected period
                                </span>
                                <div className="heatmap-legend">
                                    <span>Less</span>
                                    <div className="legend-block" style={{ backgroundColor: '#282828' }} />
                                    <div className="legend-block" style={{ backgroundColor: '#004b1c' }} />
                                    <div className="legend-block" style={{ backgroundColor: '#006d32' }} />
                                    <div className="legend-block" style={{ backgroundColor: '#26a641' }} />
                                    <div className="legend-block" style={{ backgroundColor: '#39d353' }} />
                                    <span>More</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rating Chart */}
                    {ratingChartData.length > 0 && (
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiTrendingUp /> Rating History</h3>
                            <ResponsiveContainer width="100%" height={380}>
                                <AreaChart data={ratingChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        interval="preserveStartEnd"
                                        tick={{ fill: "#94a3b8" }}
                                    />
                                    <YAxis 
                                        stroke="#64748b" 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false}
                                        domain={['dataMin - 100', 'dataMax + 100']}
                                        tick={{ fill: "#94a3b8" }}
                                    />
                                    <Tooltip content={<RatingTooltip />} cursor={{ stroke: '#818cf8', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="rating"
                                        stroke="#818cf8"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#ratingGradient)"
                                        dot={{ r: 3, fill: "#818cf8", stroke: "#121212", strokeWidth: 1.5 }}
                                        activeDot={{ r: 6, fill: "#818cf8", stroke: "#ffffff", strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Charts Section */}
                    <div className="charts-grid">
                        {/* Verdict Distribution */}
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiPieChart /> Verdict Distribution</h3>
                            <ResponsiveContainer width="100%" height={isMobile ? 360 : 450}>
                                <PieChart>
                                    <Pie
                                        data={stats.verdictData}
                                        cx={isMobile ? "50%" : "55%"}
                                        cy={isMobile ? "35%" : "50%"}
                                        innerRadius={isMobile ? "45%" : 110}
                                        outerRadius={isMobile ? "65%" : 180}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {stats.verdictData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<VerdictTooltip />} />
                                    <Legend
                                        layout={isMobile ? "horizontal" : "vertical"}
                                        align={isMobile ? "center" : "left"}
                                        verticalAlign={isMobile ? "bottom" : "middle"}
                                        formatter={(value) => (
                                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Language Distribution */}
                        <div className="chart-card glass-card">
                            <h3 className="chart-title"><FiPieChart /> Languages Used</h3>
                            <ResponsiveContainer width="100%" height={isMobile ? 360 : 450}>
                                <PieChart>
                                    <Pie
                                        data={stats.topLangs}
                                        cx={isMobile ? "50%" : "55%"}
                                        cy={isMobile ? "35%" : "50%"}
                                        innerRadius={isMobile ? "45%" : 110}
                                        outerRadius={isMobile ? "65%" : 180}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {stats.topLangs.map((entry, index) => (
                                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<LangTooltip />} />
                                    <Legend
                                        layout={isMobile ? "horizontal" : "vertical"}
                                        align={isMobile ? "center" : "left"}
                                        verticalAlign={isMobile ? "bottom" : "middle"}
                                        formatter={(value) => (
                                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Index Distribution — full width */}
                        <div className="chart-card glass-card chart-full-width">
                            <h3 className="chart-title"><FiBarChart2 /> Problem Index Distribution</h3>
                            <ResponsiveContainer width="100%" height={450}>
                                <BarChart data={stats.indexData} margin={{ bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748b"
                                        fontSize={12}
                                        height={40}
                                        tick={{ fill: "#94a3b8" }}
                                    />
                                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                                    <Tooltip content={<IndexTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                        {stats.indexData.map((entry, index) => (
                                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
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
                                                    <td>
                                                        <a
                                                            href={`https://codeforces.com/contest/${r.contestId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="problem-link"
                                                        >
                                                            {r.contestName}
                                                        </a>
                                                    </td>
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
