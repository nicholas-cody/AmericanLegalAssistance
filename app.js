(()=>{'use strict';
const $=id=>document.getElementById(id);
$('year').textContent=String(new Date().getFullYear());
const askTab=$('ask-tab'),docTab=$('doc-tab'),helpTab=$('help-tab');
function setTab(which){
 const ask=which==='ask',doc=which==='doc',help=which==='help';
 askTab.classList.toggle('selected',ask);docTab.classList.toggle('selected',doc);helpTab.classList.toggle('selected',help);
 askTab.setAttribute('aria-selected',String(ask));docTab.setAttribute('aria-selected',String(doc));helpTab.setAttribute('aria-selected',String(help));
 $('ask-panel').classList.toggle('hidden',!ask);$('doc-panel').classList.toggle('hidden',!doc);$('help-panel').classList.toggle('hidden',!help);
 history.replaceState(null,'',doc?'#pleading-paper':help?'#help':'#ask');
}
askTab.addEventListener('click',()=>setTab('ask'));docTab.addEventListener('click',()=>setTab('doc'));helpTab.addEventListener('click',()=>setTab('help'));
$('pleading-help-link').addEventListener('click',()=>setTab('help'));$('help-open-pleading').addEventListener('click',()=>setTab('doc'));$('help-open-ask').addEventListener('click',()=>setTab('ask'));
if(location.hash==='#pleading-paper')setTab('doc');else if(location.hash==='#help')setTab('help');
for(const b of document.querySelectorAll('[data-question]')) b.addEventListener('click',()=>{$('question').value=b.dataset.question;$('question').focus();});
let config={turnstileSiteKey:null,ready:false};let widgetId=null;const historyTurns=[];
const clearChat=$('clear-chat');if(clearChat)clearChat.addEventListener('click',()=>{historyTurns.length=0;$('conversation').replaceChildren();$('question').value='';$('ask-ideas').classList.remove('hidden');$('question').focus();});
function showBubble(kind,text){const item=document.createElement('div');item.className='bubble '+kind;if(kind==='answer'){const title=document.createElement('span');title.className='answer-label';title.textContent='AI-generated general information';item.append(title);}item.append(document.createTextNode(text));$('conversation').append(item);item.scrollIntoView({behavior:'smooth',block:'nearest'});return item;}

function buildFivePointGuide(guide){
 const labels=[['understand','Understand'],['gather','Gather'],['verify','Verify'],['options','Options'],['document','Document start']];
 const panel=document.createElement('section');panel.className='five-point-guide';panel.setAttribute('aria-label','ALA Five-Point Guide');
 const head=document.createElement('div');head.className='five-guide-head';const star=document.createElement('span');star.className='five-guide-star';star.textContent='★';star.setAttribute('aria-hidden','true');const headText=document.createElement('div');const title=document.createElement('strong');title.textContent='ALA Five-Point Guide';const sub=document.createElement('small');sub.textContent='Our signature quick map from the answer to an organized next step.';headText.append(title,sub);head.append(star,headText);panel.append(head);
 const list=document.createElement('ol');list.className='five-guide-list';for(const [key,label] of labels){const li=document.createElement('li');const wrap=document.createElement('div');const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.textContent=String(guide[key]||'Review the answer above and verify current requirements with the relevant official source.');wrap.append(h,p);li.append(wrap);list.append(li);}panel.append(list);
 const foot=document.createElement('div');foot.className='five-guide-footer';const note=document.createElement('span');note.className='five-guide-note';note.textContent='A navigation aid, not legal advice or a filing checklist. Verify rules and deadlines with the court or a licensed attorney.';const copy=document.createElement('button');copy.type='button';copy.className='guide-copy';copy.textContent='Copy guide';copy.addEventListener('click',async()=>{const text=labels.map(([key,label],i)=>`${i+1}. ${label}: ${guide[key]||''}`).join('\n\n');try{await navigator.clipboard.writeText(text);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy guide',1600);}catch{copy.textContent='Copy failed';setTimeout(()=>copy.textContent='Copy guide',1600);}});foot.append(note,copy);panel.append(foot);return panel;
}

async function init(){try{const res=await fetch('/api/config',{cache:'no-store'});if(!res.ok) return;config=await res.json();if(config.turnstileSiteKey) await loadTurnstile();}catch{}}
function loadTurnstile(){return new Promise((resolve)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{if(window.turnstile){$('turnstile-slot').hidden=false;widgetId=window.turnstile.render('#turnstile-slot',{sitekey:config.turnstileSiteKey,theme:'light',size:'normal'});}resolve();};script.onerror=resolve;document.head.append(script);});}
$('ask-form').addEventListener('submit',async e=>{
 e.preventDefault();const question=$('question').value.trim();if(!question)return;
 const button=$('ask-submit');button.disabled=true;button.textContent='Thinking…';$('ask-ideas').classList.add('hidden');showBubble('question',question);$('question').value='';
 try{
  let token=null;if(config.turnstileSiteKey){token=window.turnstile&&widgetId!==null?window.turnstile.getResponse(widgetId):null;if(!token)throw Error('Complete the verification below the question box, then try again.');}
  const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,jurisdiction:$('state').value,history:historyTurns,turnstileToken:token})});let data={};try{data=await r.json();}catch{}if(!r.ok)throw Error(data.error||'The AI is unavailable.');
  const answerBubble=showBubble('answer',data.answer);
  const actions=document.createElement('div');actions.className='answer-actions';
  if(data.guide&&typeof data.guide==='object'){
   const guideButton=document.createElement('button');guideButton.type='button';guideButton.className='secondary five-guide-button';guideButton.innerHTML='<span class="guide-button-star" aria-hidden="true">★</span> ALA Five-Point Guide';
   const guidePanel=buildFivePointGuide(data.guide);guidePanel.hidden=true;
   guideButton.addEventListener('click',()=>{guidePanel.hidden=!guidePanel.hidden;guideButton.setAttribute('aria-expanded',String(!guidePanel.hidden));if(!guidePanel.hidden)guidePanel.scrollIntoView({behavior:'smooth',block:'nearest'});});guideButton.setAttribute('aria-expanded','false');actions.append(guideButton);answerBubble.append(actions,guidePanel);
  }else answerBubble.append(actions);
  const toDoc=document.createElement('button');toDoc.type='button';toDoc.className='secondary to-doc';toDoc.textContent='Use this text on pleading paper ↗';toDoc.addEventListener('click',()=>{if(blocks.some(b=>b.text.trim())&&!confirm('Add the AI-generated text as another paragraph?'))return;addBlock('paragraph',data.answer);setTab('doc');const last=$('document-blocks').lastElementChild;const edit=last&&last.querySelector('textarea');if(edit)edit.focus();});actions.append(toDoc);
  historyTurns.push({role:'user',content:question},{role:'assistant',content:data.answer});while(historyTurns.length>4)historyTurns.shift();
 }catch(err){showBubble('error',err.message||'Something went wrong. Please try again.');}finally{button.disabled=false;button.innerHTML='Ask <span aria-hidden="true">↗</span>';if(window.turnstile&&widgetId!==null)window.turnstile.reset(widgetId);$('question').focus();}
});
init();

