import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiHome, FiUser, FiTrendingUp, FiMenu, FiX } from "react-icons/fi";
import { SiCodeforces } from "react-icons/si";
import "./Navbar.css";

const NAV_ITEMS = [
    { path: "/", label: "Dashboard", icon: <FiHome /> },
    { path: "/profile", label: "Profile", icon: <FiUser /> },
    { path: "/contests", label: "Contests", icon: <FiTrendingUp /> },
];

export default function Navbar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav className="navbar" id="main-navbar">
            <div className="navbar-inner">
                {/* Logo */}
                <Link to="/" className="navbar-logo" id="navbar-logo">
                    <div className="logo-icon">
                        <SiCodeforces />
                    </div>
                    <span className="logo-text">
                        CF<span className="logo-accent">Dashboard</span>
                    </span>
                </Link>

                {/* Desktop nav */}
                <ul className="nav-links">
                    {NAV_ITEMS.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
                                id={`nav-${item.label.toLowerCase()}`}
                            >
                                <span className="nav-link-icon">{item.icon}</span>
                                <span className="nav-link-text">{item.label}</span>
                                {location.pathname === item.path && <span className="nav-link-indicator" />}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Mobile toggle */}
                <button
                    className="nav-toggle"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    id="nav-toggle"
                    aria-label="Toggle navigation"
                >
                    {mobileOpen ? <FiX /> : <FiMenu />}
                </button>
            </div>

            {/* Mobile menu */}
            <div className={`mobile-menu ${mobileOpen ? "open" : ""}`}>
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`mobile-link ${location.pathname === item.path ? "active" : ""}`}
                        onClick={() => setMobileOpen(false)}
                    >
                        <span className="nav-link-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}
