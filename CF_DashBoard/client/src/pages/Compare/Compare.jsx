import { useState } from "react";
import { FiUsers, FiTrendingUp, FiArrowRight, FiTarget, FiActivity } from "react-icons/fi";
import { fetchUserInfo, fetchUserRating, fetchUserSubmissions } from "../../utils/api";
import { getRatingColor, getRankName } from "../../utils/helpers";
import "./Compare.css";

export default function Compare() {
    const [handle1, setHandle1] = useState("");
    const [handle2, setHandle2] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stats, setStats] = useState(null);

    async function handleCompare(e) {
        e.preventDefault();
        if (!handle1.trim() || !handle2.trim()) {
            setError("Please enter both handles.");
            return;
        }
        if (handle1.trim().toLowerCase() === handle2.trim().toLowerCase()) {
            setError("Cannot compare a user with themselves.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const h1 = handle1.trim();
            const h2 = handle2.trim();

            const [user1Data, user2Data, rating1Data, rating2Data, sub1Data, sub2Data] = await Promise.all([
                fetchUserInfo(h1),
                fetchUserInfo(h2),
                fetchUserRating(h1),
                fetchUserRating(h2),
                fetchUserSubmissions(h1), // Fetch lifetime data
                fetchUserSubmissions(h2)  // Fetch lifetime data
            ]);

            const p1Stats = processStats(sub1Data, rating1Data);
            const p2Stats = processStats(sub2Data, rating2Data);

            setStats({
                u1: { info: user1Data, stats: p1Stats },
                u2: { info: user2Data, stats: p2Stats }
            });
        } catch (err) {
            setError(err.response?.data?.comment || "Could not fetch data for one or both users. Please verify handles.");
        } finally {
            setLoading(false);
        }
    }

    function processStats(submissions, ratingHistory) {
        const solvedSet = new Set();
        let acceptedCount = 0;
        const len = submissions.length;

        for (let i = 0; i < len; i++) {
            const s = submissions[i];
            if (s.verdict === "OK") {
                acceptedCount++;
                solvedSet.add(`${s.problem.contestId}-${s.problem.index}`);
            }
        }

        const acceptRate = len ? ((acceptedCount / len) * 100).toFixed(1) : 0;

        let maxUp = 0;
        let maxDown = 0;
        for (let i = 0; i < ratingHistory.length; i++) {
            const diff = ratingHistory[i].newRating - ratingHistory[i].oldRating;
            if (diff > maxUp) maxUp = diff;
            if (diff < maxDown) maxDown = diff;
        }

        return {
            totalSubmissions: len,
            solved: solvedSet.size,
            acceptRate: parseFloat(acceptRate),
            maxUp,
            maxDown,
            contests: ratingHistory.length
        };
    }

    // Helper for coloring wins
    const renderComparisonRow = (label, val1, val2, higherIsBetter = true, formatFn) => {
        // Parse numeric value for comparison (strips non-numeric chars like % or +)
        const num1 = typeof val1 === 'number' ? val1 : parseFloat(String(val1).replace(/[^\d.-]/g, '')) || 0;
        const num2 = typeof val2 === 'number' ? val2 : parseFloat(String(val2).replace(/[^\d.-]/g, '')) || 0;

        let v1Better = false;
        let v2Better = false;

        if (higherIsBetter) {
            if (num1 > num2) v1Better = true;
            if (num2 > num1) v2Better = true;
        } else {
            if (num1 < num2) v1Better = true;
            if (num2 < num1) v2Better = true;
        }

        const display1 = formatFn ? formatFn(val1) : val1;
        const display2 = formatFn ? formatFn(val2) : val2;

        return (
            <div className="compare-row">
                <div className={`compare-val left ${v1Better ? 'winner' : ''}`}>
                    {display1}
                </div>
                <div className="compare-label">{label}</div>
                <div className={`compare-val right ${v2Better ? 'winner' : ''}`}>
                    {display2}
                </div>
            </div>
        );
    };

    return (
        <div className="compare-page animate-fade-in">
            <div className="compare-hero">
                <FiUsers className="hero-icon" />
                <h1>Compare Users</h1>
                <p>Pit two Codeforces handles against each other to see who comes out on top.</p>
            </div>

            <form onSubmit={handleCompare} className="compare-form glass-card">
                <div className="input-split">
                    <input
                        type="text"
                        placeholder="Player 1 handle..."
                        value={handle1}
                        onChange={(e) => setHandle1(e.target.value)}
                        className="input"
                    />
                    <span className="vs-badge">VS</span>
                    <input
                        type="text"
                        placeholder="Player 2 handle..."
                        value={handle2}
                        onChange={(e) => setHandle2(e.target.value)}
                        className="input"
                    />
                </div>
                <button type="submit" className="btn btn-primary btn-lg compare-btn" disabled={loading}>
                    {loading ? (
                        <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                    ) : (
                        <>
                            <span>Compare</span>
                            <FiArrowRight />
                        </>
                    )}
                </button>
                {error && <p className="search-error">{error}</p>}
            </form>

            {stats && (
                <div className="compare-results animate-slide-in">
                    <div className="compare-header">
                        <div className="compare-user left">
                            <div className="avatar-wrapper">
                                {stats.u1.info.titlePhoto ? (
                                    <img src={stats.u1.info.titlePhoto.startsWith("//") ? `https:${stats.u1.info.titlePhoto}` : stats.u1.info.titlePhoto} alt={stats.u1.info.handle} />
                                ) : (
                                    <div className="avatar-placeholder">{stats.u1.info.handle[0].toUpperCase()}</div>
                                )}
                                <div className="avatar-ring" style={{ borderColor: getRatingColor(stats.u1.info.rating) }} />
                            </div>
                            <h2 style={{ color: getRatingColor(stats.u1.info.rating) }}>{stats.u1.info.handle}</h2>
                            <span className="rank-name" style={{ color: getRatingColor(stats.u1.info.rating) }}>
                                {getRankName(stats.u1.info.rating)}
                            </span>
                        </div>
                        <div className="compare-user right">
                            <div className="avatar-wrapper">
                                {stats.u2.info.titlePhoto ? (
                                    <img src={stats.u2.info.titlePhoto.startsWith("//") ? `https:${stats.u2.info.titlePhoto}` : stats.u2.info.titlePhoto} alt={stats.u2.info.handle} />
                                ) : (
                                    <div className="avatar-placeholder">{stats.u2.info.handle[0].toUpperCase()}</div>
                                )}
                                <div className="avatar-ring" style={{ borderColor: getRatingColor(stats.u2.info.rating) }} />
                            </div>
                            <h2 style={{ color: getRatingColor(stats.u2.info.rating) }}>{stats.u2.info.handle}</h2>
                            <span className="rank-name" style={{ color: getRatingColor(stats.u2.info.rating) }}>
                                {getRankName(stats.u2.info.rating)}
                            </span>
                        </div>
                    </div>

                    <div className="compare-section glass-card">
                        <h3 className="section-title"><FiTrendingUp /> Core Stats</h3>
                        {renderComparisonRow("Current Rating", stats.u1.info.rating || 0, stats.u2.info.rating || 0)}
                        {renderComparisonRow("Max Rating", stats.u1.info.maxRating || 0, stats.u2.info.maxRating || 0)}
                        {renderComparisonRow("Contribution", stats.u1.info.contribution || 0, stats.u2.info.contribution || 0)}
                        {renderComparisonRow("Friends", stats.u1.info.friendOfCount || 0, stats.u2.info.friendOfCount || 0)}
                    </div>

                    <div className="compare-section glass-card">
                        <h3 className="section-title"><FiTarget /> Problem Solving</h3>
                        {renderComparisonRow("Problems Solved", stats.u1.stats.solved, stats.u2.stats.solved)}
                        {renderComparisonRow("Acceptance Rate", stats.u1.stats.acceptRate, stats.u2.stats.acceptRate, true, (v) => `${v}%`)}
                        {renderComparisonRow("Total Submissions", stats.u1.stats.totalSubmissions, stats.u2.stats.totalSubmissions)}
                    </div>

                    <div className="compare-section glass-card">
                        <h3 className="section-title"><FiActivity /> Contest Performance</h3>
                        {renderComparisonRow("Contests Attended", stats.u1.stats.contests, stats.u2.stats.contests)}
                        {renderComparisonRow("Max Rating Jump", stats.u1.stats.maxUp, stats.u2.stats.maxUp, true, (v) => `+${v}`)}
                        {renderComparisonRow("Max Rating Drop", Math.abs(stats.u1.stats.maxDown), Math.abs(stats.u2.stats.maxDown), false)}
                    </div>
                </div>
            )}
        </div>
    );
}