const fieldMap={person:'person',address:'address',contact:'contact',county:'county',plaintiff:'plaintiff',defendant:'defendant',caseNumber:'case-number',title:'doc-title'};
const blocks=[];
const labels={heading:'Centered section heading',subheading:'Left-aligned subheading',paragraph:'Body paragraph',numbered:'Numbered paragraph',blank:'Blank line / spacing'};
const fontDefaults={heading:12,subheading:11,paragraph:11,numbered:11,blank:11};
const DRAFT_KEY='american-legal-assistance-pleading-draft-v3';
let saveTimer=null;

function normalizedFont(kind,value){const n=Number(value);return Number.isFinite(n)?Math.max(8,Math.min(16,Math.round(n))):(fontDefaults[kind]||11);}
function normalizeBlock(block){const kind=block&&labels[block.kind]?block.kind:'paragraph';return{kind,text:kind==='blank'?'':String(block&&block.text||''),fontSize:normalizedFont(kind,block&&block.fontSize)};}
function updateSaveStatus(message){const el=$('autosave-status');if(el)el.textContent=message;}
function draftPayload(){return{version:3,updatedAt:Date.now(),fields:Object.fromEntries(Object.entries(fieldMap).map(([key,id])=>[key,$(id).value])),blocks:blocks.map(b=>({...b}))};}
function saveDraft(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}try{const payload=draftPayload();localStorage.setItem(DRAFT_KEY,JSON.stringify(payload));const time=new Date(payload.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});updateSaveStatus(`Saved locally at ${time}. You can leave this page and come back.`);}catch{updateSaveStatus('Autosave could not use this browser’s local storage. Download a Word copy before leaving.');}}
function scheduleSave(){if(saveTimer)clearTimeout(saveTimer);updateSaveStatus('Saving…');saveTimer=setTimeout(saveDraft,250);}
function loadDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw){drawBlocks();updateSaveStatus('Autosave is on for this device.');return;}const data=JSON.parse(raw);if(data&&data.fields){for(const [key,id] of Object.entries(fieldMap)){if(Object.prototype.hasOwnProperty.call(data.fields,key))$(id).value=String(data.fields[key]??'');}}blocks.length=0;if(Array.isArray(data&&data.blocks))for(const b of data.blocks.slice(0,75))blocks.push(normalizeBlock(b));drawBlocks();if(data.updatedAt){const when=new Date(data.updatedAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});updateSaveStatus(`Draft restored from this browser · last saved ${when}.`);}else updateSaveStatus('Draft restored from this browser.');}catch{drawBlocks();updateSaveStatus('Autosave is on, but the previous local draft could not be restored.');}}

