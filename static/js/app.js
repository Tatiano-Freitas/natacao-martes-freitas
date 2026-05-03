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
  renderSummary(); renderProvaTags();
  try { renderEvoChart(); } catch(e) { console.warn("renderEvoChart falhou:", e); }
  renderHist();
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
    if(sec==="dia-da-prova") initDiaDaProva();
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
  const f=rows.filter(r=>!low||[r.prova,r.evento,r.obs,r.data,r.periodo].some(v=>v?.toLowerCase().includes(low)));
  $("hist-body").innerHTML=f.map(r=>{
    const isPB=r.tempo_segundos!=null&&r.tempo_segundos===bm[r.prova];
    return `<tr${isPB?' class="pb-row"':''}>
      <td style="white-space:nowrap;color:rgba(255,255,255,0.55)">${fmtDate(r.data)}</td>
      <td>${r.prova}</td>
      <td class="mono">${r.tempo||"—"}${isPB?` <span class="badge badge-pb">PB</span>`:""}</td>
      <td>${catBadge(r.categoria)}</td>
      <td>${piscBadge(r.piscina)}</td>
      <td>${periodoBadge(r.periodo)}</td>
      <td style="max-width:150px;color:rgba(255,255,255,0.7)">${r.evento||"—"}</td>
      <td style="color:rgba(255,255,255,0.4);font-size:12px">${r.obs||""}</td>
      <td><button class="btn-icon-sm" onclick="openEdit(${r.id})">✎</button></td>
    </tr>`;
  }).join("")||`<tr><td colspan="9" class="empty-row">Nenhum resultado</td></tr>`;
}

