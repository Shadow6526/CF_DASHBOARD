import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiSearch, FiTrendingUp, FiClock, FiTarget, FiStar, FiArrowRight,
    FiZap, FiAward, FiUsers, FiCalendar, FiX
} from "react-icons/fi";
import { SiCodeforces } from "react-icons/si";
import { fetchUserInfo, fetchContests } from "../../utils/api";
import {
    getSavedHandles, addSavedHandle, removeSavedHandle,
    getActiveHandle, setActiveHandle, getCachedUser, setCachedUser
} from "../../utils/storage";
import { getRatingColor, getRankName, formatDate, getContestPhase, timeAgo } from "../../utils/helpers";
import "./Dashboard.css";

export default function Dashboard() {
    const navigate = useNavigate();
    const [handle, setHandle] = useState("");
    const [savedHandles, setSavedHandles] = useState([]);
    const [userProfiles, setUserProfiles] = useState({});
    const [upcomingContests, setUpcomingContests] = useState([]);
    const [recentContests, setRecentContests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setSavedHandles(getSavedHandles());
        loadContests();
    }, []);

    useEffect(() => {
        savedHandles.forEach((h) => {
            if (!userProfiles[h]) loadProfile(h);
        });
    }, [savedHandles]);

    async function loadProfile(h) {
        const cached = getCachedUser(h);
        if (cached) {
            setUserProfiles((prev) => ({ ...prev, [h]: cached }));
            return;
        }
        try {
            const data = await fetchUserInfo(h);
            setCachedUser(h, data);
            setUserProfiles((prev) => ({ ...prev, [h]: data }));
        } catch { }
    }

    async function loadContests() {
        try {
            const all = await fetchContests();
            const upcoming = all
                .filter((c) => c.phase === "BEFORE")
                .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds)
                .slice(0, 5);
            const recent = all
                .filter((c) => c.phase === "FINISHED")
                .slice(0, 5);
            setUpcomingContests(upcoming);
            setRecentContests(recent);
        } catch { }
    }

    async function handleSearch(e) {
        e.preventDefault();
        if (!handle.trim()) return;
        setLoading(true);
        setError("");
        try {
            await fetchUserInfo(handle.trim());
            addSavedHandle(handle.trim());
            setActiveHandle(handle.trim());
            setSavedHandles(getSavedHandles());
            navigate("/profile");
        } catch (err) {
            setError(err.response?.data?.comment || "User not found");
        } finally {
            setLoading(false);
        }
    }

    function selectProfile(h) {
        setActiveHandle(h);
        navigate("/profile");
    }

    function removeHandle(h) {
        removeSavedHandle(h);
        setSavedHandles(getSavedHandles());
    }

    return (
        <div className="dashboard" id="dashboard-page">
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-bg">
                    <div className="hero-orb hero-orb-1" />
                    <div className="hero-orb hero-orb-2" />
                    <div className="hero-orb hero-orb-3" />
                </div>
                <div className="hero-content">
                    <div className="hero-badge">
                        <FiZap />
                        <span>Codeforces Dashboard</span>
                    </div>
                    <h1 className="hero-title">
                        Track Your <span className="gradient-text">Codeforces</span> Journey
                    </h1>
                    <p className="hero-subtitle">
                        Analyze your performance, track rating changes, explore problems, and stay updated with upcoming contests — all in one place.
                    </p>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="hero-search" id="hero-search-form">
                        <div className="search-input-wrapper">
                            <FiSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Enter Codeforces handle..."
                                value={handle}
                                onChange={(e) => setHandle(e.target.value)}
                                className="search-input"
                                id="search-input"
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg search-btn"
                            disabled={loading}
                            id="search-btn"
                        >
                            {loading ? (
                                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                            ) : (
                                <>
                                    <span>Search</span>
                                    <FiArrowRight />
                                </>
                            )}
                        </button>
                    </form>
                    {error && <p className="search-error">{error}</p>}
                </div>
            </section>

            {/* Analytics Stat Cards */}
            {savedHandles.length > 0 && (() => {
                const activeH = savedHandles[0];
                const p = userProfiles[activeH];
                if (!p) return null;
                const statCards = [
                    { label: "Current Rating", value: p.rating || 0, icon: <FiTrendingUp />, color: "#00d4ff" },
                    { label: "Max Rating", value: p.maxRating || 0, icon: <FiAward />, color: "#34d399" },
                    { label: "Contribution", value: p.contribution || 0, icon: <FiStar />, color: "#f59e0b" },
                    { label: "Friends", value: p.friendOfCount || 0, icon: <FiUsers />, color: "#f87171" },
                ];
                return (
                    <section className="stat-cards-grid animate-fade-in">
                        {statCards.map((s) => (
                            <div key={s.label} className="stat-card glass-card">
                                <div className="stat-card-icon" style={{ color: s.color, background: `${s.color}15` }}>
                                    {s.icon}
                                </div>
                                <div className="stat-card-info">
                                    <span className="stat-card-value" style={{ color: s.color }}>{s.value}</span>
                                    <span className="stat-card-label">{s.label}</span>
                                </div>
                            </div>
                        ))}
                    </section>
                );
            })()}


            {/* Saved Profiles */}
            {savedHandles.length > 0 && (
                <section className="section animate-fade-in">
                    <div className="section-header">
                        <h2><FiUsers className="section-icon" /> Saved Profiles</h2>
                    </div>
                    <div className="profiles-grid">
                        {savedHandles.map((h) => {
                            const profile = userProfiles[h];
                            return (
                                <div key={h} className="profile-card glass-card" onClick={() => selectProfile(h)}>
                                    <button
                                        className="profile-remove"
                                        onClick={(e) => { e.stopPropagation(); removeHandle(h); }}
                                        title="Remove"
                                    >
                                        <FiX />
                                    </button>
                                    {profile ? (
                                        <>
                                            <div className="profile-avatar">
                                                {profile.titlePhoto && !profile.titlePhoto.includes("no-title") ? (
                                                    <img src={profile.titlePhoto.startsWith("//") ? `https:${profile.titlePhoto}` : profile.titlePhoto} alt={h} />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {h[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="profile-handle" style={{ color: getRatingColor(profile.rating) }}>
                                                {profile.handle}
                                            </h3>
                                            <span className="profile-rank" style={{ color: getRatingColor(profile.rating) }}>
                                                {getRankName(profile.rating)}
                                            </span>
                                            <div className="profile-ratings">
                                                <div>
                                                    <span className="rating-label">Current</span>
                                                    <span className="rating-value" style={{ color: getRatingColor(profile.rating) }}>
                                                        {profile.rating || "—"}
                                                    </span>
                                                </div>
                                                <div className="rating-divider" />
                                                <div>
                                                    <span className="rating-label">Max</span>
                                                    <span className="rating-value" style={{ color: getRatingColor(profile.maxRating) }}>
                                                        {profile.maxRating || "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="profile-loading">
                                            <div className="shimmer" style={{ width: 64, height: 64, borderRadius: "50%" }} />
                                            <div className="shimmer" style={{ width: 100, height: 18, borderRadius: 8, marginTop: 8 }} />
                                            <div className="shimmer" style={{ width: 80, height: 14, borderRadius: 8, marginTop: 4 }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}


        </div>
    );
}