function drawBlocks(){
 const host=$('document-blocks');host.replaceChildren();
 for(let i=0;i<blocks.length;i++){
  const data=blocks[i],card=document.createElement('div');card.className='doc-block';card.dataset.kind=data.kind;
  const bar=document.createElement('div');bar.className='block-top';const tag=document.createElement('span');tag.className='block-tag';tag.textContent=labels[data.kind];bar.append(tag);
  if(data.kind!=='blank'){
   const controls=document.createElement('span');controls.className='font-controls';
   const down=document.createElement('button');down.type='button';down.textContent='A−';down.title='Decrease this section font size';down.setAttribute('aria-label',`Decrease font size for section ${i+1}`);down.disabled=data.fontSize<=8;down.addEventListener('click',()=>adjustFont(i,-1));
   const size=document.createElement('span');size.className='font-size-label';size.textContent=`${data.fontSize} pt`;size.setAttribute('aria-label',`Font size ${data.fontSize} point`);
   const up=document.createElement('button');up.type='button';up.textContent='A+';up.title='Increase this section font size';up.setAttribute('aria-label',`Increase font size for section ${i+1}`);up.disabled=data.fontSize>=16;up.addEventListener('click',()=>adjustFont(i,1));
   controls.append(down,size,up);bar.append(controls);
  }
  for(const [text,fn,disabled] of [['↑',()=>moveBlock(i,-1),i===0],['↓',()=>moveBlock(i,1),i===blocks.length-1],['Remove',()=>removeBlock(i),false]]){
   const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=disabled;button.setAttribute('aria-label',`${text} section ${i+1}`);button.addEventListener('click',fn);bar.append(button);
  }card.append(bar);
  if(data.kind==='blank'){const info=document.createElement('p');info.textContent='One empty numbered line will be inserted.';card.append(info);}
  else {const edit=document.createElement('textarea');edit.rows=data.kind==='paragraph'||data.kind==='numbered'?4:2;
   edit.maxLength=14000;edit.value=data.text;edit.placeholder=data.kind==='heading'?'E.g. FACTUAL BACKGROUND':data.kind==='subheading'?'E.g. Parties':'Type your paragraph here…';
   edit.style.fontSize=`${Math.max(11,data.fontSize)}px`;edit.setAttribute('aria-label',`${labels[data.kind]} ${i+1}`);
   edit.addEventListener('input',()=>{data.text=edit.value;scheduleSave();});card.append(edit);
  }host.append(card);
 }
}
function addBlock(kind,text=''){
 if(blocks.length>=75){alert('The editor is limited to 75 sections per document.');return;}
 blocks.push({kind,text,fontSize:fontDefaults[kind]||11});drawBlocks();scheduleSave();
}
function removeBlock(i){blocks.splice(i,1);drawBlocks();scheduleSave();}
function moveBlock(i,offset){const j=i+offset;if(j<0||j>=blocks.length)return;[blocks[i],blocks[j]]=[blocks[j],blocks[i]];drawBlocks();scheduleSave();}
function adjustFont(i,delta){if(!blocks[i]||blocks[i].kind==='blank')return;blocks[i].fontSize=normalizedFont(blocks[i].kind,blocks[i].fontSize+delta);drawBlocks();scheduleSave();}
$('add-block').addEventListener('click',()=>{addBlock($('new-block-type').value);const last=$('document-blocks').lastElementChild;const field=last&&last.querySelector('textarea');if(field)field.focus();});
for(const id of Object.values(fieldMap))$(id).addEventListener('input',scheduleSave);
$('clear-draft').addEventListener('click',()=>{if(!confirm('Clear all pleading-paper fields, sections, and the saved draft on this device?'))return;if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}try{localStorage.removeItem(DRAFT_KEY);}catch{}for(const id of Object.values(fieldMap))$(id).value='';blocks.length=0;drawBlocks();$('document-preview').replaceChildren();updateSaveStatus('Saved draft cleared. Autosave will start again when you type.');});
window.addEventListener('pagehide',()=>{try{saveDraft();}catch{}});
loadDraft();