/* Badge colorido para período da prova */
function periodoBadge(p){
  if(!p) return `<span style="color:rgba(255,255,255,0.25)">—</span>`;
  const cores = {
    "Manhã": {bg:"rgba(255, 204, 0, 0.18)",  fg:"#FFCC00", icon:"☀"},
    "Tarde": {bg:"rgba(255, 149, 0, 0.18)",  fg:"#FF9500", icon:"⛅"},
    "Noite": {bg:"rgba(94, 92, 230, 0.20)",  fg:"#8E8FE9", icon:"🌙"},
  };
  const c = cores[p] || {bg:"rgba(255,255,255,0.05)", fg:"rgba(255,255,255,0.5)", icon:""};
  return `<span class="badge" style="background:${c.bg};color:${c.fg};font-size:10px;padding:2px 7px;border-radius:8px;white-space:nowrap">${c.icon} ${p}</span>`;
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
let cmpPeriodo = "";

function setCmpPeriodo(p){
  cmpPeriodo = p;
  document.querySelectorAll("[data-cmp-periodo]").forEach(b => {
    b.classList.toggle("active", b.dataset.cmpPeriodo === p);
  });
  renderComparativo();
}

function renderComparativo(){
  if(atletas.length<2){$("cmp-body").innerHTML=`<tr><td colspan="4" class="empty-row">Necessário 2 atletas.</td></tr>`;return;}
  const a1=atletas[0],a2=atletas[1];
  $("cmp-h1").textContent=a1.nome; $("cmp-h2").textContent=a2.nome;

  // aplica filtro de período (vazio = todos)
  const filtraPeriodo = arr => cmpPeriodo ? arr.filter(r => r.periodo === cmpPeriodo) : arr;

  const all=[...new Set([...provasOf(a1.id),...provasOf(a2.id)])].sort();
  const linhas = all.map(p=>{
    const b1=bestTs(filtraPeriodo((resultados[a1.id]||[]).filter(r=>r.prova===p)));
    const b2=bestTs(filtraPeriodo((resultados[a2.id]||[]).filter(r=>r.prova===p)));
    if (cmpPeriodo && b1==null && b2==null) return null;
    let dc="diff-tie",dt="—";
    if(b1!=null&&b2!=null){const d=+(b2-b1).toFixed(2);dc=d>0?"diff-win":d<0?"diff-lose":"diff-tie";dt=d>0?`+${d}s`:d<0?`${d}s`:"=";}
    return `<tr>
      <td>${p}</td>
      <td class="mono" style="color:#5AC8FA">${b1!=null?fmtT(b1):"—"}</td>
      <td class="mono" style="color:#BDB2FF">${b2!=null?fmtT(b2):"—"}</td>
      <td class="${dc}">${dt}</td>
    </tr>`;
  }).filter(Boolean);
  $("cmp-body").innerHTML = linhas.join("") || `<tr><td colspan="4" class="empty-row">Nenhum resultado ${cmpPeriodo?"no período "+cmpPeriodo:""}.</td></tr>`;
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
    evento:$("f-evento").value.trim()||null, obs:$("f-obs").value.trim()||null,
    periodo:$("f-periodo")?.value||null
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
function resetForm(){["f-data","f-tempo","f-evento","f-obs"].forEach(id=>$(id).value="");const p=$("f-periodo");if(p)p.value="";}

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
  const p=$("e-periodo"); if(p) p.value=r.periodo||"";
  $("modal").classList.add("open");
}
function closeModal(e){if(!e||e.target===$("modal")){$("modal").classList.remove("open");editingId=null;}}
async function submitEdit(e){
  e.preventDefault(); if(!editingId) return;
  const prova=Object.values(resultados).flat().find(x=>x.id===editingId)?.prova;
  const payload={data:$("e-data").value,prova,tempo:$("e-tempo").value.trim()||null,
    piscina:parseInt($("e-pisc").value),categoria:$("e-cat").value||null,
    evento:$("e-evento").value.trim()||null,obs:$("e-obs").value.trim()||null,
    periodo:$("e-periodo")?.value||null};
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
/* IMPORTANTE: o boot real está no final do arquivo, depois das reatribuições
   de loadAll/initUI feitas pelo bloco "Competições + Nutrição". Não chamamos
   loadAll() aqui pra evitar usar a versão antiga (sem competições). */

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
    <div class="field"><label>Período</label><select id="e-periodo" class="glass-select"><option value="">—</option><option value="Manhã">☀ Manhã</option><option value="Tarde">⛅ Tarde</option><option value="Noite">🌙 Noite</option></select></div>
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

/* ══════════════════════════════════════════════════════════════
   COMPETIÇÕES
   ══════════════════════════════════════════════════════════════ */
let competicoes = [];
let calAno = new Date().getFullYear();
let calMes = new Date().getMonth();
let editingCompId = null;
let atletas_sel_comp = [];

async function loadCompeticoes() {
  competicoes = await fetch("/api/competicoes").then(r => r.json());
}

/* ── Calendário ─────────────────────────────────────────────── */
function renderCalendario() {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dias  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  document.getElementById("cal-titulo").textContent = `${meses[calMes]} ${calAno}`;

  const hoje = new Date();
  const primeiroDia = new Date(calAno, calMes, 1).getDay();
  const totalDias = new Date(calAno, calMes+1, 0).getDate();

  // Header dias da semana
  let html = `<div class="cal-header">${dias.map(d=>`<div class="cal-dow">${d}</div>`).join("")}</div>`;
  html += `<div class="cal-grid-days">`;

  // Dias do mês anterior
  const diasMesAnt = new Date(calAno, calMes, 0).getDate();
  for (let i = primeiroDia - 1; i >= 0; i--) {
    html += `<div class="cal-day outro-mes"><span class="cal-num">${diasMesAnt - i}</span></div>`;
  }

  // Dias do mês atual
  for (let d = 1; d <= totalDias; d++) {
    const isHoje = d === hoje.getDate() && calMes === hoje.getMonth() && calAno === hoje.getFullYear();
    const dataStr = `${calAno}-${String(calMes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    // Competições deste dia
    const compsHoje = competicoes.filter(c => {
      const ini = c.data_inicio, fim = c.data_fim || c.data_inicio;
      return dataStr >= ini && dataStr <= fim;
    });

    const evs = compsHoje.map(c =>
      `<span class="cal-event ev-${c.status}" onclick="event.stopPropagation();abrirDetComp(${c.id})">${c.nome}</span>`
    ).join("");

    html += `<div class="cal-day${isHoje?" hoje":""}">
      <span class="cal-num">${d}</span>${evs}
    </div>`;
  }

  // Dias do próximo mês
  const totalCelulas = primeiroDia + totalDias;
  const resto = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);
  for (let i = 1; i <= resto; i++) {
    html += `<div class="cal-day outro-mes"><span class="cal-num">${i}</span></div>`;
  }
  html += `</div>`;
  document.getElementById("cal-grid").innerHTML = html;

  renderListaComps();
}

function renderListaComps() {
  const mes = String(calMes+1).padStart(2,"0");
  const prefix = `${calAno}-${mes}`;
  const doMes = competicoes.filter(c =>
    c.data_inicio.startsWith(prefix) || (c.data_fim && c.data_fim.startsWith(prefix))
  );
  const label = document.getElementById("cal-lista-label");
  if (label) label.textContent = doMes.length ? `${doMes.length} competição(ões) neste mês` : "Nenhuma competição neste mês";

  document.getElementById("cal-lista").innerHTML = doMes.map(c => {
    const atl = (c.atletas||[]).map(id => atletas.find(a=>a.id===id)?.nome||"").filter(Boolean).join(", ");
    return `<div class="comp-card ${c.status}" onclick="abrirDetComp(${c.id})">
      <div class="comp-nome">${c.nome}</div>
      <div class="comp-meta">
        <span>📅 ${fmtDate(c.data_inicio)}${c.data_fim&&c.data_fim!==c.data_inicio?" → "+fmtDate(c.data_fim):""}</span>
        ${c.local?`<span>📍 ${c.local}</span>`:""}
        ${atl?`<span>🏊 ${atl}</span>`:""}
        <span class="badge ${c.status==="confirmado"?"badge-inf":c.status==="realizado"?"badge-pb":c.status==="cancelado"?"btn-danger":"badge-p1"}">${c.status}</span>
      </div>
      ${c.obs?`<div style="font-size:11px;color:var(--text3);margin-top:6px">${c.obs}</div>`:""}
    </div>`;
  }).join("") || "";
}

function mesAnterior() {
  calMes--; if (calMes < 0) { calMes = 11; calAno--; }
  renderCalendario();
}
function proximoMes() {
  calMes++; if (calMes > 11) { calMes = 0; calAno++; }
  renderCalendario();
}

/* ── Modal competição ───────────────────────────────────────── */
function abrirModalComp() {
  editingCompId = null;
  document.getElementById("modal-comp-title").textContent = "Nova competição";
  document.getElementById("mc-nome").value = "";
  document.getElementById("mc-data-ini").value = "";
  document.getElementById("mc-data-fim").value = "";
  document.getElementById("mc-local").value = "";
  document.getElementById("mc-cat").value = "";
  document.getElementById("mc-status").value = "planejado";
  document.getElementById("mc-obs").value = "";
  document.getElementById("mc-del-btn").style.display = "none";
  atletas_sel_comp = [];
  renderAtletasCheck([]);
  document.getElementById("modal-comp").classList.add("open");
}

async function abrirComp(id) {
  const c = competicoes.find(x => x.id === id);
  if (!c) return;
  editingCompId = id;
  document.getElementById("modal-comp-title").textContent = "Editar competição";
  document.getElementById("mc-nome").value = c.nome || "";
  document.getElementById("mc-data-ini").value = c.data_inicio || "";
  document.getElementById("mc-data-fim").value = c.data_fim || "";
  document.getElementById("mc-local").value = c.local || "";
  document.getElementById("mc-cat").value = c.categoria || "";
  document.getElementById("mc-status").value = c.status || "planejado";
  document.getElementById("mc-obs").value = c.obs || "";
  if (document.getElementById("mc-piscina")) document.getElementById("mc-piscina").value = c.piscina || "25";
  document.getElementById("mc-del-btn").style.display = "";
  atletas_sel_comp = c.atletas || [];
  renderAtletasCheck(atletas_sel_comp);
  // Load and show provas
  await renderProvasComp(id, c);
  document.getElementById("modal-comp").classList.add("open");
}

async function renderProvasComp(compId, comp) {
  const provas = await fetch(`/api/competicoes/${compId}/provas`).then(r => r.json());
  if (!provas.length) { 
    document.getElementById("mc-provas-section").style.display = "none";
    return;
  }
  document.getElementById("mc-provas-section").style.display = "";
  const atlNomes = {};
  atletas.forEach(a => atlNomes[a.id] = a.nome);
  
  document.getElementById("mc-provas-lista").innerHTML = provas.map(p => {
    const statusCls = p.status === "confirmada" ? "st-confirmada" : "st-a_definir";
    const statusLabel = p.status === "confirmada" ? "✓ Confirmada" : "A definir";
    return `<div class="prova-comp-row">
      <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:#C9A84C;min-width:48px">${p.horario || "—"}</span>
      <span style="flex:1;font-size:13px;font-weight:500">${p.prova}</span>
      <span style="font-size:11px;color:var(--text3);margin-right:8px">${atlNomes[p.atleta_id] || ""}</span>
      <span class="status-badge ${statusCls}">${statusLabel}</span>
      <button class="btn-icon-sm" onclick="toggleStatusProva(${p.id}, '${p.status}', this)" title="Alternar status">⇄</button>
    </div>`;
  }).join("");
}

async function toggleStatusProva(pid, curStatus, btn) {
  const novoStatus = curStatus === "confirmada" ? "a_definir" : "confirmada";
  // Find prova data
  const row = btn.closest(".prova-comp-row");
  await fetch(`/api/provas/${pid}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      prova: row.children[1].textContent,
      horario: row.children[0].textContent === "—" ? "" : row.children[0].textContent,
      status: novoStatus,
      obs: ""
    })
  });
  if (editingCompId) await renderProvasComp(editingCompId, {});
  showToast(novoStatus === "confirmada" ? "✓ Prova confirmada!" : "Prova marcada como a definir");
}

function renderAtletasCheck(selecionados) {
  const c = document.getElementById("mc-atletas");
  c.innerHTML = atletas.map(a => {
    const sel = selecionados.includes(a.id);
    return `<label class="atleta-check${sel?" sel":""}" onclick="toggleAtletaComp(${a.id},this)">
      <input type="checkbox"${sel?" checked":""}> ${a.nome}
    </label>`;
  }).join("");
}

