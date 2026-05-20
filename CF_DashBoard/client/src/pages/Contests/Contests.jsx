import { useState, useEffect, useMemo } from "react";
import {
    FiCalendar, FiClock, FiTarget, FiUsers, FiSearch,
    FiFilter, FiExternalLink, FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import { fetchContests } from "../../utils/api";
import { formatDate, formatDuration, getContestPhase } from "../../utils/helpers";
import "./Contests.css";

export default function Contests() {
    const [contests, setContests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [page, setPage] = useState(1);
    const perPage = 20;

    useEffect(() => {
        loadContests();
    }, []);

    async function loadContests() {
        try {
            const data = await fetchContests();
            setContests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const filtered = useMemo(() => {
        let list = contests;
        if (filter !== "all") {
            list = list.filter((c) => c.phase === filter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((c) => c.name.toLowerCase().includes(q));
        }
        return list;
    }, [contests, filter, search]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    useEffect(() => {
        setPage(1);
    }, [filter, search]);

    // Single-pass phase counts instead of 3 separate .filter() calls
    const { upcoming, running, finished } = useMemo(() => {
        let upcoming = 0, running = 0, finished = 0;
        for (let i = 0; i < contests.length; i++) {
            const phase = contests[i].phase;
            if (phase === "BEFORE") upcoming++;
            else if (phase === "CODING") running++;
            else if (phase === "FINISHED") finished++;
        }
        return { upcoming, running, finished };
    }, [contests]);

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
                <p>Loading contests...</p>
            </div>
        );
    }

    return (
        <div className="contests-page" id="contests-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <FiCalendar className="title-icon" /> Contests
                    </h1>
                    <p className="page-subtitle">Browse and track Codeforces contests</p>
                </div>
            </div>

            {/* Summary badges */}
            <div className="contest-summary">
                <div className="summary-badge" style={{ borderColor: "rgba(34, 211, 238, 0.3)" }}>
                    <span className="summary-count" style={{ color: "#22d3ee" }}>{upcoming}</span>
                    <span className="summary-label">Upcoming</span>
                </div>
                <div className="summary-badge" style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
                    <span className="summary-count" style={{ color: "#34d399" }}>{running}</span>
                    <span className="summary-label">Running</span>
                </div>
                <div className="summary-badge" style={{ borderColor: "rgba(100, 116, 139, 0.3)" }}>
                    <span className="summary-count" style={{ color: "#94a3b8" }}>{finished}</span>
                    <span className="summary-label">Finished</span>
                </div>
            </div>

            {/* Filters */}
            <div className="contests-toolbar">
                <div className="input-with-icon" style={{ maxWidth: 360 }}>
                    <FiSearch className="icon" />
                    <input
                        type="text"
                        placeholder="Search contests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input"
                        id="contest-search"
                    />
                </div>
                <div className="filter-pills">
                    {[
                        { key: "all", label: "All" },
                        { key: "BEFORE", label: "Upcoming" },
                        { key: "CODING", label: "Running" },
                        { key: "FINISHED", label: "Finished" },
                    ].map((f) => (
                        <button
                            key={f.key}
                            className={`btn btn-sm ${filter === f.key ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contest list */}
            <div className="contests-grid">
                {paginated.map((c) => {
                    const phase = getContestPhase(c.phase);
                    return (
                        <div key={c.id} className="contest-card glass-card">
                            <div className="contest-card-header">
                                <span className={`badge ${phase.badge}`}>{phase.label}</span>
                                <a
                                    href={c.phase === "BEFORE"
                                        ? `https://codeforces.com/contestRegistration/${c.id}`
                                        : `https://codeforces.com/contest/${c.id}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost btn-sm"
                                    title={c.phase === "BEFORE" ? "Register" : "View Contest"}
                                >
                                    <FiExternalLink /> {c.phase === "BEFORE" ? "Register" : ""}
                                </a>
                            </div>
                            <h3 className="contest-card-title">{c.name}</h3>
                            <div className="contest-card-meta">
                                <span><FiCalendar /> {formatDate(c.startTimeSeconds)}</span>
                                <span><FiClock /> {formatDuration(c.durationSeconds)}</span>
                                <span><FiUsers /> {c.type}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="empty-state">
                    <FiCalendar className="empty-icon" />
                    <h3>No contests found</h3>
                    <p>Try adjusting your search or filter.</p>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        <FiChevronLeft /> Prev
                    </button>
                    <span className="page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next <FiChevronRight />
                    </button>
                </div>
            )}
        </div>
    );
}
