"use strict";
/* ============================================================
   home.js — หน้า 1 : ค้นหา
   ใช้ Tree: children[] (นิยามเวียนเกิด), pickerPath (Path จาก Root), Traversal
   ============================================================ */
(function () {
  Common.mountShell(1);
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const P = Common.params();
  const sel = { from: P.from, to: P.to };
  let target = "from";

  /* ---------- ฟอร์มค้นหา ---------- */
  function renderFields() {
    [["from", "เลือกสถานที่ต้นทาง"], ["to", "เลือกสถานที่ปลายทาง"]].forEach(([k, ph]) => {
      const val = $("#f-" + k + " .val");
      val.textContent = sel[k] ? PLACES[sel[k]].name : ph;
      val.classList.toggle("empty", !sel[k]);
    });
    const ok = sel.from && sel.to && sel.from !== sel.to;
    const go = $("#go");
    go.setAttribute("aria-disabled", ok ? "false" : "true");
    go.href = ok ? Common.url("routes.html", { from: sel.from, to: sel.to }) : "#";
    $("#hint").textContent = sel.from && sel.to && sel.from === sel.to
      ? "ต้นทางและปลายทางต้องเป็นคนละสถานที่"
      : (!ok ? "เลือกให้ครบทั้งต้นทางและปลายทาง" : "");
  }
  $("#swap").addEventListener("click", () => { [sel.from, sel.to] = [sel.to, sel.from]; renderFields(); });
  $("#f-from").addEventListener("click", () => openPicker("from"));
  $("#f-to").addEventListener("click", () => openPicker("to"));

  $("#popular").innerHTML = POPULAR.map(([a, b], i) =>
    `<button class="chip" type="button" data-i="${i}">${esc(PLACES[a].short)} → ${esc(PLACES[b].short)}</button>`).join("");
  $("#popular").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    [sel.from, sel.to] = POPULAR[+b.dataset.i];
    renderFields();
  });
  $("#go").addEventListener("click", e => { if ($("#go").getAttribute("aria-disabled") === "true") e.preventDefault(); });

  /* ---------- หน้าต่างเลือกสถานที่ (เดิน Path จาก Root ลงมา) ---------- */
  const dlg = $("#picker");
  let pickerPath = [TREE];                          // Path จาก Root ถึงโหนดปัจจุบัน

  function openPicker(which) {
    target = which;
    pickerPath = [TREE];
    renderPicker();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function renderPicker() {
    const node = pickerPath[pickerPath.length - 1];
    $("#picker-title").textContent = target === "from" ? "เลือกต้นทาง" : "เลือกปลายทาง";
    $("#crumbs").innerHTML = pickerPath.map((n, i) =>
      `<button type="button" data-i="${i}">${esc(n.name)}</button>`).join("<span>›</span>");
    $("#picker-back").disabled = pickerPath.length === 1;
    $("#picker-list").innerHTML = (node.children || []).map(c => {
      if (c.isLeaf) {
        const P = PLACES[c.id];
        return `<li><button type="button" data-id="${c.id}">
          <span>${P.emoji} ${esc(P.name)}<span class="sub">${esc(P.desc)}</span></span>
          <span class="badge coral">Leaf</span></button></li>`;
      }
      return `<li><button type="button" data-id="${c.id}">
        <span>${esc(c.name)}<span class="sub">มี ${c.children.length} หัวข้อย่อย</span></span><span aria-hidden="true">›</span></button></li>`;
    }).join("");
    $("#picker-foot").textContent = `Level ${node.level} — Path: ${pickerPath.map(n => n.name).join(" → ")}`;
  }
  $("#picker-list").addEventListener("click", e => {
    const b = e.target.closest("button[data-id]"); if (!b) return;
    const child = treeInfo.index[b.dataset.id];
    if (child.isLeaf) {                              // ถึง Leaf = เลือกสถานที่
      sel[target] = child.id;
      dlg.close();
      renderFields();
      selectNode(child.id);
    } else {
      pickerPath = [...pickerPath, child];           // ลงลึกหนึ่งชั้น = ต่อ Path อีกหนึ่ง Vertex
      renderPicker();
    }
  });
  $("#crumbs").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    pickerPath = pickerPath.slice(0, +b.dataset.i + 1);   // ย้อนกลับ = ตัด Path ถึงบรรพบุรุษที่เลือก
    renderPicker();
  });
  $("#picker-back").addEventListener("click", () => { pickerPath = pickerPath.slice(0, -1); renderPicker(); });
  $("#picker-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  /* ---------- วาด Tree (SVG) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const LEVEL_X = [16, 236, 486, 744];
  const ROW = 40, TOP = 46;
  const state = { selected: "ROOT", path: new Set(), visited: [] };
  const svg = $("#tree");

  function drawTree() {
    let leafIdx = 0;
    (function place(n) {                              // ตำแหน่งแนวตั้ง: Leaf เรียงลงมา, Parent อยู่กึ่งกลางลูก
      if (n.isLeaf) { n._y = TOP + leafIdx++ * ROW; return; }
      n.children.forEach(place);
      n._y = (n.children[0]._y + n.children[n.children.length - 1]._y) / 2;
    })(TREE);
    const H = TOP + leafIdx * ROW - 10, W = 980;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    let nodes = "", levels = "";
    for (let l = 0; l <= 3; l++) levels += `<g class="tlevel"><text x="${LEVEL_X[l]}" y="22">Level ${l}${l === 0 ? " (Root)" : l === 3 ? " (Leaf)" : ""}</text></g>`;
    Object.values(treeInfo.index).forEach(n => {
      const cls = !n.parent ? "root" : n.isLeaf ? "leaf" : "parent";
      nodes += `<g class="tnode ${cls}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)} — ${roleOf(n)}, Level ${n.level}">
        <rect x="${LEVEL_X[n.level]}" y="${n._y - 15}" height="30" rx="9" width="80"/>
        <text x="${LEVEL_X[n.level] + 12}" y="${n._y + 5}">${esc(n.name)}</text></g>`;
    });
    svg.innerHTML = `<g id="links"></g>${levels}<g id="nodes">${nodes}</g><g id="nums"></g>`;

    // วัดความกว้างข้อความ แล้วปรับกรอบให้พอดี
    svg.querySelectorAll(".tnode").forEach(g => {
      const n = treeInfo.index[g.dataset.id];
      let w = 0;
      try { w = g.querySelector("text").getBBox().width; } catch (e) { /* ignore */ }
      if (!w) w = n.name.length * 9;
      n._w = Math.ceil(w) + 24;
      g.querySelector("rect").setAttribute("width", n._w);
    });
    // เส้นเชื่อม Parent → Child
    let links = "";
    Object.values(treeInfo.index).forEach(n => {
      if (!n.parent) return;
      const p = n.parent, x1 = LEVEL_X[p.level] + p._w, x2 = LEVEL_X[n.level], mx = (x1 + x2) / 2;
      links += `<path class="tlink" data-id="${n.id}" d="M${x1} ${p._y} C${mx} ${p._y} ${mx} ${n._y} ${x2} ${n._y}"/>`;
    });
    svg.querySelector("#links").innerHTML = links;
    applyState();
  }

  function applyState() {
    svg.querySelectorAll(".tnode").forEach(g => {
      const id = g.dataset.id;
      g.classList.toggle("selected", id === state.selected);
      g.classList.toggle("onpath", state.path.has(id));
      g.classList.toggle("visited", state.visited.includes(id));
    });
    svg.querySelectorAll(".tlink").forEach(l => l.classList.toggle("onpath", state.path.has(l.dataset.id)));
    let nums = "";
    state.visited.forEach((id, i) => {
      const n = treeInfo.index[id];
      nums += `<g class="tnum"><circle cx="${LEVEL_X[n.level] + n._w}" cy="${n._y - 15}" r="10"/><text x="${LEVEL_X[n.level] + n._w}" y="${n._y - 11}">${i + 1}</text></g>`;
    });
    svg.querySelector("#nums").innerHTML = nums;
  }

  /* ---------- เลือกโหนด: แสดง Root/Parent/Child/Leaf/Path ---------- */
  function selectNode(id) {
    const n = treeInfo.index[id]; if (!n) return;
    state.selected = id;
    const path = pathFromRoot(n);                     // Path จาก Root ถึงโหนดนี้
    state.path = new Set(path.map(x => x.id));
    applyState();
    const role = roleOf(n);
    const pathHTML = path.map((x, i) => {
      const cls = i === 0 ? "start" : i === path.length - 1 ? "end" : "";
      return `<span class="v ${cls}">${esc(x.name)}</span>`;
    }).join('<span class="arrow">→</span>');
    const kids = n.children ? n.children.map(c => esc(c.name)).join(", ") : "— (Leaf ไม่มี Child)";
    let extra = "";
    if (n.isLeaf) {
      const P = PLACES[n.id];
      extra = `<p class="small muted" style="margin:10px 0 0">${P.emoji} ${esc(P.desc)}</p>
        <div class="chips noprint" style="margin-top:10px">
          <button class="chip" type="button" data-set="from">ตั้งเป็นต้นทาง</button>
          <button class="chip" type="button" data-set="to">ตั้งเป็นปลายทาง</button></div>`;
    }
    $("#info").innerHTML = `
      <h3>${esc(n.name)} <span class="badge ${n.isLeaf ? "coral" : !n.parent ? "" : "sea"}">${role}</span></h3>
      <ul class="infolist">
        <li><b>Level</b><span>${n.level}${n.parent ? "" : " (Root อยู่ Level 0)"}</span></li>
        <li><b>Parent</b><span>${n.parent ? esc(n.parent.name) : "— (Root ไม่มี Parent)"}</span></li>
        <li><b>Child</b><span>${kids}</span></li>
        <li><b>Path จาก Root</b><span class="pathline">${pathHTML}</span></li>
        <li><b>ความยาว Path</b><span>${path.length - 1} Edge</span></li>
      </ul>${extra}`;
  }
  $("#info").addEventListener("click", e => {
    const b = e.target.closest("button[data-set]"); if (!b) return;
    sel[b.dataset.set] = state.selected;
    renderFields();
  });
  svg.addEventListener("click", e => { const g = e.target.closest(".tnode"); if (g) selectNode(g.dataset.id); });
  svg.addEventListener("keydown", e => {
    const g = e.target.closest(".tnode");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectNode(g.dataset.id); }
  });

  /* ---------- Tree Traversal (Bonus) ---------- */
  let timer = null;
  const TRAV = {
    pre:  { name: "Preorder",  order: () => preorder(TREE),  rule: "เยี่ยมโหนดก่อน แล้วลงไปลูกทีละคนจากซ้ายไปขวา" },
    post: { name: "Postorder", order: () => postorder(TREE), rule: "เยี่ยมลูกทุกคนก่อน แล้วค่อยเยี่ยมโหนดแม่ (Root จะเป็นตัวสุดท้าย)" },
    bfs:  { name: "BFS",       order: () => bfsTree(TREE),   rule: "เยี่ยมทีละระดับ Level 0 → 1 → 2 → 3 โดยใช้ Queue" }
  };
  document.querySelectorAll("[data-trav]").forEach(b => b.addEventListener("click", () => {
    clearInterval(timer);
    state.visited = [];
    const k = b.dataset.trav;
    if (k === "clear") { $("#seq").textContent = "กดปุ่ม Preorder / Postorder / BFS เพื่อดูลำดับการเยี่ยมชมโหนด"; applyState(); return; }
    const t = TRAV[k], order = t.order().map(n => n.id);
    const show = () => {
      $("#seq").innerHTML = `<b>${t.name}</b> — ${t.rule}<br>` +
        state.visited.map(id => esc(treeInfo.index[id].name)).join(" → ");
      applyState();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { state.visited = order; show(); return; }
    let i = 0;
    timer = setInterval(() => {
      state.visited.push(order[i++]);
      show();
      if (i >= order.length) clearInterval(timer);
    }, 380);
  }));

  /* ---------- เริ่มต้น ---------- */
  renderFields();
  drawTree();
  selectNode(sel.from || "ROOT");
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawTree(); });
})();
