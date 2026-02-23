const KEYS = {
    SAVED_HANDLES: "cf_saved_handles",
    ACTIVE_HANDLE: "cf_active_handle",
    USER_CACHE: "cf_user_cache",
    SUBMISSIONS_CACHE: "cf_submissions_cache",
    RATING_CACHE: "cf_rating_cache",
    BOOKMARKED_PROBLEMS: "cf_bookmarked_problems",
    THEME: "cf_theme",
};

// ── Generic helpers ──
function getJSON(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ── Handles ──
export function getSavedHandles() {
    return getJSON(KEYS.SAVED_HANDLES, []);
}

export function addSavedHandle(handle) {
    const handles = getSavedHandles();
    if (!handles.includes(handle)) {
        handles.unshift(handle);
        if (handles.length > 20) handles.pop();
        setJSON(KEYS.SAVED_HANDLES, handles);
    }
}

export function removeSavedHandle(handle) {
    const handles = getSavedHandles().filter((h) => h !== handle);
    setJSON(KEYS.SAVED_HANDLES, handles);
}

export function getActiveHandle() {
    return localStorage.getItem(KEYS.ACTIVE_HANDLE) || "";
}

export function setActiveHandle(handle) {
    localStorage.setItem(KEYS.ACTIVE_HANDLE, handle);
}

// ── Caches ──
export function getCachedUser(handle) {
    const cache = getJSON(KEYS.USER_CACHE, {});
    const entry = cache[handle];
    if (!entry) return null;
    // cache for 10 minutes
    if (Date.now() - entry.ts > 10 * 60 * 1000) return null;
    return entry.data;
}

export function setCachedUser(handle, data) {
    const cache = getJSON(KEYS.USER_CACHE, {});
    cache[handle] = { data, ts: Date.now() };
    setJSON(KEYS.USER_CACHE, cache);
}

export function getCachedSubmissions(handle) {
    const cache = getJSON(KEYS.SUBMISSIONS_CACHE, {});
    const entry = cache[handle];
    if (!entry) return null;
    if (Date.now() - entry.ts > 5 * 60 * 1000) return null;
    return entry.data;
}

export function setCachedSubmissions(handle, data) {
    const cache = getJSON(KEYS.SUBMISSIONS_CACHE, {});
    cache[handle] = { data, ts: Date.now() };
    setJSON(KEYS.SUBMISSIONS_CACHE, cache);
}

export function getCachedRating(handle) {
    const cache = getJSON(KEYS.RATING_CACHE, {});
    const entry = cache[handle];
    if (!entry) return null;
    if (Date.now() - entry.ts > 10 * 60 * 1000) return null;
    return entry.data;
}

export function setCachedRating(handle, data) {
    const cache = getJSON(KEYS.RATING_CACHE, {});
    cache[handle] = { data, ts: Date.now() };
    setJSON(KEYS.RATING_CACHE, cache);
}

// ── Bookmarked Problems ──
export function getBookmarkedProblems() {
    return getJSON(KEYS.BOOKMARKED_PROBLEMS, []);
}

export function toggleBookmarkProblem(problem) {
    const bookmarks = getBookmarkedProblems();
    const key = `${problem.contestId}-${problem.index}`;
    const idx = bookmarks.findIndex(
        (p) => `${p.contestId}-${p.index}` === key
    );
    if (idx === -1) {
        bookmarks.unshift({ ...problem, bookmarkedAt: Date.now() });
    } else {
        bookmarks.splice(idx, 1);
    }
    setJSON(KEYS.BOOKMARKED_PROBLEMS, bookmarks);
    return bookmarks;
}

export function isBookmarked(contestId, index) {
    const bookmarks = getBookmarkedProblems();
    return bookmarks.some(
        (p) => p.contestId === contestId && p.index === index
    );
}