function toggleAtletaComp(id, el) {
  if (atletas_sel_comp.includes(id)) {
    atletas_sel_comp = atletas_sel_comp.filter(x => x !== id);
    el.classList.remove("sel");
  } else {
    atletas_sel_comp.push(id);
    el.classList.add("sel");
  }
}

async function salvarComp() {
  const payload = {
    nome: document.getElementById("mc-nome").value.trim(),
    data_inicio: document.getElementById("mc-data-ini").value,
    data_fim: document.getElementById("mc-data-fim").value,
    local: document.getElementById("mc-local").value.trim(),
    categoria: document.getElementById("mc-cat").value,
    piscina: parseInt(document.getElementById("mc-piscina")?.value || "25"),
    status: document.getElementById("mc-status").value,
    obs: document.getElementById("mc-obs").value.trim(),
    atletas: atletas_sel_comp
  };
  if (!payload.nome || !payload.data_inicio) { showToast("Preencha nome e data", true); return; }

  const url = editingCompId ? `/api/competicoes/${editingCompId}` : "/api/competicoes";
  const method = editingCompId ? "PUT" : "POST";
  const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });

  if (res.ok) {
    await loadCompeticoes();
    renderCalendario();
    updateNutCompSelect();
    closeModalComp();
    showToast(editingCompId ? "✓ Competição atualizada!" : "✓ Competição adicionada!");
  } else showToast("Erro ao salvar", true);
}

async function deletarComp() {
  if (!editingCompId || !confirm("Excluir esta competição?")) return;
  await fetch(`/api/competicoes/${editingCompId}`, {method:"DELETE"});
  await loadCompeticoes();
  renderCalendario();
  closeModalComp();
  showToast("Competição excluída");
}

function closeModalComp(e) {
  if (!e || e.target === document.getElementById("modal-comp"))
    document.getElementById("modal-comp").classList.remove("open");
}

/* ══════════════════════════════════════════════════════════════
   NUTRIÇÃO
   ══════════════════════════════════════════════════════════════ */
let nutricaoPlanos = [];
let curNutTab = "base";
let nutItems = [];

async function loadNutricao() {
  nutricaoPlanos = await fetch("/api/nutricao").then(r => r.json());
}

function selNutTab(tab, btn) {
  curNutTab = tab;
  document.querySelectorAll("#s-nutricao .ptag").forEach(b => b.className = "ptag");
  btn.classList.add("act");
  document.getElementById("nut-base-section").style.display = tab === "base" ? "" : "none";
  document.getElementById("nut-comp-section").style.display = tab === "competicao" ? "" : "none";
}

function renderNutricao() {
  const base = nutricaoPlanos.filter(p => p.tipo === "base");
  const momentoLabel = {pre:"Pré-prova",entre:"Entre provas",pos:"Pós-prova",manha:"Manhã do dia",noite_anterior:"Noite anterior"};

  document.getElementById("nut-lista").innerHTML = base.map(p => {
    const atl = atletas.find(a => a.id === p.atleta_id);
    const items = (p.items||[]).map(i =>
      `<div class="nut-item-row">
        <span class="nut-horario">${i.horario||"—"}</span>
        <span style="flex:1">${i.item}</span>
        <span class="nut-qtd">${i.quantidade||""}</span>
      </div>`
    ).join("");
    return `<div class="nut-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div class="nut-momento">${momentoLabel[p.momento]||p.momento||"Geral"}</div>
          <div style="font-size:14px;font-weight:600">${p.titulo}</div>
          ${atl?`<div style="font-size:11px;color:var(--text3);margin-top:2px">👤 ${atl.nome}</div>`:`<div style="font-size:11px;color:var(--text3);margin-top:2px">Todas as atletas</div>`}
        </div>
        <button class="btn-icon-sm" onclick="deletarNut(${p.id})">🗑</button>
      </div>
      ${p.descricao?`<div style="font-size:12px;color:var(--text3);margin-bottom:8px">${p.descricao}</div>`:""}
      ${items}
    </div>`;
  }).join("") || `<div class="glass-card"><div class="glass-card-inner"><p style="color:var(--text3);font-size:13px">Nenhum plano nutricional cadastrado ainda.</p></div></div>`;
}

