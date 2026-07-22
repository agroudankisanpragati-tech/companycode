import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, Volume2, VolumeX, Globe, ChevronDown, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const NAV_LINKS = [
  { label: 'होम', labelEn: 'Home', path: '/' },
  { label: 'योजनाएं', labelEn: 'Schemes', path: '/schemes' },
  { label: 'AI सहायक', labelEn: 'AI Assistant', path: '/assistant' },
  { label: 'आवेदन', labelEn: 'Apply', path: '/apply' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, setTheme, voiceEnabled, toggleVoice, language, setLanguage, user, logout } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(10, 15, 30, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : 'none',
        transition: 'all 0.3s ease',
        padding: '0 24px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #FF6B00, #006B3C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: 'white',
            boxShadow: '0 0 20px rgba(255,107,0,0.4)',
          }}>स</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B00', lineHeight: 1.2 }}>सेवा मित्र</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>RAJASTHAN GOV</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
          {NAV_LINKS.map(link => (
            <Link key={link.path} to={link.path} style={{
              padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
              color: location.pathname === link.path ? '#FF6B00' : 'rgba(255,255,255,0.8)',
              fontWeight: location.pathname === link.path ? 600 : 400,
              fontSize: 15, transition: 'all 0.2s',
              background: location.pathname === link.path ? 'rgba(255,107,0,0.1)' : 'transparent',
            }}>{link.label}</Link>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Language */}
          <button onClick={() => setLanguage(language === 'hi' ? 'mr' : language === 'mr' ? 'en' : 'hi')}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {language === 'hi' ? 'हिं' : language === 'mr' ? 'मा' : 'EN'}
          </button>

          {/* Voice */}
          <button onClick={toggleVoice} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8, color: voiceEnabled ? '#FF6B00' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex' }}>
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Theme */}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8, color: 'white', cursor: 'pointer', display: 'flex' }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Auth */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setProfileOpen(!profileOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,107,0,0.15)',
                border: '1px solid rgba(255,107,0,0.3)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: 'white',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B00, #FFB800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{user.name?.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    style={{ position: 'absolute', right: 0, top: '110%', background: '#1A2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, minWidth: 180, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                    <Link to="/profile" onClick={() => setProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, color: 'white', textDecoration: 'none', fontSize: 14 }}>
                      <User size={16} /> मेरी प्रोफाइल
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/dashboard" onClick={() => setProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, color: 'white', textDecoration: 'none', fontSize: 14 }}>
                        <LayoutDashboard size={16} /> डैशबोर्ड
                      </Link>
                    )}
                    <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, width: '100%' }}>
                      <LogOut size={16} /> लॉगआउट
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login" className="btn-ghost" style={{ padding: '8px 16px', fontSize: 14 }}>लॉगिन</Link>
              <Link to="/register" className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }}>पंजीकरण</Link>
            </div>
          )}

          {/* Mobile Menu */}
          <button onClick={() => setMobileOpen(!mobileOpen)} style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} className="mobile-menu-btn">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ background: 'rgba(10,15,30,0.98)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px' }}>
            {NAV_LINKS.map(link => (
              <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}
                style={{ display: 'block', padding: '12px 0', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </motion.nav>
  );
}
