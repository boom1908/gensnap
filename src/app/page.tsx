"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleAuth = async () => {
    setLoading(true);
    setMessage('');

    if (isSignIn) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else { setMessage('Successfully logged in! (Redirecting...)'); router.push('/dashboard'); }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage('Check your email for the confirmation link!');
    }
    setLoading(false);
  };

  // THE HARD-WIRED GOOGLE ENGINE
  const handleGoogleLogin = async () => {
    console.log("🚨 PROOF: Google button was successfully clicked!");
    setLoading(true);
    setMessage('Connecting to Google...');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    console.log("🚨 PROOF: Supabase responded:", { data, error });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="gs-root">
      <div className="gs-bg-orb gs-bg-orb-1"></div>
      <div className="gs-bg-orb gs-bg-orb-2"></div>

      <div className="gs-card">
        <div className="gs-logo-row">
          <div className="gs-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" fill="rgba(255,255,255,0.2)"/>
              <path d="M9 9h6M9 12h6M9 15h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="17" cy="7" r="3" fill="#90b8f8"/>
              <path d="M15.8 6.8l.8.8 1.6-1.6" stroke="#1a3a6e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="gs-title">GenSnap</p>
        </div>
        <p className="gs-subtitle">Secure Family Database</p>

        <div className="gs-tabs">
          <div className={`gs-tab ${isSignIn ? 'active' : ''}`} onClick={() => { setIsSignIn(true); setMessage(''); }}>Sign in</div>
          <div className={`gs-tab ${!isSignIn ? 'active' : ''}`} onClick={() => { setIsSignIn(false); setMessage(''); }}>Sign up</div>
        </div>

        <div className="gs-field">
          <label className="gs-label">Email</label>
          <input className="gs-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="gs-field">
          <label className="gs-label">Password</label>
          <div className="gs-input-wrap">
            <input className="gs-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" style={{ paddingRight: '38px' }} value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="gs-eye" onClick={() => setShowPassword(!showPassword)}>👁</span>
          </div>
        </div>

        {message && (
          <p style={{ color: message.includes('Success') || message.includes('Connecting') || message.includes('Check') ? '#4ade80' : '#f87171', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
            {message}
          </p>
        )}

        <button type="button" className="gs-btn-primary" onClick={handleAuth} disabled={loading}>
          {loading ? 'Processing...' : (isSignIn ? 'Sign in' : 'Create account')}
        </button>

        <div className="gs-divider">
          <div className="gs-divider-line"></div>
          <span className="gs-divider-text">or</span>
          <div className="gs-divider-line"></div>
        </div>

        {/* THE WIRED GOOGLE BUTTON */}
        <button type="button" className="gs-btn-google" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="gs-footer">
          {isSignIn ? (
            <>Don't have an account? <span onClick={() => { setIsSignIn(false); setMessage(''); }} style={{cursor: 'pointer'}}>Create one</span></>
          ) : (
            <>Already have an account? <span onClick={() => { setIsSignIn(true); setMessage(''); }} style={{cursor: 'pointer'}}>Sign in</span></>
          )}
        </p>
      </div>
    </div>
  );
}
