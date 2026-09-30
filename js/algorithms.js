"use strict";
/* ============================================================
   algorithms.js — โค้ดของ Graph Theory และ Tree
   ส่วน A: Graph  → Adjacency List, Weighted Graph, Dijkstra, BFS, DFS
   ส่วน B: Tree   → Rooted Tree, Parent/Child/Leaf, Path, Traversal
   ============================================================ */

/* ------------------------------------------------------------
   ส่วน A : GRAPH
   ------------------------------------------------------------ */

/* A1) Adjacency List: graph[v] = รายการ Edge ที่ออกจาก v
   (Edge ไม่มีทิศทาง จึงใส่ทั้งสองฝั่ง)                          */
function buildGraph(edges) {
  const g = {};
  Object.keys(PLACES).forEach(v => { g[v] = []; });
  edges.forEach(([a, b, mode, time, fare]) => {
    g[a].push({ to: b, mode, time, fare });
    g[b].push({ to: a, mode, time, fare });
  });
  return g;
}
const graph = buildGraph(EDGES);

/* เพื่อนบ้านแบบไม่ซ้ำ (ใช้กับ BFS/DFS ที่ไม่สนใจ Weight) */
function neighborsOf(g, v) {
  const seen = new Set();
  g[v].forEach(e => seen.add(e.to));
  return [...seen];
}

/* A2) State Graph: 1 Vertex = "สถานที่|โหมด"
   - Edge แบบ "ride"     : นั่งโหมดเดิมต่อไปยังสถานที่ถัดไป (Weight = เวลา, ค่าโดยสาร)
   - Edge แบบ "transfer" : เปลี่ยนโหมดที่สถานที่เดียวกัน (เสียเวลา TRANSFER_TIME นาที, ค่าโดยสาร 0)
   ทำให้ Dijkstra นับ "การเปลี่ยนโหมด" ได้ถูกต้อง โดยไม่ต้องเขียน Dijkstra ใหม่         */
function buildStateGraph(g) {
  const sg = {};
  const ensure = s => { if (!sg[s]) sg[s] = []; };
  Object.keys(g).forEach(a => {
    g[a].forEach(e => {
      const from = a + "|" + e.mode, to = e.to + "|" + e.mode;
      ensure(from); ensure(to);
      sg[from].push({ to, kind: "ride", mode: e.mode, time: e.time, fare: e.fare,
                      fromPlace: a, toPlace: e.to });
    });
  });
  const byPlace = {};
  Object.keys(sg).forEach(s => {
    const p = s.split("|")[0];
    (byPlace[p] = byPlace[p] || []).push(s);
  });
  Object.keys(byPlace).forEach(p => {
    byPlace[p].forEach(s1 => byPlace[p].forEach(s2 => {
      if (s1 !== s2) sg[s1].push({ to: s2, kind: "transfer", mode: null, time: TRANSFER_TIME,
                                   fare: 0, fromPlace: p, toPlace: p });
    }));
  });
  return sg;
}

/* A3) Dijkstra's Algorithm (เขียนตามขั้นตอนในสไลด์ ไม่ใช้ไลบรารี)
   Step 1  dist[จุดเริ่มต้น] = 0 , dist[จุดอื่น] = ∞
   Step 2  queue = เซตของจุดที่ยังไม่ถูกปิด
   Step 3  เลือก u ใน queue ที่ dist ต่ำสุด
   Step 4  ตรวจ Neighbor ของ u ทุกตัว
   Step 5  ถ้า dist[u] + w < dist[neighbor] ให้ปรับค่า (Relax)
   Step 6  ทำซ้ำจนถึงปลายทาง
   costFn = นิยาม "น้ำหนัก" ที่ใช้ตอน Relax (เวลา / ค่าโดยสาร / ผสม)        */
function dijkstra(sg, sources, targets, costFn, withTrace) {
  const dist = {}, prev = {}, prevEdge = {}, trace = [];
  Object.keys(sg).forEach(s => { dist[s] = Infinity; });        // Step 1
  sources.forEach(s => { dist[s] = 0; });
  const queue = new Set(Object.keys(sg));                        // Step 2
  let target = null, step = 0;

  while (queue.size) {                                           // Step 6
    let u = null;
    queue.forEach(s => { if (u === null || dist[s] < dist[u]) u = s; });  // Step 3
    if (dist[u] === Infinity) break;
    queue.delete(u);
    step++;
    const row = { step, u, dist: dist[u], updates: [] };
    if (targets.has(u)) {                                        // ถึงปลายทางแล้ว
      target = u;
      if (withTrace) { row.done = true; trace.push(row); }
      break;
    }
    sg[u].forEach(edge => {                                      // Step 4
      if (!queue.has(edge.to)) return;
      const alt = dist[u] + costFn(edge);
      if (alt < dist[edge.to]) {                                 // Step 5 : Relax
        if (withTrace) row.updates.push({ to: edge.to, old: dist[edge.to], now: alt });
        dist[edge.to] = alt;
        prev[edge.to] = u;
        prevEdge[edge.to] = edge;
      }
    });
    if (withTrace) trace.push(row);
  }
  return { dist, prev, prevEdge, target, trace };
}

/* A4) แปลงผลของ Dijkstra ให้เป็น Path + ขา (leg) ที่อ่านง่าย
   - statePath  = ลำดับ Vertex v0, v1, ..., vk ที่คู่ติดกันเชื่อมกันด้วย Edge เสมอ
   - Total Weight = ผลรวม Weight ของทุก Edge บน Path                       */
