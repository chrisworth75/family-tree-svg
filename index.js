const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper function to generate SVG for family tree
function generateFamilyTreeSVG(familyData) {
  const { members, relationships } = familyData;

  // Build a map of members by ID
  const memberMap = new Map();
  members.forEach(member => {
    memberMap.set(member.id, member);
  });

  // Find marriages (couples who share children)
  const marriages = [];
  const marriageMap = new Map(); // childId -> [parent1Id, parent2Id]

  relationships.forEach(rel => {
    if (rel.type === 'parent-child') {
      if (!marriageMap.has(rel.childId)) {
        marriageMap.set(rel.childId, []);
      }
      marriageMap.get(rel.childId).push(rel.parentId);
    }
  });

  marriageMap.forEach((parents, childId) => {
    if (parents.length === 2) {
      const marriageKey = parents.sort().join('-');
      if (!marriages.find(m => m.key === marriageKey)) {
        marriages.push({
          key: marriageKey,
          parents: parents,
          children: []
        });
      }
      const marriage = marriages.find(m => m.key === marriageKey);
      marriage.children.push(childId);
    }
  });

  // Find root members (those without parents)
  const roots = members.filter(member => {
    const hasParents = relationships.some(rel =>
      rel.type === 'parent-child' && rel.childId === member.id
    );
    return !hasParents;
  });

  // Calculate positions for each member
  const positions = new Map();
  const nodeWidth = 120;
  const nodeHeight = 60;
  const horizontalSpacing = 40;
  const verticalSpacing = 80;

  let currentY = 50;
  let generationIndex = 0;

  // Simple layout algorithm: arrange by generations
  function layoutGeneration(memberIds, y, generation) {
    const totalWidth = memberIds.length * (nodeWidth + horizontalSpacing) - horizontalSpacing;
    let currentX = 50;

    memberIds.forEach((id, index) => {
      positions.set(id, {
        x: currentX,
        y: y,
        generation: generation
      });
      currentX += nodeWidth + horizontalSpacing;
    });

    // Find children of this generation
    const childIds = new Set();
    memberIds.forEach(parentId => {
      relationships.forEach(rel => {
        if (rel.type === 'parent-child' && rel.parentId === parentId) {
          childIds.add(rel.childId);
        }
      });
    });

    if (childIds.size > 0) {
      layoutGeneration(Array.from(childIds), y + nodeHeight + verticalSpacing, generation + 1);
    }
  }

  // Start layout from roots
  layoutGeneration(roots.map(r => r.id), currentY, 0);

  // Calculate SVG dimensions
  let maxX = 0, maxY = 0;
  positions.forEach(pos => {
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  const svgWidth = maxX + 50;
  const svgHeight = maxY + 50;

  // Generate SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      .person-box { fill: #e3f2fd; stroke: #1976d2; stroke-width: 2; }
      .person-name { font-family: Arial, sans-serif; font-size: 14px; fill: #000; text-anchor: middle; }
      .person-details { font-family: Arial, sans-serif; font-size: 11px; fill: #555; text-anchor: middle; }
      .relationship-line { stroke: #666; stroke-width: 2; fill: none; }
      .marriage-line { stroke: #1976d2; stroke-width: 2; fill: none; }
    </style>
  </defs>

  <!-- Relationship lines -->
`;

  // Draw marriage lines (horizontal lines between spouses)
  const drawnMarriages = new Set();
  marriages.forEach(marriage => {
    const parent1Pos = positions.get(marriage.parents[0]);
    const parent2Pos = positions.get(marriage.parents[1]);

    if (parent1Pos && parent2Pos && parent1Pos.generation === parent2Pos.generation) {
      const x1 = parent1Pos.x + nodeWidth;
      const y1 = parent1Pos.y + nodeHeight / 2;
      const x2 = parent2Pos.x;
      const y2 = parent2Pos.y + nodeHeight / 2;

      // Draw horizontal marriage line at middle of boxes
      svg += `  <line class="marriage-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />\n`;

      // Calculate midpoint of marriage line for children to connect to
      const midX = (x1 + x2) / 2;
      const midY = y1; // Same Y level as middle of parent boxes

      drawnMarriages.add(marriage.key);

      // Draw lines from marriage midpoint down to children
      marriage.children.forEach(childId => {
        const childPos = positions.get(childId);
        if (childPos) {
          const childX = childPos.x + nodeWidth / 2;
          const childY = childPos.y;
          const parentBottom = parent1Pos.y + nodeHeight;

          // Vertical line down from marriage line, then across to child
          svg += `  <path class="relationship-line" d="M ${midX} ${midY} L ${midX} ${parentBottom + verticalSpacing/2} L ${childX} ${parentBottom + verticalSpacing/2} L ${childX} ${childY}" />\n`;
        }
      });
    }
  });

  // Draw lines for single parents (not in a marriage)
  relationships.forEach(rel => {
    if (rel.type === 'parent-child') {
      const parents = marriageMap.get(rel.childId);
      if (!parents || parents.length === 1) {
        const parentPos = positions.get(rel.parentId);
        const childPos = positions.get(rel.childId);

        if (parentPos && childPos) {
          const x1 = parentPos.x + nodeWidth / 2;
          const y1 = parentPos.y + nodeHeight;
          const x2 = childPos.x + nodeWidth / 2;
          const y2 = childPos.y;

          svg += `  <path class="relationship-line" d="M ${x1} ${y1} L ${x1} ${y1 + verticalSpacing/2} L ${x2} ${y1 + verticalSpacing/2} L ${x2} ${y2}" />\n`;
        }
      }
    }
  });

  svg += `\n  <!-- Person boxes -->\n`;

  // Draw person boxes
  members.forEach(member => {
    const pos = positions.get(member.id);
    if (!pos) return;

    svg += `  <g>
    <rect class="person-box" x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="5" />
    <text class="person-name" x="${pos.x + nodeWidth/2}" y="${pos.y + 25}">${member.name}</text>
`;

    if (member.birthYear) {
      svg += `    <text class="person-details" x="${pos.x + nodeWidth/2}" y="${pos.y + 42}">b. ${member.birthYear}</text>\n`;
    }

    svg += `  </g>\n`;
  });

  svg += `</svg>`;

  return svg;
}

// POST endpoint to generate family tree SVG
app.post('/api/family-tree', (req, res) => {
  try {
    const familyData = req.body;

    // Validate input
    if (!familyData.members || !Array.isArray(familyData.members)) {
      return res.status(400).json({ error: 'Invalid input: members array is required' });
    }

    if (!familyData.relationships) {
      familyData.relationships = [];
    }

    // Generate SVG
    const svg = generateFamilyTreeSVG(familyData);

    // Return SVG with appropriate content type
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('Error generating family tree:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Family Tree SVG API running on port ${PORT}`);
  console.log(`POST to http://localhost:${PORT}/api/family-tree with JSON family data`);
});
