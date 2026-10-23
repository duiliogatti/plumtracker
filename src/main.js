import "./style.css";
import { store, demo } from "./store.js";

const AREAS=[
 ["prod_ejec","Producción ejecutiva","--a1"],["produccion","Producción (jefatura)","--a2"],["logistica","Logística y hospedaje","--a3"],
 ["redes","Redes y comunicación","--a6"],["web","Diseño web","--a9"],["feria","Feria gráfica y merch","--a4"],
 ["tecnica","Técnica","--a10"],["montaje","Montaje","--a8"],["programacion","Programación y competencia","--a5"],
 ["talleres","Talleres y Plum Lab","--a7"],["eventos","Eventos","--a11"],["general","Coordinación general","--a12"]];
const AREA=Object.fromEntries(AREAS.map(a=>[a[0],{name:a[1],c:`var(${a[2]})`}]));
const EVENTS={festival:"Festival",preplum:"PrePlum",ambos:"Ambos",general:"General"};
const STATUS=[["pendiente","Pendiente"],["en_curso","En curso"],["bloqueada","Bloqueada"],["hecha","Hecha"]];
const PRI={alta:"Alta",media:"Media",baja:"Baja"};
const GST={invitado:"Por confirmar",confirmado:"Confirmado",cancelado:"Cancelado"};
const PREPLUM="2026-10-25", FEST=["2026-11-20","2026-11-21","2026-11-22"];

let canWrite=true, tasks=[], guests=[], started=false;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const today=iso(new Date());
const dayDiff=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const DOW=["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const fmt=s=>{if(!s)return"";const d=parse(s);return `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`};
const pref=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};

function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2200)}
function setStatus(msg){const s=$("#status");s.hidden=!msg;s.textContent=msg||""}

/* ---------- header counts ---------- */
function renderCounts(){
  const dp=dayDiff(today,PREPLUM), df=dayDiff(today,FEST[0]);
  const c=(cls,n,lbl,doneLbl)=>`<span class="count ${cls}">${n>0?`<b>${n}</b> días para ${lbl}`:n===0?`<b>Hoy</b> ${lbl}`:doneLbl}</span>`;
  $("#counts").innerHTML=c("pre",dp,"PrePlum","PrePlum ✓")+c("fest",df,"el Festival",df>=-2?"<b>En curso</b> Festival":"Festival ✓");
}

/* ---------- tabs ---------- */
const VIEWS=["resumen","tablero","cronograma","invitados"];
let view=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):(pref("plum.view")||"resumen");
if(!VIEWS.includes(view))view="resumen";
function show(v){view=v;pref("plum.view",v);
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===v));
  VIEWS.forEach(x=>$("#v-"+x).hidden=x!==v);render()}
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.v)});