function fields(){return {...Object.fromEntries(Object.entries(fieldMap).map(([key,id])=>[key,$(id).value.trim()])),blocks:blocks.map(b=>({...b}))};}
function safeName(s){return String(s||'pleading-paper').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'pleading-paper';}
function preview(){const pages=window.Pleading.getPages(fields());const wrapper=$('document-preview');wrapper.replaceChildren();const banner=document.createElement('p');banner.className='doc-preview-banner';banner.textContent=`Formatting preview · ${pages.length} page${pages.length!==1?'s':''} · Review in Word or print preview before filing.`;wrapper.append(banner);
 for(let i=0;i<pages.length;i++){
  const page=document.createElement('div');page.className='paper-sheet';
  for(let j=0;j<28;j++){
   const row=pages[i][j],line=document.createElement('div');line.className='paper-line';
   const no=document.createElement('span');no.className='paper-num';no.textContent=j+1;
   const content=document.createElement('span');content.className='paper-content';content.style.fontSize=`${row.fontSize||11}pt`;if(row.bold)content.classList.add('is-bold');if(row.align==='center')content.classList.add('is-center');
   const left=document.createElement('span');left.className='paper-left';left.textContent=row.left||'\u00a0';content.append(left);
   if(row.right){const right=document.createElement('span');right.className='paper-right';right.textContent=row.right;content.append(right);}
   line.append(no,content);page.append(line);
  }const pageNo=document.createElement('div');pageNo.className='paper-page-number';pageNo.textContent=`Page ${i+1}`;page.append(pageNo);wrapper.append(page);
 }wrapper.scrollIntoView({behavior:'smooth',block:'start'});
}
$('preview-button').addEventListener('click',preview);
$('docx-button').addEventListener('click',()=>{saveDraft();const f=fields();const doc=window.Pleading.makeDocx(f);const link=document.createElement('a');const u=URL.createObjectURL(doc);link.href=u;link.download=safeName(f.title)+'.docx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);});
$('pdf-button').addEventListener('click',()=>{
 saveDraft();const f=fields(),pages=window.Pleading.getPages(f),esc=window.Pleading.escapeHTML;
 const pageHTML=pages.map((lines,i)=>`<section class="page">${lines.map((row,j)=>`<div class="line"><span class="num">${j+1}</span><span class="content ${row.align==='center'?'center':''} ${row.bold?'bold':''}" style="font-size:${Number(row.fontSize)||11}pt"><span class="left">${esc(row.left)||'&nbsp;'}</span>${row.right?`<span class="right ${row.rightBold?'bold':''}">${esc(row.right)}</span>`:''}</span></div>`).join('')}<div class="page-no">${i+1}</div></section>`).join('');
 const printWindow=window.open('','_blank');if(!printWindow){alert('Allow pop-ups for this site, then use Print / Save as PDF again.');return;}
 printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title||'Pleading paper')}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#eceff3;font:11pt 'Times New Roman',serif}.page{background:#fff;width:8.5in;height:11in;padding:.875in 1in .75in;position:relative;margin:14px auto;box-shadow:0 3px 16px #a3a9b5;break-after:page}.page:last-child{break-after:auto}.line{height:.279in;line-height:.279in;display:flex;white-space:pre}.num{width:.34in;flex:none;text-align:right;padding-right:.08in;border-right:1px solid #555;font-size:10pt}.content{padding-left:.13in;display:flex;flex:1;min-width:0;overflow:hidden}.left{flex:1;overflow:hidden}.right{width:48%;padding-left:.10in;border-left:1px solid #555;overflow:hidden}.center .left{text-align:center}.bold{font-weight:bold}.page-no{position:absolute;bottom:.48in;left:0;right:0;text-align:center;font-size:10pt}.control{padding:10px;text-align:center;font:14px system-ui;background:#fff}.control button{padding:10px 17px;cursor:pointer}@media print{body{background:white}.control{display:none}.page{margin:0;box-shadow:none}}</style></head><body><div class="control"><button onclick="window.print()">Print or Save as PDF</button> · Choose “Save as PDF” as your printer destination.</div>${pageHTML}</body></html>`);printWindow.document.close();printWindow.focus();
});
})();