function updateNutCompSelect() {
  const sel = document.getElementById("nut-comp-select");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecione uma competição —</option>` +
    competicoes.map(c => `<option value="${c.id}">${c.nome} (${fmtDate(c.data_inicio)})</option>`).join("");
}

async function loadNutComp(cid) {
  if (!cid) { document.getElementById("nut-comp-lista").innerHTML = ""; return; }
  const comp = competicoes.filter(p => p.tipo === "competicao" && p.competicao_id == cid);
  // For now show base plans as placeholder
  document.getElementById("nut-comp-lista").innerHTML =
    `<p style="color:var(--text3);font-size:13px">Planos específicos para esta competição aparecerão aqui.</p>`;
}

/* Modal nutrição */
function abrirModalNut() {
  nutItems = [];
  document.getElementById("mn-titulo").value = "";
  document.getElementById("mn-tipo").value = "base";
  document.getElementById("mn-momento").value = "pre";
  document.getElementById("mn-desc").value = "";
  document.getElementById("mn-atleta").innerHTML =
    `<option value="">Todas</option>` + atletas.map(a=>`<option value="${a.id}">${a.nome}</option>`).join("");
  document.getElementById("mn-items").innerHTML = "";
  document.getElementById("modal-nut").classList.add("open");
}

function addItemNut() {
  const idx = nutItems.length;
  nutItems.push({horario:"",item:"",quantidade:""});
  const el = document.createElement("div");
  el.className = "nut-item-input";
  el.id = `nut-item-${idx}`;
  el.innerHTML = `
    <input type="text" class="glass-input" placeholder="08:00" oninput="nutItems[${idx}].horario=this.value" style="height:34px;font-size:13px">
    <input type="text" class="glass-input" placeholder="Alimento / suplemento" oninput="nutItems[${idx}].item=this.value" style="height:34px;font-size:13px">
    <input type="text" class="glass-input" placeholder="Qtd" oninput="nutItems[${idx}].quantidade=this.value" style="height:34px;font-size:13px">
  `;
  document.getElementById("mn-items").appendChild(el);
}

async function salvarNut() {
  const payload = {
    titulo: document.getElementById("mn-titulo").value.trim(),
    tipo: document.getElementById("mn-tipo").value,
    atleta_id: document.getElementById("mn-atleta").value || null,
    momento: document.getElementById("mn-momento").value,
    descricao: document.getElementById("mn-desc").value.trim(),
    items: nutItems.filter(i => i.item.trim())
  };
  if (!payload.titulo) { showToast("Preencha o título", true); return; }
  const res = await fetch("/api/nutricao", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if (res.ok) {
    await loadNutricao(); renderNutricao();
    closeModalNut(); showToast("✓ Plano salvo!");
  } else showToast("Erro ao salvar", true);
}

async function deletarNut(id) {
  if (!confirm("Excluir este plano?")) return;
  await fetch(`/api/nutricao/${id}`, {method:"DELETE"});
  await loadNutricao(); renderNutricao();
  showToast("Plano excluído");
}

function closeModalNut(e) {
  if (!e || e.target === document.getElementById("modal-nut"))
    document.getElementById("modal-nut").classList.remove("open");
}

/* ══════════════════════════════════════════════════════════════
   INIT PATCH
   ══════════════════════════════════════════════════════════════ */
const _origLoadAll = loadAll;
loadAll = async function() {
  atletas = await fetch("/api/atletas").then(r=>r.json());
  for(const a of atletas) resultados[a.id] = await fetch(`/api/resultados/${a.id}`).then(r=>r.json());
  await loadIndices();
  await loadCompeticoes();
  await loadNutricao();
  curAtleta = atletas[0]?.id;
  curAtletaRec = atletas[0]?.id;
  curAtletaIdx = atletas[0]?.id;
  if(!provasOf(curAtleta).includes(curProva)&&provasOf(curAtleta).length) curProva=provasOf(curAtleta)[0];
  initUI();
};

const _origInitUI = initUI;
initUI = function() {
  _origInitUI();
  renderCalendario();
  renderNutricao();
  updateNutCompSelect();
};

const _origGoTo = null;
document.querySelectorAll("[data-section]").forEach(btn => {
  const old = btn.onclick;
});
// Patch section nav for new sections
document.querySelectorAll("[data-section]").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    const sec=btn.dataset.section;
    if(sec==="competicoes") {
      // defesa: se array competicoes estiver vazio (ex: boot falhou parcialmente), recarrega
      if (!competicoes || competicoes.length === 0) await loadCompeticoes();
      renderCalendario();
    }
    if(sec==="nutricao") { renderNutricao(); updateNutCompSelect(); }
  });
});

/* ── Boot real (após reatribuições) ────────────────────────────── */
loadAll().then(function(){ checkMobileProva(); renderConfig(); });

/* ══════════════════════════════════════════════════════════════
   DETALHE COMPETIÇÃO + PROVAS
   ══════════════════════════════════════════════════════════════ */
let provasComp = [];
let detCompId = null;

async function abrirDetComp(id) {
  detCompId = id;
  editingCompId = id;
  const c = competicoes.find(x => x.id === id);
  if (!c) return;

  document.getElementById("mcd-titulo").textContent = c.nome;
  const atl = (c.atletas||[]).map(id => atletas.find(a=>a.id===id)?.nome||"").filter(Boolean).join(" · ");
  document.getElementById("mcd-meta").innerHTML =
    `📅 ${fmtDate(c.data_inicio)}${c.data_fim&&c.data_fim!==c.data_inicio?" → "+fmtDate(c.data_fim):""}` +
    (c.local ? `  &nbsp;·&nbsp;  📍 ${c.local}` : "") +
    (atl ? `  &nbsp;·&nbsp;  🏊 ${atl}` : "");

  // Populate atleta select
  const atlIds = c.atletas || [];
  document.getElementById("np-atleta").innerHTML =
    atletas.filter(a => atlIds.includes(a.id))
           .map(a => `<option value="${a.id}">${a.nome}</option>`).join("") ||
    atletas.map(a => `<option value="${a.id}">${a.nome}</option>`).join("");

  // Populate data select with all days of the competition
  const dias = diasDaCompeticao(c);
  const selData = document.getElementById("np-data");
  if (selData) {
    selData.innerHTML = '<option value="">— escolher —</option>' +
      dias.map(d => `<option value="${d}">${formatarDataBr(d)}</option>`).join("");
    if (dias.length === 1) selData.value = dias[0]; // pré-seleciona se só tem 1 dia
  }

  // Load provas
  provasComp = await fetch(`/api/competicoes/${id}/provas`).then(r => r.json());
  renderProvasComp(c);

  document.getElementById("modal-comp-det").classList.add("open");
}

function renderProvasComp(c) {
  const atlIds = c.atletas && c.atletas.length ? c.atletas : atletas.map(a => a.id);
  let html = "";
  const provaIcon = (p) => {
    if (!p) return "🏊";
    const s = p.toLowerCase();
    if (s.includes("costas"))    return "🔄";
    if (s.includes("peito"))     return "🐸";
    if (s.includes("borboleta")) return "🦋";
    if (s.includes("medley"))    return "⭐";
    return "🏊";
  };

  for (const aid of atlIds) {
    const atl = atletas.find(a => a.id === aid);
    if (!atl) continue;
    const provasAtl = provasComp.filter(p => p.atleta_id === aid)
                                .sort((a,b) => (a.num_prova||99) - (b.num_prova||99));

    html += `<div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px;
                  display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${atl.cor||'#2e75b6'};display:inline-block"></span>
        ${atl.nome}
        <span style="font-size:11px;color:var(--text3);font-weight:400">${provasAtl.length} prova(s)</span>
      </div>`;

    if (provasAtl.length === 0) {
      html += `<div style="font-size:12px;color:var(--text3);padding:8px 0">Nenhuma prova adicionada ainda.</div>`;
    } else {
      html += provasAtl.map(p => `
        <div class="prova-comp-row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:10px 0">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span style="font-size:18px">${provaIcon(p.prova)}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--text1)">
                ${p.num_prova ? `<span style="color:var(--text3);font-size:11px">#${p.num_prova}</span> ` : ""}
                ${p.prova}
                ${p.etapa ? `<span style="color:var(--text3);font-size:11px"> · ${p.etapa}</span>` : ""}
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">
                ${p.data_prova ? `<span>📅 ${formatarDataBr(p.data_prova)}</span>` : ""}
                ${p.horario_prova || p.horario ? `<span>🕐 ${p.horario_prova || p.horario}</span>` : ""}
                ${p.serie ? `<span>📋 ${p.serie}ª série</span>` : ""}
                ${p.raia  ? `<span>🏊 Raia ${p.raia}</span>` : ""}
                ${p.tempo_inscricao ? `<span>⏱ Insc: <code style="color:#FFD60A">${p.tempo_inscricao}</code></span>` : ""}
                ${p.tempo_final     ? `<span>🏅 <code style="color:#34C759">${p.tempo_final}</code>${p.colocacao ? " · " + p.colocacao : ""}</span>` : ""}
              </div>
            </div>
            <div style="display:flex;gap:4px">
              <span class="status-badge st-${p.status}">${p.status === "a_definir" ? "A definir" : p.status === "realizada" ? "Realizada" : "Confirmada"}</span>
              <button class="btn-icon-sm" onclick="toggleStatusProva(${p.id})" title="Alternar status">⇄</button>
              <button class="btn-icon-sm" onclick="abrirModalProvaEdit(${p.id})" title="Editar prova">✎</button>
              <button class="btn-icon-sm" onclick="lancarTempoProva(${p.id})" title="Lançar tempo final">🏅</button>
              <button class="btn-icon-sm" onclick="deletarProvaComp(${p.id})" title="Remover">✕</button>
            </div>
          </div>
        </div>`).join("");
    }
    html += `</div>`;
  }

  document.getElementById("mcd-atletas-provas").innerHTML = html;
}

async function adicionarProvaComp() {
  const atleta_id = parseInt(document.getElementById("np-atleta").value);
  const prova     = document.getElementById("np-prova").value;
  const horario   = document.getElementById("np-horario").value;
  const status    = document.getElementById("np-status").value;
  const etapa     = document.getElementById("np-etapa")?.value || "";
  const num_prova = parseInt(document.getElementById("np-num")?.value) || null;
  const serie     = parseInt(document.getElementById("np-serie")?.value) || null;
  const raia      = parseInt(document.getElementById("np-raia")?.value) || null;
  const tempo_inscricao = document.getElementById("np-tinsc")?.value?.trim() || "";

  const horario_prova = document.getElementById("np-horario")?.value || "";
  const data_prova = document.getElementById("np-data")?.value || "";
  const res = await fetch(`/api/competicoes/${detCompId}/provas`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({atleta_id, prova, horario: horario_prova, status, etapa, num_prova, serie, raia, tempo_inscricao, horario_prova, data_prova})
  });

  if (res.ok) {
    // Limpar campos de balizamento
    ["np-num","np-serie","np-raia","np-tinsc"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const el = document.getElementById("np-etapa");
    if (el) el.value = "";
    const elData = document.getElementById("np-data");
    if (elData) elData.value = "";

    provasComp = await fetch(`/api/competicoes/${detCompId}/provas`).then(r => r.json());
    const c = competicoes.find(x => x.id === detCompId);
    renderProvasComp(c);
    showToast(`✓ ${prova} adicionada!`);
  } else showToast("Erro ao adicionar prova", true);
}

async function lancarTempoProva(pid) {
  const p = provasComp.find(x => x.id === pid);
  if (!p) return;
  const tempo = prompt("Tempo final (MM:SS.cc):", p.tempo_final || "");
  if (tempo === null) return;
  const colocacao = prompt("Colocação (ex: 3°):", p.colocacao || "") || "";
  const horario_prova = prompt("Horário da prova (ex: 09:30):", p.horario_prova || p.horario || "") || "";
  const res = await fetch(`/api/provas/${pid}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({...p, status:"realizada", tempo_final:tempo.trim(), colocacao, horario_prova, horario:horario_prova})
  });
  if (res.ok) {
    provasComp = await fetch(`/api/competicoes/${detCompId}/provas`).then(r => r.json());
    const c = competicoes.find(x => x.id === detCompId);
    renderProvasComp(c);
    showToast("🏅 Resultado salvo!");
  }
}

