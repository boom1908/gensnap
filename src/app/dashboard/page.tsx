"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, Network, ChevronRight, Link as LinkIcon, UserPlus, Trash2, RefreshCw, Edit3, Eye, Camera, Check, HelpCircle, X } from 'lucide-react';
import TreeCanvas from '@/components/TreeCanvas';
import Cropper from 'react-easy-crop';

export default function Dashboard() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  
  // INSTRUCTIONS MODAL STATE
  const [showInstructions, setShowInstructions] = useState(false);

  const [rootName, setRootName] = useState('');
  const [rootGender, setRootGender] = useState('Male');

  const [relName, setRelName] = useState(''); const [relGender, setRelGender] = useState('Male'); const [relType, setRelType] = useState('Child');
  const [editName, setEditName] = useState(''); const [editDob, setEditDob] = useState(''); const [editIsAlive, setEditIsAlive] = useState(true); const [editRelation, setEditRelation] = useState('');
  const [selectedSpouseId, setSelectedSpouseId] = useState(''); const [selectedSecParentId, setSelectedSecParentId] = useState('');

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('family_members').select('*');
    if (!error && data) setMembers(data);
    setLoading(false);
  };

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setUserId(session.user.id);
      fetchMembers();
    };
    checkUserAndFetchData();
  }, [router]);

  // AUTO-TRIGGER INSTRUCTIONS ONCE PER DEVICE
  useEffect(() => {
    const hasSeen = localStorage.getItem('gs_has_seen_instructions');
    if (!hasSeen) {
      setShowInstructions(true);
      localStorage.setItem('gs_has_seen_instructions', 'true');
    }
  }, []);

  const handleNodeClick = (node: any) => { 
    setSelectedNode(node); setRelName(''); setRelType('Child'); setRelGender('Male'); 
    setEditName(node.name || ''); setEditDob(node.dob || ''); setEditIsAlive(node.is_alive !== false); setEditRelation(node.relation || '');
  };

  const handleNodeMove = async (id: string, x: number, y: number) => { await supabase.from('family_members').update({ pos_x: x, pos_y: y }).eq('id', id); };
  const handleResetLayout = async () => {
    if (!userId || !window.confirm("Warning: Erase custom dragging?")) return;
    setLoading(true); await supabase.from('family_members').update({ pos_x: null, pos_y: null }).eq('user_id', userId); fetchMembers();
  };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image(); image.src = imageSrc;
    await new Promise(resolve => image.onload = resolve);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) return new Blob();
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 256, 256);
    return new Promise(resolve => canvas.toBlob((file) => resolve(file as Blob), 'image/jpeg', 0.8));
  };

  const handleUploadAvatar = async () => {
    if (!imageSrc || !croppedAreaPixels || !selectedNode || !userId) return;
    setUploadingImage(true);
    try {
      const compressedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const fileName = `${userId}_${selectedNode.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('family_members').update({ photo_url: publicUrl }).eq('id', selectedNode.id);
      setSelectedNode({ ...selectedNode, photo_url: publicUrl }); setImageSrc(null); fetchMembers();
    } catch (error: any) { alert("Upload failed: " + error.message); }
    setUploadingImage(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedNode || !editName) return; setPanelLoading(true);
    const { error } = await supabase.from('family_members').update({ name: editName, dob: editDob || null, is_alive: editIsAlive, relation: editRelation }).eq('id', selectedNode.id);
    if (!error) { setSelectedNode({ ...selectedNode, name: editName, dob: editDob, is_alive: editIsAlive, relation: editRelation }); fetchMembers(); } 
    else alert("Error updating: " + error.message);
    setPanelLoading(false);
  };

  const currentSpouse = selectedNode ? members.find(m => m.id === selectedNode.spouse_id || m.spouse_id === selectedNode.id) : null;
  const currentParent1 = selectedNode ? members.find(m => m.id === selectedNode.parent_id) : null;
  const currentParent2 = selectedNode ? members.find(m => m.id === selectedNode.secondary_parent_id) : null;

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault(); if (!rootName || !userId) return; setLoading(true);
    const newMember = { user_id: userId, name: rootName, gender: rootGender, relation: 'Me', is_alive: true, parent_id: null, secondary_parent_id: null, spouse_id: null };
    const { error } = await supabase.from('family_members').insert([newMember]);
    if (!error) { setRootName(''); fetchMembers(); } else { alert("Error: " + error.message); setLoading(false); }
  };

  const handleAddRelative = async (e: React.FormEvent) => {
    e.preventDefault(); if (!relName || !userId || !selectedNode) return; setPanelLoading(true);
    let newParentId = null; let newSecParentId = null; let newSpouseId = null;
    if (relType === 'Child') { newParentId = selectedNode.id; newSecParentId = currentSpouse ? currentSpouse.id : null; } 
    else if (relType === 'Sibling') { newParentId = selectedNode.parent_id; newSecParentId = selectedNode.secondary_parent_id; } 
    else if (relType === 'Spouse') { newSpouseId = selectedNode.id; }
    const newMember = { user_id: userId, name: relName, gender: relGender, relation: relType, is_alive: true, parent_id: newParentId, secondary_parent_id: newSecParentId, spouse_id: newSpouseId };
    const { data: insertedData, error: insertError } = await supabase.from('family_members').insert([newMember]).select().single();
    if (!insertError && insertedData) {
      if (relType === 'Parent') {
        if (selectedNode.parent_id) await supabase.from('family_members').update({ secondary_parent_id: insertedData.id }).eq('id', selectedNode.id);
        else await supabase.from('family_members').update({ parent_id: insertedData.id }).eq('id', selectedNode.id);
      } else if (relType === 'Spouse') await supabase.from('family_members').update({ spouse_id: insertedData.id }).eq('id', selectedNode.id);
      setRelName(''); setRelType('Child'); setSelectedNode(null); fetchMembers();
    }
    setPanelLoading(false);
  };

  const handleLinkSpouse = async () => {
    if (!selectedSpouseId || !selectedNode) return; setPanelLoading(true);
    await supabase.from('family_members').update({ spouse_id: selectedSpouseId }).eq('id', selectedNode.id);
    await supabase.from('family_members').update({ spouse_id: selectedNode.id }).eq('id', selectedSpouseId);
    setSelectedNode(null); setSelectedSpouseId(''); fetchMembers(); setPanelLoading(false);
  };

  const handleLinkSecParent = async () => {
    if (!selectedSecParentId || !selectedNode) return; setPanelLoading(true);
    await supabase.from('family_members').update({ secondary_parent_id: selectedSecParentId }).eq('id', selectedNode.id);
    setSelectedNode(null); setSelectedSecParentId(''); fetchMembers(); setPanelLoading(false);
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return; if (!window.confirm(`Permanently delete ${selectedNode.name}?`)) return; setPanelLoading(true);
    await supabase.from('family_members').update({ spouse_id: null }).eq('spouse_id', selectedNode.id);
    await supabase.from('family_members').update({ parent_id: null }).eq('parent_id', selectedNode.id);
    await supabase.from('family_members').update({ secondary_parent_id: null }).eq('secondary_parent_id', selectedNode.id);
    await supabase.from('family_members').delete().eq('id', selectedNode.id);
    setSelectedNode(null); fetchMembers(); setPanelLoading(false);
  };

  const availableToLink = members.filter(m => m.id !== selectedNode?.id);

  return (
    <div style={{ height: '100vh', backgroundColor: '#0d1520', color: '#f0eeff', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* INSTRUCTIONS MODAL OVERLAY */}
      {showInstructions && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'linear-gradient(180deg, #121c2b 0%, #0d1520 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2.5rem', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            <button onClick={() => setShowInstructions(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={24} /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #3d7fd4 0%, #6252cc 100%)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HelpCircle size={22} color="white" /></div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Welcome to GenSnap</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'rgba(200,210,255,0.8)', fontSize: '14px', lineHeight: '1.6' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>1.</span> View Mode vs. Edit Mode</h3>
                <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}><strong style={{color: '#90b8f8'}}>👁️ View Mode (Safe Mode):</strong> Use this to safely explore your tree. You can pan around the canvas and click on any person to view their beautiful, read-only profile card.</li>
                  <li><strong style={{color: '#90b8f8'}}>✏️ Edit Mode:</strong> Toggle this on to unlock "God Mode." This allows you to drag cards, edit profiles, and add new relatives.</li>
                </ul>
              </div>

              <div>
                <h3 style={{ color: 'white', fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>2.</span> Building Your Tree</h3>
                <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}><strong>Adding People:</strong> In Edit Mode, click on any person to open the side panel. Scroll down to "Create New Relative" to instantly attach a Parent, Child, Sibling, or Spouse.</li>
                  <li style={{ marginBottom: '6px' }}><strong>Linking Existing Relatives:</strong> Have a child that needs to be linked to their second parent? Or two existing people who are married? Use the <strong style={{color: '#3d7fd4'}}>Link Parent</strong> or <strong style={{color: '#fbbf24'}}>Link Couple</strong> dropdowns in the side panel to connect them.</li>
                  <li style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', listStyleType: 'none', marginLeft: '-1.5rem' }}><em>*Note: Bloodlines are solid, and Marriages are marked with a dashed yellow line.</em></li>
                </ul>
              </div>

              <div>
                <h3 style={{ color: 'white', fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>3.</span> Organizing the Canvas</h3>
                <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}>In Edit Mode, you can click and drag any card to anywhere on the screen. The lines will stretch like rubber bands! Your custom layout is automatically saved to the cloud.</li>
                  <li><strong>Reset Layout:</strong> If your tree gets too messy, click the "Reset Layout" button at the top to let the math engine organize everyone into a grid again.</li>
                </ul>
              </div>

              <div>
                <h3 style={{ color: 'white', fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>4.</span> Personalizing Profiles</h3>
                <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}><strong>Avatars:</strong> In Edit Mode, click on a person and select "Upload & Crop Image" to add a profile picture. Our engine automatically crops and compresses the photo.</li>
                  <li><strong>Smart Details:</strong> Add their Date of Birth, and GenSnap will automatically calculate their exact age on their card. You can also mark their living status and their specific relation to you.</li>
                </ul>
              </div>
            </div>

            <button onClick={() => setShowInstructions(false)} style={{ marginTop: '2rem', width: '100%', background: 'linear-gradient(135deg, #3d7fd4 0%, #6252cc 100%)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(61, 127, 212, 0.4)' }}>
              Got it! Let's build.
            </button>
          </div>
        </div>
      )}

      {/* CROP MODAL */}
      {imageSrc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}><Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} /></div>
          <div style={{ padding: '20px', background: '#121c2b', display: 'flex', justifyContent: 'center', gap: '20px' }}>
             <button onClick={() => setImageSrc(null)} style={{ padding: '10px 20px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
             <button onClick={handleUploadAvatar} disabled={uploadingImage} style={{ padding: '10px 20px', background: '#4ade80', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} /> {uploadingImage ? 'Uploading...' : 'Save Avatar'}</button>
          </div>
        </div>
      )}

      <nav style={{ zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: 'rgba(13, 21, 32, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3d7fd4 0%, #6252cc 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Network size={18} color="white" /></div><h1 style={{ fontSize: '1.2rem', fontWeight: 600 }}>GenSnap Workspace</h1></div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          {/* THE NEW INSTRUCTIONS BUTTON */}
          <button onClick={() => setShowInstructions(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <HelpCircle size={16} /><span style={{ fontSize: '13px', fontWeight: 500 }}>Instructions</span>
          </button>

          <button onClick={() => { setIsEditMode(!isEditMode); setSelectedNode(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isEditMode ? 'rgba(61, 127, 212, 0.2)' : 'transparent', border: `1px solid ${isEditMode ? '#3d7fd4' : 'rgba(255,255,255,0.2)'}`, color: isEditMode ? '#90b8f8' : 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>{isEditMode ? <Edit3 size={16} /> : <Eye size={16} />}<span style={{ fontSize: '13px', fontWeight: 500 }}>{isEditMode ? 'Edit Mode' : 'View Mode'}</span></button>
          {isEditMode && <button onClick={handleResetLayout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}><RefreshCw size={16} /><span style={{ fontSize: '13px', fontWeight: 500 }}>Reset Layout</span></button>}
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(200, 210, 255, 0.7)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}><LogOut size={16} /><span style={{ fontSize: '13px' }}>Sign Out</span></button>
        </div>
      </nav>

      <main style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? ( 
          <p style={{ color: 'rgba(200, 210, 255, 0.5)' }}>Loading your lineage...</p> 
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', padding: '3rem', borderRadius: '16px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: 'white' }}>Your Tree is Empty</h2>
            <p style={{ color: 'rgba(200, 210, 255, 0.5)', fontSize: '13px', marginBottom: '2rem' }}>Start your lineage by adding yourself as the root person.</p>
            <form onSubmit={handleAddRoot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <input required type="text" value={rootName} onChange={(e) => setRootName(e.target.value)} placeholder="Your Full Name" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
               <select value={rootGender} onChange={(e) => setRootGender(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}>
                 <option value="Male" style={{background: '#121c2b'}}>Male</option>
                 <option value="Female" style={{background: '#121c2b'}}>Female</option>
               </select>
               <button type="submit" style={{ background: '#3d7fd4', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginTop: '10px' }}>Start My Tree</button>
            </form>
          </div>
        ) : (
          <TreeCanvas data={members} onNodeClick={handleNodeClick} onNodeMove={handleNodeMove} isEditMode={isEditMode} />
        )}

        {/* SIDE PANEL */}
        {members.length > 0 && selectedNode && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '420px', background: 'rgba(18, 28, 43, 0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '2rem', transform: selectedNode ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', zIndex: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white' }}>{isEditMode ? 'Settings' : 'Profile'}</h2>
                <button onClick={() => setSelectedNode(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '6px', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight size={20} /></button>
            </div>

            {!isEditMode ? (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: selectedNode.gender === 'Female' ? 'rgba(244, 114, 182, 0.1)' : 'rgba(61, 127, 212, 0.1)', margin: '0 auto 1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${selectedNode.gender === 'Female' ? '#f472b6' : '#3d7fd4'}`, overflow: 'hidden' }}>
                       {selectedNode.photo_url ? <img src={selectedNode.photo_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2rem', color: 'white' }}>{selectedNode.name.charAt(0)}</span>}
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', marginBottom: '5px' }}>{selectedNode.name}</h2>
                    <p style={{ color: 'rgba(200,210,255,0.6)', fontSize: '13px', marginBottom: '1.5rem' }}>{selectedNode.relation} • {selectedNode.is_alive !== false ? 'Living' : 'Deceased'}</p>
                    <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(200,210,255,0.5)', fontSize: '12px' }}>Gender</span><span style={{ color: 'white', fontSize: '13px' }}>{selectedNode.gender}</span></div>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(200,210,255,0.5)', fontSize: '12px' }}>Date of Birth</span><span style={{ color: 'white', fontSize: '13px' }}>{selectedNode.dob ? new Date(selectedNode.dob).toLocaleDateString() : 'Unknown'}</span></div>
                       {currentSpouse && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}><span style={{ color: 'rgba(251, 191, 36, 0.8)', fontSize: '12px' }}>Spouse</span><span style={{ color: '#fbbf24', fontSize: '13px' }}>{currentSpouse.name}</span></div>}
                    </div>
                  </div>
                </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${selectedNode.gender === 'Female' ? '#f472b6' : '#3d7fd4'}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     {selectedNode.photo_url ? <img src={selectedNode.photo_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'rgba(255,255,255,0.5)' }}>{selectedNode.name.charAt(0)}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                     <p style={{ fontSize: '12px', color: 'rgba(200,210,255,0.8)', marginBottom: '5px' }}>Profile Picture</p>
                     <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                     <button onClick={() => fileInputRef.current?.click()} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Camera size={14} /> Upload & Crop Image</button>
                  </div>
                </div>

                <div style={{ background: 'rgba(61, 127, 212, 0.05)', border: '1px solid rgba(61, 127, 212, 0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '11px', color: '#90b8f8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><Edit3 size={12}/> Edit Details</p>
                  <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div><label style={{ fontSize: '11px', color: 'rgba(200,210,255,0.6)' }}>Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', marginTop: '4px' }} /></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}><label style={{ fontSize: '11px', color: 'rgba(200,210,255,0.6)' }}>Date of Birth</label><input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', marginTop: '4px', colorScheme: 'dark' }} /></div>
                      <div style={{ flex: 1 }}><label style={{ fontSize: '11px', color: 'rgba(200,210,255,0.6)' }}>Relation</label><input type="text" value={editRelation} onChange={(e) => setEditRelation(e.target.value)} placeholder="e.g. Aunt" style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', marginTop: '4px' }} /></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><input type="checkbox" id="aliveCheck" checked={editIsAlive} onChange={(e) => setEditIsAlive(e.target.checked)} style={{ cursor: 'pointer' }} /><label htmlFor="aliveCheck" style={{ fontSize: '13px', cursor: 'pointer' }}>Living</label></div>
                    <button type="submit" disabled={panelLoading} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>{panelLoading ? 'Saving...' : 'Save Profile Edits'}</button>
                  </form>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '11px', color: 'rgba(200,210,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={12}/> Add Relative</p>
                  <form onSubmit={handleAddRelative} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input required type="text" value={relName} onChange={(e) => setRelName(e.target.value)} placeholder="Relative's Name" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select value={relGender} onChange={(e) => setRelGender(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}><option value="Male" style={{background: '#121c2b'}}>Male</option><option value="Female" style={{background: '#121c2b'}}>Female</option></select>
                      <select value={relType} onChange={(e) => setRelType(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}><option value="Child" style={{background: '#121c2b'}}>Child</option><option value="Parent" style={{background: '#121c2b'}}>Parent</option><option value="Sibling" style={{background: '#121c2b'}}>Sibling</option>{!currentSpouse && <option value="Spouse" style={{background: '#121c2b'}}>Spouse</option>}</select>
                    </div>
                    <button type="submit" disabled={panelLoading} style={{ background: '#3d7fd4', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Create & Add</button>
                  </form>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '11px', color: 'rgba(251, 191, 36, 0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><LinkIcon size={12}/> Link Couple</p>
                  {currentSpouse ? ( <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '10px', borderRadius: '8px', color: '#fbbf24', fontSize: '13px' }}>💍 Married to {currentSpouse.name}</div> ) 
                  : ( <div style={{ display: 'flex', gap: '8px' }}><select value={selectedSpouseId} onChange={(e) => setSelectedSpouseId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}><option value="">Select a spouse...</option>{availableToLink.map(m => <option key={`sp-${m.id}`} value={m.id} style={{background: '#121c2b'}}>{m.name}</option>)}</select><button onClick={handleLinkSpouse} disabled={panelLoading} style={{ background: '#fbbf24', color: '#121c2b', border: 'none', padding: '0 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Link</button></div> )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px' }}>
                  <p style={{ fontSize: '11px', color: 'rgba(61, 127, 212, 0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><LinkIcon size={12}/> Link Parent</p>
                  {currentParent1 && currentParent2 ? ( <div style={{ background: 'rgba(61, 127, 212, 0.1)', border: '1px solid rgba(61, 127, 212, 0.3)', padding: '10px', borderRadius: '8px', color: '#90b8f8', fontSize: '13px' }}>Both parents linked ({currentParent1.name} & {currentParent2.name})</div> ) 
                  : ( <div style={{ display: 'flex', gap: '8px' }}><select value={selectedSecParentId} onChange={(e) => setSelectedSecParentId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}><option value="">Select existing parent...</option>{availableToLink.map(m => <option key={`pa-${m.id}`} value={m.id} style={{background: '#121c2b'}}>{m.name}</option>)}</select><button onClick={handleLinkSecParent} disabled={panelLoading} style={{ background: '#3d7fd4', color: 'white', border: 'none', padding: '0 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Link</button></div> )}
                </div>

                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                  <button onClick={handleDeleteNode} disabled={panelLoading} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Trash2 size={16} />{panelLoading ? 'Processing...' : `Delete ${selectedNode.name}`}</button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
