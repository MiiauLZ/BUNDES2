/**
 * Fuentes CSV publicadas. Funciones puras compartidas por el portal y las pruebas.
 * Contrato: resultados con bloques de 18 columnas; posiciones con columnas 1-11; goleadores 0-3.
 */
'use strict';
function norm(x) { return String(x ?? '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function esc(x) { return String(x ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

function safeUrl(str) { try { const u = new URL(String(str)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }

function played(match) { return [match?.marcadorLocal, match?.marcadorVisitante].every(raw => /^\d+$/.test(String(raw ?? '').trim()) && Number.isSafeInteger(Number(raw))); }

function score(match) { return played(match) ? `${match.marcadorLocal} - ${match.marcadorVisitante}` : 'VS'; }

function pointsOrder(a,b) { return b.pts - a.pts || b.dg-a.dg || b.gf-a.gf || a.equipo.localeCompare(b.equipo,'es'); }

function csvRows(raw) {
  const rows=[];let row=[],cell='',quoted=false;
  const str=String(raw||'').replace(/^\uFEFF/,'');
  for(let i=0;i<str.length;i++) {
    const c=str[i];
    if(c==='"') { if(quoted && str[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&str[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}

function parseData(matchesCSV,standingsCSV,scorersCSV) {
  const matches=[], standings=[], scorers=[], crests={},groups=new Set();
  // Keep the original Google Sheet column format. Each results block is 18 columns wide.
  for(const row of csvRows(matchesCSV)) {
    for(let offset=0;offset+12<row.length;offset+=18){
      const group=String(row[offset+5]||'').trim();
      const home=String(row[offset+7]||'').trim();
      const away=String(row[offset+12]||'').trim();
      if(!group||!home||!away||norm(home)==='local'||norm(group)==='grupo')continue;
      const journey=parseInt(String(row[offset+6]||'').replace(/\D/g,''),10);
      if(!Number.isFinite(journey) || journey<1)continue;
      groups.add(group);
      matches.push({grupo:group,jornada:journey,local:home,visitante:away,marcadorLocal:String(row[offset+8]||'').trim(),msLocal:String(row[offset+9]||'').trim(),msVisitante:String(row[offset+10]||'').trim(),marcadorVisitante:String(row[offset+11]||'').trim()});
    }
  }
  for(const row of csvRows(standingsCSV)) {
    const group=String(row[1]||'').trim(), name=String(row[2]||'').trim();
    if(row.length<11||!group||!name||norm(group)==='grupo'||norm(name)==='equipo')continue;
    groups.add(group);
    const rawLogo=String(row[11]||'').trim();
    const logoLink=rawLogo.match(/https?:\/\/[^\s"')]+/i);
    if(logoLink && safeUrl(logoLink[0]))crests[`${norm(group)}|${norm(name)}`]=safeUrl(logoLink[0]);
    const num=i=>parseInt(row[i],10)||0;
    standings.push({grupo:group,equipo:name,v:num(3),d:num(4),gs:num(5),ps:num(6),gf:num(7),gc:num(8),dg:num(9),pts:num(10)});
  }
  for(const row of csvRows(scorersCSV)) {
    const name=String(row[1]||'').trim();if(row.length<4||!name||norm(name)==='jugador')continue;
    const rawGoals=String(row[3]||'').trim();
    if(rawGoals!==''&&!/^\d+$/.test(rawGoals))continue;
    scorers.push({grupo:String(row[0]||'A').trim().toUpperCase(),jugador:name,equipo:String(row[2]||'-').trim(),goles:Number(rawGoals)||0});
  }
  return {matches,standings,scorers,crests,groups:[...groups].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}))};
}

/** Determina los cupos de acceso a la fase final de manera explícita por torneo. */
function qualifyingPositions(leagueKey) {
  return ['polos', 'bundesladies'].includes(leagueKey) ? 8 : 4;
}

/** Desempata un partido empatado solo si existe shootout válido; evita derrotas ficticias. */
function matchResultForTeam(match, teamKey) {
  if(!played(match)) return null;
  const home=norm(match.local)===teamKey;
  const gf=Number(home?match.marcadorLocal:match.marcadorVisitante);
  const ga=Number(home?match.marcadorVisitante:match.marcadorLocal);
  if(gf>ga) return 'W';
  if(gf<ga) return 'L';
  const own=home?match.msLocal:match.msVisitante;
  const other=home?match.msVisitante:match.msLocal;
  if(!/^\d+$/.test(String(own ?? '').trim()) || !/^\d+$/.test(String(other ?? '').trim())) return 'D';
  if(Number(own)>Number(other)) return 'SO-W';
  if(Number(own)<Number(other)) return 'SO-L';
  return 'D';
}
