// Emits the SVG path 'd' strings used by src/components/rocket-desk-icon.tsx
// (the static brand mark — rocket at rest on the desk). Reuses the same geometry
// as the login animation's rest pose. Run: node scripts/gen-brand-icon.js
// Paste the output into rocket-desk-icon.tsx if the geometry ever changes.
const bezToPath = (pts) => {
  let d = `M${pts[0][0][0]},${pts[0][0][1]}`;
  for (let k = 0; k < pts.length; k++) {
    const A = pts[k], B = pts[(k + 1) % pts.length];
    const o = A[2] || [0, 0], i = B[1] || [0, 0];
    const c1 = [A[0][0] + o[0], A[0][1] + o[1]];
    const c2 = [B[0][0] + i[0], B[0][1] + i[1]];
    d += `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${B[0][0]},${B[0][1]}`;
  }
  return d + "Z";
};
const polyToPath = (v) => "M" + v.map(p => p.join(",")).join("L") + "Z";

const body = [
  [[150, 84],  [-13, 3],  [13, 3]],
  [[188, 150], [-7, -34], [0, 8]],
  [[186, 238], [0, -30],  [0, 14]],
  [[172, 262], [7, -16],  [-4, 3]],
  [[150, 266], [12, 0],   [-12, 0]],
  [[128, 262], [4, 3],    [-7, -16]],
  [[114, 238], [0, 14],   [0, -30]],
  [[112, 150], [0, 8],    [-7, -34]],
];
console.log("BODY:    ", bezToPath(body));
console.log("FIN R:   ", polyToPath([[184,224],[216,278],[176,260]]));
console.log("FIN L:   ", polyToPath([[116,224],[84,278],[124,260]]));
console.log("DESK TOP:", polyToPath([[54,286],[246,286],[260,300],[40,300]]));
console.log("DESK EDGE:", polyToPath([[40,300],[260,300],[258,312],[42,312]]));
console.log("\nRocket is scaled to 62% about (150,296) in the component so it sits in proportion on the desk.");
