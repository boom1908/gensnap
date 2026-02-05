"use client";
import React from "react";
import Tree from "react-d3-tree";

// This is the data structure for the automatic tree
const myFamilyData = {
  name: "Grandfather",
  attributes: {
    gender: "Male",
  },
  children: [
    {
      name: "Father",
      attributes: {
        gender: "Male",
      },
      children: [
        {
          name: "You",
          attributes: {
            gender: "Male",
            relation: "Me"
          },
        },
        {
          name: "Sister",
          attributes: {
            gender: "Female",
          },
        },
      ],
    },
    {
      name: "Uncle",
      attributes: {
        gender: "Male",
      },
    },
  ],
};

export default function FamilyTreeBoard() {
  return (
    // We create a white container so you can see the lines clearly
    <div style={{ width: "100%", height: "600px", background: "white", borderRadius: "10px", border: "1px solid #ccc" }}>
      <Tree 
        data={myFamilyData} 
        orientation="vertical" // Makes it go Top-to-Bottom
        pathFunc="step"        // Makes the lines square/neat
        translate={{ x: 300, y: 50 }} // Centers the starting point
        rootNodeClassName="node__root"
        branchNodeClassName="node__branch"
        leafNodeClassName="node__leaf"
      />
    </div>
  );
}