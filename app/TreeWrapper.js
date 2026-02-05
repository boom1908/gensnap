"use client";
import dynamic from "next/dynamic";
import React from "react";

const DynamicTree = dynamic(() => import("react-d3-tree"), { 
  ssr: false,
  loading: () => <p style={{padding: "20px"}}>Loading Tree Visuals...</p>
});

export default function TreeWrapper({ data }) {
  // If no data is passed, show a placeholder
  const finalData = data || { name: "Loading..." };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <DynamicTree 
        data={finalData} 
        orientation="vertical"
        pathFunc="step"
        translate={{ x: 300, y: 50 }}
        rootNodeClassName="node__root"
        branchNodeClassName="node__branch"
        leafNodeClassName="node__leaf"
      />
    </div>
  );
}