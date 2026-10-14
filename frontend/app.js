(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
};
let user=null, books=[], cur=null, ch=0, prefs={rt:'light',fs:20,lh:1.7,w:680,al:'left'}, hl='', flashIdx=-1;
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2400)}
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function show(id){['auth','library','reader'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id))}

/* ---------- AUTH ---------- */
let mode='in';
function setMode(m){mode=m;$('#tabIn').setAttribute('aria-selected',m==='in');$('#tabUp').setAttribute('aria-selected',m==='up');
  $('#nameWrap').classList.toggle('hidden',m==='in');$('#aGo').textContent=m==='in'?'Sign in':'Create account';
  $('#authTitle').textContent=m==='in'?'Welcome back':'Start your library';$('#aErr').textContent='';
  $('#aPass').autocomplete=m==='in'?'current-password':'new-password'}
$('#tabIn').onclick=()=>setMode('in');$('#tabUp').onclick=()=>setMode('up');
async function submitAuth(){
  const email=$('#aEmail').value.trim().toLowerCase(), pass=$('#aPass').value, name=$('#aName').value.trim(), err=$('#aErr');
  if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent='Enter a valid email address.';return}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';return}
  const users=store.get('mg:users',{}), h=await hash(pass+email);
  if(mode==='up'){
    if(users[email]){err.textContent='That email already has an account. Sign in instead.';return}
    users[email]={name:name||email.split('@')[0],h};store.set('mg:users',users);
  }else if(!users[email]||users[email].h!==h){err.textContent='Email or password is incorrect.';return}
  store.set('mg:session',email);loadUser(email);
}
$('#aGo').onclick=submitAuth;
[$('#aEmail'),$('#aPass'),$('#aName')].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')submitAuth()}));
$('#logout').onclick=()=>{try{localStorage.removeItem('mg:session')}catch(e){}user=null;$('#aPass').value='';show('auth')};

function loadUser(email){
  user=email;const u=store.get('mg:users',{})[email]||{name:email};
  $('#who').textContent=u.name;
  books=store.get('mg:books:'+email,null);
  if(!books){books=[sample()];persist()}
  prefs=Object.assign(prefs,store.get('mg:prefs:'+email,{}));
  renderLib();show('library');
}
function persist(){if(!store.set('mg:books:'+user,books))toast('Storage is full. Remove a book to save more.')}
function savePrefs(){store.set('mg:prefs:'+user,prefs)}

/* ---------- THEME ---------- */
$('#themeBtn').onclick=()=>{const r=document.documentElement,dark=getComputedStyle(r).getPropertyValue('--bg').trim()==='#0e1513';
  r.dataset.theme=dark?'light':'dark';store.set('mg:theme',r.dataset.theme)};
{const t=store.get('mg:theme',null);if(t)document.documentElement.dataset.theme=t}

/* ---------- LIBRARY ---------- */
const hues=[162,210,18,275,340,45,190,100];
function coverColor(t){let n=0;for(const c of t)n=(n*31+c.charCodeAt(0))>>>0;const h=hues[n%hues.length];return `hsl(${h} 45% 32%)`}
function pct(b){const n=b.chapters.length;if(!n)return 0;return Math.min(100,Math.round(((b.pos.ch+b.pos.f)/n)*100))}
function renderLib(){
  const q=$('#libSearch').value.toLowerCase(), s=$('#libSort').value;
  let list=books.filter(b=>(b.title+' '+b.author).toLowerCase().includes(q));
  list.sort((a,b)=>s==='title'?a.title.localeCompare(b.title):s==='added'?b.added-a.added:(b.last||0)-(a.last||0));
  const g=$('#grid');
  if(!list.length){g.innerHTML='<div class="empty">'+(books.length?'No books match your search.':'Your shelf is empty. Upload a book to begin.')+'</div>';return}
  g.innerHTML=list.map(b=>`<div><button class="book" data-id="${b.id}" aria-label="Open ${esc(b.title)}"><div class="cover" style="background:${coverColor(b.title)}"><b>${esc(b.title)}</b><span>${esc(b.author)}</span></div></button>
  <div class="meta"><div class="bar"><i style="width:${pct(b)}%"></i></div><div class="row"><span>${pct(b)}% read · ${b.marks.length} mark${b.marks.length===1?'':'s'}</span><button data-del="${b.id}">Remove</button></div></div></div>`).join('');
}
$('#grid').addEventListener('click',e=>{
  const d=e.target.closest('[data-del]');
  if(d){const b=books.find(x=>x.id===d.dataset.del);if(b&&confirm('Remove "'+b.title+'" and its bookmarks?')){books=books.filter(x=>x!==b);persist();renderLib()}return}
  const o=e.target.closest('.book');if(o)openBook(o.dataset.id)});
