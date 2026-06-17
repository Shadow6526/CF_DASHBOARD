import { Link, useLocation } from "react-router-dom";
import { FiHome, FiUser, FiTrendingUp } from "react-icons/fi";
import { SiCodeforces } from "react-icons/si";
import "./TopBar.css";

const NAV_ITEMS = [
    { path: "/", label: "Dashboard", icon: <FiHome /> },
    { path: "/profile", label: "Profile", icon: <FiUser /> },
    { path: "/contests", label: "Contests", icon: <FiTrendingUp /> },
];

export default function TopBar() {
    const location = useLocation();

    return (
        <header className="topbar" id="topbar">
            {/* Logo */}
            <div className="topbar-logo-container">
                <Link to="/" className="topbar-logo">
                    <div className="topbar-logo-icon">
                        <SiCodeforces />
                    </div>
                    <span className="topbar-logo-text">
                        CF<span className="logo-accent">Dashboard</span>
                    </span>
                </Link>
            </div>

            {/* Nav */}
            <nav className="topbar-nav">
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`topbar-link ${location.pathname === item.path ? "active" : ""}`}
                    >
                        <span className="topbar-link-icon">{item.icon}</span>
                        <span className="topbar-link-text">{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="topbar-right">
                <Link to="/compare" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                    Compare Users
                </Link>
            </div>
        </header>
    );
}
