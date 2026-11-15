
'use strict';
const $ = id => document.getElementById(id);
const leagueKeys = Object.keys(CONFIG);
const cache = new Map();
const CACHE_TTL_MS = 120_000;
const FETCH_TIMEOUT_MS = 12_000;
let state = { league: null, tab: 'jornadas', data: null, matchesByTeam: new Map(), group: '', journey: 'all', status: 'all', query: '', sortKey: 'pts', sortDir: 'desc' };
let indexData = null;
let indexPromise = null;
let indexUpdated = 0;
let indexIncomplete = false;
let currentController = null;
let currentRequest = 0;
let lastFocus = null;
let toastTimer;
let searchFrame = 0;
const scrollBehavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
function focusVisible(node) {
  if(node?.isConnected && !node.closest('[hidden], [inert]'))node.focus({preventScroll:true});
}

function safeRead(key, fallback) { try { const x = localStorage.getItem(key); return x ? JSON.parse(x) : fallback; } catch { return fallback; } }
function safeWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }






function fallbackLogo(img) {
  if (!img || img.dataset.fallbackApplied==='true') return;
  img.dataset.fallbackApplied='true';
  const entry=Object.entries(CONFIG).find(([,conf])=>conf.logo===img.getAttribute('src'));
  const key=entry?.[0]||'bundespuebla';
  const names={polos:'PL',bundesladies:'BL',bundespuebla:'BP',betos:'BT'};
  const el=document.createElement('span');
  el.className='logo-fallback';el.textContent=names[key];el.title=entry?.[1].nombre||'Bundespuebla';
  el.style.setProperty('--logo-bg',entry?.[1].color||'#b42f4d');
  if(img.id==='league-detail-logo') {img.hidden=true;el.id='league-detail-fallback';img.insertAdjacentElement('afterend',el);}
  else img.replaceWith(el);
}
function clubCrest(name, crests = null) {
  const label=String(name||'CL').trim();
  const parts=label.split(/\s+/);
  const initials=(parts.length>1?parts[0][0]+parts[1][0]:label.slice(0,2)).toUpperCase();
  const palette=['#aa3553','#396da9','#167d75','#7655b0','#a66b28','#356a93','#9f4483','#54784a'];
  const color=palette[[...label].reduce((n,c)=>n+c.charCodeAt(0),0)%palette.length];
  const fallback=`<span class="crest fallback" style="--badge-color:${color}">${esc(initials)}</span>`;
  // Escudos oficiales provienen de la tabla del grupo activo. No reemplazarlos por otro emblema.
  const availableCrests=crests||state.data?.crests||{};
  const src=safeUrl(availableCrests[`${norm(state.group)}|${norm(label)}`]||availableCrests[norm(label)]||'');
  // Las iniciales se muestran *solo* si no existe imagen o si la URL no carga.
  return src?`<span class="crest crest-with-fallback" style="--badge-color:${color}" data-initials="${esc(initials)}"><span class="crest-initials" aria-hidden="true">${esc(initials)}</span><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>`:fallback;
}
function showToast(message) {
  const node=$('toast'); clearTimeout(toastTimer); node.textContent=message; node.hidden=false;
  toastTimer=setTimeout(()=>node.hidden=true,3300);
}
function setHash() {
  const hash = state.league ? `#liga/${state.league}/${state.tab}` : '#inicio';
  try { history.replaceState(null, '', location.pathname + location.search + hash); } catch { location.hash=hash; }
}
function toggleTheme() {
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(theme); safeWrite('bp_theme_2026_apple',theme);
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme==='light'?'light':'dark';
  $('theme-btn').textContent=theme==='light'?'☾':'☀';
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.content=theme==='light'?'#ffffff':'#101216';
}
function showHome() {
  const previousLeague=state.league;
  closeAll();
  ++currentRequest;
  currentController?.abort(); currentController=null;
  state.league=null; state.data=null; state.matchesByTeam.clear();
  document.body.classList.add('on-home');
  $('home-wrapper').hidden=false; $('league-view').hidden=true;
  $('nav-home').classList.add('selected');$('nav-leagues').classList.remove('selected');
  setHash();window.scrollTo(0,0);
  $('league-view').removeAttribute('aria-busy');
  focusVisible(document.querySelector('.picker-card[data-league="'+previousLeague+'"]')||$('nav-home'));
}
function updateClearSearch(){
  const clear=$('clear-search'),search=$('team-search');
  if(clear&&search){clear.hidden=!search.value.trim();}
}
function switchTab(tab, {updateLocation=true}={}) {
  if(!['jornadas','tabla','goleo'].includes(tab))return;
  state.tab=tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  document.querySelectorAll('.tab-content').forEach(c=>{const active=c.id===`content-${tab}`;c.classList.toggle('active',active);c.hidden=!active;});
  $('status-field').hidden=tab!=='jornadas';
  if(updateLocation && state.league)setHash();
}
async function openLeague(key, options={}) {
  if(!CONFIG[key])return;
  const req=++currentRequest;
  currentController?.abort();
  const controller=new AbortController();currentController=controller;
  state.league=key;
  // La identidad visual del banner depende únicamente de la liga activa.
  $('league-view').dataset.league=key;
  state.data=null; state.matchesByTeam.clear();
  state.group=options.group||'';state.query=options.query||'';
  state.status=['all','pending','played'].includes(options.status)?options.status:'all';
  state.sortKey=['pts','gf','dg','pj'].includes(options.sortKey)?options.sortKey:'pts';
  state.sortDir=options.sortDir==='asc'?'asc':'desc';
  const cfg=CONFIG[key];
  const detailFallback=$('league-detail-fallback');if(detailFallback)detailFallback.remove();
  $('league-detail-logo').hidden=false;delete $('league-detail-logo').dataset.fallbackApplied;
  document.documentElement.style.setProperty('--league', cfg.color);
  $('league-title').textContent=cfg.nombre;
  $('breadcrumb-league').textContent=cfg.nombre;
  $('league-detail-logo').src=cfg.logo;
  $('league-detail-logo').alt=`Escudo de ${cfg.nombre}`;
  document.body.classList.remove('on-home');
  $('home-wrapper').hidden=true; $('league-view').hidden=false;
  $('nav-home').classList.remove('selected');$('nav-leagues').classList.add('selected');
  $('team-search').value=state.query; $('status-filter').value=state.status; updateClearSearch();
  $('league-view').setAttribute('aria-busy','true');
  $('error-display').hidden=true;
  $('jornadas-container').innerHTML='<div class="load-state"><div class="spinner"></div>Conectando con los partidos oficiales…</div>';
  $('tabla-body').innerHTML='<tr><td colspan="12" class="load-state">Consultando clasificación…</td></tr>';
  $('goleo-individual-body').innerHTML='<div class="load-state">Consultando goleadores…</div>';
  $('goleo-equipos-body').innerHTML='';
  $('journey-pills').innerHTML=''; $('scorers-highlight').hidden=true;$('records-banner-container').innerHTML='';
  ['kpi-leader','kpi-offense','kpi-defense','kpi-goals'].forEach(id=>$(id).textContent='—');
  ['kpi-leader-pts','kpi-offense-gf','kpi-defense-gc','kpi-matches'].forEach(id=>$(id).textContent='Cargando información');
  switchTab(options.tab||'jornadas');
  updateStatusChips();
  focusVisible($('main'));
  window.scrollTo(0,0);
  try {
    const entry=cache.get(key);
    const data=entry&&Date.now()-entry.updated<CACHE_TTL_MS ? entry.data : await getLeagueData(key,{signal:controller.signal});
    if(req!==currentRequest || state.league!==key)return;
    loadLeagueData(data,options);
    if(options.profile)openTeamDetails(options.profile);
  } catch(error) {
    if(req!==currentRequest || controller.signal.aborted)return;
    $('jornadas-container').innerHTML='<div class="empty"><strong>No fue posible cargar los partidos.</strong>Revisa tu conexión y vuelve a intentarlo.</div>';
    $('tabla-body').innerHTML='<tr><td colspan="12">No se pudo cargar la tabla.</td></tr>';
    $('error-message-text').textContent=error.message||'Ocurrió un problema al consultar los datos publicados.';
    $('error-display').hidden=false;
    $('goleo-individual-body').innerHTML='<div class="empty"><strong>No se pudieron cargar los goleadores.</strong>Usa Reintentar para volver a consultar.</div>';
    ['kpi-leader-pts','kpi-offense-gf','kpi-defense-gc','kpi-matches'].forEach(id=>$(id).textContent='Datos no disponibles');
    console.error('Error al cargar la liga',error);
  } finally {
    if(req===currentRequest)$('league-view').removeAttribute('aria-busy');
  }
}
async function refreshLeague() {
  if(!state.league)return;
  const key=state.league;
  cache.delete(key);
  indexUpdated=0;
  $('refresh-btn').disabled=true;
  const options={group:state.group,journey:state.journey,tab:state.tab,query:state.query,status:state.status,sortKey:state.sortKey,sortDir:state.sortDir};
  try {await openLeague(key,options);} finally {$('refresh-btn').disabled=false;}
}
async function fetchCSV(url,name,{signal,optional=false}={}) {
    if(!url)return '';
    try {
      const requestController = new AbortController();
      const abort = () => requestController.abort();
      const timeout = setTimeout(abort, FETCH_TIMEOUT_MS);
      if(signal?.aborted)abort();
      else if(signal)signal.addEventListener('abort',abort,{once:true});
      let res;
      try {res=await fetch(url,{cache:'no-store',signal:requestController.signal});
        if(!res.ok)throw new Error(`respuesta HTTP ${res.status}`);
        return await res.text();
      } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
    } catch(error) {
      if(signal?.aborted)throw error;
      if(optional){console.warn(`No se pudo obtener ${name}; se mostrarán datos parciales.`,error);return '';}
      throw new Error(`No se pudo obtener ${name} de Google Sheets (${error.message}).`);
    }
  }
