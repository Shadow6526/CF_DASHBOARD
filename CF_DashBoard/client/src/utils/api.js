import axios from "axios";

const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "/api";

const api = axios.create({
    baseURL: API_BASE,
    timeout: 20000,
});

export const fetchUserInfo = async (handle) => {
    const res = await api.get(`/user/${handle}`);
    return res.data.result;
};

export const fetchUserRating = async (handle) => {
    const res = await api.get(`/user/${handle}/rating`);
    return res.data.result;
};

export const fetchUserSubmissions = async (handle, count) => {
    const params = {};
    if (count) params.count = count;
    
    const res = await api.get(`/user/${handle}/submissions`, { params });
    return res.data.result;
};

export const fetchContests = async () => {
    const res = await api.get("/contests");
    return res.data.result;
};

export const fetchContestStandings = async (contestId, from = 1, count = 50) => {
    const res = await api.get(`/contest/${contestId}/standings`, {
        params: { from, count },
    });
    return res.data.result;
};

export const fetchProblemset = async (tags) => {
    const params = {};
    if (tags) params.tags = tags;
    const res = await api.get("/problemset", { params });
    return res.data.result;
};

export default api;
