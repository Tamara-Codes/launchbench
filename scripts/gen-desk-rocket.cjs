// Regenerates public/lottie/launchbench-desk.json — the login-page animation.
// LaunchBench logo, animated: green rocket shakes on the pad, ignites a red flame,
// lifts off the white desk, then resets and loops. Canvas 300 x 360, transparent bg.
// Run: node scripts/gen-desk-rocket.js
const fs = require("fs");
const path = require("path");
const hex = (h) => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
const C = {
  green:   hex("#45d995"),
  white:   hex("#f7faf9"),
  whiteEdge:hex("#dfe4e3"),
  windowDk:hex("#12161c"),
  fireRed: hex("#ff3b2f"),
  fireOrg: hex("#ff8c2b"),
  fireYel: hex("#ffd54a"),
};

const fill = (rgb, op = 100) => ({ ty: "fl", c: { a: 0, k: rgb }, o: { a: 0, k: op }, r: 1, nm: "fill" });
const rect = (w, h, x, y, r = 0) => ({ ty: "rc", d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: [x, y] }, r: { a: 0, k: r }, nm: "rect" });
const ellipse = (w, h, x, y) => ({ ty: "el", d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: [x, y] }, nm: "el" });
// verts/tangents: pass [[x,y],[ix,iy],[ox,oy]] triples
const bez = (pts, closed = true) => ({ ty: "sh", d: 1, nm: "p", ks: { a: 0, k: {
  c: closed, v: pts.map(p => p[0]), i: pts.map(p => p[1] || [0,0]), o: pts.map(p => p[2] || [0,0]) } } });
const poly = (verts, closed = true) => bez(verts.map(v => [v]), closed);
const xf = () => ({ ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } });
const group = (items, nm) => ({ ty: "gr", nm, it: [...items, xf()] });

const EASE = { io:{i:{x:[0.42],y:[1]},o:{x:[0.58],y:[0]}}, in:{i:{x:[0.16],y:[1]},o:{x:[0.36],y:[0]}}, out:{i:{x:[0.7],y:[1]},o:{x:[0.85],y:[0]}}, lin:{i:{x:[0.99],y:[1]},o:{x:[0.01],y:[0]}} };
const kfs = (arr) => ({ a: 1, k: arr.map(([t, s, e = "io"]) => ({ t, s: Array.isArray(s) ? s : [s], ...EASE[e] })) });
const layer = (ind, nm, shapes, ks) => ({ ddd:0, ind, ty:4, nm, sr:1, ao:0, shapes, ip:0, op:180, st:0, bm:0,
  ks: { o:{a:0,k:100}, r:{a:0,k:0}, p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, ...ks } });

const S = 76; // rocket scale (%)

// ---- ROCKET (green). First group renders on top: window > body > fins behind ----
const body = bez([
  [[150, 84],  [-13, 3],  [13, 3]],    // nose apex
  [[188, 150], [-7, -34], [0, 8]],     // right shoulder
  [[186, 238], [0, -30],  [0, 14]],    // right lower
  [[172, 262], [7, -16],  [-4, 3]],    // right base
  [[150, 266], [12, 0],   [-12, 0]],   // bottom center
  [[128, 262], [4, 3],    [-7, -16]],  // left base
  [[114, 238], [0, 14],   [0, -30]],   // left lower
  [[112, 150], [0, 8],    [-7, -34]],  // left shoulder
]);
const finR = poly([[184,224],[216,278],[176,260]]);
const finL = poly([[116,224],[84,278],[124,260]]);
const rocketShapes = [
  group([ ellipse(28, 28, 150, 150), fill(C.windowDk) ], "window"),
  group([ body, fill(C.green) ], "body"),
  group([ finR, fill(C.green) ], "finR"),
  group([ finL, fill(C.green) ], "finL"),
];
// pivot at base (150,266): scaling keeps it on desk, rotation sways the nose.
// Timeline: 0-38 shake on the pad, 42-120 ascend, ~124 gone, snap back invisibly, 148 back at rest.
const risePos = kfs([
  [0,[150,266]],[7,[155,266]],[13,[145,266]],[19,[156,266]],[25,[144,266]],[31,[155,266]],[38,[150,266]],
  [42,[150,266],"in"],[120,[150,-250],"out"],[132,[150,266],"lin"],[180,[150,266]],
]);
const rocketRot = kfs([
  [0,0],[7,3.5],[13,-3.5],[19,4],[25,-4],[31,3],[38,0],[180,0],
]);
const riseOp = kfs([[0,100],[108,100],[122,0],[132,0,"lin"],[148,100],[180,100]]);
const rocket = layer(1, "rocket", rocketShapes, { p: risePos, r: rocketRot, o: riseOp, a:{a:0,k:[150,266]}, s:{a:0,k:[S,S]} });

// ---- FLAME (red/orange/yellow), attached to rocket, ignites during the shake ----
const flame = (topY, halfW, tipY) => bez([
  [[150, topY],       [halfW*0.5,-2], [-halfW*0.5,-2]],
  [[150+halfW, topY+(tipY-topY)*0.32], [-2,-(tipY-topY)*0.24], [2,(tipY-topY)*0.2]],
  [[150, tipY],       [halfW*0.6,-4], [-halfW*0.6,-4]],
  [[150-halfW, topY+(tipY-topY)*0.32], [-2,(tipY-topY)*0.2], [2,-(tipY-topY)*0.24]],
]);
const flameShapes = [
  group([ flame(268, 8,  292), fill(C.fireYel) ], "inner"),
  group([ flame(266, 13, 300), fill(C.fireOrg) ], "mid"),
  group([ flame(264, 19, 308), fill(C.fireRed) ], "outer"),
];
const flameOp = kfs([[0,0,"lin"],[14,0],[24,55],[40,100],[118,100],[124,0],[180,0,"lin"]]);
const flameScale = kfs([[0,[S*0.5,S*0.5]],[24,[S,S*0.7]],[42,[S,S*1.06]],[64,[S,S*0.86]],[86,[S,S*1.12]],[108,[S,S*0.9]],[120,[S,S*0.72]],[180,[S,S*0.5]]]);
const flameLayer = layer(2, "flame", flameShapes, { p: risePos, r: rocketRot, o: flameOp, a:{a:0,k:[150,266]}, s: flameScale });

// ---- DESK (white, slight 3D top + two legs with feet). First group on top. ----
const desk = layer(3, "desk", [
  group([ rect(22, 6, 212, 293, 3), fill(C.green) ], "accent"),
  group([ poly([[54,286],[246,286],[260,300],[40,300]]), fill(C.white) ], "top"),
  group([ poly([[40,300],[260,300],[258,312],[42,312]]), fill(C.whiteEdge) ], "edge"),
  group([ rect(15, 60, 96, 322, 3), fill(C.white) ], "legL"),
  group([ rect(15, 60, 204, 322, 3), fill(C.white) ], "legR"),
  group([ rect(34, 13, 96, 350, 3), fill(C.white) ], "footL"),
  group([ rect(34, 13, 204, 350, 3), fill(C.white) ], "footR"),
], {});

const doc = { v:"5.7.5", fr:30, ip:0, op:180, w:300, h:360, nm:"launchbench-desk-rocket", ddd:0, assets:[],
  layers: [rocket, flameLayer, desk] };
const out = path.join(__dirname, "..", "public", "lottie", "launchbench-desk.json");
fs.writeFileSync(out, JSON.stringify(doc));
const rp = JSON.parse(fs.readFileSync(out, "utf8"));
console.log("wrote", out, rp.w + "x" + rp.h, "layers", rp.layers.length, fs.statSync(out).size + "b");
