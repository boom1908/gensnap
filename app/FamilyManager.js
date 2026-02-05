"use client";
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReactFlow, { 
  useNodesState, 
  useEdgesState, 
  Controls, 
  Background, 
  MiniMap,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { User, X, Save, Plus, Trash2, Edit3, ArrowUp, ArrowDown, Link as LinkIcon, RefreshCcw, Loader2, Upload } from "lucide-react";

// --- GOOGLE LOGO COMPONENT ---
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.734 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
    </g>
  </svg>
);

// --- LAYOUT ENGINE ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 180;
const nodeHeight = 100;

const getLayoutedElements = (nodes, edges, savedPositions = {}) => {
  if (nodes.length === 0) return { nodes: [], edges: [] };
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 50 });
  nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }); });
  
  edges.forEach((edge) => { 
      // CRITICAL: We DO NOT tell the layout engine about "Couple" edges.
      // If we did, it would try to put one spouse below the other.
      // By skipping them here, spouses stay on the same level!
      if (edge.data && edge.data.isCouple) return;

      dagreGraph.setEdge(edge.source, edge.target); 
  });
  
  dagre.layout(dagreGraph);
  const layoutedNodes = nodes.map((node) => {
    if (savedPositions[node.id]) return { ...node, position: savedPositions[node.id] };
    const nodeWithPosition = dagreGraph.node(node.id);
    const x = nodeWithPosition ? nodeWithPosition.x - nodeWidth / 2 : 0;
    const y = nodeWithPosition ? nodeWithPosition.y - nodeHeight / 2 : 0;
    return { ...node, position: { x, y } };
  });
  return { nodes: layoutedNodes, edges };
};

