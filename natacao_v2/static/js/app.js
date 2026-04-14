/* ── State ─────────────────────────────────────────────────────── */
let atletas = [], resultados = {}, curAtleta = null, curAtletaRec = null;
let curProva = "Livre 50m", editingId = null, evoChart = null;

/* ── Utils ─────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmtDate = d => { if(!d) return "—"; const p=d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const ts = t => { if(!t) return null; try { const p=t.replace(",",".").split(":"); return parseInt(p[0])*60+parseFloat(p[1]); } catch{return null;} };
const fmtT = s => { if(s==null) return "—"; const m=Math.floor(s/60),sec=s%60; return `${String(m).padStart(2,"0")}:${sec.toFixed(2).padStart(5,"0")}`; };
const catBadge = c => { if(!c) return ""; const m={P1:"badge-p1",P2:"badge-p2",INF:"badge-inf"}; return `<span class="badge ${m[c]||""}">${c}</span>`; };
const piscBadge = p => `<span class="badge badge-${p}">${p}m</span>`;
const bestTs = rows => rows.reduce((b,r)=>(r.tempo_segundos!=null&&(b==null||r.tempo_segundos<b))?r.tempo_segundos:b, null);
const provasOf = id => [...new Set((resultados[id]||[]).map(r=>r.prova))].sort();
const sorted = (id,p) => (resultados[id]||[]).filter(r=>r.prova===p).sort((a,b)=>a.data.localeCompare(b.data));

/* ── Load ──────────────────────────────────────────────────────── */
async function loadAll() {
  atletas = await fetch("/api/atletas").then(r=>r.json());
  for(const a of atletas) resultados[a.id] = await fetch(`/api/resultados/${a.id}`).then(r=>r.json());
  await loadIndices();
  curAtleta = atletas[0]?.id;
  curAtletaRec = atletas[0]?.id;
  curAtletaIdx = atletas[0]?.id;
  if(!provasOf(curAtleta).includes(curProva)&&provasOf(curAtleta).length) curProva=provasOf(curAtleta)[0];
  initUI();
}

function initUI() {
  buildTabs(); buildFormAtletas();
  renderSummary(); renderProvaTags(); renderEvoChart(); renderHist();
  renderRecordes(); renderComparativo(); renderRecent();
  renderIndicesAtletaTabs(); renderCampTabs(); renderCategoriaTabs(); renderIndicesTable();
}

/* ── Tab bar navigation ────────────────────────────────────────── */
document.querySelectorAll("[data-section]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const sec=btn.dataset.section;
    document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    $(`s-${sec}`).classList.add("active");
    document.querySelectorAll(`[data-section="${sec}"]`).forEach(b=>b.classList.add("active"));

    /* iOS 26: tab bar shrinks on scroll into content */
    if(sec==="recordes") renderRecordes();
    if(sec==="comparativo") renderComparativo();
    if(sec==="config") renderConfig();
    if(sec==="indices") { renderIndicesAtletaTabs(); renderCampTabs(); renderCategoriaTabs(); renderIndicesTable(); }
  });
});

/* sidebar layout — no scroll hide needed */

/* ── Athlete tabs ──────────────────────────────────────────────── */
function buildTabs(){
  ["atabs-desempenho","atabs-recordes"].forEach((cId,idx)=>{
    const c=$(cId);
    c.innerHTML=atletas.map(a=>{
      const active=(idx===0?a.id===curAtleta:a.id===curAtletaRec)?" act":"";
      return `<button class="atab${active}" data-aid="${a.id}" data-ctx="${idx===0?'des':'rec'}">${a.nome}</button>`;
    }).join("");
    c.querySelectorAll(".atab").forEach(b=>b.addEventListener("click",()=>{
      if(b.dataset.ctx==="des") selAtleta(parseInt(b.dataset.aid));
      else selAtletaRec(parseInt(b.dataset.aid));
    }));
  });
}
function refreshTabs(){
  document.querySelectorAll(".atab").forEach(b=>{
    const aid=parseInt(b.dataset.aid);
    const isAct=b.dataset.ctx==="des"?aid===curAtleta:aid===curAtletaRec;
    b.className="atab"+(isAct?" act":"");
  });
}
function selAtleta(id){
  curAtleta=id;
  if(!provasOf(id).includes(curProva)&&provasOf(id).length) curProva=provasOf(id)[0];
  refreshTabs(); renderSummary(); renderProvaTags(); renderEvoChart(); renderHist();
}
function selAtletaRec(id){ curAtletaRec=id; refreshTabs(); renderRecordes(); }