async function toggleStatusProva(pid) {
  const p = provasComp.find(x => x.id === pid);
  if (!p) return;
  const novoStatus = p.status === "a_definir" ? "confirmada" : "a_definir";
  const res = await fetch(`/api/provas/${pid}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({...p, status: novoStatus})
  });
  if (res.ok) {
    provasComp = await fetch(`/api/competicoes/${detCompId}/provas`).then(r => r.json());
    const c = competicoes.find(x => x.id === detCompId);
    renderProvasComp(c);
  }
}

async function deletarProvaComp(pid) {
  await fetch(`/api/provas/${pid}`, {method:"DELETE"});
  provasComp = provasComp.filter(p => p.id !== pid);
  const c = competicoes.find(x => x.id === detCompId);
  renderProvasComp(c);
  showToast("Prova removida");
}

function closeModalCompDet(e) {
  if (!e || e.target === document.getElementById("modal-comp-det"))
    document.getElementById("modal-comp-det").classList.remove("open");
}


/* ═══════════════════════════════════════════════════════════════════════ */
/* DIA DA PROVA + IMPORTAÇÃO DE PDF                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

let ddpProvas = [];          // provas da competição selecionada
let ddpNutItems = [];        // itens de nutrição da competição
let importPdfPreview = null; // preview vindo do parser, antes de salvar
let nutSlotEditing = null;   // {plano_id, item_id?} em edição

/* ── Inicialização da aba Dia da Prova ──────────────────────────────── */
function initDiaDaProva() {
  const sel = document.getElementById("ddp-comp");
  // popula competições (mesma lista do estado global)
  sel.innerHTML = '<option value="">— Selecione —</option>' +
    competicoes.map(c => `<option value="${c.id}">${escapeHtml(c.nome)} (${c.data_inicio})</option>`).join("");
  const selA = document.getElementById("ddp-atleta");
  selA.innerHTML = '<option value="">— Selecione —</option>' +
    atletas.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join("");
  document.getElementById("ddp-dia").innerHTML = '<option value="">— Todos os dias —</option>';
}

/* ── Render principal: linha do tempo do dia ──────────────────────────── */
async function renderDiaDaProva() {
  const compId = +document.getElementById("ddp-comp").value;
  const atletaId = +document.getElementById("ddp-atleta").value;
  const container = document.getElementById("ddp-timeline-container");
  document.getElementById("ddp-btn-print").style.display = "none";
  document.getElementById("ddp-btn-add-nut").style.display = "none";

  if (!compId) {
    container.innerHTML = `<div class="glass-card"><div class="glass-card-inner" style="text-align:center;padding:40px 20px">
      <div style="font-size:48px;margin-bottom:8px">🗓️</div>
      <div style="color:var(--text3);font-size:14px">Selecione uma competição.</div></div></div>`;
    return;
  }

  // carrega provas + nutrição da competição
  ddpProvas = await fetch(`/api/competicoes/${compId}/provas`).then(r => r.json());
  const todosPlanos = await fetch("/api/nutricao").then(r => r.json());
  ddpNutItems = [];
  todosPlanos.filter(p => p.competicao_id === compId).forEach(p => {
    p.items.forEach(it => ddpNutItems.push({...it, plano_id: p.id, plano_titulo: p.titulo, atleta_id: p.atleta_id}));
  });

  // popula select de dias com base nas datas únicas das provas (ou data da comp)
  const comp = competicoes.find(c => c.id === compId);
  const diasComp = diasDaCompeticao(comp);
  const selDia = document.getElementById("ddp-dia");
  const valorAtual = selDia.value;
  selDia.innerHTML = '<option value="">— Todos os dias —</option>' +
    diasComp.map(d => `<option value="${d}" ${d===valorAtual?'selected':''}>${formatarDataBr(d)}</option>`).join("");

  if (!atletaId) {
    container.innerHTML = `<div class="glass-card"><div class="glass-card-inner" style="text-align:center;padding:40px 20px">
      <div style="font-size:48px;margin-bottom:8px">🏊</div>
      <div style="color:var(--text3);font-size:14px">Selecione o atleta.</div></div></div>`;
    return;
  }

  document.getElementById("ddp-btn-add-nut").style.display = "";

  // filtra provas e nutrição pelo atleta (e dia, se escolhido)
  const dia = selDia.value;
  let provas = ddpProvas.filter(p => p.atleta_id === atletaId);
  let nuts = ddpNutItems.filter(n => !n.atleta_id || n.atleta_id === atletaId);

  if (dia) {
    // Filtra provas pela data_prova; provas sem data ficam visíveis em todos os dias
    // só se a competição for de UM dia só (nesse caso o "todos os dias" e o filtro batem).
    provas = provas.filter(p => {
      if (p.data_prova) return p.data_prova === dia;
      // Sem data registrada: mostra apenas se for o único dia da competição
      return diasComp.length === 1;
    });
    // Filtra nutrição: itens não têm campo de data, então mostramos sempre que filtra dia
    // (slots de nutrição costumam servir todo o dia/comp).
  }

  if (provas.length === 0 && nuts.length === 0) {
    container.innerHTML = `<div class="glass-card"><div class="glass-card-inner" style="text-align:center;padding:32px 20px">
      <div style="font-size:36px;margin-bottom:8px">📋</div>
      <div style="color:var(--text3);font-size:14px">Sem provas cadastradas para este atleta nesta competição.<br>
      Você pode <button class="btn-glass" onclick="abrirCompFromDdp(${compId})" style="padding:4px 10px;font-size:12px;display:inline-block;margin-top:6px">adicionar provas</button>
      ou <button class="btn-glass" onclick="abrirModalImportPdfFromDdp(${compId})" style="padding:4px 10px;font-size:12px;display:inline-block;margin-top:6px">importar PDF</button>.</div>
    </div></div>`;
    return;
  }

  // monta timeline: combina provas e items de nutrição, ordena por horário
  const eventos = [];
  provas.forEach(p => eventos.push({
    tipo: "prova",
    horario: p.horario_prova || p.horario || "",
    titulo: p.prova,
    detalhes: [
      // mostra a data só quando estamos vendo "todos os dias" (sem filtro)
      (!dia && p.data_prova) ? formatarDataBr(p.data_prova) : null,
      p.num_prova ? `Prova nº ${p.num_prova}` : null,
      p.etapa || null,
      p.serie ? `Série ${p.serie}` : null,
      p.raia ? `Raia ${p.raia}` : null,
      p.tempo_inscricao ? `Insc.: ${p.tempo_inscricao}` : null,
    ].filter(Boolean).join(" · "),
    raw: p,
  }));
  nuts.forEach(n => eventos.push({
    tipo: "nutricao",
    horario: n.horario || "",
    titulo: n.item,
    detalhes: [n.quantidade, n.obs, n.plano_titulo].filter(Boolean).join(" · "),
    raw: n,
  }));
  eventos.sort((a, b) => {
    const dA = (a.raw && a.raw.data_prova) || "";
    const dB = (b.raw && b.raw.data_prova) || "";
    if (dA !== dB) return dA.localeCompare(dB);
    return (a.horario || "99:99").localeCompare(b.horario || "99:99");
  });

  const atleta = atletas.find(a => a.id === atletaId);
  const tituloDia = dia ? formatarDataBr(dia) : `${comp.data_inicio}${comp.data_fim && comp.data_fim !== comp.data_inicio ? ' a ' + comp.data_fim : ''}`;

  container.innerHTML = `
    <div class="glass-card" id="ddp-print-area">
      <div class="glass-card-inner">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div>
            <div style="font-size:18px;font-weight:600;color:var(--text1)">${escapeHtml(atleta.nome)}</div>
            <div style="font-size:13px;color:var(--text3);margin-top:2px">${escapeHtml(comp.nome)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${tituloDia} · ${comp.local || ""}</div>
          </div>
          <div style="font-size:12px;color:var(--text3);text-align:right">
            ${comp.piscina}m · ${comp.categoria || "—"}
          </div>
        </div>
        <div class="ddp-timeline">
          ${eventos.map(e => renderEventoDdp(e)).join("")}
        </div>
      </div>
    </div>`;
  document.getElementById("ddp-btn-print").style.display = "";
}

function renderEventoDdp(e) {
  const cor = e.tipo === "prova" ? "#3aa8ff" : "#7be08a";
  const icon = e.tipo === "prova" ? "🏊" : "🥗";
  const acoes = e.tipo === "nutricao" ? `
    <button class="btn-glass" onclick="editarNutSlot(${e.raw.plano_id}, ${e.raw.id})" style="padding:3px 8px;font-size:11px">✎</button>
    <button class="btn-glass" onclick="removerNutSlot(${e.raw.plano_id}, ${e.raw.id})" style="padding:3px 8px;font-size:11px">×</button>` : "";
  return `
    <div class="ddp-evento ddp-evento-${e.tipo}" style="display:grid;grid-template-columns:60px 12px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);align-items:start">
      <div style="font-weight:600;color:var(--text2);font-size:14px;text-align:right;padding-top:2px">${e.horario || "—"}</div>
      <div style="position:relative">
        <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:${cor};box-shadow:0 0 0 3px rgba(${e.tipo==='prova'?'58,168,255':'123,224,138'},0.15)"></div>
        <div style="position:absolute;top:18px;bottom:-12px;left:50%;width:1px;background:rgba(255,255,255,0.08);transform:translateX(-50%)"></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
          <div style="font-weight:500;color:var(--text1);font-size:14px">${icon} ${escapeHtml(e.titulo)}</div>
          <div style="display:flex;gap:4px">${acoes}</div>
        </div>
        ${e.detalhes ? `<div style="font-size:12px;color:var(--text3);margin-top:3px">${escapeHtml(e.detalhes)}</div>` : ""}
      </div>
    </div>`;
}

function diasDaCompeticao(c) {
  if (!c) return [];
  const dias = [];
  const ini = new Date(c.data_inicio + "T00:00:00");
  const fim = c.data_fim ? new Date(c.data_fim + "T00:00:00") : ini;
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function formatarDataBr(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function imprimirDiaDaProva() {
  // Usa window.print do navegador. CSS @media print já trata layout.
  window.print();
}

function abrirCompFromDdp(compId) {
  abrirCompDet(compId);
}

function abrirModalImportPdfFromDdp(compId) {
  editingCompId = compId;
  abrirModalImportPdf();
}

/* ── Modal Importar PDF ────────────────────────────────────────────── */
function abrirModalImportPdf() {
  if (!editingCompId) {
    showToast("Abra uma competição primeiro", true);
    return;
  }
  resetImportPdf();
  document.getElementById("modal-import-pdf").classList.add("open");
}

function closeModalImportPdf(e) {
  if (!e || e.target === document.getElementById("modal-import-pdf"))
    document.getElementById("modal-import-pdf").classList.remove("open");
}

function resetImportPdf() {
  importPdfPreview = null;
  document.getElementById("mip-step-upload").style.display = "";
  document.getElementById("mip-step-revisao").style.display = "none";
  document.getElementById("mip-status").textContent = "";
  document.getElementById("mip-file").value = "";
}

async function enviarPdfTorneio() {
  const file = document.getElementById("mip-file").files[0];
  if (!file) return;
  if (!editingCompId) { showToast("Sem competição selecionada", true); return; }

  document.getElementById("mip-status").textContent = "📄 Lendo PDF...";
  const fd = new FormData();
  fd.append("arquivo", file);

  try {
    const res = await fetch(`/api/competicoes/${editingCompId}/importar-pdf`, {method: "POST", body: fd});
    const data = await res.json();
    if (!res.ok) {
      document.getElementById("mip-status").textContent = "❌ " + (data.erro || "Falha");
      return;
    }
    if (!data.provas || data.provas.length === 0) {
      document.getElementById("mip-status").textContent = "⚠️ Nenhuma prova reconhecida no PDF. Você pode adicionar manualmente.";
      return;
    }
    importPdfPreview = data;
    renderTabelaImportPdf();
    document.getElementById("mip-step-upload").style.display = "none";
    document.getElementById("mip-step-revisao").style.display = "";
  } catch (err) {
    document.getElementById("mip-status").textContent = "❌ Erro: " + err.message;
  }
}

function renderTabelaImportPdf() {
  const opcoes = atletas.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join("");

  // dias da competição para o seletor de data por linha
  const comp = competicoes.find(c => c.id === editingCompId);
  const dias = comp ? diasDaCompeticao(comp) : [];
  const opcoesData = '<option value="">—</option>' +
    dias.map(d => `<option value="${d}">${formatarDataBr(d)}</option>`).join("");
  // se houver bulk selector lá em cima, usaremos o valor dele como default
  const defaultData = (dias.length === 1) ? dias[0] : "";

  const linhas = importPdfPreview.provas.map((p, i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
      <td style="padding:6px 4px"><input type="checkbox" id="mip-sel-${i}" checked></td>
      <td style="padding:6px 4px">
        <select id="mip-atleta-${i}" class="glass-select" style="font-size:12px;padding:4px 6px">
          <option value="">— atleta —</option>${opcoes}
        </select>
      </td>
      <td style="padding:6px 4px">
        <select id="mip-data-${i}" class="glass-select" style="font-size:11px;padding:4px 6px;min-width:110px">${opcoesData}</select>
      </td>
      <td style="padding:6px 4px;font-size:12px">${escapeHtml(p.prova)}</td>
      <td style="padding:6px 4px;font-size:11px">${escapeHtml(p.horario_prova || "—")}</td>
      <td style="padding:6px 4px;font-size:11px">${escapeHtml(p.etapa || "—")}</td>
      <td style="padding:6px 4px;font-size:11px">${p.num_prova ?? "—"}</td>
      <td style="padding:6px 4px;font-size:11px">${p.serie ?? "—"}</td>
      <td style="padding:6px 4px;font-size:11px">${p.raia ?? "—"}</td>
      <td style="padding:6px 4px;font-size:11px">${escapeHtml(p.tempo_inscricao || "—")}</td>
    </tr>`).join("");

  // pré-seleciona atleta se a competição tiver só 1
  const setor = importPdfPreview.atletas_competicao.length === 1
    ? importPdfPreview.atletas_competicao[0].id : null;

  // bulk: aplica data/atleta a todas as linhas marcadas
  const bulk = `
    <div style="display:flex;gap:8px;align-items:end;margin-bottom:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px">
      <div class="field" style="margin:0">
        <label style="font-size:10px">Aplicar data a todas</label>
        <select id="mip-bulk-data" class="glass-select" style="font-size:12px;padding:4px 6px;min-width:130px">${opcoesData}</select>
      </div>
      <button class="btn-glass" onclick="aplicarBulkData()" style="padding:5px 10px;font-size:11px">↓ aplicar</button>
      ${atletas.length > 1 ? `
        <div class="field" style="margin:0;margin-left:auto">
          <label style="font-size:10px">Aplicar atleta a todas</label>
          <select id="mip-bulk-atleta" class="glass-select" style="font-size:12px;padding:4px 6px;min-width:130px">
            <option value="">—</option>${opcoes}
          </select>
        </div>
        <button class="btn-glass" onclick="aplicarBulkAtleta()" style="padding:5px 10px;font-size:11px">↓ aplicar</button>
      ` : ""}
    </div>`;

  document.getElementById("mip-tabela").innerHTML = `
    ${bulk}
    <div style="overflow-x:auto;max-height:400px;border:1px solid rgba(255,255,255,0.08);border-radius:8px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead style="background:rgba(0,0,0,0.2);position:sticky;top:0">
          <tr>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">✓</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Atleta</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Data</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Prova</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Hora</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Etapa</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Nº</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Sé</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Ra</th>
            <th style="padding:8px 4px;text-align:left;font-size:10px;color:var(--text3);text-transform:uppercase">Insc.</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">
      ${importPdfPreview.total_provas_extraidas} prova(s) extraída(s) do PDF
      ${setor ? `· Atleta sugerido: ${atletas.find(a=>a.id===setor)?.nome || ""}` : ""}
    </div>`;

  // pré-seleciona atleta nos selects se só houver 1 na competição
  if (setor) {
    importPdfPreview.provas.forEach((_, i) => {
      const sel = document.getElementById(`mip-atleta-${i}`);
      if (sel) sel.value = setor;
    });
  }
  // pré-seleciona data se a competição tem só 1 dia
  if (defaultData) {
    importPdfPreview.provas.forEach((_, i) => {
      const sel = document.getElementById(`mip-data-${i}`);
      if (sel) sel.value = defaultData;
    });
  }
}

function aplicarBulkData() {
  const v = document.getElementById("mip-bulk-data")?.value;
  if (!v) { showToast("Escolha uma data", true); return; }
  importPdfPreview.provas.forEach((_, i) => {
    const ck = document.getElementById(`mip-sel-${i}`);
    if (ck && ck.checked) {
      const sel = document.getElementById(`mip-data-${i}`);
      if (sel) sel.value = v;
    }
  });
}

function aplicarBulkAtleta() {
  const v = document.getElementById("mip-bulk-atleta")?.value;
  if (!v) { showToast("Escolha um atleta", true); return; }
  importPdfPreview.provas.forEach((_, i) => {
    const ck = document.getElementById(`mip-sel-${i}`);
    if (ck && ck.checked) {
      const sel = document.getElementById(`mip-atleta-${i}`);
      if (sel) sel.value = v;
    }
  });
}

async function confirmarImportPdf() {
  if (!importPdfPreview || !editingCompId) return;

  const aSalvar = importPdfPreview.provas
    .map((p, i) => {
      const checked = document.getElementById(`mip-sel-${i}`)?.checked;
      const aid = +document.getElementById(`mip-atleta-${i}`)?.value || 0;
      const data_prova = document.getElementById(`mip-data-${i}`)?.value || "";
      return {p, checked, aid, data_prova};
    })
    .filter(x => x.checked && x.aid)
    .map(x => ({...x.p, atleta_id: x.aid, data_prova: x.data_prova}));

  if (aSalvar.length === 0) {
    showToast("Marque ao menos uma linha com atleta", true);
    return;
  }

  let ok = 0, fail = 0;
  for (const prova of aSalvar) {
    try {
      const res = await fetch(`/api/competicoes/${editingCompId}/provas`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          atleta_id: prova.atleta_id,
          prova: prova.prova,
          horario_prova: prova.horario_prova,
          horario: prova.horario_prova,
          etapa: prova.etapa,
          num_prova: prova.num_prova,
          serie: prova.serie,
          raia: prova.raia,
          tempo_inscricao: prova.tempo_inscricao,
          data_prova: prova.data_prova,
          status: "confirmada",
        }),
      });
      if (res.ok) ok++; else fail++;
    } catch { fail++; }
  }

  showToast(`✓ ${ok} prova(s) importada(s)${fail ? ` · ${fail} falhou(aram)` : ""}`);
  closeModalImportPdf();
  // recarrega provas no modal de detalhes se aberto
  if (typeof loadProvasComp === "function") {
    provasComp = await fetch(`/api/competicoes/${editingCompId}/provas`).then(r => r.json());
    const c = competicoes.find(x => x.id === editingCompId);
    if (c && typeof renderProvasComp === "function") renderProvasComp(c);
  }
}

