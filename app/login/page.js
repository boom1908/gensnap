"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Sign Up
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      if (isSignUp) {
        // --- SIGN UP LOGIC ---
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        if (error) throw error;
        setMsg("Success! Check your email to confirm your account.");
      } else {
        // --- SIGN IN LOGIC ---
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) throw error;
        router.push("/"); // Redirect to Home/Tree
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#111", color: "white" }}>
      <div style={{ width: "350px", padding: "2rem", border: "1px solid #333", borderRadius: "10px", background: "#000" }}>
        <h2 style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", background: "#222", color: "white" }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "10px", borderRadius: "5px", border: "1px solid #444", background: "#222", color: "white" }}
          />
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: "10px", background: "white", color: "black", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}
          >
            {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
          </button>
        </form>

        {msg && <p style={{ marginTop: "1rem", color: msg.includes("Success") ? "green" : "red", textAlign: "center" }}>{msg}</p>}

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem", color: "#888" }}>
          {isSignUp ? "Already have an account?" : "No account yet?"}
          <button 
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ background: "none", border: "none", color: "#4a90e2", cursor: "pointer", marginLeft: "5px", textDecoration: "underline" }}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}