async function getLeagueData(key, {signal}={}) {
  const cfg=CONFIG[key];
  const load=(url,name,optional=false)=>fetchCSV(url,name,{signal,optional});
  const [matchesCSV,standingsCSV,scorersCSV] = await Promise.all([
    load(cfg.resultadosUrl,'resultados'),load(cfg.tablasUrl,'tabla de posiciones'),load(cfg.goleoUrl,'goleadores',true)
  ]);
  const data=parseData(matchesCSV,standingsCSV,scorersCSV);
  if(signal?.aborted)throw new DOMException('Carga cancelada','AbortError');
  cache.set(key,{data,updated:Date.now()});
  return data;
}


function fillOptions(node, items, selected) {
  node.replaceChildren(...items.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));
  if(items.some(([value])=>String(value)===String(selected)))node.value=String(selected);
}
function loadLeagueData(data, options={}) {
  state.data=data;
  // Índice de partidos por equipo y grupo, reutilizado por las filas de la tabla.
  const byTeam=new Map();
  for(const match of data.matches){
    const uniqueTeams=new Set([norm(match.local),norm(match.visitante)]);
    for(const team of uniqueTeams){
      const key=`${norm(match.grupo)}|${team}`;
      if(!byTeam.has(key))byTeam.set(key,[]);
      byTeam.get(key).push(match);
    }
  }
  for(const matches of byTeam.values())matches.sort((a,b)=>a.jornada-b.jornada);
  state.matchesByTeam=byTeam;
  const groups=data.groups;
  state.group=groups.includes(options.group)?options.group:(groups.includes(state.group)?state.group:groups[0]||'');
  fillOptions($('group-select'),groups.map(g=>[g,`Grupo ${g}`]),state.group);
  $('group-field').hidden=groups.length<2;
  updateJourneys(options.journey);
  renderAll();
}
function getGroupMatches() { return state.data?.matches.filter(m=>m.grupo===state.group)||[]; }
function getGroupTable() { return (state.data?.standings.filter(s=>s.grupo===state.group)||[]).sort(pointsOrder); }
function getGroupScorers() {
  const arr=state.data?.scorers||[];
  const ungrouped=state.data?.groups.length===1;
  const unique=ungrouped;
  return arr.filter(x=>unique||norm(x.grupo)===norm(state.group)).sort((a,b)=>b.goles-a.goles||a.jugador.localeCompare(b.jugador,'es'));
}
function getJourneys() { return [...new Set(getGroupMatches().map(m=>m.jornada))].sort((a,b)=>a-b); }
function updateJourneys(prefer) {
  const journeys=getJourneys(),gm=getGroupMatches();
  const recommended=journeys.find(j=>gm.some(m=>m.jornada===j&&!played(m)))??journeys.at(-1);
  const desired=prefer!==undefined?String(prefer):recommended!==undefined?String(recommended):'all';
  state.journey=desired==='all'||journeys.some(j=>String(j)===desired)?desired:'all';
  renderJourneyControls();
}
function keepJourneyVisible(row, button) {
  // No centrar ni desplazar un botón que ya está visible: en móviles
  // mover el scroll al hacer tap cancela la animación del botón.
  if (!button) return;
  const rowBox=row.getBoundingClientRect();
  const buttonBox=button.getBoundingClientRect();
  const margin=7;
  const overflowLeft=buttonBox.left-rowBox.left-margin;
  const overflowRight=buttonBox.right-rowBox.right+margin;
  if (overflowLeft<0) row.scrollLeft+=overflowLeft;
  else if (overflowRight>0) row.scrollLeft+=overflowRight;
}
function renderJourneyControls({revealSelection=false}={}) {
  const journeys=getJourneys(),chosen=state.journey;
  const row=$('journey-pills');
  const values=['all',...journeys.map(String)];
  const existing=[...row.querySelectorAll('.journey-pill')];
  const hasSameJourneys=existing.length===values.length &&
    existing.every((button,index)=>button.dataset.journey===values[index]);
  // Reconstruir solo cuando cambia realmente el conjunto de jornadas.
  // En cada tap actualizar las clases del mismo nodo conserva el foco,
  // la animación CSS y la posición horizontal actual.
  if (!hasSameJourneys) {
    row.innerHTML=values.map(value=>`<button type="button" class="journey-pill" data-journey="${value}" aria-pressed="false">${value==='all'?'Todas':`J${value}`}</button>`).join('');
  }
  let selected=null;
  row.querySelectorAll('.journey-pill').forEach(button=>{
    const active=button.dataset.journey===chosen;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    if(active) selected=button;
  });
  // En primera carga o con flechas, desplazar solo lo mínimo necesario.
  // Un toque directo a una jornada visible nunca desplaza la banda.
  if (selected && (!hasSameJourneys || revealSelection)) keepJourneyVisible(row,selected);
  const idx=journeys.findIndex(j=>String(j)===chosen);
  $('prev-jornada').disabled=journeys.length===0||idx===0;
  $('next-jornada').disabled=journeys.length===0||idx===journeys.length-1;
  $('match-hint').textContent=chosen==='all'?'Consulta los resultados y partidos programados de todas las jornadas':`Jornada ${chosen} · Usa las flechas para moverte entre fechas`;
}
function selectJourney(journey,{revealSelection=false}={}) {
  state.journey=String(journey);
  renderJourneyControls({revealSelection});
  renderMatches();
}
function navigateJourney(delta) {
  const journeys=getJourneys(); if(!journeys.length)return;
  const idx=journeys.findIndex(j=>String(j)===state.journey);
  const pos=idx<0?(delta<0?journeys.length-1:0):Math.max(0,Math.min(journeys.length-1,idx+delta));
  selectJourney(journeys[pos],{revealSelection:true});
}
function renderAll() { renderKPIs();renderJourneyControls();renderMatches();renderTable();renderStats(); }
function renderKPIs() {
  const standings=getGroupTable(),games=getGroupMatches().filter(played);
  const leader=standings[0];
  const offense=[...standings].sort((a,b)=>b.gf-a.gf)[0];
  const active=standings.filter(t=>t.v+t.d+t.gs+t.ps>0);
  const defense=[...(active.length?active:standings)].sort((a,b)=>a.gc-b.gc)[0];
  const totalGoals=games.reduce((n,m)=>n+Number(m.marcadorLocal)+Number(m.marcadorVisitante),0);
  $('kpi-leader').textContent=leader?.equipo||'—';$('kpi-leader-pts').textContent=leader?`${leader.pts} puntos · ${leader.dg>=0?'+':''}${leader.dg} DG`:'Sin clasificación';
  $('kpi-offense').textContent=offense?.equipo||'—';$('kpi-offense-gf').textContent=offense?`${offense.gf} goles a favor`:'Sin registros';
  $('kpi-defense').textContent=defense?.equipo||'—';$('kpi-defense-gc').textContent=defense?`${defense.gc} goles recibidos`:'Sin registros';
  $('kpi-goals').textContent=String(totalGoals);$('kpi-matches').textContent=`${games.length} partidos · ${games.length?(totalGoals/games.length).toFixed(1):'0'} goles por partido`;
  $('table-group-label').textContent=`GRUPO ${state.group}`;
}
function matchCard(m) {
  const done=played(m),hg=Number(m.marcadorLocal),ag=Number(m.marcadorVisitante);
  const shootout=done && hg===ag && [m.msLocal,m.msVisitante].every(value => /^\d+$/.test(String(value ?? '').trim()));
  const winner=shootout?(Number(m.msLocal)>Number(m.msVisitante)?'home':Number(m.msLocal)<Number(m.msVisitante)?'away':null):done?(hg>ag?'home':ag>hg?'away':null):null;
  const home=esc(m.local),away=esc(m.visitante);
  return `<article class="match-card"><div class="match-top"><small>JORNADA ${m.jornada} · GRUPO ${esc(m.grupo)}</small><span class="status ${done?'final':''}"><span class="dot"></span>${done?(shootout?'Final / SO':'Finalizado'):'Por jugar'}</span></div><div class="match-main"><button type="button" class="match-team ${winner==='home'?'winner':''}" data-team="${home}" aria-label="Ver perfil de ${home}">${clubCrest(m.local)}<span class="name">${home}</span></button><div class="score-wrap"><div class="score ${done?'':'pending'}">${done?`${esc(m.marcadorLocal)} – ${esc(m.marcadorVisitante)}`:'VS'}</div>${shootout?`<small class="shootout">SO ${esc(m.msLocal)}–${esc(m.msVisitante)}</small>`:''}</div><button type="button" class="match-team ${winner==='away'?'winner':''}" data-team="${away}" aria-label="Ver perfil de ${away}">${clubCrest(m.visitante)}<span class="name">${away}</span></button></div><div class="match-bottom"><span>LOCAL</span><span>VISITANTE</span></div></article>`;
}
function updateStatusChips() {
  document.querySelectorAll('[data-status-chip]').forEach(button=>{
    const selected=button.dataset.statusChip===state.status;
    button.classList.toggle('is-current',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
function renderMatches() {
  updateStatusChips();
  if(!state.data)return;
  const term=norm(state.query), status=state.status;
  const matches=getGroupMatches().filter(m=>(state.journey==='all'||m.jornada===Number(state.journey)) && (status==='all'||(status==='played'?played(m):!played(m))) && (!term||norm(m.local).includes(term)||norm(m.visitante).includes(term)));
  const groups=new Map();matches.forEach(m=>{if(!groups.has(m.jornada))groups.set(m.jornada,[]);groups.get(m.jornada).push(m);});
  if(!matches.length){$('jornadas-container').innerHTML='<div class="empty"><strong>No hay partidos con estos filtros.</strong>Prueba otra jornada, cambia el estado o borra la búsqueda.</div>';return;}
  $('jornadas-container').innerHTML=[...groups.entries()].sort(([a],[b])=>a-b).map(([journey,games])=>`<section class="match-group" aria-label="Jornada ${journey}"><div class="match-group-title"><strong>Jornada ${journey}</strong><small>${games.length} ${games.length===1?'partido':'partidos'}</small></div><div class="match-grid">${games.map(matchCard).join('')}</div></section>`).join('');
}
function recentForm(team) {
  const key=norm(team);
  const games=(state.matchesByTeam.get(`${norm(state.group)}|${key}`)||[]).filter(played).slice(-5);
  if(!games.length)return '<span class="form-dot form-none">–</span>';
  const labels={'W':['V','Victoria'],'L':['D','Derrota'],'D':['E','Empate sin shootout'],'SO-W':['GS','Shootout ganado'],'SO-L':['PS','Shootout perdido']};
  return games.map(m=>{
    const code=matchResultForTeam(m,key);
    const [label,title]=labels[code]||labels.D;
    return `<span class="form-dot form-${code}" title="Jornada ${m.jornada}: ${title}">${label}</span>`;
  }).join('');
}
function renderTable() {
  if(!state.data)return;
  const official=getGroupTable().map((t,i)=>({...t,pos:i+1,pj:t.v+t.d+t.gs+t.ps}));
  const term=norm(state.query);
  let filtered=official.filter(t=>!term||norm(t.equipo).includes(term));
  const {sortKey,sortDir}=state;
  filtered.sort((a,b)=>(sortDir==='desc'?-1:1)*(a[sortKey]-b[sortKey])||a.pos-b.pos);
  const qualifying=qualifyingPositions(state.league);
  $('tabla-body').innerHTML=filtered.length?filtered.map(row=>`<tr class="${row.pos<=qualifying?'zone':''} ${row.pos===qualifying?'cutoff':''}"><td><span class="pos ${row.pos<=3?'top'+row.pos:''}">${row.pos}</span></td><td class="sticky"><button type="button" class="team-name-button" data-team="${esc(row.equipo)}" title="Ver perfil de ${esc(row.equipo)}">${clubCrest(row.equipo)}<span class="team-cell-text"><span class="team-cell-name">${esc(row.equipo)}</span><small class="team-mobile-score"><b>${row.pts} pts</b><span> · ${row.dg>0?'+':''}${row.dg} DG</span></small></span></button></td><td>${row.pj}</td><td>${row.v}</td><td>${row.d}</td><td>${row.gs}</td><td>${row.ps}</td><td>${row.gf}</td><td>${row.gc}</td><td class="${row.dg>0?'positive':row.dg<0?'negative':''}">${row.dg>0?'+':''}${row.dg}</td><td class="points">${row.pts}</td><td><div class="form-dots">${recentForm(row.equipo)}</div></td></tr>`).join(''):'<tr><td colspan="12" style="padding:35px">No se encontraron clubes para esa búsqueda.</td></tr>';
  const note=qualifying===8 ? 'Clasifican los primeros 8.' : `Clasifican los primeros 4 del Grupo ${state.group||''}.`;
  $('table-group-label').textContent=state.group ? `GRUPO ${state.group}` : 'TABLA GENERAL';
  $('qualification-note').textContent=note;
  document.querySelectorAll('[data-sort]').forEach(button=>{
    const selected=button.dataset.sort===state.sortKey;
    const heading=button.closest('th');
    if(selected)heading.setAttribute('aria-sort',state.sortDir==='desc'?'descending':'ascending');
    else heading.removeAttribute('aria-sort');
    button.classList.toggle('active',selected);
    button.querySelector('.sort-icon').textContent=selected?(state.sortDir==='desc'?'↓':'↑'):'↕';
    const labels={pts:'puntos',gf:'goles a favor',dg:'diferencia de goles',pj:'partidos jugados'};
    button.setAttribute('aria-label',`Ordenar por ${labels[button.dataset.sort]}${selected?' (orden '+(state.sortDir==='desc'?'descendente':'ascendente')+')':''}`);
  });
}
function renderStats() {
  if(!state.data)return;
  const games=getGroupMatches().filter(played);
  let record=null,recordDiff=-1;
  games.forEach(m=>{const diff=Math.abs(Number(m.marcadorLocal)-Number(m.marcadorVisitante));if(diff>recordDiff||(diff===recordDiff&&record&&(Number(m.marcadorLocal)+Number(m.marcadorVisitante)>Number(record.marcadorLocal)+Number(record.marcadorVisitante)))){record=m;recordDiff=diff;}});
  $('records-banner-container').innerHTML=record?`<div class="record-banner"><small>Partido con mayor diferencia de goles · J${record.jornada}</small><strong>${esc(record.local)} &nbsp;${esc(score(record))}&nbsp; ${esc(record.visitante)}</strong><p>Diferencia de ${recordDiff} goles · Grupo ${esc(state.group)}</p></div>`:'';
  const term=norm(state.query);
  const allScorers=getGroupScorers();
  const scorers=allScorers.filter(g=>!term||norm(g.jugador).includes(term)||norm(g.equipo).includes(term));
  const positions=new Map(allScorers.map((g,i)=>[g,i+1]));
  const scorerRank=g=>positions.get(g)||0;
  const podium=$('scorers-highlight');podium.hidden=allScorers.length===0;
  $('podium-list').innerHTML=allScorers.slice(0,3).map((g,i)=>`<div class="podium-item podium-rank-${i+1}"><small class="podium-kicker">#${scorerRank(g)} · GOLEADOR${scorerRank(g)===1?' LÍDER':''}</small><strong>${esc(g.jugador)}</strong><p>${esc(g.equipo)}</p><em class="podium-goals">${g.goles} <span style="font-family:'DM Sans',sans-serif;font-size:10px;font-weight:800;color:inherit;opacity:.78">GOLES</span></em></div>`).join('');
  $('goleo-individual-body').innerHTML=scorers.length?scorers.map((g,i)=>`<div class="ranking-row"><span class="ranking-index">${scorerRank(g)}</span><div class="ranking-detail"><strong>${esc(g.jugador)}</strong><span>${esc(g.equipo)}</span></div><span class="ranking-value">${g.goles}</span></div>`).join(''):'<div class="empty" style="border:0"><strong>Sin goleadores disponibles</strong>No hay registros para este filtro.</div>';
  const clubs=getGroupTable().sort((a,b)=>b.gf-a.gf||b.pts-a.pts).filter(t=>!term||norm(t.equipo).includes(term));
  const maxGF=Math.max(1,...clubs.map(c=>c.gf));
  $('goleo-equipos-body').innerHTML=clubs.length?clubs.map((t,i)=>`<div class="ranking-row"><span class="ranking-index">${i+1}</span>${clubCrest(t.equipo)}<div class="ranking-detail"><strong>${esc(t.equipo)}</strong><span>${t.v+t.d+t.gs+t.ps} PJ · ${(t.gf/Math.max(1,t.v+t.d+t.gs+t.ps)).toFixed(2)} goles/partido</span><div class="bar-track"><i style="width:${Math.round(t.gf/maxGF*100)}%"></i></div></div><span class="ranking-value">${t.gf}</span></div>`).join(''):'<div class="empty" style="border:0"><strong>Sin clubes disponibles</strong>Cambia tu búsqueda.</div>';
}
function activeOverlay() { return ['finder-overlay','team-overlay'].map($).find(node=>!node.hidden); }
function openOverlay(id) {
  if(!activeOverlay())lastFocus=document.activeElement;
  ['finder-overlay','team-overlay'].forEach(key=>$(key).hidden=key!==id);
  document.body.style.overflow='hidden';
  focusVisible(id==='finder-overlay'?$('finder-input'):$(id).querySelector('button'));
  const shell=document.querySelector('.site-shell');
  shell.setAttribute('inert','');shell.setAttribute('aria-hidden','true');
}
function closeOverlay(id) {
  $(id).hidden=true;
  if(activeOverlay())return;
  document.body.style.overflow='';
  const shell=document.querySelector('.site-shell');
  shell.removeAttribute('inert');shell.removeAttribute('aria-hidden');
  const target=lastFocus?.isConnected&&!lastFocus.closest('[hidden], [inert]')?lastFocus:state.league?$('tab-'+state.tab):$('nav-home');
  lastFocus=null;focusVisible(target);
}
function closeAll() { const overlay=activeOverlay();if(overlay)closeOverlay(overlay.id); }
function openTeamDetails(name) {
  if(!state.data)return;
  const club=getGroupTable().find(t=>norm(t.equipo)===norm(name));
  const all=getGroupMatches().filter(m=>norm(m.local)===norm(name)||norm(m.visitante)===norm(name));
  if(!club&&!all.length)return;
  const completed=all.filter(played).sort((a,b)=>b.jornada-a.jornada).slice(0,3);
  const upcoming=all.filter(m=>!played(m)).sort((a,b)=>a.jornada-b.jornada).slice(0,3);
  const official=getGroupTable(),place=club?official.findIndex(t=>norm(t.equipo)===norm(name))+1:null;
  const pf=club?club.v+club.d+club.gs+club.ps:all.filter(played).length;
  const gameLine=m=>`<div class="mini-game"><span><small>J${m.jornada} · </small>${esc(m.local)} <b>${esc(score(m))}</b> ${esc(m.visitante)}</span><small>${played(m)?'FINAL':'POR JUGAR'}</small></div>`;
  $('team-dialog-body').innerHTML=`<div class="team-summary">${clubCrest(name)}<div><h3>${esc(name)}</h3><p>${esc(CONFIG[state.league].nombre)} · Grupo ${esc(state.group)}${place?' · Posición '+place:''}</p></div></div><div class="team-numbers"><div><strong>${club?.pts??'—'}</strong><small>Puntos</small></div><div><strong>${pf}</strong><small>Partidos</small></div><div><strong>${club?.gf??'—'}</strong><small>GF</small></div><div><strong>${club?.gc??'—'}</strong><small>GC</small></div></div><div class="modal-section-title">Próximos encuentros</div>${upcoming.length?upcoming.map(gameLine).join(''):'<div class="mini-game"><small>No hay encuentros pendientes registrados.</small></div>'}<div class="modal-section-title">Últimos resultados</div>${completed.length?completed.map(gameLine).join(''):'<div class="mini-game"><small>Sin resultados registrados.</small></div>'}<div class="modal-actions"><button type="button" class="btn btn-muted" id="go-to-team-table">Ver clasificación ↗</button></div>`;
  openOverlay('team-overlay');
}
function openFinder() {
  $('finder-input').value='';openOverlay('finder-overlay');
  if(!indexPromise&&(!indexData||indexIncomplete||Date.now()-indexUpdated>=CACHE_TTL_MS))loadIndex();
  renderFinder();
}
async function loadIndex() {
  if(indexPromise)return indexPromise;
  indexPromise=Promise.allSettled(leagueKeys.map(async key=>{
    const cacheEntry=cache.get(key);
    const fresh=cacheEntry&&Date.now()-cacheEntry.updated<CACHE_TTL_MS;
    // Solo tablas: el buscador no necesita descargar partidos ni goleadores.
    const data=fresh?cacheEntry.data:parseData('',await fetchCSV(CONFIG[key].tablasUrl,'clubes de '+CONFIG[key].nombre),'');
    return data.standings.map(t=>({team:t.equipo,group:t.grupo,league:key}));
  }));
  const responses=await indexPromise;
  const previous=indexData||[];
  indexIncomplete=responses.some(r=>r.status==='rejected');
  indexData=responses.flatMap((r,i)=>r.status==='fulfilled'?r.value:previous.filter(t=>t.league===leagueKeys[i]));
  if(responses.every(r=>r.status==='rejected')&&!indexData.length)indexData=null;
  indexUpdated=Date.now();
  indexPromise=null;
  if(!$('finder-overlay').hidden)renderFinder();
}
function renderFinder() {
  const q=norm($('finder-input').value), entries=(indexData||[]).filter(t=>norm(t.team).includes(q)||norm(CONFIG[t.league].nombre).includes(q));
  const leagues=leagueKeys.filter(key=>!q||norm(CONFIG[key].nombre).includes(q));
  $('finder-note').textContent=indexPromise?'Buscando clubes en las hojas de las competiciones…':!indexData?'Elige una liga mientras consultamos los clubes.':'Selecciona un club o entra directamente a una competición.';
  const leagueEntries=leagues.map(key=>`<button type="button" class="finder-result" data-find-league="${key}"><span class="finder-left"><img src="${esc(CONFIG[key].logo)}" alt="" style="width:36px;height:36px;border-radius:9px;object-fit:cover;background:#fff"><span><strong>${esc(CONFIG[key].nombre)}</strong><small>Entrar a la competición</small></span></span><span class="chevron">↗</span></button>`);
  if(!indexPromise&&indexIncomplete)$('finder-note').textContent='No pudimos actualizar todos los clubes. Puedes entrar a una liga o cerrar y volver a abrir la búsqueda para reintentar.';
  const distinct=new Set();
  const teamEntries=entries.filter(row=>{const id=[row.league,row.group,norm(row.team)].join('|');if(distinct.has(id))return false;distinct.add(id);return true;}).slice(0,45).map(t=>`<button type="button" class="finder-result" data-find-team="${esc(t.team)}" data-find-group="${esc(t.group)}" data-find-league-key="${t.league}"><span class="finder-left"><span class="crest fallback" style="--badge-color:${esc(CONFIG[t.league].color)}">⚽</span><span><strong>${esc(t.team)}</strong><small>${esc(CONFIG[t.league].nombre)} · Grupo ${esc(t.group)}</small></span></span><span class="chevron">↗</span></button>`);
  $('finder-results').innerHTML=[...leagueEntries,...teamEntries].length?[...leagueEntries,...teamEntries].join(''):'<div class="empty"><strong>No se encontraron coincidencias.</strong>Prueba con otro nombre o entra desde las ligas.</div>';
}
async function shareLeague() {
  const url=location.href;
  try { if(navigator.share){await navigator.share({title:CONFIG[state.league].nombre,url});return;} if(navigator.clipboard){await navigator.clipboard.writeText(url);showToast('Enlace de la liga copiado.');return;} } catch(error){if(error.name==='AbortError')return;}
  showToast('Puedes copiar la dirección del navegador para compartir esta liga.');
}
function registerEvents() {
  document.addEventListener('focusin',event=>{
    const overlay=activeOverlay();
    if(overlay&&!overlay.contains(event.target))focusVisible(overlay.querySelector('input,button'));
  });
  $('brand-link').addEventListener('click',e=>{e.preventDefault();showHome();});
  $('nav-home').addEventListener('click',showHome);
  $('nav-leagues').addEventListener('click',()=>{showHome();$('competiciones').scrollIntoView({behavior:scrollBehavior()});});
  $('open-search').addEventListener('click',openFinder);
  $('theme-btn').addEventListener('click',toggleTheme);
  document.querySelectorAll('.back-home').forEach(b=>b.addEventListener('click',showHome));
  $('refresh-btn').addEventListener('click',refreshLeague);$('error-retry').addEventListener('click',refreshLeague);
  $('share-btn').addEventListener('click',shareLeague);
  $('group-select').addEventListener('change',()=>{state.group=$('group-select').value;updateJourneys();renderAll();});
  $('status-filter').addEventListener('change',()=>{state.status=$('status-filter').value;renderMatches();});
  document.querySelectorAll('[data-status-chip]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.statusChip;
    if(!['all','pending','played'].includes(next))return;
    $('status-filter').value=next;
    state.status=next;
    renderMatches();
  }));
  $('team-search').addEventListener('input',()=>{
    state.query=$('team-search').value;updateClearSearch();
    if(!searchFrame)searchFrame=requestAnimationFrame(()=>{searchFrame=0;renderMatches();renderTable();renderStats();});
  });
  $('clear-search').addEventListener('click',()=>{$('team-search').value='';state.query='';updateClearSearch();renderMatches();renderTable();renderStats();$('team-search').focus();});
  $('prev-jornada').addEventListener('click',()=>navigateJourney(-1));$('next-jornada').addEventListener('click',()=>navigateJourney(1));
  $('finder-input').addEventListener('input',renderFinder);
  document.addEventListener('click',e=>{
    const card=e.target.closest('.picker-card[data-league]');if(card){openLeague(card.dataset.league);return;}
    const tab=e.target.closest('[data-tab]');if(tab){switchTab(tab.dataset.tab);if(state.league&&window.innerWidth<=760){const tabs=document.querySelector('.tabs');const header=document.querySelector('.site-header');const top=window.scrollY+tabs.getBoundingClientRect().top-(header?.getBoundingClientRect().height||0)-8;window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}return;}
    const journey=e.target.closest('[data-journey]');if(journey){selectJourney(journey.dataset.journey);return;}
    const sort=e.target.closest('[data-sort]');if(sort){const key=sort.dataset.sort;if(!['pts','gf','dg','pj'].includes(key))return;state.sortDir=state.sortKey===key?(state.sortDir==='desc'?'asc':'desc'):'desc';state.sortKey=key;renderTable();return;}
    const team=e.target.closest('[data-team]');if(team){openTeamDetails(team.dataset.team);return;}
    const findLeague=e.target.closest('[data-find-league]');if(findLeague){closeAll();openLeague(findLeague.dataset.findLeague);return;}
    const findTeam=e.target.closest('[data-find-team]');if(findTeam){const {findLeagueKey,findGroup,findTeam:team}=findTeam.dataset;closeAll();openLeague(findLeagueKey,{group:findGroup,query:'',tab:'tabla',profile:team});return;}
    if(e.target.closest('#go-to-team-table')){closeOverlay('team-overlay');switchTab('tabla');focusVisible($('tab-tabla'));$('content-tabla').scrollIntoView({behavior:scrollBehavior()});return;}
    if(e.target.closest('.close-overlay')){closeOverlay(e.target.closest('.overlay').id);return;}
    if(e.target.classList.contains('overlay'))closeOverlay(e.target.id);
  });
  document.querySelector('.tabs')?.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const items=[...document.querySelectorAll('.tabs [data-tab]')];
    if(!items.includes(document.activeElement))return;
    event.preventDefault();
    const idx=items.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(idx+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;
    items[next].focus();switchTab(items[next].dataset.tab);
  });
  document.addEventListener('keydown',e=>{
    const overlay=activeOverlay();
    if(e.key==='Tab'&&overlay){
      const items=[...overlay.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(first&&(!overlay.contains(document.activeElement)||(e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();focusVisible(e.shiftKey?last:first);}
    }
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if($('finder-overlay').hidden)openFinder();else closeOverlay('finder-overlay');}
    if(e.key==='/'&&!typing&&$('finder-overlay').hidden&&$('team-overlay').hidden){e.preventDefault();openFinder();}
    if(e.key==='Escape') {if(!$('finder-overlay').hidden)closeOverlay('finder-overlay');else if(!$('team-overlay').hidden)closeOverlay('team-overlay');}
  });
}
function installLogoFallbacks() {
  document.querySelectorAll('.ap-logo img').forEach(img=>{
    const reveal=()=>{img.style.opacity='1';if(img.previousElementSibling)img.previousElementSibling.style.opacity='0';};
    const restore=()=>img.remove(); // la marca original queda representada por su monograma
    img.addEventListener('load',reveal,{once:true});
    img.addEventListener('error',restore,{once:true});
    if(img.complete){if(img.naturalWidth>0)reveal();else restore();}
  });
  document.querySelectorAll('#league-detail-logo, .finder-result img').forEach(img=>{
    img.addEventListener('error',()=>fallbackLogo(img),{once:true});
    if(img.complete&&img.naturalWidth===0&&img.src.startsWith('https:'))fallbackLogo(img);
  });
  document.addEventListener('error',event=>{
    const img=event.target;
    if(!(img instanceof HTMLImageElement))return;
    const wrapper=img.closest('.crest-with-fallback');
    if(wrapper){img.remove();wrapper.classList.add('crest-image-failed');return;}
    if(img.id==='league-detail-logo')fallbackLogo(img);
  },true);
}
function init() {
  installLogoFallbacks();
  applyTheme(safeRead('bp_theme_2026_apple','light'));
  registerEvents();
  let hash=location.hash;try{hash=decodeURIComponent(hash);}catch{}
  const parts=hash.match(/^#liga\/(polos|bundesladies|bundespuebla|betos)(?:\/(jornadas|tabla|goleo))?$/);
  if(parts)openLeague(parts[1],{tab:parts[2]||'jornadas'});
}
init();