/* ── Summary ───────────────────────────────────────────────────── */
function renderSummary(){
  const rows=resultados[curAtleta]||[];
  const b50=bestTs(rows.filter(r=>r.prova==="Livre 50m"));
  const bC50=bestTs(rows.filter(r=>r.prova==="Costas 50m"));
  const last=[...rows].sort((a,b)=>b.data.localeCompare(a.data))[0];
  const card=(l,v,s="")=>`<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div>${s?`<div class="stat-sub">${s}</div>`:""}</div>`;
  $("summary-cards").innerHTML=
    card("Registros",rows.length,`${provasOf(curAtleta).length} provas`)+
    card("Livre 50m",fmtT(b50),"melhor marca")+
    card("Costas 50m",fmtT(bC50),"melhor marca")+
    card("Última comp",last?.evento||"—",last?fmtDate(last.data):"");
}

/* ── Prova tags ────────────────────────────────────────────────── */
function renderProvaTags(){
  const ps=provasOf(curAtleta);
  $("prova-tags").innerHTML=ps.map(p=>`<button class="ptag${p===curProva?" act":""}" onclick="selProva('${p}',this)">${p}</button>`).join("");
  const sel=$("prova-select-mobile");
  sel.innerHTML=ps.map(p=>`<option${p===curProva?" selected":""}>${p}</option>`).join("");
  sel.onchange=()=>selProva(sel.value,null);
}
function selProva(p,btn){
  curProva=p;
  document.querySelectorAll(".ptag").forEach(b=>b.className="ptag");
  if(btn) btn.classList.add("act");
  const sel=$("prova-select-mobile"); if(sel) sel.value=p;
  renderEvoChart();
}

/* ── Chart ─────────────────────────────────────────────────────── */
function renderEvoChart(){
  const a=atletas.find(x=>x.id===curAtleta);
  const rows=sorted(curAtleta,curProva).filter(r=>r.tempo_segundos!=null);
  if(evoChart){evoChart.destroy();evoChart=null;}
  const ctx=$("evoChart").getContext("2d");
  if(!rows.length){
    ctx.clearRect(0,0,800,260);
    ctx.fillStyle="rgba(255,255,255,0.3)";
    ctx.font="14px -apple-system,sans-serif";
    ctx.textAlign="center";
    ctx.fillText("Nenhum tempo registrado",400,120);
    return;
  }
  const vals=rows.map(r=>r.tempo_segundos);
  const minV=Math.min(...vals), maxV=Math.max(...vals);
  const pad=(maxV-minV)*0.18||5;
  const color=a?.cor||"#007AFF";

  evoChart=new Chart(ctx,{
    type:"line",
    data:{
      labels:rows.map(r=>fmtDate(r.data)),
      datasets:[{
        label:curProva, data:vals,
        borderColor:color,
        backgroundColor:color+"22",
        pointBackgroundColor:vals.map(v=>v===minV?"#FFD60A":color),
        pointRadius:vals.map(v=>v===minV?10:5),
        pointBorderColor:vals.map(v=>v===minV?"rgba(255,214,10,0.6)":color+"88"),
        pointBorderWidth:vals.map(v=>v===minV?2:1),
        fill:true, tension:.38, borderWidth:2
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:"rgba(20,20,40,0.85)",
          borderColor:"rgba(255,255,255,0.15)",
          borderWidth:1,
          titleColor:"rgba(255,255,255,0.6)",
          bodyColor:"#fff",
          padding:12,
          callbacks:{
            label:ctx=>`  ${fmtT(ctx.raw)}`,
            afterLabel:ctx=>{ const r=rows[ctx.dataIndex]; return r.evento?`  ${r.evento}`:""; }
          }
        }
      },
      scales:{
        y:{
          min:Math.max(0,minV-pad), max:maxV+pad, reverse:true,
          ticks:{callback:v=>fmtT(v),color:"rgba(255,255,255,0.45)",font:{family:"monospace",size:11}},
          grid:{color:"rgba(255,255,255,0.06)"},
          border:{display:false}
        },
        x:{
          ticks:{color:"rgba(255,255,255,0.45)",font:{size:11},maxRotation:40,autoSkip:rows.length>12},
          grid:{display:false},
          border:{display:false}
        }
      }
    }
  });
}

