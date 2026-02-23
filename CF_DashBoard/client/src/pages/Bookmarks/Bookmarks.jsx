import { useState, useEffect } from "react";
import {
    FiBookmark, FiExternalLink, FiTrash2, FiX
} from "react-icons/fi";
import { getBookmarkedProblems, toggleBookmarkProblem } from "../../utils/storage";
import { getDifficultyColor, timeAgo } from "../../utils/helpers";
import "./Bookmarks.css";

export default function Bookmarks() {
    const [bookmarks, setBookmarks] = useState([]);

    useEffect(() => {
        setBookmarks(getBookmarkedProblems());
    }, []);

    function removeBookmark(problem) {
        const updated = toggleBookmarkProblem(problem);
        setBookmarks(updated);
    }

    return (
        <div className="bookmarks-page" id="bookmarks-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <FiBookmark className="title-icon" /> Bookmarked Problems
                    </h1>
                    <p className="page-subtitle">
                        {bookmarks.length} problem{bookmarks.length !== 1 ? "s" : ""} saved
                    </p>
                </div>
            </div>

            {bookmarks.length === 0 ? (
                <div className="empty-state">
                    <FiBookmark className="empty-icon" />
                    <h3>No bookmarks yet</h3>
                    <p>
                        Browse the Problems page and bookmark problems you want to solve later.
                    </p>
                </div>
            ) : (
                <div className="bookmarks-list">
                    {bookmarks.map((p) => (
                        <div key={`${p.contestId}-${p.index}`} className="bookmark-card glass-card">
                            <div className="bookmark-info">
                                <div className="bookmark-top">
                                    <span className="problem-id">{p.contestId}{p.index}</span>
                                    {p.rating && (
                                        <span
                                            className="difficulty-badge"
                                            style={{
                                                color: getDifficultyColor(p.rating),
                                                background: `${getDifficultyColor(p.rating)}15`,
                                            }}
                                        >
                                            {p.rating}
                                        </span>
                                    )}
                                </div>
                                <a
                                    href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bookmark-name"
                                >
                                    {p.name}
                                </a>
                                <div className="bookmark-meta">
                                    {p.tags?.slice(0, 4).map((t) => (
                                        <span key={t} className="tag">{t}</span>
                                    ))}
                                </div>
                                {p.bookmarkedAt && (
                                    <span className="bookmark-time">
                                        Saved {timeAgo(p.bookmarkedAt / 1000)}
                                    </span>
                                )}
                            </div>
                            <div className="bookmark-actions">
                                <a
                                    href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                >
                                    <FiExternalLink /> Solve
                                </a>
                                <button
                                    className="btn btn-ghost btn-sm remove-btn"
                                    onClick={() => removeBookmark(p)}
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
