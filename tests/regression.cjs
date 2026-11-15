'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function setup(){
 const nodes=new Map(),events={},frames=[];
 const document={activeElement:null,body:{style:{},classList:{add(){},remove(){}}},documentElement:{style:{setProperty(){}},dataset:{}},getElementById:id=>node(id),querySelector:s=>node(s),querySelectorAll:()=>[],addEventListener:(type,fn)=>{(events[type]??=[]).push(fn)}};
 function node(id){if(nodes.has(id))return nodes.get(id);const n={id,hidden:id.endsWith('-overlay'),dataset:{},value:'',textContent:'',innerHTML:'',isConnected:true,disabled:false,tabIndex:0,attrs:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},listeners:{},parent:null,
 setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},focus(){document.activeElement=this},closest(){for(let n=this;n;n=n.parent)if(n.hidden||'inert' in n.attrs)return n;return null},querySelector(){return node(id+'-button')},querySelectorAll(){return this.children||[]},getClientRects(){return this.hidden?[]:[{}]},contains(t){return t===this||(this.children||[]).includes(t)},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){},remove(){this.isConnected=false},replaceChildren(){},getBoundingClientRect(){return {left:0,right:300,top:0,height:60}}};nodes.set(id,n);return n}
 const context=vm.createContext({document,console:{warn(){},error(){}},URL,DOMException,AbortController,setTimeout,clearTimeout,Date,Map,Set,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.push(fn);return frames.length},localStorage:{getItem(){return null},setItem(){}},history:{replaceState(){}},location:{pathname:'/',search:'',hash:''},window:{scrollTo(){},innerWidth:390},navigator:{},fetch:async()=>{throw Error('offline')}});
 const run=code=>vm.runInContext(code,context);
 run(fs.readFileSync(root+'/assets/config.js','utf8'));
 run(fs.readFileSync(root+'/assets/data.js','utf8'));
 run(fs.readFileSync(root+'/assets/app.js','utf8').replace(/init\(\);\s*$/,''));
 return {run,node,context,document,events,frames};
}
test('finder retries after total failure; only four standings requests',async()=>{
 const h=setup();await h.run('loadIndex()');assert.equal(h.run('indexData'),null);assert.equal(h.run('indexIncomplete'),true);
 let urls=[];h.context.fetch=async url=>{urls.push(url);return {ok:true,text:async()=>',A,Club prueba,1,0,0,0,2,0,2,3,'}};
 h.run('openFinder()');await h.run('indexPromise');await new Promise(setImmediate);
 assert.equal(h.run('indexData.length'),4);assert.equal(h.run('indexIncomplete'),false);assert.equal(urls.length,4);
 assert.ok(urls.every(url=>h.run('leagueKeys.map(k=>CONFIG[k].tablasUrl)').includes(url)));
 h.run("closeOverlay('finder-overlay');openFinder()");assert.equal(urls.length,4,'fresh index is reused');
});
test('partial finder failure retains cached clubs and signals incomplete data',async()=>{
 const h=setup();h.run("indexData=[{team:'Anterior',group:'A',league:leagueKeys[0]}]");const failed=h.run('CONFIG[leagueKeys[0]].tablasUrl');
 h.context.fetch=async url=>{if(url===failed)throw Error('offline');return {ok:true,text:async()=>',A,Nuevo,1,0,0,0,2,0,2,3,'}};
 await h.run('loadIndex()');assert.equal(h.run('indexData.length'),4);assert.equal(h.run('indexData[0].team'),'Anterior');assert.equal(h.run('indexIncomplete'),true);
});
test('profile counts every played match, while showing last three results',()=>{
 const h=setup();h.run("state.league='polos';state.group='A';state.data={standings:[],crests:{},matches:Array.from({length:5},(_,i)=>({grupo:'A',jornada:i+1,local:'Equipo',visitante:'Rival',marcadorLocal:'2',marcadorVisitante:'1'}))};openTeamDetails('Equipo')");
 assert.match(h.node('team-dialog-body').innerHTML,/<strong>5<\/strong><small>Partidos/);
 assert.equal((h.node('team-dialog-body').innerHTML.match(/class="mini-game"/g)||[]).length,4);
});
test('only one modal stays open; finder focuses input and restores original focus',()=>{
 const h=setup();const origin=h.node('open-search');h.document.activeElement=origin;
 h.run("openOverlay('team-overlay');openOverlay('finder-overlay')");
 assert.equal(h.node('team-overlay').hidden,true);assert.equal(h.document.activeElement,h.node('finder-input'));
 assert.ok('inert' in h.node('.site-shell').attrs);
 h.run("closeOverlay('finder-overlay')");assert.equal(h.document.activeElement,origin);assert.equal('inert' in h.node('.site-shell').attrs,false);
});
test('Tab and Shift+Tab remain inside modal',()=>{
 const h=setup();const first=h.node('finder-input'),last=h.node('finder-close');const overlay=h.node('finder-overlay');overlay.children=[first,last];first.parent=last.parent=overlay;
 h.run('registerEvents();openOverlay("finder-overlay")');
 let prevented=false;h.document.activeElement=last;for(const fn of h.events.keydown)fn({key:'Tab',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(h.document.activeElement,first);
 h.document.activeElement=first;for(const fn of h.events.keydown)fn({key:'Tab',shiftKey:true,preventDefault(){}});
 assert.equal(h.document.activeElement,last);
});
test('failed league request ends loading in all panels and clears busy state',async()=>{
 const h=setup();await h.run("openLeague('polos')");assert.equal(h.node('error-display').hidden,false);
 assert.match(h.node('goleo-individual-body').innerHTML,/No se pudieron cargar/);assert.equal(h.node('league-view').attrs['aria-busy'],undefined);
 assert.equal(h.node('kpi-matches').textContent,'Datos no disponibles');
});
test('refresh keeps filter, query, group, journey and sort options',async()=>{
 const h=setup();h.run("state.league='polos';state.group='B';state.journey='5';state.tab='tabla';state.query='Equipo';state.status='played';state.sortKey='gf';state.sortDir='asc';openLeague=async (k,o)=>{globalThis.refreshOptions=o}");
 await h.run('refreshLeague()');assert.deepEqual(JSON.parse(h.run('JSON.stringify(refreshOptions)')),{group:'B',journey:'5',tab:'tabla',query:'Equipo',status:'played',sortKey:'gf',sortDir:'asc'});assert.equal(h.node('refresh-btn').disabled,false);
});
test('aborted request passes aborted signal and never populates cache',async()=>{
 const h=setup();let aborted=false;h.context.fetch=async(url,{signal})=>{aborted=signal.aborted;throw new DOMException('Aborted','AbortError')};
 const controller=new AbortController();controller.abort();h.context.cancelled=controller.signal;
 await assert.rejects(h.run("fetchCSV('https://example.test','test',{signal:cancelled})"));assert.equal(aborted,true);assert.equal(h.run('cache.size'),0);
});
test('typing batches render work into one animation frame',()=>{
 const h=setup();h.run('registerEvents();globalThis.renders=0;renderMatches=renderTable=renderStats=()=>renders++');
 h.node('team-search').value='Equ';h.node('team-search').listeners.input();h.node('team-search').value='Equipo';h.node('team-search').listeners.input();
 assert.equal(h.frames.length,1);assert.equal(h.run('renders'),0);h.frames[0]();assert.equal(h.run('renders'),3);assert.equal(h.run('state.query'),'Equipo');
});
test('table markup supports keyboard scrolling and named column headers',()=>{
 const html=fs.readFileSync(root+'/index.html','utf8');assert.match(html,/class="table-scroll" tabindex="0" role="region" aria-label=/);assert.equal((html.match(/<th scope="col"/g)||[]).length,12);
});
test('qualification limits and pending scores remain unchanged',()=>{
 const h=setup();assert.equal(h.run("qualifyingPositions('polos')"),8);assert.equal(h.run("qualifyingPositions('bundesladies')"),8);assert.equal(h.run("qualifyingPositions('bundespuebla')"),4);assert.equal(h.run("qualifyingPositions('betos')"),4);
 assert.equal(h.run("played({marcadorLocal:'',marcadorVisitante:''})"),false);assert.equal(h.run("played({marcadorLocal:'0',marcadorVisitante:'0'})"),true);
});

test('sort headers announce only the selected column and Spanish order',()=>{
 const h=setup();const buttons=['pts','gf'].map(key=>{const button=h.node('sort-'+key);button.dataset.sort=key;const th=h.node('th-'+key);button.closest=()=>th;return button});
 h.document.querySelectorAll=selector=>selector==='[data-sort]'?buttons:[];
 h.run("state.data={standings:[]};state.sortKey='gf';state.sortDir='asc';renderTable()");
 assert.equal(h.node('th-gf').attrs['aria-sort'],'ascending');assert.equal(h.node('th-pts').attrs['aria-sort'],undefined);
 assert.match(h.node('sort-gf').attrs['aria-label'],/goles a favor.*ascendente/);
});

test('late response from previous league cannot overwrite current league',async()=>{
 const h=setup();h.run("globalThis.pending={};getLeagueData=key=>new Promise(resolve=>pending[key]=resolve);loadLeagueData=data=>{state.data=data}");
 const first=h.run("openLeague('polos')");const second=h.run("openLeague('betos')");
 h.run("pending.betos({source:'betos'})");await second;h.run("pending.polos({source:'polos'})");await first;
 assert.equal(h.run('state.league'),'betos');assert.equal(h.run('state.data.source'),'betos');
});
test('returning home during load prevents late data from reopening league',async()=>{
 const h=setup();h.run("getLeagueData=()=>new Promise(resolve=>globalThis.resolveLoad=resolve);loadLeagueData=data=>{state.data=data}");
 const request=h.run("openLeague('polos')");h.run("showHome();resolveLoad({source:'polos'})");await request;
 assert.equal(h.run('state.league'),null);assert.equal(h.run('state.data'),null);assert.equal(h.node('league-view').hidden,true);assert.equal(h.node('home-wrapper').hidden,false);
});
test('programmatic scroll respects reduced motion preference',()=>{
 const h=setup();assert.equal(h.run('scrollBehavior()'),'smooth');h.context.matchMedia=()=>({matches:true});assert.equal(h.run('scrollBehavior()'),'auto');
});