/* ── Hist ──────────────────────────────────────────────────────── */
function renderHist(filter=""){
  const rows=(resultados[curAtleta]||[]).slice().sort((a,b)=>b.data.localeCompare(a.data));
  const bm={};
  provasOf(curAtleta).forEach(p=>bm[p]=bestTs(rows.filter(r=>r.prova===p)));
  const low=filter.toLowerCase();
  const f=rows.filter(r=>!low||[r.prova,r.evento,r.obs,r.data].some(v=>v?.toLowerCase().includes(low)));
  $("hist-body").innerHTML=f.map(r=>{
    const isPB=r.tempo_segundos!=null&&r.tempo_segundos===bm[r.prova];
    return `<tr${isPB?' class="pb-row"':''}>
      <td style="white-space:nowrap;color:rgba(255,255,255,0.55)">${fmtDate(r.data)}</td>
      <td>${r.prova}</td>
      <td class="mono">${r.tempo||"—"}${isPB?` <span class="badge badge-pb">PB</span>`:""}</td>
      <td>${catBadge(r.categoria)}</td>
      <td>${piscBadge(r.piscina)}</td>
      <td style="max-width:150px;color:rgba(255,255,255,0.7)">${r.evento||"—"}</td>
      <td style="color:rgba(255,255,255,0.4);font-size:12px">${r.obs||""}</td>
      <td><button class="btn-icon-sm" onclick="openEdit(${r.id})">✎</button></td>
    </tr>`;
  }).join("")||`<tr><td colspan="8" class="empty-row">Nenhum resultado</td></tr>`;
}
$("hist-search").addEventListener("input",e=>renderHist(e.target.value));

/* ── Recordes ──────────────────────────────────────────────────── */
function renderRecordes(){
  const a=atletas.find(x=>x.id===curAtletaRec);
  const rows=resultados[curAtletaRec]||[];
  $("rec-grid").innerHTML=provasOf(curAtletaRec).map(prova=>{
    const best=rows.filter(r=>r.prova===prova).reduce((b,r)=>(r.tempo_segundos!=null&&(b==null||r.tempo_segundos<b.tempo_segundos))?r:b,null);
    if(!best) return "";
    return `<div class="rec-card">
      <div class="rec-prova">${prova}</div>
      <div class="rec-tempo" style="color:${a?.cor||"#007AFF"}">${fmtT(best.tempo_segundos)}</div>
      <div class="rec-info">
        ${fmtDate(best.data)}${best.evento?" · "+best.evento:""}${best.piscina?" · "+best.piscina+"m":""}
      </div>
      <div style="margin-top:6px">${catBadge(best.categoria)}</div>
    </div>`;
  }).join("")||`<p style="color:rgba(255,255,255,0.3);padding:20px">Nenhum resultado.</p>`;
}

