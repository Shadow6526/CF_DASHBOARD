// ── Rating color mapping (Codeforces ranks) ──
export function getRatingColor(rating) {
    if (!rating || rating < 0) return "#808080";
    if (rating < 1200) return "#808080";    // Newbie
    if (rating < 1400) return "#008000";    // Pupil
    if (rating < 1600) return "#03a89e";    // Specialist
    if (rating < 1900) return "#0000ff";    // Expert
    if (rating < 2100) return "#aa00aa";    // Candidate Master
    if (rating < 2300) return "#ff8c00";    // Master
    if (rating < 2400) return "#ff8c00";    // International Master
    if (rating < 2600) return "#ff0000";    // Grandmaster
    if (rating < 3000) return "#ff0000";    // International Grandmaster
    return "#ff0000";                        // Legendary Grandmaster
}

export function getRankName(rating) {
    if (!rating || rating < 0) return "Unrated";
    if (rating < 1200) return "Newbie";
    if (rating < 1400) return "Pupil";
    if (rating < 1600) return "Specialist";
    if (rating < 1900) return "Expert";
    if (rating < 2100) return "Candidate Master";
    if (rating < 2300) return "Master";
    if (rating < 2400) return "International Master";
    if (rating < 2600) return "Grandmaster";
    if (rating < 3000) return "International Grandmaster";
    return "Legendary Grandmaster";
}

export function getRankBadgeClass(rating) {
    if (!rating || rating < 1200) return "badge-secondary";
    if (rating < 1400) return "badge-success";
    if (rating < 1600) return "badge-info";
    if (rating < 1900) return "badge-primary";
    if (rating < 2100) return "badge-warning";
    return "badge-danger";
}

// ── Date / Time ──
export function formatDate(seconds) {
    return new Date(seconds * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatDateTime(seconds) {
    return new Date(seconds * 1000).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function timeAgo(seconds) {
    const now = Date.now() / 1000;
    const diff = now - seconds;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(seconds);
}

export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ── Verdict mapping ──
export function getVerdictInfo(verdict) {
    const map = {
        OK: { label: "Accepted", color: "#10b981", short: "AC" },
        WRONG_ANSWER: { label: "Wrong Answer", color: "#ef4444", short: "WA" },
        TIME_LIMIT_EXCEEDED: { label: "TLE", color: "#f59e0b", short: "TLE" },
        MEMORY_LIMIT_EXCEEDED: { label: "MLE", color: "#f97316", short: "MLE" },
        RUNTIME_ERROR: { label: "Runtime Error", color: "#e11d48", short: "RE" },
        COMPILATION_ERROR: { label: "Compilation Error", color: "#8b5cf6", short: "CE" },
        CHALLENGED: { label: "Challenged", color: "#ec4899", short: "CH" },
        SKIPPED: { label: "Skipped", color: "#64748b", short: "SK" },
        TESTING: { label: "Testing", color: "#06b6d4", short: "..." },
        PARTIAL: { label: "Partial", color: "#eab308", short: "PT" },
        PRESENTATION_ERROR: { label: "Presentation Error", color: "#a855f7", short: "PE" },
        IDLENESS_LIMIT_EXCEEDED: { label: "ILE", color: "#f59e0b", short: "ILE" },
    };
    return map[verdict] || { label: verdict || "Unknown", color: "#64748b", short: "?" };
}

// ── Problem difficulty color (official Codeforces rank colors) ──
export function getDifficultyColor(rating) {
    if (!rating) return "#808080";
    if (rating < 1200) return "#808080";    // Newbie — Grey
    if (rating < 1400) return "#00c853";    // Pupil — Green
    if (rating < 1600) return "#00bcd4";    // Specialist — Cyan / Sky Blue
    if (rating < 1900) return "#2979ff";    // Expert — Blue
    if (rating < 2100) return "#aa00ff";    // Candidate Master — Violet
    if (rating < 2300) return "#ff8c00";    // Master — Orange
    if (rating < 2400) return "#ff8c00";    // International Master — Orange
    if (rating < 2600) return "#ff1744";    // Grandmaster — Red
    if (rating < 3000) return "#ff1744";    // International GM — Red
    return "#ff1744";                       // Legendary GM — Red
}

// ── Contest phase ──
export function getContestPhase(phase) {
    const map = {
        BEFORE: { label: "Upcoming", color: "#22d3ee", badge: "badge-info" },
        CODING: { label: "Running", color: "#10b981", badge: "badge-success" },
        PENDING_SYSTEM_TEST: { label: "Pending", color: "#f59e0b", badge: "badge-warning" },
        SYSTEM_TEST: { label: "System Test", color: "#f59e0b", badge: "badge-warning" },
        FINISHED: { label: "Finished", color: "#64748b", badge: "badge-secondary" },
    };
    return map[phase] || { label: phase, color: "#64748b", badge: "" };
}

// ── Number formatting ──
export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
}