/* ── Slot de nutrição (Dia da Prova) ──────────────────────────────── */
function abrirModalNutSlot() {
  const compId = +document.getElementById("ddp-comp").value;
  const atletaId = +document.getElementById("ddp-atleta").value;
  if (!compId || !atletaId) { showToast("Selecione competição e atleta", true); return; }
  nutSlotEditing = {comp_id: compId, atleta_id: atletaId, plano_id: null, item_id: null};
  document.getElementById("mns-horario").value = "";
  document.getElementById("mns-item").value = "";
  document.getElementById("mns-qtd").value = "";
  document.getElementById("mns-obs").value = "";
  document.getElementById("modal-nut-slot").classList.add("open");
}

function closeModalNutSlot(e) {
  if (!e || e.target === document.getElementById("modal-nut-slot"))
    document.getElementById("modal-nut-slot").classList.remove("open");
}

function editarNutSlot(planoId, itemId) {
  const item = ddpNutItems.find(n => n.plano_id === planoId && n.id === itemId);
  if (!item) return;
  const compId = +document.getElementById("ddp-comp").value;
  const atletaId = +document.getElementById("ddp-atleta").value;
  nutSlotEditing = {comp_id: compId, atleta_id: atletaId, plano_id: planoId, item_id: itemId, item};
  document.getElementById("mns-horario").value = item.horario || "";
  document.getElementById("mns-item").value = item.item || "";
  document.getElementById("mns-qtd").value = item.quantidade || "";
  document.getElementById("mns-obs").value = item.obs || "";
  document.getElementById("modal-nut-slot").classList.add("open");
}