/* ── Comparativo ───────────────────────────────────────────────── */
function renderComparativo(){
  if(atletas.length<2){$("cmp-body").innerHTML=`<tr><td colspan="4" class="empty-row">Necessário 2 atletas.</td></tr>`;return;}
  const a1=atletas[0],a2=atletas[1];
  $("cmp-h1").textContent=a1.nome; $("cmp-h2").textContent=a2.nome;
  const all=[...new Set([...provasOf(a1.id),...provasOf(a2.id)])].sort();
  $("cmp-body").innerHTML=all.map(p=>{
    const b1=bestTs((resultados[a1.id]||[]).filter(r=>r.prova===p));
    const b2=bestTs((resultados[a2.id]||[]).filter(r=>r.prova===p));
    let dc="diff-tie",dt="—";
    if(b1!=null&&b2!=null){const d=+(b2-b1).toFixed(2);dc=d>0?"diff-win":d<0?"diff-lose":"diff-tie";dt=d>0?`+${d}s`:d<0?`${d}s`:"=";}
    return `<tr>
      <td>${p}</td>
      <td class="mono" style="color:#5AC8FA">${b1!=null?fmtT(b1):"—"}</td>
      <td class="mono" style="color:#BDB2FF">${b2!=null?fmtT(b2):"—"}</td>
      <td class="${dc}">${dt}</td>
    </tr>`;
  }).join("");
}

/* ── Form ──────────────────────────────────────────────────────── */
function buildFormAtletas(){$("f-atleta").innerHTML=atletas.map(a=>`<option value="${a.id}">${a.nome}</option>`).join("");}