/* ---------- filters ---------- */
function opts(sel,first,pairs,keep){const el=$(sel),cur=keep??el.value;el.innerHTML=`<option value="">${first}</option>`+pairs.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join("");el.value=pairs.some(p=>p[0]===cur)?cur:""}
function initFilters(){
  const ap=AREAS.map(a=>[a[0],a[1]]), ep=Object.entries(EVENTS);
  opts("#fArea","Todas las áreas",ap,pref("plum.fArea")||""); opts("#fEvent","Todos los eventos",ep,pref("plum.fEvent")||"");
  opts("#gArea","Todas las áreas",ap); opts("#gEvent","Todos los eventos",ep);
  opts("#gvEvent","Festival y PrePlum",[["festival","Festival"],["preplum","PrePlum"]],"festival");
  ["#q","#fArea","#fEvent","#fOwner"].forEach(s=>$(s).addEventListener("input",()=>{pref("plum.fArea",$("#fArea").value);pref("plum.fEvent",$("#fEvent").value);renderBoard()}));
  ["#gArea","#gEvent","#gDone"].forEach(s=>$(s).addEventListener("input",renderGantt));
  ["#gq","#gvEvent"].forEach(s=>$(s).addEventListener("input",renderGuests));
  $("#newTask").onclick=()=>editTask(null,{area:$("#fArea").value,event:$("#fEvent").value});
  $("#newTask2").onclick=()=>editTask(null,{area:$("#gArea").value});
  $("#newGuest").onclick=()=>editGuest(null);
}
function owners(){return [...new Set(tasks.flatMap(t=>(t.owner||"").split(/,| y /).map(s=>s.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,"es"))}
function matchEvent(t,ev){return !ev||t.event===ev||(t.event==="ambos"&&(ev==="festival"||ev==="preplum"))}

/* ---------- summary ---------- */
function renderSummary(){
  const el=$("#v-resumen");
  const open=tasks.filter(t=>t.status!=="hecha");
  const late=open.filter(t=>t.due&&t.due<today).sort((a,b)=>a.due.localeCompare(b.due));
  const week=open.filter(t=>t.due&&t.due>=today&&t.due<=addDays(today,7)).sort((a,b)=>a.due.localeCompare(b.due));
  const blocked=open.filter(t=>t.status==="bloqueada");
  const done=tasks.length-open.length;
  const dp=dayDiff(today,PREPLUM), df=dayDiff(today,FEST[0]);
  const preOpen=open.filter(t=>t.event==="preplum"||t.event==="ambos").length;
  const fesOpen=open.filter(t=>t.event==="festival"||t.event==="ambos").length;
  const arrivals=guests.filter(g=>g.status!=="cancelado"&&g.arrDate&&g.arrDate>=today).sort((a,b)=>(a.arrDate+(a.arrTime||"")).localeCompare(b.arrDate+(b.arrTime||""))).slice(0,6);
  const noLodging=guests.filter(g=>g.status!=="cancelado"&&!g.lodging).length;
  const row=t=>{const a=AREA[t.area]||AREA.general;return `<div class="li" data-task="${t.id}"><span class="dot" style="background:${a.c}"></span><span class="t">${esc(t.title)} <span class="lbl">${esc(t.owner||"sin responsable")}</span></span><span class="when ${t.due<today?"due-late":""}">${fmt(t.due)}</span></div>`};
  el.innerHTML=`
  <div class="milestones">
    <div class="ms pre"><div class="lbl">PrePlum · dom 25 de octubre</div><div class="n">${dp>0?dp+" días":dp===0?"Hoy":"Hecho"}</div><div class="d">${preOpen} tareas abiertas</div></div>
    <div class="ms fest"><div class="lbl">Festival · 20, 21 y 22 de noviembre, Tafí</div><div class="n">${df>0?df+" días":df>=-2?"En curso":"Hecho"}</div><div class="d">${fesOpen} tareas abiertas</div></div>
    <div class="ms"><div class="lbl">Avance general</div><div class="n">${tasks.length?Math.round(done/tasks.length*100):0}%</div><div class="d">${done} de ${tasks.length} tareas hechas</div>
      <div class="stats"><div class="stat bad"><b>${late.length}</b><span class="lbl">vencidas</span></div><div class="stat warn"><b>${blocked.length}</b><span class="lbl">bloqueadas</span></div><div class="stat"><b>${guests.filter(g=>g.status==="confirmado").length}</b><span class="lbl">invitados conf.</span></div></div></div>
  </div>
  <div class="sumgrid">
    <div class="panel"><h2>Por área</h2>${AREAS.map(([k,n])=>{const ts=tasks.filter(t=>t.area===k);if(!ts.length)return"";const d=ts.filter(t=>t.status==="hecha").length;return `<div class="arearow" data-area="${k}"><span class="an"><span class="dot" style="background:${AREA[k].c}"></span>${esc(n)}</span><span class="bar"><i style="width:${d/ts.length*100}%;background:${AREA[k].c}"></i></span><span class="num">${d}/${ts.length}</span></div>`}).join("")||`<div class="empty">Todavía no hay tareas.</div>`}</div>
    <div class="panel"><h2>Vencidas</h2><div class="list">${late.map(row).join("")||`<div class="empty">Nada vencido.</div>`}</div></div>
    <div class="panel"><h2>Próximos 7 días</h2><div class="list">${week.map(row).join("")||`<div class="empty">No hay entregas esta semana.</div>`}</div></div>
    <div class="panel"><h2>Próximas llegadas</h2>${noLodging?`<p class="warnflag">${noLodging} invitado${noLodging>1?"s":""} sin alojamiento asignado</p>`:""}<div class="list">${arrivals.map(g=>`<div class="li" data-guest="${g.id}"><span class="t">${esc(g.name)} <span class="lbl">${esc(g.role||"")}</span></span><span class="when">${fmt(g.arrDate)} ${esc(g.arrTime||"")}</span></div>`).join("")||`<div class="empty">Cargá invitados en la pestaña Invitados.</div>`}</div></div>
  </div>`;
}
$("#v-resumen").addEventListener("click",e=>{
  const t=e.target.closest("[data-task]"),g=e.target.closest("[data-guest]"),a=e.target.closest("[data-area]");
  if(t)editTask(tasks.find(x=>x.id===t.dataset.task));else if(g)editGuest(guests.find(x=>x.id===g.dataset.guest));
  else if(a){$("#fArea").value=a.dataset.area;pref("plum.fArea",a.dataset.area);show("tablero")}
});

/* ---------- board ---------- */
function filteredTasks(){
  const q=$("#q").value.trim().toLowerCase(),ar=$("#fArea").value,ev=$("#fEvent").value,ow=$("#fOwner").value;
  return tasks.filter(t=>(!ar||t.area===ar)&&matchEvent(t,ev)&&(!ow||(t.owner||"").includes(ow))&&(!q||(t.title+" "+(t.owner||"")+" "+(t.notes||"")).toLowerCase().includes(q)));
}
function card(t){
  const a=AREA[t.area]||AREA.general;
  const dueCls=t.status!=="hecha"&&t.due?(t.due<today?"due-late":t.due<=addDays(today,3)?"due-soon":""):"";
  return `<div class="card ${t.status==="hecha"?"done":""}" draggable="${canWrite}" data-id="${t.id}" style="--ac:${a.c}">
    <div class="ct">${esc(t.title)}</div>
    <div class="meta"><span class="chip"><span class="dot" style="background:${a.c}"></span>${esc(a.name)}</span>
    ${t.event&&t.event!=="general"?`<span class="chip ev-${t.event==="ambos"?"festival":t.event}">${EVENTS[t.event]}</span>`:""}
    ${t.priority==="alta"?`<span class="chip pr-alta">Alta</span>`:""}</div>
    <div class="meta"><span>${esc(t.owner||"Sin responsable")}</span>${t.due?`<span class="${dueCls}">· ${fmt(t.due)}</span>`:""}</div>
  </div>`;
}
function renderBoard(){
  opts("#fOwner","Todas las personas",owners().map(o=>[o,o]));
  const ts=filteredTasks().sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
  $("#board").innerHTML=STATUS.map(([k,l])=>{const col=ts.filter(t=>(t.status||"pendiente")===k);
    return `<div class="col" data-status="${k}"><div class="colh"><span>${l}</span><span class="num">${col.length}</span></div>${col.map(card).join("")}${k==="pendiente"&&canWrite?`<button class="addcol" data-add>+ Agregar tarea</button>`:""}</div>`}).join("");
}
$("#board").addEventListener("click",e=>{
  if(e.target.closest("[data-add]"))return editTask(null,{area:$("#fArea").value,event:$("#fEvent").value});
  const c=e.target.closest(".card");if(c)editTask(tasks.find(t=>t.id===c.dataset.id));
});
let dragId=null;
$("#board").addEventListener("dragstart",e=>{const c=e.target.closest(".card");if(c){dragId=c.dataset.id;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",dragId)}});
$("#board").addEventListener("dragover",e=>{const col=e.target.closest(".col");if(col&&dragId){e.preventDefault();document.querySelectorAll(".col.over").forEach(c=>c!==col&&c.classList.remove("over"));col.classList.add("over")}});
$("#board").addEventListener("dragleave",e=>{const col=e.target.closest(".col");if(col&&!col.contains(e.relatedTarget))col.classList.remove("over")});
$("#board").addEventListener("drop",e=>{const col=e.target.closest(".col");document.querySelectorAll(".col.over").forEach(c=>c.classList.remove("over"));
  if(!col||!dragId)return;e.preventDefault();const t=tasks.find(x=>x.id===dragId);dragId=null;
  if(t&&t.status!==col.dataset.status)saveTask(t.id,{...strip(t),status:col.dataset.status});});

/* ---------- gantt ---------- */
function renderGantt(){
  const ar=$("#gArea").value,ev=$("#gEvent").value,showDone=$("#gDone").checked;
  const ts=tasks.filter(t=>(t.start||t.due)&&(!ar||t.area===ar)&&matchEvent(t,ev)&&(showDone||t.status!=="hecha"));
  const undated=tasks.filter(t=>!t.start&&!t.due&&t.status!=="hecha"&&(!ar||t.area===ar)&&matchEvent(t,ev)).length;
  let from=addDays(today,-7),to="2026-11-30";
  ts.forEach(t=>{const s=t.start||t.due;if(s<from)from=s;const d=t.due||t.start;if(d>to)to=d});
  // start on a Monday
  while(parse(from).getDay()!==1)from=addDays(from,-1);
  const n=dayDiff(from,to)+1, W=26, NAME=230;
  const days=[...Array(n)].map((_,i)=>addDays(from,i));
  const groups=AREAS.map(([k,nm])=>[k,nm,ts.filter(t=>t.area===k).sort((a,b)=>(a.start||a.due).localeCompare(b.start||b.due))]).filter(g=>g[2].length);
  let rows=[],r=3;
  groups.forEach(([k,nm,list])=>{
    rows.push(`<div class="ggroup" style="grid-row:${r};grid-column:1"><span class="dot" style="background:${AREA[k].c}"></span>${esc(nm)}</div><div class="gfill" style="grid-row:${r};grid-column:2 / span ${n}"></div>`);r++;
    list.forEach(t=>{
      const s=t.start||t.due,d=t.due||t.start, c0=dayDiff(from,s)+2, c1=dayDiff(from,d)+3;
      const tip=esc(`${t.title} · ${t.owner||"sin responsable"} · ${t.start?fmt(t.start)+" → ":""}${fmt(t.due)}`);
      rows.push(`<div class="gname" style="grid-row:${r};grid-column:1" data-task="${t.id}" title="${tip}">${t.status==="hecha"?"✓ ":""}${esc(t.title)}</div>`);
      rows.push(`<div class="gcell" style="grid-row:${r};grid-column:2 / span ${n}"></div>`);
      if(t.start&&t.due&&t.start!==t.due) rows.push(`<div class="gbar" style="grid-row:${r};grid-column:${c0} / ${c1};background:${AREA[k].c};opacity:${t.status==="hecha"?.4:1}" data-task="${t.id}" title="${tip}"></div>`);
      else rows.push(`<div class="gdia" style="grid-row:${r};grid-column:${c0};background:${AREA[k].c}" data-task="${t.id}" title="${tip}"></div>`);
      r++;
    });
  });
  const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const months=[];days.forEach((d,i)=>{const m=parse(d).getMonth();if(!months.length||months.at(-1).m!==m)months.push({m,i,len:1});else months.at(-1).len++});
  const head=months.map(o=>`<div class="gh gmonth" style="grid-row:1;grid-column:${o.i+2} / span ${o.len}">${o.len>2?MES[o.m]:""}</div>`).join("")
    +days.map((d,i)=>{const dt=parse(d);return `<div class="gh" style="grid-row:2;grid-column:${i+2}">${dt.getDay()===1?`<b style="color:var(--fg)">${dt.getDate()}</b>`:dt.getDate()}<br>${DOW[dt.getDay()][0]}</div>`}).join("");
  const mark=(d,cls,span=1)=>{const i=dayDiff(from,d);if(i<0||i>=n)return"";return `<div class="gmark ${cls}" style="left:${NAME+i*W}px;width:${cls==="today"?0:span*W}px"></div>`};
  const we=days.map((d,i)=>[0,6].includes(parse(d).getDay())?mark(d,"we"):"").join("");
  $("#gwrap").innerHTML=(groups.length?`<div class="gantt" style="grid-template-columns:${NAME}px repeat(${n},${W}px);grid-auto-rows:minmax(28px,auto);width:${NAME+n*W}px">
    <div class="gh" style="grid-row:1 / span 2;grid-column:1;position:sticky;left:0;z-index:4;text-align:left;padding:6px 10px">Tarea</div>${head}
    ${we}${mark(PREPLUM,"pre")}${mark(FEST[0],"fest",3)}${mark(today,"today")}${rows.join("")}</div>`:`<div class="empty">No hay tareas con fecha para este filtro.</div>`)
    +(undated?`<p class="lbl" style="padding:10px">${undated} tareas abiertas sin fecha no aparecen acá. Asignales fecha desde el Tablero.</p>`:"");
  const sc=$("#gwrap");const ti=dayDiff(from,today);if(ti>0)sc.scrollLeft=Math.max(0,ti*W-W*5);
}
$("#gwrap").addEventListener("click",e=>{const t=e.target.closest("[data-task]");if(t)editTask(tasks.find(x=>x.id===t.dataset.task))});

/* ---------- guests ---------- */
function renderGuests(){
  const q=$("#gq").value.trim().toLowerCase(),ev=$("#gvEvent").value||"festival";
  const gs=guests.filter(g=>(!q||(g.name+" "+(g.role||"")+" "+(g.lodging||"")).toLowerCase().includes(q))).sort((a,b)=>(a.arrDate||"9999").localeCompare(b.arrDate||"9999"));
  const inEv=gs.filter(g=>(g.event||"festival")===ev||g.event==="ambos");
  const range=ev==="preplum"?["2026-10-23",4]:["2026-11-17",8];
  const days=[...Array(range[1])].map((_,i)=>addDays(range[0],i));
  const fest=ev==="preplum"?[PREPLUM]:FEST;
  const active=inEv.filter(g=>g.status!=="cancelado");
  const cell=(g,d)=>{
    if(!g.arrDate)return `<td></td>`;
    const dep=g.depDate||g.arrDate;
    if(d===g.arrDate&&d===dep)return `<td class="arr" title="Llega y se va">${esc(g.arrTime||"↓")}↕</td>`;
    if(d===g.arrDate)return `<td class="arr" title="Llega">↓ ${esc(g.arrTime||"")}</td>`;
    if(d===dep)return `<td class="dep" title="Se va">↑ ${esc(g.depTime||"")}</td>`;
    if(d>g.arrDate&&d<dep)return `<td class="in" title="En Tafí">●</td>`;
    return `<td></td>`;
  };
  const nights=d=>active.filter(g=>g.arrDate&&g.arrDate<=d&&(g.depDate||g.arrDate)>d).length;
  const present=d=>active.filter(g=>g.arrDate&&g.arrDate<=d&&(g.depDate||g.arrDate)>=d).length;
  $("#stay").innerHTML=active.length?`<table class="stay"><thead><tr><th>Invitado</th>${days.map(d=>`<th class="${fest.includes(d)?"fd":""}">${fmt(d)}</th>`).join("")}</tr></thead>
    <tbody>${active.map(g=>`<tr data-guest="${g.id}"><td>${esc(g.name)}${!g.arrDate?` <span class="warnflag">sin fechas</span>`:""}</td>${days.map(d=>cell(g,d)).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><td>Presentes</td>${days.map(d=>`<td>${present(d)}</td>`).join("")}</tr><tr><td>Duermen esa noche</td>${days.map(d=>`<td>${nights(d)}</td>`).join("")}</tr></tfoot></table>`
    :`<div class="empty">Todavía no hay invitados para ${ev==="preplum"?"el PrePlum":"el Festival"}. ${canWrite?"Tocá «+ Invitado» para cargar el primero con su llegada y salida.":""}</div>`;
  $("#glist").innerHTML=gs.length?`<table><thead><tr><th>Nombre</th><th>Rol</th><th>Evento</th><th>Estado</th><th>Llega</th><th>Se va</th><th>Viaje</th><th>Alojamiento</th><th>Comida</th><th>A cargo</th></tr></thead><tbody>
    ${gs.map(g=>`<tr data-guest="${g.id}"><td><b>${esc(g.name)}</b></td><td>${esc(g.role)}</td><td>${EVENTS[g.event||"festival"]}</td><td><span class="chip st-${g.status||"invitado"}">${GST[g.status||"invitado"]}</span></td>
    <td class="mono">${fmt(g.arrDate)} ${esc(g.arrTime||"")}</td><td class="mono">${fmt(g.depDate)} ${esc(g.depTime||"")}</td><td>${esc(g.transport)}</td>
    <td>${g.lodging?esc(g.lodging):`<span class="warnflag">Falta</span>`}</td><td>${esc(g.diet)}</td><td>${esc(g.host)}</td></tr>`).join("")}</tbody></table>`
    :`<div class="empty">Sin invitados cargados.</div>`;
}
document.querySelector("#v-invitados").addEventListener("click",e=>{const r=e.target.closest("[data-guest]");if(r)editGuest(guests.find(g=>g.id===r.dataset.guest))});

/* ---------- dialogs ---------- */
const dlg=$("#dlg"),form=$("#dlgForm");
const sel=(id,pairs,v)=>`<select id="${id}">${pairs.map(([k,l])=>`<option value="${esc(k)}" ${k===(v??"")?"selected":""}>${esc(l)}</option>`).join("")}</select>`;
const inp=(id,v,type="text",ph="")=>`<input id="${id}" type="${type}" value="${esc(v??"")}" placeholder="${esc(ph)}">`;
function edited(o){if(!o||!o.updatedAt)return"";const d=new Date(o.updatedAt);return `<p class="edited">Último cambio: ${esc(o.updatedBy||"")} · ${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}</p>`}
function footer(isNew){return `<div class="dlgfoot">${!isNew&&canWrite?`<button type="button" class="btn danger" id="delBtn">Borrar</button><span class="confirmdel" id="delAsk" hidden>¿Seguro? <button type="button" class="btn danger" id="delYes">Sí, borrar</button></span>`:""}<span class="sp"></span><button type="button" class="btn" id="cancelBtn">Cancelar</button>${canWrite?`<button type="submit" class="btn primary" id="saveBtn">${isNew?"Crear":"Guardar"}</button>`:""}</div>`}
function wire(onSave,onDel){
  $("#cancelBtn").onclick=()=>dlg.close();
  form.onsubmit=e=>{e.preventDefault();if(!canWrite)return;const ok=onSave();if(ok!==false)dlg.close()};
  const db_=$("#delBtn");if(db_){db_.onclick=()=>{$("#delAsk").hidden=false;db_.hidden=true};$("#delYes").onclick=()=>{onDel();dlg.close()}}
  dlg.showModal();
}
function editTask(t,preset={}){
  const isNew=!t;t=t||{status:"pendiente",priority:"media",event:"festival",...Object.fromEntries(Object.entries(preset).filter(([,v])=>v))};
  form.innerHTML=`<h3>${isNew?"Nueva tarea":"Editar tarea"}</h3>
  <div class="fgrid">
   <label class="f full"><span class="lbl">Tarea</span>${inp("tTitle",t.title,"text","Qué hay que hacer")}</label>
   <label class="f"><span class="lbl">Área</span>${sel("tArea",AREAS.map(a=>[a[0],a[1]]),t.area||"general")}</label>
   <label class="f"><span class="lbl">Responsable</span>${inp("tOwner",t.owner,"text","Ej: Nai, Duilio")}</label>
   <label class="f"><span class="lbl">Evento</span>${sel("tEvent",Object.entries(EVENTS),t.event)}</label>
   <label class="f"><span class="lbl">Estado</span>${sel("tStatus",STATUS,t.status||"pendiente")}</label>
   <label class="f"><span class="lbl">Empieza</span>${inp("tStart",t.start,"date")}</label>
   <label class="f"><span class="lbl">Entrega</span>${inp("tDue",t.due,"date")}</label>
   <label class="f"><span class="lbl">Prioridad</span>${sel("tPri",Object.entries(PRI),t.priority||"media")}</label>
   <label class="f full"><span class="lbl">Notas</span><textarea id="tNotes">${esc(t.notes)}</textarea></label>
  </div>${edited(t)}${footer(isNew)}`;
  if(!canWrite)form.querySelectorAll("input,select,textarea").forEach(x=>x.disabled=true);
  wire(()=>{
    const title=$("#tTitle").value.trim();if(!title){$("#tTitle").focus();return false}
    let start=$("#tStart").value,due=$("#tDue").value;if(start&&due&&start>due)[start,due]=[due,start];
    saveTask(isNew?null:t.id,{title,area:$("#tArea").value,owner:$("#tOwner").value.trim(),event:$("#tEvent").value,status:$("#tStatus").value,start,due,priority:$("#tPri").value,notes:$("#tNotes").value.trim(),origin:t.origin||""});
  },()=>delDoc("tasks",t.id,"Tarea borrada"));
  if(isNew)setTimeout(()=>$("#tTitle").focus(),30);
}
function editGuest(g){
  const isNew=!g;g=g||{status:"invitado",event:$("#gvEvent").value||"festival"};
  form.innerHTML=`<h3>${isNew?"Nuevo invitado":esc(g.name)}</h3>
  <div class="fgrid">
   <label class="f"><span class="lbl">Nombre</span>${inp("gName",g.name)}</label>
   <label class="f"><span class="lbl">Rol</span>${inp("gRole",g.role,"text","Jurado, tallerista, realizador…")}</label>
   <label class="f"><span class="lbl">Evento</span>${sel("gEvent2",[["festival","Festival"],["preplum","PrePlum"],["ambos","Ambos"]],g.event||"festival")}</label>
   <label class="f"><span class="lbl">Estado</span>${sel("gStatus",Object.entries(GST),g.status||"invitado")}</label>
   <label class="f"><span class="lbl">Llega (día)</span>${inp("gArrD",g.arrDate,"date")}</label>
   <label class="f"><span class="lbl">Llega (hora)</span>${inp("gArrT",g.arrTime,"time")}</label>
   <label class="f"><span class="lbl">Se va (día)</span>${inp("gDepD",g.depDate,"date")}</label>
   <label class="f"><span class="lbl">Se va (hora)</span>${inp("gDepT",g.depTime,"time")}</label>
   <label class="f"><span class="lbl">Viaje / traslado</span>${inp("gTrans",g.transport,"text","Ej: bus desde SMT, lo busca Franco")}</label>
   <label class="f"><span class="lbl">Alojamiento</span>${inp("gLodg",g.lodging,"text","Hotel / cabaña / casa")}</label>
   <label class="f"><span class="lbl">Comida / dieta</span>${inp("gDiet",g.diet,"text","Vegetariano, celíaco…")}</label>
   <label class="f"><span class="lbl">Quién lo atiende</span>${inp("gHost",g.host)}</label>
   <label class="f"><span class="lbl">Contacto</span>${inp("gContact",g.contact,"text","Teléfono o mail")}</label>
   <label class="f"><span class="lbl">Actividades</span>${inp("gAct",g.activities,"text","Taller sáb 11h, jurado…")}</label>
   <label class="f full"><span class="lbl">Notas</span><textarea id="gNotes">${esc(g.notes)}</textarea></label>
  </div>${edited(g)}${footer(isNew)}`;
  if(!canWrite)form.querySelectorAll("input,select,textarea").forEach(x=>x.disabled=true);
  wire(()=>{
    const name=$("#gName").value.trim();if(!name){$("#gName").focus();return false}
    let arrDate=$("#gArrD").value,depDate=$("#gDepD").value;if(arrDate&&depDate&&depDate<arrDate)depDate=arrDate;
    saveGuest(isNew?null:g.id,{name,role:$("#gRole").value.trim(),event:$("#gEvent2").value,status:$("#gStatus").value,arrDate,arrTime:$("#gArrT").value,depDate,depTime:$("#gDepT").value,
      transport:$("#gTrans").value.trim(),lodging:$("#gLodg").value.trim(),diet:$("#gDiet").value.trim(),host:$("#gHost").value.trim(),contact:$("#gContact").value.trim(),activities:$("#gAct").value.trim(),notes:$("#gNotes").value.trim()});
  },()=>delDoc("guests",g.id,"Invitado borrado"));
  if(isNew)setTimeout(()=>$("#gName").focus(),30);
}

/* ---------- persistence ---------- */
const strip=o=>{const {id,updatedAt,updatedBy,...r}=o;return r};
function failed(e){console.error(e);toast("No se pudo guardar. Revisá la conexión y probá de nuevo.")}
async function saveTask(id,data){try{await store.save("tasks",id,data);toast(id?"Guardado":"Tarea creada")}catch(e){failed(e)}}
async function saveGuest(id,data){try{await store.save("guests",id,data);toast(id?"Guardado":"Invitado agregado")}catch(e){failed(e)}}
async function delDoc(col,id,msg){try{await store.remove(col,id);toast(msg)}catch(e){failed(e)}}

function render(){
  renderCounts();
  if(view==="resumen")renderSummary();
  if(view==="tablero")renderBoard();
  if(view==="cronograma")renderGantt();
  if(view==="invitados")renderGuests();
}

/* ---------- login y arranque ---------- */
function showLogin(){$("#app").hidden=true;$("#login").hidden=false}
function startApp(session){
  $("#login").hidden=true;$("#app").hidden=false;
  $("#me").innerHTML=demo?`<span class="chip ev-preplum">Modo demo</span>`:`<span>${esc(session.email)}</span><button class="btn" id="pass">Contraseña</button><button class="btn" id="logout">Salir</button>`;
  const lo=$("#logout");if(lo){lo.onclick=()=>store.signOut();$("#pass").onclick=changePassword}
  if(demo)setStatus("Modo demo: los cambios quedan solo en este navegador. Configurá Supabase para compartirlos con el equipo.");
  if(started)return;started=true;
  initFilters();show(view);
  if(!demo)setStatus("Cargando…");
  store.subscribe(d=>{tasks=d.tasks;guests=d.guests;if(!demo)setStatus("");render()},()=>setStatus("No se pudieron cargar los datos. Revisá la conexión y recargá."));
}
const loginErr=m=>{const e=$("#loginErr");e.hidden=!m;e.textContent=m||""};
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();loginErr("");$("#loginBtn").disabled=true;
  try{await store.signIn($("#loginEmail").value.trim().toLowerCase(),$("#loginPass").value)}
  catch(err){loginErr(/invalid/i.test(err.message||"")?"Mail o contraseña incorrectos. Si no tenés usuario, pedíselo a Duilio o a Nai.":"No se pudo entrar. Revisá la conexión y probá de nuevo.")}
  $("#loginBtn").disabled=false;
});
function changePassword(){
  form.innerHTML=`<h3>Cambiar contraseña</h3><label class="f"><span class="lbl">Nueva contraseña (mínimo 8 caracteres)</span><input id="newPass" type="password" minlength="8" required autocomplete="new-password"></label>
  <div class="dlgfoot"><span class="sp"></span><button type="button" class="btn" id="cancelBtn">Cancelar</button><button type="submit" class="btn primary">Guardar</button></div>`;
  $("#cancelBtn").onclick=()=>dlg.close();
  form.onsubmit=async e=>{e.preventDefault();try{await store.setPassword($("#newPass").value);dlg.close();toast("Contraseña cambiada")}catch(err){toast("No se pudo cambiar. Probá con otra más larga.")}};
  dlg.showModal();
}

store.onAuth(s=>s?startApp(s):(started?location.reload():showLogin()));
store.session().then(s=>s?startApp(s):showLogin());