async function salvarNutSlot() {
  if (!nutSlotEditing) return;
  const horario = document.getElementById("mns-horario").value;
  const item = document.getElementById("mns-item").value.trim();
  const qtd = document.getElementById("mns-qtd").value.trim();
  const obs = document.getElementById("mns-obs").value.trim();
  if (!item) { showToast("Item é obrigatório", true); return; }

  if (nutSlotEditing.plano_id && nutSlotEditing.item_id) {
    // edição: como não há endpoint PUT específico de item, recriamos o plano inteiro.
    // Estratégia simples: deleta o item antigo via remover, cria de novo.
    showToast("Edição não suportada ainda — remova e adicione novamente", true);
    return;
  }

  // cria novo plano "Dia da prova" (1 plano por slot — simples e funciona)
  const payload = {
    titulo: `Dia da prova · ${horario || "sem horário"}`,
    tipo: "competicao",
    atleta_id: nutSlotEditing.atleta_id,
    momento: "entre",
    descricao: "",
    competicao_id: nutSlotEditing.comp_id,
    items: [{horario, item, quantidade: qtd, obs}],
  };
  const res = await fetch("/api/nutricao", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    showToast("✓ Slot adicionado");
    closeModalNutSlot();
    await loadNutricao();
    renderDiaDaProva();
  } else {
    showToast("Erro ao salvar", true);
  }
}