function planRoute(sg, from, to, costFn, withTrace) {
  const sources = new Set(), targets = new Set();
  Object.keys(sg).forEach(s => {
    const p = s.split("|")[0];
    if (p === from) sources.add(s);
    if (p === to) targets.add(s);
  });
  const r = dijkstra(sg, sources, targets, costFn, withTrace);
  if (!r.target) return null;

  const statePath = [r.target];
  const edgePath = [];
  let cur = r.target;
  while (r.prev[cur] !== undefined) {
    edgePath.unshift(r.prevEdge[cur]);
    cur = r.prev[cur];
    statePath.unshift(cur);
  }

  const legs = [];
  let totalTime = 0, totalFare = 0, transfers = 0, pending = null;
  edgePath.forEach(e => {
    totalTime += e.time;     // สะสม Weight ของทุก Edge บน Path
    totalFare += e.fare;
    if (e.kind === "transfer") { transfers++; pending = e; return; }
    const last = legs[legs.length - 1];
    if (last && last.mode === e.mode && !pending) {
      last.to = e.toPlace; last.time += e.time; last.fare += e.fare;
      last.hops++; last.places.push(e.toPlace);
    } else {
      legs.push({ mode: e.mode, from: e.fromPlace, to: e.toPlace, time: e.time, fare: e.fare,
                  hops: 1, places: [e.fromPlace, e.toPlace], transferBefore: pending });
      pending = null;
    }
  });

  const places = [];
  legs.forEach(l => l.places.forEach(p => { if (places[places.length - 1] !== p) places.push(p); }));

  return { from, to, cost: r.dist[r.target], legs, places, statePath, edgePath,
           totalTime, totalFare, transfers, trace: r.trace };
}

/* เกณฑ์ที่ใช้นิยาม Weight ต่างกัน → Dijkstra ตัวเดิมได้คำตอบต่างกัน
   (บวกค่าเล็กน้อยไว้ตัดสินเมื่อคะแนนเท่ากัน) */
const CRITERIA = {
  fast:  { label: "เร็วที่สุด",   formula: "w = เวลา (นาที)",
           fn: e => e.time + e.fare * 0.0001 },
  cheap: { label: "ประหยัดที่สุด", formula: "w = ค่าโดยสาร (บาท)",
           fn: e => e.fare + e.time * 0.001 },
  best:  { label: "แนะนำ",        formula: "w = เวลา + 0.06 × ค่าโดยสาร",
           fn: e => e.time + e.fare * 0.06 + 0.0001 }
};

/* A5) BFS — ท่องกราฟทีละ "ระดับ" (ใช้ Queue) จากจุด start
   level[v] = จำนวนช่วงเดินทางขั้นต่ำจาก start ไป v (ไม่สนใจ Weight) */
function bfs(g, start) {
  const order = [], level = { [start]: 0 }, parent = { [start]: null };
  const queue = [start];
  while (queue.length) {
    const v = queue.shift();
    order.push(v);
    neighborsOf(g, v).forEach(w => {
      if (!(w in level)) { level[w] = level[v] + 1; parent[w] = v; queue.push(w); }
    });
  }
  return { order, level, parent };
}

/* A6) DFS — ท่องกราฟให้ลึกที่สุดก่อนค่อยย้อนกลับ (ใช้ Recursion = Stack) */
function dfs(g, start) {
  const order = [], depth = { [start]: 0 }, parent = { [start]: null };
  (function visit(v) {
    order.push(v);
    neighborsOf(g, v).forEach(w => {
      if (!(w in depth)) { depth[w] = depth[v] + 1; parent[w] = v; visit(w); }
    });
  })(start);
  return { order, level: depth, parent };
}

/* ------------------------------------------------------------
   ส่วน B : TREE
   ------------------------------------------------------------ */

/* B1) เตรียม Tree: ใส่ parent, level ให้ทุกโหนด และเติมชื่อของ Leaf จาก PLACES
   - โหนดที่ไม่มี children (หรือ children.length === 0) คือ Leaf ตามนิยาม */
function prepareTree(root) {
  const index = {}, leaves = [];
  (function walk(node, parent, level) {
    if (node.place) { node.id = node.place; node.name = PLACES[node.place].short; }
    node.parent = parent;
    node.level = level;
    index[node.id] = node;
    if (!node.children || node.children.length === 0) { node.isLeaf = true; leaves.push(node); }
    (node.children || []).forEach(c => walk(c, node, level + 1));
  })(root, null, 0);
  return { index, leaves };
}
const treeInfo = prepareTree(TREE);

/* B2) Path จาก Root ลงมาถึงโหนดที่ต้องการ (ไล่ parent ขึ้นไปแล้วกลับลำดับ) */
function pathFromRoot(node) {
  const path = [];
  for (let n = node; n; n = n.parent) path.unshift(n);
  return path;
}

/* B3) Tree Traversal (Bonus) */
function preorder(node, out = []) {             // ราก → ลูกซ้าย → ลูกขวา
  out.push(node);
  (node.children || []).forEach(c => preorder(c, out));
  return out;
}
function postorder(node, out = []) {            // ลูก ๆ ก่อน แล้วค่อยราก
  (node.children || []).forEach(c => postorder(c, out));
  out.push(node);
  return out;
}
function bfsTree(root) {                        // ทีละระดับ (Level order)
  const out = [], q = [root];
  while (q.length) {
    const n = q.shift();
    out.push(n);
    (n.children || []).forEach(c => q.push(c));
  }
  return out;
}

/* บทบาทของโหนด */
function roleOf(node) {
  if (!node.parent) return "Root";
  if (node.isLeaf) return "Leaf";
  return "Parent (Internal node)";
}

/* เผื่อรันทดสอบด้วย Node.js */
if (typeof module !== "undefined") {
  module.exports = { graph, buildStateGraph, planRoute, CRITERIA, bfs, dfs, treeInfo, TREE,
                     preorder, postorder, bfsTree, pathFromRoot, PLACES, EDGES, MODES };
}