function FamilyManagerInner() {
  const { setViewport, getViewport, fitView } = useReactFlow();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Ready");
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [modalMode, setModalMode] = useState("none");
  const [targetNode, setTargetNode] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [formData, setFormData] = useState({ 
    id: null, name: "", gender: "Male", dob: "", is_alive: true, photo_url: "", relation: "", 
    parent_id: null, secondary_parent_id: null 
  });
  const [placement, setPlacement] = useState("child");
  const [membersList, setMembersList] = useState([]); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) { restoreView(); fetchAndDrawGraph(); } else { setLoading(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAndDrawGraph();
    });
    return () => subscription.unsubscribe();
  }, []);

  const saveNodePosition = useCallback((event, node) => {
      const saved = JSON.parse(localStorage.getItem("gensnap-positions") || "{}");
      saved[node.id] = node.position;
      localStorage.setItem("gensnap-positions", JSON.stringify(saved));
  }, []);

  const saveView = useCallback(() => {
      const view = getViewport();
      localStorage.setItem("gensnap-view", JSON.stringify(view));
  }, [getViewport]);

  const restoreView = () => {
      const savedView = JSON.parse(localStorage.getItem("gensnap-view"));
      if (savedView) setViewport(savedView);
  };

  const resetLayout = () => {
      if(confirm("Reset all node positions to default?")) {
          localStorage.removeItem("gensnap-positions");
          fetchAndDrawGraph();
      }
  };

  async function fetchAndDrawGraph() {
    setStatusMsg("Syncing...");
    const { data: members, error } = await supabase.from("family_members").select("*").order("dob");
    if (error) { 
        console.error("Fetch error:", error);
        setStatusMsg("Error: " + error.message);
        setLoading(false); 
        return; 
    }
    setMembersList(members || []);
    setStatusMsg(`Found ${members ? members.length : 0} people.`);

    if (!members || members.length === 0) {
        setModalMode("me");
        setFormData({ id: null, name: "", gender: "Male", dob: "", is_alive: true, photo_url: "", relation: "Me", parent_id: null, secondary_parent_id: null });
        setLoading(false);
        setNodes([]); 
        setEdges([]);
        return;
    }

    const newNodes = members.map((m) => ({
      id: m.id,
      data: { ...m, label: m.name }, 
      position: { x: 0, y: 0 }, 
      style: { 
        background: "#1f2937", color: "white", 
        border: m.gender === "Male" ? "1px solid #3b82f6" : "1px solid #ec4899",
        borderRadius: "8px", padding: "10px", width: 180, fontSize: "12px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)"
      },
      label: (
        <div className="flex flex-col items-center gap-2 pointer-events-none">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-500 bg-gray-800">
                {m.photo_url ? <img src={m.photo_url} className="w-full h-full object-cover" /> : <User className="p-2 w-full h-full text-gray-400"/>}
            </div>
            <div className="text-center">
                <div className="font-bold text-sm truncate w-36">{m.name}</div>
                <div className="text-[10px] text-gray-400">{m.relation}</div>
                <div className="text-[9px] text-gray-500">{getPreciseAge(m.dob, m.is_alive)}</div>
            </div>
        </div>
      )
    }));

    const newEdges = [];
    const couplePairs = new Set(); // To ensure we only draw the line once per couple

    members.forEach((m) => {
      // 1. Regular Parent-Child Edges
      if (m.parent_id) {
        newEdges.push({ id: `e-${m.parent_id}-${m.id}`, source: m.parent_id, target: m.id, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#4b5563" }, style: { stroke: "#4b5563", strokeWidth: 2 } });
      }
      if (m.secondary_parent_id) {
        newEdges.push({ id: `e-${m.secondary_parent_id}-${m.id}`, source: m.secondary_parent_id, target: m.id, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#4b5563" }, style: { stroke: "#4b5563", strokeWidth: 2 } });
      }

      // 2. COUPLE DETECTION (Draw dashed line between parents)
      if (m.parent_id && m.secondary_parent_id) {
          const p1 = m.parent_id;
          const p2 = m.secondary_parent_id;
          // Sort IDs so "Dad-Mom" is the same as "Mom-Dad"
          const pairKey = [p1, p2].sort().join("-");

          if (!couplePairs.has(pairKey)) {
              couplePairs.add(pairKey);
              newEdges.push({
                  id: `couple-${pairKey}`,
                  source: p1,
                  target: p2,
                  type: "straight", // Straight line for couples
                  animated: false,
                  style: { stroke: "#ec4899", strokeWidth: 2, strokeDasharray: "5,5" }, // PINK DASHED LINE
                  data: { isCouple: true }, // Tag for Layout Engine
                  selectable: false
              });
          }
      }
    });

    const savedPositions = JSON.parse(localStorage.getItem("gensnap-positions") || "{}");
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, savedPositions);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setLoading(false);
  }

  const onNodeClick = useCallback((event, node) => {
    setTargetNode(node); 
    setFormData(node.data); 
    setModalMode("menu");
  }, []);

  function getPreciseAge(dob, isAlive) {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (months < 0) { years--; months += 12; }
    return isAlive ? `${years}y` : `Died: ${years}y`;
  }

  // --- NEW: UPLOAD LOGIC ---
  async function handleImageUpload(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${session.user.id}/${fileName}`; 

    try {
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        setFormData({ ...formData, photo_url: data.publicUrl });
    } catch (err) {
        alert("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg("Saving...");

    const cleanDob = formData.dob === "" ? null : formData.dob;
    const payload = { 
      name: formData.name, gender: formData.gender, dob: cleanDob, 
      is_alive: formData.is_alive, relation: formData.relation, 
      photo_url: formData.photo_url, 
      secondary_parent_id: formData.secondary_parent_id || null, 
      user_id: session.user.id 
    };

    try {
        let error = null;
        if (modalMode === "me") {
            const res = await supabase.from("family_members").insert([payload]).select();
            error = res.error;
        } 
        else if (modalMode === "edit") {
            const res = await supabase.from("family_members").update(payload).eq("id", formData.id).select();
            error = res.error;
        } 
        else if (modalMode === "add") {
            if (placement === "child") {
                const res = await supabase.from("family_members").insert([{ ...payload, parent_id: targetNode.id }]).select();
                error = res.error;
            } else if (placement === "parent") {
                const parentRes = await supabase.from("family_members").insert([payload]).select().single();
                if (parentRes.error) throw parentRes.error;
                if (parentRes.data) {
                    const updateRes = await supabase.from("family_members").update({ parent_id: parentRes.data.id }).eq("id", targetNode.id);
                    error = updateRes.error;
                }
            }
        }

        if (error) {
            console.error(error);
            alert("Database Error: " + error.message);
            setStatusMsg("Error: " + error.message);
        } else {
            setStatusMsg("Saved!");
            setModalMode("none");
            setTimeout(() => { fetchAndDrawGraph().then(() => { if (modalMode === "me") { setTimeout(() => fitView(), 200); } }); }, 500);
        }
    } catch (err) {
        alert("Unexpected Error: " + err.message);
        setStatusMsg("Critical Error: " + err.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if(!confirm("⚠️ Delete this person?")) return;
    setSaving(true);
    await supabase.from("family_members").delete().eq("id", formData.id);
    setSaving(false);
    setModalMode("none"); 
    fetchAndDrawGraph();
  }
  
  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
    setLoading(false);
  }

  async function handleResetTree() {
    if (!confirm("⚠️ DANGER: This will delete YOUR ENTIRE FAMILY TREE.\n\nThis cannot be undone. Are you sure?")) return;
    setSaving(true);
    setStatusMsg("Deleting...");
    const { error } = await supabase.from("family_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { alert("Reset failed: " + error.message); setStatusMsg("Error"); } 
    else { window.location.reload(); }
    setSaving(false);
  }

  if (!session) return ( 
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4">
        <div className="bg-[#1e293b] p-8 rounded-2xl border border-gray-700 w-full max-w-sm shadow-2xl">
            <h1 className="text-3xl font-bold mb-2 text-center text-blue-400">GenSnap</h1>
            <p className="text-center text-gray-400 text-xs mb-8">Secure Family Database</p>
            <form onSubmit={handleAuth} className="space-y-4">
                <div><label className="text-xs text-gray-500 font-bold ml-1">EMAIL</label><input className="w-full p-3 bg-[#0f172a] rounded border border-gray-600 focus:border-blue-500 text-white outline-none" type="text" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500 font-bold ml-1">PASSWORD</label><input className="w-full p-3 bg-[#0f172a] rounded border border-gray-600 focus:border-blue-500 text-white outline-none" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                <button className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded font-bold transition shadow-lg shadow-blue-900/50">{loading ? "Processing..." : (authMode === "login" ? "Sign In" : "Create Account")}</button>
            </form>
            <div className="my-4 flex items-center gap-2"><div className="h-[1px] bg-gray-700 flex-1"></div><span className="text-xs text-gray-500">OR</span><div className="h-[1px] bg-gray-700 flex-1"></div></div>
            <button type="button" onClick={handleGoogleLogin} className="w-full bg-white text-gray-700 p-2 rounded-full font-medium hover:bg-gray-100 transition flex items-center justify-center gap-3 border border-gray-300">
                <GoogleIcon /> <span className="text-sm font-roboto">Sign in with Google</span>
            </button>
            <button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="w-full mt-6 text-xs text-gray-500 hover:text-white transition">Switch to {authMode === "login" ? "Sign Up" : "Login"}</button>
        </div>
    </div> 
  );

  return (
    <div className="w-screen h-screen bg-[#111827] flex flex-col">
      <div className="absolute top-4 left-4 z-10 flex gap-4">
        <div className="bg-black/40 backdrop-blur px-4 py-2 rounded-full border border-gray-700 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusMsg.includes("Error") ? "bg-red-500" : "bg-green-500"} animate-pulse`}></div>
            <span className="font-bold text-gray-200 tracking-wide">GenSnap Graph</span>
        </div>
        <button onClick={resetLayout} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full border border-gray-600 transition" title="Reset Layout"><RefreshCcw size={14} /></button>
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={handleResetTree} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-full border border-red-500/50 transition text-sm font-bold">Reset Tree</button>
          <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full border border-gray-600 transition text-sm">Logout</button>
      </div>
      <div className="flex-1 w-full h-full">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onNodeDragStop={saveNodePosition} onMoveEnd={saveView} fitView className="bg-[#111827]">
          <Controls className="bg-gray-800 border-gray-700 fill-white" />
          <Background color="#374151" gap={20} />
          <MiniMap nodeColor={() => "#1f2937"} style={{background: "#111827"}} />
        </ReactFlow>
      </div>
      <div className="bg-blue-900/80 text-white text-xs p-1 text-center font-mono">STATUS: {statusMsg}</div>

      {modalMode !== "none" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="bg-[#0f172a] p-4 border-b border-gray-700 flex justify-between items-center"><h2 className="font-bold text-lg text-white">{modalMode === "me" ? "Start Tree" : modalMode === "menu" ? targetNode?.data?.name : modalMode === "add" ? "Add Relative" : "Edit Profile"}</h2>{modalMode !== "me" && <button onClick={() => setModalMode("none")}><X className="text-gray-400 hover:text-white" /></button>}</div>
            {modalMode === "menu" && (
                <div className="p-8 grid grid-cols-2 gap-4">
                    <button onClick={() => { setFormData({ name: "", gender: "Male", dob: "", is_alive: true, relation: "", photo_url: "" }); setPlacement("child"); setModalMode("add"); }} className="bg-blue-600 hover:bg-blue-500 h-32 rounded-xl flex flex-col items-center justify-center gap-2 text-white transition hover:scale-105 border border-blue-400"><Plus size={32} /><span className="font-bold">Add Relative</span></button>
                    <button onClick={() => setModalMode("edit")} className="bg-gray-700 hover:bg-gray-600 h-32 rounded-xl flex flex-col items-center justify-center gap-2 text-white transition hover:scale-105 border border-gray-500"><Edit3 size={32} /><span className="font-bold">Edit Person</span></button>
                </div>
            )}
            {(modalMode === "edit" || modalMode === "add" || modalMode === "me") && (
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalMode === "add" && (
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-600 mb-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPlacement("parent")} className={`p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${placement === "parent" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"}`}><ArrowUp size={14}/> Parent (Above)</button>
                    <button type="button" onClick={() => setPlacement("child")} className={`p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${placement === "child" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"}`}><ArrowDown size={14}/> Child (Below)</button>
                  </div>
              )}
              {modalMode === "edit" && membersList.length > 1 && (
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                    <label className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1 block flex items-center gap-2"><LinkIcon size={12}/> Link Second Parent (Normal Line)</label>
                    <select className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-white text-sm outline-none" value={formData.secondary_parent_id || ""} onChange={e => setFormData({...formData, secondary_parent_id: e.target.value === "" ? null : e.target.value})}>
                        <option value="">-- None --</option>
                        {membersList.filter(m => m.id !== formData.id).map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                    </select>
                </div>
              )}
              
              {/* --- NEW FILE UPLOAD SECTION --- */}
              <div className="flex items-center gap-4 bg-[#0f172a] p-3 rounded-lg border border-gray-700">
                  <div className="w-12 h-12 bg-gray-700 rounded-full overflow-hidden flex items-center justify-center border border-gray-500 relative group">
                      {formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" /> : <User className="text-gray-400" />}
                      {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={16}/></div>}
                  </div>
                  <div className="flex-1">
                      <label className="cursor-pointer flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-2 rounded border border-gray-600 transition w-fit">
                          <Upload size={14}/> {uploading ? "Uploading..." : "Upload Photo"}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading}/>
                      </label>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-gray-500 font-bold">NAME</label><input className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-white" value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} required /></div><div><label className="text-[10px] text-gray-500 font-bold">RELATION</label><input className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-white" value={formData.relation || ""} onChange={e => setFormData({...formData, relation: e.target.value})} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-gray-500 font-bold">GENDER</label><select className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-white" value={formData.gender || "Male"} onChange={e => setFormData({...formData, gender: e.target.value})}><option>Male</option><option>Female</option></select></div><div><label className="text-[10px] text-gray-500 font-bold">DOB</label><input type="date" className="w-full p-2 bg-[#0f172a] border border-gray-700 rounded text-white" value={formData.dob || ""} onChange={e => setFormData({...formData, dob: e.target.value})} /></div></div>
              <button disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {saving ? "Saving..." : "Save Changes"}</button>
              {modalMode === "edit" && <button type="button" onClick={handleDelete} className="w-full text-red-400 text-sm"><Trash2 size={14} className="inline mr-1"/> Delete</button>}
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FamilyManager() {
  return (
    <ReactFlowProvider>
      <FamilyManagerInner />
    </ReactFlowProvider>
  );
}