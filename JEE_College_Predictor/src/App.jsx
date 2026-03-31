import React, { useState } from 'react';
import Papa from 'papaparse';
import { Search, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

const STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand",
    "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal"
];

function App() {
    const [exam, setExam] = useState('MAIN'); // MAIN or ADV
    const [category, setCategory] = useState('OPEN');
    const [categoryRank, setCategoryRank] = useState('');
    const [crlRank, setCrlRank] = useState('');
    const [homeState, setHomeState] = useState('');
    const [gender, setGender] = useState('Gender-Neutral');

    const [activeTab, setActiveTab] = useState('JOSAA');
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const handlePredict = async () => {
        if (!categoryRank || !crlRank) {
            setError('Please fill in both Category Rank and CRL Rank.');
            return;
        }
        if (exam === 'MAIN' && !homeState) {
            setError('Please select your Home State for NITs/IIITs.');
            return;
        }

        setError('');
        setLoading(true);
        setSearched(true);
        setSearchQuery('');

        const queryRank = category === 'OPEN' ? parseInt(crlRank) : parseInt(categoryRank);

        try {
            const response = await fetch('/josaa24.csv');
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                complete: function (result) {
                    const rawData = result.data;

                    let filtered = rawData.filter(d => {
                        if (!d['Institute']) return false; // skip empty rows

                        // 1. Exam Filter
                        const isIIT = d['Institute'].includes('Indian Institute of Technology');
                        if (exam === 'ADV' && !isIIT) return false;
                        if (exam === 'MAIN' && isIIT) return false;

                        // 2. Category & Gender Filter
                        if (d['Seat Type'] !== category) return false;
                        if (d['Gender'] !== gender) return false;

                        // 3. Rank Filter (Closing >= queryRank AND Opening <= queryRank)
                        const openR = parseFloat(d['Opening Rank']);
                        const closeR = parseFloat(d['Closing Rank']);
                        if (isNaN(openR) || isNaN(closeR)) return false;

                        if (queryRank > closeR || queryRank < openR) return false;

                        return true;
                    });

                    // 4. Sort Ascending (Hardest to get at the top)
                    filtered.sort((a, b) => a['Closing Rank'] - b['Closing Rank']);

                    const processedData = filtered.map(d => ({
                        institute: d['Institute'],
                        branch: d['Academic Program Name'],
                        quota: d['Quota'],
                        closing_rank: d['Closing Rank']
                    }));

                    setResults(processedData);
                    setLoading(false);
                },
                error: function (err) {
                    setError(`File Parse Error: ${err.message}`);
                    setLoading(false);
                }
            });

        } catch (err) {
            console.error(err);
            setError("Error fetching CSV. Make sure josaa24.csv is inside the public/ folder.");
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            <header className="header">
                <h2 className="header-subtitle">Premium JEE Intelligence</h2>
                <h1 className="header-title">NextGen College Predictor</h1>
            </header>

            <section className="glass-panel" style={{ padding: '2rem' }}>
                <div className="tabs-container" style={{ justifyContent: 'center', marginBottom: '2rem', borderBottom: 'none' }}>
                    <button
                        className={`tab-btn \${exam === 'MAIN' ? 'active' : ''}`}
                        onClick={() => { setExam('MAIN'); setSearched(false); }}
                        style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
                    >
                        NIT & IIIT (JEE Main)
                    </button>
                    <button
                        className={`tab-btn \${exam === 'ADV' ? 'active' : ''}`}
                        onClick={() => { setExam('ADV'); setSearched(false); }}
                        style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
                    >
                        IIT (JEE Advanced)
                    </button>
                </div>

                <div className="controls-grid" style={{ padding: 0, marginBottom: '2rem' }}>
                    <div className="input-group">
                        <label className="label">Category</label>
                        <select className="select-field" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="OPEN">OPEN (General)</option>
                            <option value="EWS">GEN-EWS</option>
                            <option value="OBC-NCL">OBC-NCL</option>
                            <option value="SC">SC</option>
                            <option value="ST">ST</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label className="label">Category Rank (Exam: {exam})</label>
                        <input type="number" className="input-field" placeholder="e.g. 1500" value={categoryRank} onChange={e => setCategoryRank(e.target.value)} />
                    </div>

                    <div className="input-group">
                        <label className="label">CRL Rank (Exam: {exam})</label>
                        <input type="number" className="input-field" placeholder="e.g. 8000" value={crlRank} onChange={e => setCrlRank(e.target.value)} />
                    </div>

                    <div className="input-group">
                        <label className="label">Gender</label>
                        <select className="select-field" value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="Gender-Neutral">Male / Gender-Neutral</option>
                            <option value="Female-only (including Supernumerary)">Female</option>
                        </select>
                    </div>

                    {exam === 'MAIN' && (
                        <div className="input-group">
                            <label className="label">Home State (12th Board)</label>
                            <select className="select-field" value={homeState} onChange={e => setHomeState(e.target.value)}>
                                <option value="">Select State</option>
                                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500 }}>
                    <AlertCircle size={20} /> {error}
                </div>}

                <div className="text-center">
                    <button className="btn-primary" style={{ minWidth: '250px', fontSize: '1.2rem', padding: '14px 32px' }} onClick={handlePredict} disabled={loading}>
                        {loading ? 'Predicting...' : 'Find My College'}
                    </button>
                </div>
            </section>

            {searched && !loading && (
                <section className="glass-panel results-section">
                    <div className="tabs-container" style={{ marginBottom: '2rem' }}>
                        <button
                            className={`tab-btn \${activeTab === 'JOSAA' ? 'active' : ''}`}
                            onClick={() => setActiveTab('JOSAA')}
                        >JoSAA Counselling</button>
                        <button
                            className={`tab-btn \${activeTab === 'CSAB' ? 'active' : ''}`}
                            onClick={() => setActiveTab('CSAB')}
                        >CSAB Matrix</button>
                    </div>

                    <div className="search-bar" style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search by Institute or Branch..."
                            style={{ width: '100%', paddingLeft: '48px' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Institute Name</th>
                                    <th>Academic Program</th>
                                    <th>Quota</th>
                                    <th>Cutoff (Closing Rank)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results
                                    .filter(r => (r.institute + r.branch).toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((r, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <MapPin size={16} /> {r.institute}
                                            </td>
                                            <td>{r.branch}</td>
                                            <td>
                                                <span className={`badge \${r.quota === 'HS' ? 'badge-hs' : r.quota === 'OS' ? 'badge-os' : 'badge-ai'}`}>
                                                    {r.quota}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)' }}>
                                                {r.closing_rank}
                                            </td>
                                        </tr>
                                    ))}
                                {results.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center text-muted" style={{ padding: '4rem 0' }}>
                                            No colleges found in this rank range. Try adjusting your inputs.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {loading && (
                <div className="text-center text-muted" style={{ padding: '4rem 0' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>⚙️</div>
                    Processing historical data matrix...
                </div>
            )}
        </div>
    );
}

export default App;
