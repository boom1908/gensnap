"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';

export default function TreeCanvas({ data, onNodeClick, onNodeMove, isEditMode = false }: { data: any[], onNodeClick?: (node: any) => void, onNodeMove?: (id: string, x: number, y: number) => void, isEditMode?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const zoomRef = useRef<any>(d3.zoomIdentity);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });
    g.setDefaultEdgeLabel(() => ({}));

    data.forEach(member => {
      g.setNode(member.id, { 
        label: member.name, 
        width: 240,
        height: 85, 
        gender: member.gender, 
        relation: member.relation, 
        id: member.id, 
        raw: member 
      });
    });

    data.forEach(member => {
      if (member.parent_id) g.setEdge(member.parent_id, member.id);
      if (member.secondary_parent_id) g.setEdge(member.secondary_parent_id, member.id);
      if (member.spouse_id && !member.parent_id && !member.secondary_parent_id) {
        const spouse = data.find(m => m.id === member.spouse_id);
        if (spouse && spouse.parent_id) g.setEdge(spouse.parent_id, member.id);
        if (spouse && spouse.secondary_parent_id) g.setEdge(spouse.secondary_parent_id, member.id);
      }
    });

    dagre.layout(g);

    const layoutNodes = g.nodes().map(v => {
      const n = g.node(v);
      return { ...n, x: n.raw.pos_x !== null ? n.raw.pos_x : n.x, y: n.raw.pos_y !== null ? n.raw.pos_y : n.y };
    });

    setNodes(layoutNodes);
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on('zoom', (event) => {
        zoomRef.current = event.transform;
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    if (isEditMode) {
      const drag = d3.drag<SVGGElement, any>()
        .on('drag', function(event) {
          d3.select(this).classed("dragging", true); 
          const id = d3.select(this).attr('data-id');
          const k = zoomRef.current.k || 1; 
          setNodes(prev => prev.map(n => n.id === id ? { ...n, x: n.x + event.dx / k, y: n.y + event.dy / k } : n));
        })
        .on('end', function(event) {
          d3.select(this).classed("dragging", false);
          const id = d3.select(this).attr('data-id');
          setNodes(prev => {
            const movedNode = prev.find(n => n.id === id);
            if (movedNode && onNodeMove) onNodeMove(id, movedNode.x, movedNode.y);
            return prev;
          });
        });

      g.selectAll('.node-group').call(drag as any);
    } else {
      g.selectAll('.node-group').on('.drag', null);
    }
  }, [nodes.length, onNodeMove, isEditMode]);

  const drawCurve = (source: any, target: any) => `M ${source.x},${source.y + 42} C ${source.x},${source.y + 80} ${target.x},${target.y - 80} ${target.x},${target.y - 42}`;

  // NEW: Formatting function specifically for DOB and Age together
  const getDetailsText = (raw: any) => {
    let parts = [];
    if (raw.dob) {
      const birthDate = new Date(raw.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      
      // Format to DD-MM-YYYY
      const dobString = `${birthDate.getDate().toString().padStart(2, '0')}-${(birthDate.getMonth() + 1).toString().padStart(2, '0')}-${birthDate.getFullYear()}`;
      parts.push(`${dobString} (Age ${age})`);
    }
    if (raw.is_alive === false) parts.push("Deceased");
    return parts.join(" • ");
  };

  return (
    <svg ref={svgRef} style={{ width: '100%', height: '100%', background: '#0d1520', cursor: 'grab' }}>
      <defs>
        <clipPath id="avatar-clip">
          <circle cx="45" cy="42.5" r="25" />
        </clipPath>
      </defs>
      <g ref={gRef}>
        {/* Draw Lines */}
        {data.map(member => {
          if (!member.parent_id) return null;
          const source = nodes.find(n => n.id === member.parent_id);
          const target = nodes.find(n => n.id === member.id);
          if (!source || !target) return null;
          return <path key={`p1-${member.id}`} d={drawCurve(source, target)} stroke={source.gender === 'Female' ? '#f472b6' : '#3d7fd4'} strokeWidth="2.5" fill="none" opacity="0.8" />;
        })}
        {data.map(member => {
          if (!member.secondary_parent_id) return null;
          const source = nodes.find(n => n.id === member.secondary_parent_id);
          const target = nodes.find(n => n.id === member.id);
          if (!source || !target) return null;
          return <path key={`p2-${member.id}`} d={drawCurve(source, target)} stroke={source.gender === 'Female' ? '#f472b6' : '#3d7fd4'} strokeWidth="2.5" fill="none" opacity="0.8" />;
        })}
        {data.map(member => {
          if (!member.spouse_id) return null;
          const source = nodes.find(n => n.id === member.id);
          const target = nodes.find(n => n.id === member.spouse_id);
          if (!source || !target || source.id > target.id) return null;
          return <path key={`spouse-${member.id}`} d={`M ${source.x},${source.y} L ${target.x},${target.y}`} stroke="#fbbf24" strokeWidth="2" strokeDasharray="6,6" fill="none" opacity="0.7" />;
        })}

        {/* Draw Cards */}
        {nodes.map((node) => {
          let borderColor = node.relation === 'Me' ? '#fbbf24' : (node.gender === 'Female' ? '#f472b6' : '#3d7fd4');
          return (
            <g key={node.id} className="node-group" data-id={node.id} transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`} onClick={(e) => { if ((e.target as Element).closest('.dragging')) return; if (onNodeClick) onNodeClick(node.raw); }} style={{ cursor: isEditMode ? 'move' : 'pointer' }}>
              <rect width={node.width} height={node.height} rx={12} fill="rgba(255,255,255,0.05)" stroke={borderColor} strokeWidth={2} style={{ backdropFilter: 'blur(10px)' }} />
              
              {/* AVATAR RENDERING */}
              <g>
                <circle cx="45" cy="42.5" r="25" fill="rgba(255,255,255,0.1)" stroke={borderColor} strokeWidth="1" />
                {node.raw.photo_url ? (
                  <image href={node.raw.photo_url} x="20" y="17.5" width="50" height="50" preserveAspectRatio="xMidYMid slice" clipPath="url(#avatar-clip)" />
                ) : (
                  <text x="45" y="48" fill="white" fontSize="18" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>{node.label.charAt(0).toUpperCase()}</text>
                )}
              </g>

              {/* THREE-LINE TEXT LAYOUT */}
              
              {/* 1. Name */}
              <text x={140} y={node.height / 2 - 12} fill="#f0eeff" fontSize="16" fontWeight="600" textAnchor="middle" fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>{node.label}</text>
              
              {/* 2. Relation (e.g., Chechi) - Styled in soft gold to stand out */}
              <text x={140} y={node.height / 2 + 6} fill="#fbbf24" fontSize="12" fontWeight="500" textAnchor="middle" fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>{node.raw.relation}</text>
              
              {/* 3. DOB & Age */}
              <text x={140} y={node.height / 2 + 22} fill="rgba(200,210,255,0.6)" fontSize="11" fontWeight="400" textAnchor="middle" fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>{getDetailsText(node.raw)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
