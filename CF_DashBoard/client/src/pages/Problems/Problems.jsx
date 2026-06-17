import { useState, useEffect, useMemo } from "react";
import {
    FiList, FiSearch, FiBookmark, FiExternalLink,
    FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import { fetchProblemset } from "../../utils/api";
import { toggleBookmarkProblem, isBookmarked } from "../../utils/storage";
import { getDifficultyColor } from "../../utils/helpers";
import "./Problems.css";

const POPULAR_TAGS = [
    "implementation", "math", "greedy", "dp", "data structures",
    "brute force", "constructive algorithms", "graphs", "sortings",
    "binary search", "strings", "trees", "number theory", "geometry", "dfs and similar"
];

export default function Problems() {
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [diffRange, setDiffRange] = useState([800, 3500]);
    const [page, setPage] = useState(1);
    const perPage = 30;

    useEffect(() => {
        loadProblems();
    }, []);

    async function loadProblems() {
        try {
            const data = await fetchProblemset();
            setProblems(data.problems || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function toggleTag(tag) {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }

    function handleBookmark(problem) {
        toggleBookmarkProblem(problem);
    }

    const filtered = useMemo(() => {
        let list = problems;

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    `${p.contestId}${p.index}`.toLowerCase().includes(q)
            );
        }

        if (selectedTags.length > 0) {
            list = list.filter((p) =>
                selectedTags.every((tag) => p.tags?.includes(tag))
            );
        }

        list = list.filter(
            (p) => !p.rating || (p.rating >= diffRange[0] && p.rating <= diffRange[1])
        );

        return list;
    }, [problems, search, selectedTags, diffRange]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    useEffect(() => {
        setPage(1);
    }, [search, selectedTags, diffRange]);

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: "60vh" }}>
                <div className="spinner" />
                <p>Loading problems...</p>
            </div>
        );
    }

    return (
        <div className="problems-page" id="problems-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <FiList className="title-icon" /> Problems
                    </h1>
                    <p className="page-subtitle">
                        Browse {problems.length.toLocaleString()} problems from Codeforces
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="problems-toolbar">
                <div className="input-with-icon" style={{ flex: 1, maxWidth: 400 }}>
                    <FiSearch className="icon" />
                    <input
                        type="text"
                        placeholder="Search problems by name or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input"
                        id="problem-search"
                    />
                </div>
                <div className="diff-filter">
                    <span className="diff-label">Difficulty:</span>
                    <select
                        className="input diff-select"
                        value={diffRange[0]}
                        onChange={(e) => setDiffRange([parseInt(e.target.value), diffRange[1]])}
                    >
                        {[800, 1000, 1200,1300,1400,1500, 1600,1700, 1800, 1900,2000,2100, 2200,2300, 2400,2500].map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                    <span style={{ color: "var(--text-muted)" }}>to</span>
                    <select
                        className="input diff-select"
                        value={diffRange[1]}
                        onChange={(e) => setDiffRange([diffRange[0], parseInt(e.target.value)])}
                    >
                        {[800, 1000, 1200,1300,1400,1500, 1600,1700, 1800, 1900,2000,2100, 2200,2300, 2400,2500].map((v) => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tag Pills */}
            <div className="tag-filters">
                {POPULAR_TAGS.map((tag) => (
                    <button
                        key={tag}
                        className={`tag-pill ${selectedTags.includes(tag) ? "active" : ""}`}
                        onClick={() => toggleTag(tag)}
                    >
                        {tag}
                    </button>
                ))}
                {selectedTags.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTags([])}>
                        Clear all
                    </button>
                )}
            </div>

            {/* Results count */}
            <p className="results-count">
                Showing {paginated.length} of {filtered.length.toLocaleString()} problems
            </p>

            {/* Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: 50 }}></th>
                            <th style={{ width: 90 }}>ID</th>
                            <th>Problem Name</th>
                            <th style={{ width: 100 }}>Difficulty</th>
                            <th>Tags</th>
                            <th style={{ width: 50 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map((p) => {
                            const bookmarked = isBookmarked(p.contestId, p.index);
                            return (
                                <tr key={`${p.contestId}-${p.index}`}>
                                    <td>
                                        <button
                                            className={`bookmark-btn ${bookmarked ? "active" : ""}`}
                                            onClick={() => handleBookmark(p)}
                                            title={bookmarked ? "Remove bookmark" : "Bookmark"}
                                        >
                                            <FiBookmark />
                                        </button>
                                    </td>
                                    <td>
                                        <span className="problem-id">{p.contestId}{p.index}</span>
                                    </td>
                                    <td>
                                        <a
                                            href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="problem-name-link"
                                        >
                                            {p.name}
                                        </a>
                                    </td>
                                    <td>
                                        {p.rating ? (
                                            <span
                                                className="difficulty-badge"
                                                style={{ color: getDifficultyColor(p.rating), background: `${getDifficultyColor(p.rating)}15` }}
                                            >
                                                {p.rating}
                                            </span>
                                        ) : (
                                            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="problem-tags">
                                            {p.tags?.slice(0, 4).map((t) => (
                                                <span key={t} className="tag">{t}</span>
                                            ))}
                                            {p.tags?.length > 4 && (
                                                <span className="tag">+{p.tags.length - 4}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <a
                                            href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost btn-icon btn-sm"
                                        >
                                            <FiExternalLink />
                                        </a>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filtered.length === 0 && (
                <div className="empty-state">
                    <FiList className="empty-icon" />
                    <h3>No problems found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
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