$('#libSearch').oninput=renderLib;$('#libSort').onchange=renderLib;
$('#upBtn').onclick=()=>$('#file').click();
$('#file').onchange=e=>{handleFiles(e.target.files);e.target.value=''};
const drop=$('#drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>handleFiles(e.dataTransfer.files));

/* ---------- PARSING ---------- */
async function handleFiles(files){
  for(const f of files){
    try{
      const ext=f.name.split('.').pop().toLowerCase();let b;
      if(ext==='epub')b=await parseEpub(f);
      else if(ext==='html'||ext==='htm')b=parseHtml(await f.text(),f.name);
      else b=parseText(await f.text(),f.name);
      if(!b.chapters.length)throw new Error('No readable text found');
      b.id=uid();b.added=Date.now();b.pos={ch:0,f:0};b.marks=[];books.push(b);persist();renderLib();toast('Added "'+b.title+'"');
    }catch(err){toast('Could not read '+f.name+': '+err.message)}
  }
}
const base=n=>n.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
function parseText(t,name){
  const lines=t.replace(/\r/g,'').split('\n'),chs=[];let c={t:'Beginning',p:[]},buf=[];
  const flush=()=>{if(buf.length){c.p.push(buf.join(' ').trim());buf=[]}};
  for(const l of lines){
    if(/^\s*(#{1,2}\s+.+|chapter\s+[\divxlc]+\b.*)$/i.test(l)&&l.length<80){flush();if(c.p.length)chs.push(c);c={t:l.replace(/^#+\s*/,'').trim(),p:[]}}
    else if(!l.trim())flush();else buf.push(l.trim());
  }
  flush();if(c.p.length)chs.push(c);
  const out=[];chs.forEach(x=>{if(x.p.length>60){for(let i=0;i<x.p.length;i+=40)out.push({t:x.t+(i?' (cont.)':''),p:x.p.slice(i,i+40)})}else out.push(x)});
  return{title:base(name),author:'Unknown author',chapters:out}
}
function domParas(doc){return [...doc.body.querySelectorAll('p,h1,h2,h3,h4,li,blockquote')].map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean)}
function parseHtml(s,name){
  const d=new DOMParser().parseFromString(s,'text/html');
  const title=(d.title||base(name)).trim();const p=domParas(d);
  return{title,author:'Unknown author',chapters:p.length?[{t:title,p}]:[]}
}
async function parseEpub(f){
  if(!window.JSZip)throw new Error('EPUB support failed to load');
  const z=await JSZip.loadAsync(await f.arrayBuffer());
  const rd=async p=>{const e=z.file(decodeURIComponent(p));if(!e)throw new Error('Missing '+p);return e.async('string')};
  const x=s=>new DOMParser().parseFromString(s,'application/xml');
  const cont=x(await rd('META-INF/container.xml'));
  const opfPath=cont.querySelector('rootfile').getAttribute('full-path');
  const opf=x(await rd(opfPath)),dir=opfPath.includes('/')?opfPath.replace(/[^/]+$/,''):'';
  const man={};opf.querySelectorAll('manifest > item').forEach(i=>man[i.getAttribute('id')]=i.getAttribute('href'));
  const title=(opf.getElementsByTagNameNS('*','title')[0]||{}).textContent||base(f.name);
  const author=(opf.getElementsByTagNameNS('*','creator')[0]||{}).textContent||'Unknown author';
  const chapters=[];let n=1;
  for(const ref of opf.querySelectorAll('spine > itemref')){
    const href=man[ref.getAttribute('idref')];if(!href)continue;
    try{
      const d=new DOMParser().parseFromString(await rd(dir+href),'text/html');
      const p=domParas(d);if(!p.length)continue;
      const h=d.querySelector('h1,h2,h3');
      chapters.push({t:(h&&h.textContent.trim())||('Section '+n),p});n++;
    }catch(e){}
  }
  return{title:title.trim(),author:author.trim(),chapters}
}
function sample(){
  const P=['Leafline are the notes readers leave at the edge of a page. This app gives you a place for them.','Use the Contents button to jump between chapters. Your place is saved automatically, so you can close the book and return to the same spot.','Tap the bookmark icon to save the current position with a short snippet of text.'];
  return{id:uid(),title:'Welcome to Leafline',author:'The Leafline team',added:Date.now(),last:Date.now(),pos:{ch:0,f:0},marks:[],chapters:[
    {t:'Getting started',p:P.concat(['Upload your own EPUB, TXT, Markdown or HTML files from the library. Drag and drop works too.'])},
    {t:'Reading comfortably',p:['Open Aa to change the theme, text size, spacing, width and alignment. Sepia is easy on the eyes in the evening.','Open Search to find any word across the whole book. Results link to the exact paragraph, which is highlighted when you arrive.','Keyboard shortcuts: left and right arrows change chapters, B adds a bookmark, and / opens search.']},
    {t:'Your data',p:['Books, progress and bookmarks are stored in this browser for your account. Browser storage is limited to a few megabytes, so very large books may not fit.','To sync across devices, connect this front end to a backend that stores users and files.']}]}
}

/* ---------- READER ---------- */
const scroller=$('#scroller'),R=$('#reader');
function openBook(id){
  cur=books.find(b=>b.id===id);if(!cur)return;
  cur.last=Date.now();persist();hl='';
  $('#rTitle').textContent=cur.title;applyPrefs();show('reader');
  loadChapter(cur.pos.ch,cur.pos.f);
}
function loadChapter(i,f=0,flash=-1){
  ch=Math.max(0,Math.min(cur.chapters.length-1,i));const c=cur.chapters[ch];
  const re=hl?new RegExp(hl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'):null;
  const mk=t=>re?esc(t).replace(new RegExp(esc(hl).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>'<mark>'+m+'</mark>'):esc(t);
  $('#page').innerHTML='<h2>'+esc(c.t)+'</h2>'+c.p.map((t,k)=>`<p data-i="${k}">${mk(t)}</p>`).join('');
  $('#chLabel').textContent='Ch. '+(ch+1)+'/'+cur.chapters.length;
  $('#prev').disabled=ch===0;$('#next').disabled=ch===cur.chapters.length-1;
  requestAnimationFrame(()=>{
    if(flash>=0){const p=$('#page [data-i="'+flash+'"]');if(p){p.scrollIntoView({block:'center'});p.classList.add('flash');setTimeout(()=>p.classList.remove('flash'),2500)}}
    else scroller.scrollTop=f*(scroller.scrollHeight-scroller.clientHeight);
    track();
  });
  renderToc();
}
function frac(){const m=scroller.scrollHeight-scroller.clientHeight;return m>0?scroller.scrollTop/m:0}
let tt;function track(){
  if(!cur)return;const f=frac();cur.pos={ch,f};
  const total=((ch+f)/cur.chapters.length)*100;
  $('#pBar').style.width=total+'%';$('#pPct').textContent=Math.round(total)+'%';
  clearTimeout(tt);tt=setTimeout(persist,600);
}
scroller.addEventListener('scroll',track,{passive:true});
$('#prev').onclick=()=>loadChapter(ch-1);$('#next').onclick=()=>loadChapter(ch+1);
$('#rBack').onclick=()=>{persist();closePanels();show('library');renderLib()};

/* panels */
const panels=['pToc','pSearch','pMarks','pSet'];
function closePanels(){panels.forEach(p=>$('#'+p).classList.add('hidden'))}
function toggle(id){const open=$('#'+id).classList.contains('hidden');closePanels();if(open)$('#'+id).classList.remove('hidden');return open}
$$('[data-close]').forEach(b=>b.onclick=closePanels);
$('#rToc').onclick=()=>toggle('pToc');
$('#rSearch').onclick=()=>{if(toggle('pSearch'))$('#qIn').focus()};
$('#rList').onclick=()=>{if(toggle('pMarks'))renderMarks()};
$('#rSet').onclick=()=>{if(toggle('pSet'))syncSeg()};
function renderToc(){
  $('#tocList').innerHTML=cur.chapters.map((c,i)=>`<button class="item ${i===ch?'on':''}" data-ch="${i}">${esc(c.t)}</button>`).join('');
}
$('#tocList').onclick=e=>{const b=e.target.closest('[data-ch]');if(b){loadChapter(+b.dataset.ch);closePanels()}};

/* bookmarks */
function addMark(){
  const f=frac(),ps=[...$$('#page p')];
  const vis=ps.find(p=>p.getBoundingClientRect().bottom>scroller.getBoundingClientRect().top+20)||ps[0];
  const snip=vis?vis.textContent.slice(0,110):'';
  cur.marks.push({id:uid(),ch,f,snip,date:Date.now()});persist();toast('Bookmark added');
}
$('#rMark').onclick=addMark;
function renderMarks(){
  const m=cur.marks.slice().sort((a,b)=>a.ch-b.ch||a.f-b.f);
  $('#markList').innerHTML=m.length?m.map(k=>`<div style="display:flex;align-items:flex-start"><button class="item" data-go="${k.id}"><b>${esc(cur.chapters[k.ch].t)}</b><small>${esc(k.snip)}…</small><small>${new Date(k.date).toLocaleDateString()}</small></button><button class="icon" data-rm="${k.id}" aria-label="Delete bookmark">✕</button></div>`).join(''):'<div class="empty">No bookmarks yet. Tap the bookmark icon while reading.</div>';
}
$('#markList').onclick=e=>{
  const g=e.target.closest('[data-go]'),r=e.target.closest('[data-rm]');
  if(g){const k=cur.marks.find(x=>x.id===g.dataset.go);loadChapter(k.ch,k.f);closePanels()}
  if(r){cur.marks=cur.marks.filter(x=>x.id!==r.dataset.rm);persist();renderMarks()}
};

/* search */
let st;$('#qIn').oninput=()=>{clearTimeout(st);st=setTimeout(doSearch,200)};
function doSearch(){
  const q=$('#qIn').value.trim(),out=$('#qRes');hl=q.length>1?q:'';
  if(q.length<2){out.innerHTML='<div class="empty">Type at least 2 letters.</div>';loadChapter(ch,frac());return}
  const ql=q.toLowerCase(),res=[];
  cur.chapters.forEach((c,ci)=>c.p.forEach((t,pi)=>{const i=t.toLowerCase().indexOf(ql);if(i>-1&&res.length<200)res.push({ci,pi,s:(i>40?'…':'')+t.slice(Math.max(0,i-40),i+80)})}));
  out.innerHTML=res.length?`<p class="note">${res.length}${res.length===200?'+':''} result${res.length===1?'':'s'}</p>`+res.map((r,k)=>`<button class="item" data-r="${k}"><b>${esc(cur.chapters[r.ci].t)}</b><small>${esc(r.s)}</small></button>`).join(''):'<div class="empty">No matches for "'+esc(q)+'".</div>';
  out._res=res;loadChapter(ch,frac());
}
$('#qRes').onclick=e=>{const b=e.target.closest('[data-r]');if(!b)return;const r=$('#qRes')._res[+b.dataset.r];loadChapter(r.ci,0,r.pi);if(innerWidth<760)closePanels()};

/* settings */
function applyPrefs(){
  R.dataset.rt=prefs.rt;const p=$('#page');
  p.style.setProperty('--fs',prefs.fs+'px');p.style.setProperty('--lh',prefs.lh);p.style.setProperty('--measure',prefs.w+'px');p.style.setProperty('--al',prefs.al);
}
function syncSeg(){$$('.seg[data-k]').forEach(s=>[...s.children].forEach(b=>b.setAttribute('aria-pressed',String(prefs[s.dataset.k])===b.dataset.v)))}
$$('.seg[data-k]').forEach(s=>s.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const k=s.dataset.k,v=b.dataset.v;
  prefs[k]=(k==='lh'||k==='w')?+v:v;applyPrefs();syncSeg();savePrefs()}));
$('#fsM').onclick=()=>{prefs.fs=Math.max(14,prefs.fs-2);applyPrefs();savePrefs()};
$('#fsP').onclick=()=>{prefs.fs=Math.min(34,prefs.fs+2);applyPrefs();savePrefs()};

/* keyboard */
document.addEventListener('keydown',e=>{
  if(R.classList.contains('hidden')||/INPUT|SELECT/.test(e.target.tagName))return;
  if(e.key==='ArrowRight')loadChapter(ch+1);
  else if(e.key==='ArrowLeft')loadChapter(ch-1);
  else if(e.key==='b'||e.key==='B')addMark();
  else if(e.key==='/'){e.preventDefault();$('#rSearch').click()}
  else if(e.key==='Escape')closePanels();
});

/* boot */
setMode('in');
const s=store.get('mg:session',null);
if(s&&store.get('mg:users',{})[s])loadUser(s);else show('auth');
})();