async function submitForm(e){
  e.preventDefault();
  const btn=$("submit-btn"); btn.disabled=true; btn.textContent="Salvando…";
  const payload={
    atleta_id:parseInt($("f-atleta").value), data:$("f-data").value,
    prova:$("f-prova").value, tempo:$("f-tempo").value.trim()||null,
    piscina:parseInt($("f-pisc").value), categoria:$("f-cat").value||null,
    evento:$("f-evento").value.trim()||null, obs:$("f-obs").value.trim()||null
  };
  if(!payload.data){showToast("Preencha a data",true);btn.disabled=false;btn.textContent="Salvar resultado";return;}
  const res=await fetch("/api/resultados",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(res.ok){
    const novo=await res.json();
    if(!resultados[novo.atleta_id]) resultados[novo.atleta_id]=[];
    resultados[novo.atleta_id].push(novo);
    if(novo.atleta_id===curAtleta){renderSummary();renderProvaTags();renderEvoChart();renderHist();}
    renderRecordes();renderComparativo();renderRecent();
    showToast("✓ Resultado salvo!"); resetForm();
  } else showToast("Erro ao salvar",true);
  btn.disabled=false; btn.textContent="Salvar resultado";
}
function resetForm(){["f-data","f-tempo","f-evento","f-obs"].forEach(id=>$(id).value="");}

/* ── Recent ────────────────────────────────────────────────────── */
function renderRecent(){
  const all=atletas.flatMap(a=>(resultados[a.id]||[]).map(r=>({...r,atletaNome:a.nome})))
    .sort((a,b)=>(b.criado_em||"").localeCompare(a.criado_em||"")).slice(0,20);
  $("recent-body").innerHTML=all.map(r=>`<tr>
    <td style="color:rgba(255,255,255,0.6)">${r.atletaNome}</td>
    <td style="color:rgba(255,255,255,0.5)">${fmtDate(r.data)}</td>
    <td>${r.prova}</td>
    <td class="mono">${r.tempo||"—"}</td>
    <td style="color:rgba(255,255,255,0.6)">${r.evento||"—"}</td>
    <td><button class="btn-icon-sm" onclick="openEdit(${r.id})">✎</button></td>
  </tr>`).join("")||`<tr><td colspan="6" class="empty-row">Nenhum resultado ainda.</td></tr>`;
}

/* ── Edit modal ────────────────────────────────────────────────── */
function openEdit(id){
  const r=Object.values(resultados).flat().find(x=>x.id===id); if(!r) return;
  editingId=id;
  $("e-data").value=r.data||""; $("e-tempo").value=r.tempo||"";
  $("e-pisc").value=r.piscina||50; $("e-cat").value=r.categoria||"";
  $("e-evento").value=r.evento||""; $("e-obs").value=r.obs||"";
  $("modal").classList.add("open");
}
function closeModal(e){if(!e||e.target===$("modal")){$("modal").classList.remove("open");editingId=null;}}
async function submitEdit(e){
  e.preventDefault(); if(!editingId) return;
  const prova=Object.values(resultados).flat().find(x=>x.id===editingId)?.prova;
  const payload={data:$("e-data").value,prova,tempo:$("e-tempo").value.trim()||null,
    piscina:parseInt($("e-pisc").value),categoria:$("e-cat").value||null,
    evento:$("e-evento").value.trim()||null,obs:$("e-obs").value.trim()||null};
  const res=await fetch(`/api/resultados/${editingId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(res.ok){
    const u=await res.json();
    for(const aid in resultados){const i=resultados[aid].findIndex(x=>x.id===editingId);if(i>-1){resultados[aid][i]=u;break;}}
    refreshAll(); showToast("✓ Alteração salva!"); closeModal();
  } else showToast("Erro ao salvar",true);
}
async function deleteResult(){
  if(!editingId||!confirm("Excluir este resultado?")) return;
  const res=await fetch(`/api/resultados/${editingId}`,{method:"DELETE"});
  if(res.ok){
    for(const aid in resultados){const i=resultados[aid].findIndex(x=>x.id===editingId);if(i>-1){resultados[aid].splice(i,1);break;}}
    refreshAll(); showToast("Resultado excluído"); closeModal();
  } else showToast("Erro ao excluir",true);
}
function refreshAll(){renderSummary();renderProvaTags();renderEvoChart();renderHist();renderRecordes();renderComparativo();renderRecent();}

/* ── Toast ─────────────────────────────────────────────────────── */
let toastT;
function showToast(msg,err=false){
  const t=$("toast"); t.textContent=msg;
  t.className="toast"+(err?" err":"")+" show";
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2800);
}

/* ── Mobile: show select on small screens ───────────────────────── */
function checkMobileProva(){
  const isMobile=window.innerWidth<640;
  const tags=$("prova-tags"),sel=$("prova-select-mobile");
  if(tags) tags.style.display=isMobile?"none":"flex";
  if(sel) sel.style.display=isMobile?"block":"none";
}
window.addEventListener("resize",checkMobileProva);

/* ── Boot ──────────────────────────────────────────────────────── */
loadAll().then(function(){ checkMobileProva(); renderConfig(); });

/* ── Configurações ─────────────────────────────────────────────── */
function renderConfig() {
  const el = document.getElementById("atletas-config-list");
  if (!el) return;
  el.innerHTML = atletas.map(a => `
    <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08)">
      <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Atleta ${a.id}</div>
      <div class="form-grid">
        <div class="field">
          <label>Nome curto <span class="hint">(aparece nas abas)</span></label>
          <input type="text" id="cfg-nome-${a.id}" class="glass-input" value="${a.nome}" placeholder="Ex: Ana">
        </div>
        <div class="field">
          <label>Nome completo</label>
          <input type="text" id="cfg-nomec-${a.id}" class="glass-input" value="${a.nome_completo||''}" placeholder="Ex: Ana Clara Silva">
        </div>
      </div>
      <div style="margin-top:12px">
        <button class="btn-glass btn-primary" onclick="salvarAtleta(${a.id})">Salvar</button>
      </div>
    </div>
  `).join("");
}

async function salvarAtleta(id) {
  const nome = document.getElementById("cfg-nome-"+id).value.trim();
  const nomeC = document.getElementById("cfg-nomec-"+id).value.trim();
  if (!nome) { showToast("Nome nao pode ser vazio", true); return; }
  const res = await fetch("/api/atletas/"+id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: nome, nome_completo: nomeC })
  });
  if (res.ok) {
    const updated = await res.json();
    const idx = atletas.findIndex(a => a.id === id);
    if (idx > -1) atletas[idx] = Object.assign({}, atletas[idx], updated);
    buildTabs(); refreshAll();
    showToast("Nome atualizado com sucesso!");
  } else {
    showToast("Erro ao salvar", true);
  }
}

async function adicionarAtleta() {
  const nome = document.getElementById("nova-nome").value.trim();
  const nomeC = document.getElementById("nova-nomec").value.trim();
  if (!nome) { showToast("Preencha o nome da atleta", true); return; }

  const res = await fetch("/api/atletas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: nome, nome_completo: nomeC, cor: "#2e75b6", cor_clara: "#bdd7ee" })
  });
  if (res.ok) {
    const nova = await res.json();
    atletas.push(nova);
    resultados[nova.id] = [];
    document.getElementById("nova-nome").value = "";
    document.getElementById("nova-nomec").value = "";
    buildTabs();
    buildFormAtletas();
    renderConfig();
    showToast("Atleta " + nova.nome + " adicionada!");
  } else {
    showToast("Erro ao adicionar atleta", true);
  }
}

/* ── Índices ────────────────────────────────────────────────────── */
let indices = [];
let curAtletaIdx = null;
let curCampeonato = null;
let curPiscinaIdx = 50;
let curCategoria = null;

async function loadIndices() {
  indices = await fetch("/api/indices").then(r => r.json());
}

function renderIndicesAtletaTabs() {
  const c = document.getElementById("atabs-indices");
  if (!c) return;
  c.innerHTML = atletas.map(a => {
    const act = a.id === curAtletaIdx ? " act" : "";
    return `<button class="atab${act}" data-aid="${a.id}" data-ctx="idx">${a.nome}</button>`;
  }).join("");
  c.querySelectorAll(".atab").forEach(b => b.addEventListener("click", () => {
    curAtletaIdx = parseInt(b.dataset.aid);
    refreshIndicesAtletaTabs();
    renderIndicesTable();
  }));
}

function refreshIndicesAtletaTabs() {
  document.querySelectorAll("[data-ctx='idx']").forEach(b => {
    const act = parseInt(b.dataset.aid) === curAtletaIdx;
    b.className = "atab" + (act ? " act" : "");
  });
}

function getCampeonatos() {
  return [...new Set(indices.map(i => i.campeonato))];
}


function getCategorias() {
  if (!curCampeonato) return [];
  return [...new Set(
    indices.filter(i => i.campeonato === curCampeonato).map(i => i.categoria)
  )].sort();
}

function renderCategoriaTabs() {
  const c = document.getElementById("cat-tabs");
  if (!c) return;
  const cats = getCategorias();
  if (!curCategoria || !cats.includes(curCategoria)) curCategoria = cats[0] || null;
  c.innerHTML = cats.map(cat => {
    const act = cat === curCategoria ? " act" : "";
    return '<button class="ptag' + act + '" onclick="selCategoria(\'' + cat.replace(/'/g,"\'") + '\',this)">' + cat + '</button>';
  }).join("");
}

function selCategoria(cat, btn) {
  curCategoria = cat;
  document.querySelectorAll("#cat-tabs .ptag").forEach(b => b.className = "ptag");
  if (btn) btn.classList.add("act");
  renderIndicesTable();
}

function renderCampTabs() {
  const c = document.getElementById("camp-tabs");
  if (!c) return;
  const camps = getCampeonatos();
  if (!curCampeonato && camps.length) curCampeonato = camps[0];
  c.innerHTML = camps.map(camp => {
    const act = camp === curCampeonato ? " act" : "";
    const safe = camp.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    return `<button class="ptag${act}" onclick="selCampeonato('${safe}',this)">${camp}</button>`;
  }).join("");
  renderCategoriaTabs();
}

function selCampeonato(camp, btn) {
  curCampeonato = camp;
  curCategoria = null;
  document.querySelectorAll("#camp-tabs .ptag").forEach(b => b.className = "ptag");
  if (btn) btn.classList.add("act");
  renderCategoriaTabs();
  renderIndicesTable();
}

function renderIndicesTable() {
  const tbody = document.getElementById("indices-body");
  const title = document.getElementById("indices-panel-title");
  if (!tbody) return;

  // Guard: ensure athlete and campeonato are set
  if (!curAtletaIdx && atletas.length) curAtletaIdx = atletas[0].id;
  const camps = getCampeonatos();
  if (!curCampeonato && camps.length) curCampeonato = camps[0];

  const atletaRows = resultados[curAtletaIdx] || [];
  const atletaNome = atletas.find(a => a.id === curAtletaIdx)?.nome || "—";
  if (title) title.textContent = `${atletaNome} · ${curCampeonato || "—"} · ${curCategoria || ""} · Piscina ${curPiscinaIdx}m`;

  // REPLACED — see below
  // Auto-set categoria if not set
  const _cats = getCategorias();
  if (!curCategoria || !_cats.includes(curCategoria)) curCategoria = _cats[0] || null;

  const filtered = indices.filter(i =>
    i.campeonato === curCampeonato &&
    i.categoria === curCategoria &&
    parseInt(i.piscina) === parseInt(curPiscinaIdx)
  ).sort((a, b) => a.prova.localeCompare(b.prova));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Nenhum índice cadastrado para esta combinação</td></tr>`;
    return;
  }

  // Best time per prova for this athlete
  const bestMap = {};
  provasOf(curAtletaIdx).forEach(p => {
    // match prova name — try exact and piscina-flexible
    const rows = atletaRows.filter(r => r.prova === p);
    const b = rows.reduce((best, r) => (r.tempo_segundos != null && (best == null || r.tempo_segundos < best)) ? r.tempo_segundos : best, null);
    if (b != null) bestMap[p] = b;
  });

  tbody.innerHTML = filtered.map(idx => {
    const best = bestMap[idx.prova];
    const idxTs = idx.tempo_segundos;

    let diffStr = "—", statusHtml = `<span style="color:var(--text3);font-size:12px">Sem marca</span>`;
    let rowStyle = "";

    if (best != null && idxTs != null) {
      const diff = best - idxTs;
      const absDiff = Math.abs(diff).toFixed(2);
      if (diff <= 0) {
        // dentro do índice — tem índice
        diffStr = `<span style="color:#30D158;font-weight:600;font-family:var(--mono)">-${absDiff}s</span>`;
        statusHtml = `<span class="badge" style="background:rgba(48,209,88,0.18);color:#30D158;border:1px solid rgba(48,209,88,0.35)">✓ Tem índice</span>`;
        rowStyle = " style='background:rgba(48,209,88,0.04)'"
      } else {
        // precisa melhorar
        diffStr = `<span style="color:#FF453A;font-weight:600;font-family:var(--mono)">+${absDiff}s</span>`;
        if (diff <= 3) {
          statusHtml = `<span class="badge" style="background:rgba(255,159,10,0.18);color:#FF9F0A;border:1px solid rgba(255,159,10,0.35)">Perto! ${absDiff}s</span>`;
          rowStyle = " style='background:rgba(255,159,10,0.04)'"
        } else {
          statusHtml = `<span class="badge" style="background:rgba(255,69,58,0.14);color:#FF453A;border:1px solid rgba(255,69,58,0.3)">Faltam ${absDiff}s</span>`;
        }
      }
    } else if (best == null && idxTs != null) {
      statusHtml = `<span style="color:var(--text3);font-size:12px">Sem marca registrada</span>`;
    }

    return `<tr${rowStyle}>
      <td style="font-weight:500">${idx.prova}</td>
      <td class="mono" style="color:rgba(255,255,255,0.7)">${idx.tempo || "—"}</td>
      <td class="mono" style="color:#5AC8FA">${best != null ? fmtT(best) : "—"}</td>
      <td>${diffStr}</td>
      <td>${statusHtml}</td>
      <td><button class="btn-icon-sm" onclick="openEditIndice(${idx.id})">✎</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty-row">Nenhum dado</td></tr>`;
}

function openEditIndice(id) {
  const idx = indices.find(i => i.id === id);
  if (!idx) return;
  editingId = id;
  // Reuse modal fields
  document.getElementById("e-data").closest(".form-grid").innerHTML = `
    <div class="field full" style="margin-bottom:8px">
      <div style="font-size:13px;font-weight:600;color:var(--text2)">${idx.prova}</div>
      <div style="font-size:11px;color:var(--text3)">${idx.campeonato} · Cat: ${idx.categoria} · ${idx.piscina}m</div>
    </div>
    <div class="field full">
      <label>Índice mínimo <span class="hint">MM:SS.cc</span></label>
      <input type="text" id="e-indice-tempo" class="glass-input" value="${idx.tempo||''}" placeholder="01:23.45">
    </div>
  `;
  document.querySelector("#modal form").onsubmit = submitEditIndice;
  document.querySelector("#modal .modal-title").textContent = "Editar índice";
  document.querySelector("#modal .btn-danger").style.display = "none";
  document.getElementById("modal").classList.add("open");
}

async function submitEditIndice(e) {
  e.preventDefault();
  if (!editingId) return;
  const tempo = document.getElementById("e-indice-tempo")?.value.trim();
  const res = await fetch(`/api/indices/${editingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempo })
  });
  if (res.ok) {
    const updated = await res.json();
    const idx2 = indices.findIndex(i => i.id === editingId);
    if (idx2 > -1) indices[idx2] = updated;
    renderIndicesTable();
    showToast("✓ Índice atualizado!");
    closeModal();
    // Restore modal
    restoreModal();
  } else {
    showToast("Erro ao salvar", true);
  }
}

function restoreModal() {
  document.querySelector("#modal .modal-title").textContent = "Editar resultado";
  document.querySelector("#modal .btn-danger").style.display = "";
  document.querySelector("#modal form").onsubmit = submitEdit;
  document.querySelector("#modal form .form-grid").innerHTML = `
    <div class="field"><label>Data</label><input type="date" id="e-data" class="glass-input"></div>
    <div class="field"><label>Tempo</label><input type="text" id="e-tempo" class="glass-input" placeholder="01:23.45"></div>
    <div class="field"><label>Piscina</label><select id="e-pisc" class="glass-select"><option value="25">25m</option><option value="50">50m</option></select></div>
    <div class="field"><label>Categoria</label><select id="e-cat" class="glass-select"><option value="">—</option><option value="P1">P1</option><option value="P2">P2</option><option value="INF">INF</option></select></div>
    <div class="field full"><label>Evento</label><input type="text" id="e-evento" class="glass-input"></div>
    <div class="field full"><label>Obs</label><input type="text" id="e-obs" class="glass-input"></div>
  `;
}

// Override closeModal to restore modal when needed
const _origClose = closeModal;
function closeModal(e) {
  if (!e || e.target === document.getElementById("modal")) {
    document.getElementById("modal").classList.remove("open");
    restoreModal();
    editingId = null;
  }
}

// Piscina selector
document.addEventListener("DOMContentLoaded", () => {
  const psel = document.getElementById("pisc-indices");
  if (psel) psel.addEventListener("change", () => {
    curPiscinaIdx = parseInt(psel.value);
    renderIndicesTable();
  });
});