async function removerNutSlot(planoId, itemId) {
  if (!confirm("Remover este slot de nutrição?")) return;
  // Não há endpoint para remover apenas o item; removemos o plano inteiro
  // (o usuário só consegue chegar aqui via slots criados pelo Dia da Prova,
  // que são planos de 1 item — então ok)
  const res = await fetch(`/api/nutricao/${planoId}`, {method: "DELETE"});
  if (res.ok) {
    showToast("Slot removido");
    await loadNutricao();
    renderDiaDaProva();
  } else {
    showToast("Erro ao remover", true);
  }
}


/* ─── Modal de edição completa de prova ────────────────────────── */
let provaEditId = null;

function abrirModalProvaEdit(pid) {
  const p = provasComp.find(x => x.id === pid);
  if (!p) return;
  provaEditId = pid;

  document.getElementById("mpe-prova").value     = p.prova || "Livre 50m";
  document.getElementById("mpe-horario").value   = (p.horario_prova || p.horario || "").slice(0, 5);
  document.getElementById("mpe-etapa").value     = p.etapa || "";
  document.getElementById("mpe-status").value    = p.status || "a_definir";
  document.getElementById("mpe-num").value       = p.num_prova ?? "";
  document.getElementById("mpe-serie").value     = p.serie ?? "";
  document.getElementById("mpe-raia").value      = p.raia ?? "";
  document.getElementById("mpe-tinsc").value     = p.tempo_inscricao || "";
  document.getElementById("mpe-tfinal").value    = p.tempo_final || "";
  document.getElementById("mpe-colocacao").value = p.colocacao || "";

  // popula data com os dias da competição
  const c = competicoes.find(x => x.id === detCompId);
  const dias = c ? diasDaCompeticao(c) : [];
  const sel = document.getElementById("mpe-data");
  sel.innerHTML = '<option value="">— escolher —</option>' +
    dias.map(d => `<option value="${d}">${formatarDataBr(d)}</option>`).join("");
  sel.value = p.data_prova || "";

  document.getElementById("modal-prova-edit").classList.add("open");
}

function closeModalProvaEdit(e) {
  if (!e || e.target === document.getElementById("modal-prova-edit")) {
    document.getElementById("modal-prova-edit").classList.remove("open");
    provaEditId = null;
  }
}

async function salvarProvaEdit() {
  if (!provaEditId) return;
  const p = provasComp.find(x => x.id === provaEditId);
  if (!p) return;

  const horario = document.getElementById("mpe-horario").value;
  const payload = {
    ...p,
    prova:           document.getElementById("mpe-prova").value,
    data_prova:      document.getElementById("mpe-data").value,
    horario:         horario,
    horario_prova:   horario,
    etapa:           document.getElementById("mpe-etapa").value,
    status:          document.getElementById("mpe-status").value,
    num_prova:       parseInt(document.getElementById("mpe-num").value)   || null,
    serie:           parseInt(document.getElementById("mpe-serie").value) || null,
    raia:            parseInt(document.getElementById("mpe-raia").value)  || null,
    tempo_inscricao: document.getElementById("mpe-tinsc").value.trim(),
    tempo_final:     document.getElementById("mpe-tfinal").value.trim(),
    colocacao:       document.getElementById("mpe-colocacao").value.trim(),
  };

  const res = await fetch(`/api/provas/${provaEditId}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    showToast("✓ Prova atualizada");
    closeModalProvaEdit();
    provasComp = await fetch(`/api/competicoes/${detCompId}/provas`).then(r => r.json());
    const c = competicoes.find(x => x.id === detCompId);
    if (c) renderProvasComp(c);
  } else {
    showToast("Erro ao salvar", true);
  }
}

async function deletarProvaDoEdit() {
  if (!provaEditId) return;
  if (!confirm("Excluir esta prova? A ação não pode ser desfeita.")) return;
  await fetch(`/api/provas/${provaEditId}`, {method:"DELETE"});
  closeModalProvaEdit();
  provasComp = await fetch(`/api/competicoes/${detCompId}/provas`).then(r => r.json());
  const c = competicoes.find(x => x.id === detCompId);
  if (c) renderProvasComp(c);
  showToast("Prova removida");
}
