(()=>{'use strict';
const $=id=>document.getElementById(id);
$('year').textContent=String(new Date().getFullYear());
const askTab=$('ask-tab'),docTab=$('doc-tab'),helpTab=$('help-tab');
const METRIC_EVENTS=new Set(['ask_completed','pleading_opened','pleading_started','preview_opened','word_exported','pdf_exported','help_opened','draft_cleared','ai_session_cleared','five_point_opened','answer_to_pleading']);
const metricOnce=new Set();
function trackEvent(event){
 if(!METRIC_EVENTS.has(event))return false;
 const body=JSON.stringify({event});
 try{
  if(navigator.sendBeacon){const blob=new Blob([body],{type:'application/json'});if(navigator.sendBeacon('/api/metric',blob))return true;}
 }catch{}
 try{fetch('/api/metric',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true,credentials:'same-origin'}).catch(()=>{});return true;}catch{return false;}
}
function trackEventOnce(event){if(metricOnce.has(event))return;metricOnce.add(event);trackEvent(event);}
let currentTab='ask';
function setTab(which){
 const previous=currentTab;currentTab=which;
 const ask=which==='ask',doc=which==='doc',help=which==='help';
 askTab.classList.toggle('selected',ask);docTab.classList.toggle('selected',doc);helpTab.classList.toggle('selected',help);
 askTab.setAttribute('aria-selected',String(ask));docTab.setAttribute('aria-selected',String(doc));helpTab.setAttribute('aria-selected',String(help));
 $('ask-panel').classList.toggle('hidden',!ask);$('doc-panel').classList.toggle('hidden',!doc);$('help-panel').classList.toggle('hidden',!help);
 history.replaceState(null,'',doc?'#pleading-paper':help?'#help':'#ask');
 if(which!==previous){if(doc)trackEvent('pleading_opened');if(help)trackEvent('help_opened');}
}
askTab.addEventListener('click',()=>setTab('ask'));docTab.addEventListener('click',()=>setTab('doc'));helpTab.addEventListener('click',()=>setTab('help'));
$('pleading-help-link').addEventListener('click',()=>setTab('help'));$('help-open-pleading').addEventListener('click',()=>setTab('doc'));$('help-open-ask').addEventListener('click',()=>setTab('ask'));
if(location.hash==='#pleading-paper')setTab('doc');else if(location.hash==='#help')setTab('help');
for(const b of document.querySelectorAll('[data-question]')) b.addEventListener('click',()=>{$('question').value=b.dataset.question;$('question').focus();});
let config={turnstileSiteKey:null,ready:false};let widgetId=null;const historyTurns=[];
const clearChat=$('clear-chat');if(clearChat)clearChat.addEventListener('click',()=>{trackEvent('ai_session_cleared');historyTurns.length=0;$('conversation').replaceChildren();$('question').value='';$('ask-ideas').classList.remove('hidden');$('question').focus();});
function showBubble(kind,text){const item=document.createElement('div');item.className='bubble '+kind;if(kind==='answer'){const title=document.createElement('span');title.className='answer-label';title.textContent='AI-generated general information';item.append(title);}item.append(document.createTextNode(text));$('conversation').append(item);item.scrollIntoView({behavior:'smooth',block:'nearest'});return item;}

function buildFivePointGuide(guide){
 const labels=[['understand','Understand'],['gather','Gather'],['verify','Verify'],['options','Options'],['document','Document start']];
 const panel=document.createElement('section');panel.className='five-point-guide';panel.setAttribute('aria-label','ALA Five-Point Guide');
 const head=document.createElement('div');head.className='five-guide-head';const star=document.createElement('span');star.className='five-guide-star';star.textContent='★';star.setAttribute('aria-hidden','true');const headText=document.createElement('div');const title=document.createElement('strong');title.textContent='ALA Five-Point Guide';const sub=document.createElement('small');sub.textContent='The answer organized into five practical categories, plus a possible next step.';headText.append(title,sub);head.append(star,headText);panel.append(head);
 const list=document.createElement('ol');list.className='five-guide-list';for(const [key,label] of labels){const li=document.createElement('li');const wrap=document.createElement('div');const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.textContent=String(guide[key]||'Review the answer above and verify current requirements with the relevant official source.');wrap.append(h,p);li.append(wrap);list.append(li);}panel.append(list);
 const next=document.createElement('div');next.className='five-guide-next';const nextLabel=document.createElement('strong');nextLabel.className='five-guide-next-label';nextLabel.textContent='Possible next step';const nextText=document.createElement('p');nextText.textContent=String(guide.nextStep||'One possible next step is to verify the current procedure and any applicable deadline with the relevant official source before deciding how to proceed.');next.append(nextLabel,nextText);panel.append(next);
 const foot=document.createElement('div');foot.className='five-guide-footer';const note=document.createElement('span');note.className='five-guide-note';note.textContent='Educational navigation aid — not legal advice or a recommendation about what you personally should do. Verify rules and deadlines with the court or a licensed attorney.';const copy=document.createElement('button');copy.type='button';copy.className='guide-copy';copy.textContent='Copy guide';copy.addEventListener('click',async()=>{const text=labels.map(([key,label],i)=>`${i+1}. ${label}: ${guide[key]||''}`).join('\n\n')+`\n\nPossible next step: ${guide.nextStep||''}\n\nEducational information only — not legal advice.`;try{await navigator.clipboard.writeText(text);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy guide',1600);}catch{copy.textContent='Copy failed';setTimeout(()=>copy.textContent='Copy guide',1600);}});foot.append(note,copy);panel.append(foot);return panel;
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
   let guideOpenTracked=false;guideButton.addEventListener('click',()=>{guidePanel.hidden=!guidePanel.hidden;guideButton.setAttribute('aria-expanded',String(!guidePanel.hidden));if(!guidePanel.hidden){if(!guideOpenTracked){guideOpenTracked=true;trackEvent('five_point_opened');}guidePanel.scrollIntoView({behavior:'smooth',block:'nearest'});}});guideButton.setAttribute('aria-expanded','false');actions.append(guideButton);answerBubble.append(actions,guidePanel);
  }else answerBubble.append(actions);
  const toDoc=document.createElement('button');toDoc.type='button';toDoc.className='secondary to-doc';toDoc.textContent='Use this text on pleading paper ↗';toDoc.addEventListener('click',()=>{if(blocks.some(blockHasText)&&!confirm('Add the AI-generated text as another paragraph?'))return;trackEvent('answer_to_pleading');trackEventOnce('pleading_started');addBlock('paragraph',data.answer);setTab('doc');const last=$('document-blocks').lastElementChild;const edit=last&&last.querySelector('.rich-editor,textarea');if(edit)edit.focus();});actions.append(toDoc);
  historyTurns.push({role:'user',content:question},{role:'assistant',content:data.answer});while(historyTurns.length>4)historyTurns.shift();
 }catch(err){showBubble('error',err.message||'Something went wrong. Please try again.');}finally{button.disabled=false;button.innerHTML='Ask <span aria-hidden="true">↗</span>';if(window.turnstile&&widgetId!==null)window.turnstile.reset(widgetId);$('question').focus();}
});
init();

const fieldMap={person:'person',address:'address',contact:'contact',county:'county',plaintiff:'plaintiff',defendant:'defendant',caseNumber:'case-number',title:'doc-title'};
const blocks=[];
const labels={heading:'Centered section heading',subheading:'Left-aligned subheading',paragraph:'Body paragraph',numbered:'Numbered paragraph',blank:'Blank line / spacing'};
const fontDefaults={heading:12,subheading:11,paragraph:11,numbered:11,blank:11};
const DRAFT_KEY='american-legal-assistance-pleading-draft-v3';
let saveTimer=null,dragIndex=null,dropIndex=null,dropMarker=null;

function normalizedFont(kind,value){const n=Number(value);return Number.isFinite(n)?Math.max(8,Math.min(16,Math.round(n))):(fontDefaults[kind]||11);}
function escapeHTML(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function textToRichHTML(text){return escapeHTML(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');}
function cleanRichNode(node){
 if(node.nodeType===Node.TEXT_NODE)return escapeHTML(node.nodeValue||'');
 if(node.nodeType!==Node.ELEMENT_NODE)return '';
 const tag=node.tagName.toLowerCase(),inner=[...node.childNodes].map(cleanRichNode).join('');
 if(tag==='br')return '<br>';
 if(tag==='strong'||tag==='b')return `<strong>${inner}</strong>`;
 if(tag==='em'||tag==='i')return `<em>${inner}</em>`;
 if(tag==='u')return `<u>${inner}</u>`;
 if(tag==='div'||tag==='p')return `<${tag}>${inner}</${tag}>`;
 if(tag==='span'){
  const raw=node.getAttribute('data-pt')||node.style.fontSize||'';let result=inner;
  const weight=String(node.style.fontWeight||'').toLowerCase(),fontStyle=String(node.style.fontStyle||'').toLowerCase(),decoration=String(node.style.textDecoration||node.style.textDecorationLine||'').toLowerCase();
  if(weight==='bold'||Number(weight)>=600)result=`<strong>${result}</strong>`;
  if(fontStyle==='italic')result=`<em>${result}</em>`;
  if(decoration.includes('underline'))result=`<u>${result}</u>`;
  if(raw){const n=normalizedFont('paragraph',parseFloat(raw));result=`<span data-pt="${n}" style="font-size:${n}pt">${result}</span>`;}
  return result;
 }
 return inner;
}
function sanitizeRichHTML(html){const template=document.createElement('template');template.innerHTML=String(html||'');return [...template.content.childNodes].map(cleanRichNode).join('');}
function richPlainText(html){const box=document.createElement('div');box.innerHTML=sanitizeRichHTML(html);return (box.innerText||box.textContent||'').replace(/\u00a0/g,' ');}
function blockHasText(block){if(!block||block.kind==='blank')return false;return block.kind==='paragraph'||block.kind==='numbered'?richPlainText(block.html||textToRichHTML(block.text||'')).trim().length>0:String(block.text||'').trim().length>0;}
function normalizeBlock(block){
 const kind=block&&labels[block.kind]?block.kind:'paragraph';
 if(kind==='blank')return{kind,text:'',fontSize:11,bold:false,italic:false,underline:false};
 const base={kind,fontSize:normalizedFont(kind,block&&block.fontSize),bold:block&&typeof block.bold==='boolean'?block.bold:(kind==='heading'||kind==='subheading'),italic:!!(block&&block.italic),underline:!!(block&&block.underline)};
 if(kind==='paragraph'||kind==='numbered')return{...base,fontSize:11,text:String(block&&block.text||''),html:sanitizeRichHTML(block&&block.html?block.html:textToRichHTML(block&&block.text||''))};
 return{...base,text:String(block&&block.text||'')};
}
function updateSaveStatus(message){const el=$('autosave-status');if(el)el.textContent=message;}
function draftPayload(){return{version:4,updatedAt:Date.now(),fields:Object.fromEntries(Object.entries(fieldMap).map(([key,id])=>[key,$(id).value])),blocks:blocks.map(b=>({...b,html:b.html?sanitizeRichHTML(b.html):undefined}))};}
function saveDraft(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}try{const payload=draftPayload();localStorage.setItem(DRAFT_KEY,JSON.stringify(payload));const time=new Date(payload.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});updateSaveStatus(`Saved locally at ${time}. You can leave this page and come back.`);}catch{updateSaveStatus('Autosave could not use this browser’s local storage. Download a Word copy before leaving.');}}
function scheduleSave(){if(saveTimer)clearTimeout(saveTimer);updateSaveStatus('Saving…');saveTimer=setTimeout(saveDraft,250);}
function loadDraft(){try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw){drawBlocks();updateSaveStatus('Autosave is on for this device.');return;}const data=JSON.parse(raw);if(data&&data.fields){for(const [key,id] of Object.entries(fieldMap)){if(Object.prototype.hasOwnProperty.call(data.fields,key))$(id).value=String(data.fields[key]??'');}}blocks.length=0;if(Array.isArray(data&&data.blocks))for(const b of data.blocks.slice(0,75))blocks.push(normalizeBlock(b));drawBlocks();if(data.updatedAt){const when=new Date(data.updatedAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});updateSaveStatus(`Draft restored from this browser · last saved ${when}.`);}else updateSaveStatus('Draft restored from this browser.');}catch{drawBlocks();updateSaveStatus('Autosave is on, but the previous local draft could not be restored.');}}

function makeToolbarButton(text,title,handler,pressed){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);if(typeof pressed==='boolean')b.setAttribute('aria-pressed',String(pressed));b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',handler);return b;}
function currentSelectionInside(editor){const sel=window.getSelection();if(!sel||!sel.rangeCount)return null;const range=sel.getRangeAt(0);if(!editor.contains(range.commonAncestorContainer))return null;return range;}
function selectionPointSize(editor){const sel=window.getSelection();if(!sel||!sel.anchorNode)return 11;let el=sel.anchorNode.nodeType===Node.ELEMENT_NODE?sel.anchorNode:sel.anchorNode.parentElement;while(el&&el!==editor){if(el.dataset&&el.dataset.pt)return normalizedFont('paragraph',el.dataset.pt);el=el.parentElement;}return 11;}
function applyInlineFont(editor,delta){
 editor.focus();let range=currentSelectionInside(editor);let target=normalizedFont('paragraph',selectionPointSize(editor)+delta);
 if(!range||range.collapsed){range=document.createRange();range.selectNodeContents(editor);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);target=normalizedFont('paragraph',11+delta);}
 const wrapper=document.createElement('span');wrapper.dataset.pt=String(target);wrapper.style.fontSize=`${target}pt`;
 try{const frag=range.extractContents();wrapper.append(frag);range.insertNode(wrapper);const sel=window.getSelection();const newRange=document.createRange();newRange.selectNodeContents(wrapper);sel.removeAllRanges();sel.addRange(newRange);}catch{}
}
function formatInline(i,command){const card=$('document-blocks').querySelector(`[data-index="${i}"]`),editor=card&&card.querySelector('.rich-editor');if(!editor)return;editor.focus();if(command==='smaller'||command==='larger')applyInlineFont(editor,command==='larger'?1:-1);else document.execCommand(command,false,null);blocks[i].html=sanitizeRichHTML(editor.innerHTML);editor.innerHTML=blocks[i].html;scheduleSave();}
function toggleBlockStyle(i,key){if(!blocks[i])return;blocks[i][key]=!blocks[i][key];drawBlocks();scheduleSave();}

function clearDropMarker(){if(dropMarker&&dropMarker.parentNode)dropMarker.remove();dropMarker=null;dropIndex=null;}
function startDrag(i,card,e){dragIndex=i;card.classList.add('is-dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(i));}catch{};if(!dropMarker){dropMarker=document.createElement('div');dropMarker.className='drop-marker';dropMarker.setAttribute('aria-hidden','true');}}
function finishDrag(){for(const c of document.querySelectorAll('.doc-block.is-dragging'))c.classList.remove('is-dragging');dragIndex=null;clearDropMarker();}
function autoScrollDuringDrag(e){if(dragIndex===null)return;const edge=95,h=window.innerHeight;if(e.clientY<edge)window.scrollBy(0,-Math.max(6,Math.ceil((edge-e.clientY)/4)));else if(e.clientY>h-edge)window.scrollBy(0,Math.max(6,Math.ceil((e.clientY-(h-edge))/4)));}

document.addEventListener('dragover',autoScrollDuringDrag);
function setupDropHost(host){
 host.addEventListener('dragover',e=>{if(dragIndex===null)return;e.preventDefault();e.dataTransfer.dropEffect='move';const cards=[...host.querySelectorAll('.doc-block:not(.is-dragging)')];let before=null;for(const card of cards){const r=card.getBoundingClientRect();if(e.clientY<r.top+r.height/2){before=card;break;}}if(before){host.insertBefore(dropMarker,before);dropIndex=Number(before.dataset.index);}else{host.append(dropMarker);dropIndex=blocks.length;}});
 host.addEventListener('drop',e=>{if(dragIndex===null)return;e.preventDefault();let target=dropIndex===null?blocks.length:dropIndex;const from=dragIndex;const [moved]=blocks.splice(from,1);if(from<target)target--;target=Math.max(0,Math.min(blocks.length,target));blocks.splice(target,0,moved);finishDrag();drawBlocks();scheduleSave();});
}

function drawBlocks(){
 const host=$('document-blocks');host.replaceChildren();
 for(let i=0;i<blocks.length;i++){
  const data=blocks[i],card=document.createElement('div');card.className='doc-block';card.dataset.kind=data.kind;card.dataset.index=String(i);
  const bar=document.createElement('div');bar.className='block-top';
  const drag=document.createElement('button');drag.type='button';drag.className='drag-handle';drag.draggable=true;drag.innerHTML='<span aria-hidden="true">⋮⋮</span> Drag';drag.title='Drag this section to a new position';drag.setAttribute('aria-label',`Drag section ${i+1} to reorder`);drag.addEventListener('dragstart',e=>startDrag(i,card,e));drag.addEventListener('dragend',finishDrag);bar.append(drag);
  const tag=document.createElement('span');tag.className='block-tag';tag.textContent=labels[data.kind];bar.append(tag);
  if(data.kind==='paragraph'||data.kind==='numbered'){
   const controls=document.createElement('span');controls.className='font-controls inline-format-controls';controls.title='Select text in this paragraph, then format only the selection';
   controls.append(
    makeToolbarButton('A−','Decrease selected text size',()=>formatInline(i,'smaller')),
    makeToolbarButton('A+','Increase selected text size',()=>formatInline(i,'larger')),
    makeToolbarButton('B','Bold selected text',()=>formatInline(i,'bold')),
    makeToolbarButton('I','Italicize selected text',()=>formatInline(i,'italic')),
    makeToolbarButton('U','Underline selected text',()=>formatInline(i,'underline'))
   );bar.append(controls);
  }else if(data.kind!=='blank'){
   const controls=document.createElement('span');controls.className='font-controls';
   const down=makeToolbarButton('A−','Decrease this whole section font size',()=>adjustFont(i,-1));down.disabled=data.fontSize<=8;
   const size=document.createElement('span');size.className='font-size-label';size.textContent=`${data.fontSize} pt`;size.setAttribute('aria-label',`Font size ${data.fontSize} point`);
   const up=makeToolbarButton('A+','Increase this whole section font size',()=>adjustFont(i,1));up.disabled=data.fontSize>=16;
   controls.append(down,size,up,makeToolbarButton('B','Bold this whole section',()=>toggleBlockStyle(i,'bold'),!!data.bold),makeToolbarButton('I','Italicize this whole section',()=>toggleBlockStyle(i,'italic'),!!data.italic),makeToolbarButton('U','Underline this whole section',()=>toggleBlockStyle(i,'underline'),!!data.underline));bar.append(controls);
  }
  for(const [text,fn,disabled,label] of [['↑',()=>moveBlock(i,-1),i===0,'Move section up'],['↓',()=>moveBlock(i,1),i===blocks.length-1,'Move section down'],['Remove',()=>removeBlock(i),false,'Remove section']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=disabled;button.setAttribute('aria-label',`${label} ${i+1}`);button.addEventListener('click',fn);bar.append(button);}card.append(bar);
  if(data.kind==='blank'){const info=document.createElement('p');info.textContent='One empty numbered line will be inserted.';card.append(info);}
  else if(data.kind==='paragraph'||data.kind==='numbered'){
   const tip=document.createElement('p');tip.className='inline-format-tip';tip.textContent='Body text defaults to 11 pt. Select a word, line, or phrase to resize, bold, italicize, or underline it.';card.append(tip);
   const edit=document.createElement('div');edit.className='rich-editor';edit.contentEditable='true';edit.spellcheck=true;edit.dataset.blockIndex=String(i);edit.setAttribute('role','textbox');edit.setAttribute('aria-multiline','true');edit.setAttribute('aria-label',`${labels[data.kind]} ${i+1}`);edit.dataset.placeholder='Type your paragraph here…';edit.innerHTML=sanitizeRichHTML(data.html||textToRichHTML(data.text||''));edit.addEventListener('input',()=>{trackEventOnce('pleading_started');data.html=sanitizeRichHTML(edit.innerHTML);data.text=richPlainText(data.html);scheduleSave();});card.append(edit);
  }else{
   const edit=document.createElement('textarea');edit.rows=2;edit.maxLength=14000;edit.value=data.text;edit.placeholder=data.kind==='heading'?'E.g. FACTUAL BACKGROUND':'E.g. Parties';edit.style.fontSize=`${Math.max(11,data.fontSize)}px`;edit.style.fontWeight=data.bold?'700':'400';edit.style.fontStyle=data.italic?'italic':'normal';edit.style.textDecoration=data.underline?'underline':'none';edit.setAttribute('aria-label',`${labels[data.kind]} ${i+1}`);edit.addEventListener('input',()=>{trackEventOnce('pleading_started');data.text=edit.value;scheduleSave();});card.append(edit);
  }
  host.append(card);
 }
}
function addBlock(kind,text=''){if(blocks.length>=75){alert('The editor is limited to 75 sections per document.');return;}blocks.push(normalizeBlock({kind,text,fontSize:fontDefaults[kind]||11}));drawBlocks();scheduleSave();}
function removeBlock(i){blocks.splice(i,1);drawBlocks();scheduleSave();}
function moveBlock(i,offset){const j=i+offset;if(j<0||j>=blocks.length)return;[blocks[i],blocks[j]]=[blocks[j],blocks[i]];drawBlocks();scheduleSave();}
function adjustFont(i,delta){if(!blocks[i]||blocks[i].kind==='blank'||blocks[i].kind==='paragraph'||blocks[i].kind==='numbered')return;blocks[i].fontSize=normalizedFont(blocks[i].kind,blocks[i].fontSize+delta);drawBlocks();scheduleSave();}
setupDropHost($('document-blocks'));
$('add-block').addEventListener('click',()=>{trackEventOnce('pleading_started');addBlock($('new-block-type').value);const last=$('document-blocks').lastElementChild;const field=last&&last.querySelector('.rich-editor,textarea');if(field)field.focus();});
for(const id of Object.values(fieldMap))$(id).addEventListener('input',()=>{trackEventOnce('pleading_started');scheduleSave();});
$('clear-draft').addEventListener('click',()=>{if(!confirm('Clear all pleading-paper fields, sections, and the saved draft on this device?'))return;if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}try{localStorage.removeItem(DRAFT_KEY);}catch{}for(const id of Object.values(fieldMap))$(id).value='';blocks.length=0;drawBlocks();$('document-preview').replaceChildren();updateSaveStatus('Saved draft cleared. Autosave will start again when you type.');metricOnce.delete('pleading_started');trackEvent('draft_cleared');});
window.addEventListener('pagehide',()=>{try{saveDraft();}catch{}});
loadDraft();

function fields(){return {...Object.fromEntries(Object.entries(fieldMap).map(([key,id])=>[key,$(id).value.trim()])),blocks:blocks.map(b=>({...b,html:b.html?sanitizeRichHTML(b.html):undefined}))};}
function safeName(s){return String(s||'pleading-paper').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'pleading-paper';}
function appendRuns(host,runs,row){if(Array.isArray(runs)&&runs.length){for(const run of runs){const span=document.createElement('span');span.textContent=run.text;span.style.fontSize=`${run.fontSize||row.fontSize||11}pt`;span.style.fontWeight=run.bold?'700':'inherit';span.style.fontStyle=run.italic?'italic':'normal';span.style.textDecoration=run.underline?'underline':'none';host.append(span);}}else host.textContent=row.left||'\u00a0';}
function preview(){const pages=window.Pleading.getPages(fields());const wrapper=$('document-preview');wrapper.replaceChildren();const banner=document.createElement('p');banner.className='doc-preview-banner';banner.textContent=`Formatting preview · ${pages.length} page${pages.length!==1?'s':''} · Review in Word or print preview before filing.`;wrapper.append(banner);
 for(let i=0;i<pages.length;i++){const page=document.createElement('div');page.className='paper-sheet';for(let j=0;j<28;j++){const row=pages[i][j],line=document.createElement('div');line.className='paper-line';const no=document.createElement('span');no.className='paper-num';no.textContent=j+1;const content=document.createElement('span');content.className='paper-content';content.style.fontSize=`${row.fontSize||11}pt`;content.style.fontStyle=row.italic?'italic':'normal';content.style.textDecoration=row.underline?'underline':'none';if(row.bold)content.classList.add('is-bold');if(row.align==='center')content.classList.add('is-center');const left=document.createElement('span');left.className='paper-left';appendRuns(left,row.runs,row);content.append(left);if(row.right){const right=document.createElement('span');right.className='paper-right';right.textContent=row.right;content.append(right);}line.append(no,content);page.append(line);}const pageNo=document.createElement('div');pageNo.className='paper-page-number';pageNo.textContent=`Page ${i+1}`;page.append(pageNo);wrapper.append(page);}wrapper.scrollIntoView({behavior:'smooth',block:'start'});trackEvent('preview_opened');
}
$('preview-button').addEventListener('click',preview);
$('docx-button').addEventListener('click',()=>{saveDraft();const f=fields();const doc=window.Pleading.makeDocx(f);const link=document.createElement('a');const u=URL.createObjectURL(doc);link.href=u;link.download=safeName(f.title)+'.docx';document.body.append(link);link.click();trackEvent('word_exported');link.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);});
$('pdf-button').addEventListener('click',()=>{
 saveDraft();const f=fields(),pages=window.Pleading.getPages(f),esc=window.Pleading.escapeHTML;
 const renderRuns=(row)=>Array.isArray(row.runs)&&row.runs.length?row.runs.map(run=>`<span style="font-size:${Number(run.fontSize)||11}pt;${run.bold?'font-weight:700;':''}${run.italic?'font-style:italic;':''}${run.underline?'text-decoration:underline;':''}">${esc(run.text)}</span>`).join(''):(esc(row.left)||'&nbsp;');
 const pageHTML=pages.map((lines,i)=>`<section class="page">${lines.map((row,j)=>`<div class="line"><span class="num">${j+1}</span><span class="content ${row.align==='center'?'center':''} ${row.bold?'bold':''}" style="font-size:${Number(row.fontSize)||11}pt;${row.italic?'font-style:italic;':''}${row.underline?'text-decoration:underline;':''}"><span class="left">${renderRuns(row)}</span>${row.right?`<span class="right ${row.rightBold?'bold':''}">${esc(row.right)}</span>`:''}</span></div>`).join('')}<div class="page-no">${i+1}</div></section>`).join('');
 const printWindow=window.open('','_blank');if(!printWindow){alert('Allow pop-ups for this site, then use Print / Save as PDF again.');return;}trackEvent('pdf_exported');
 printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title||'Pleading paper')}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#eceff3;font:11pt 'Times New Roman',serif}.page{background:#fff;width:8.5in;height:11in;padding:.875in 1in .75in;position:relative;margin:14px auto;box-shadow:0 3px 16px #a3a9b5;break-after:page}.page:last-child{break-after:auto}.line{height:.279in;line-height:.279in;display:flex;white-space:pre}.num{width:.34in;flex:none;text-align:right;padding-right:.08in;border-right:1px solid #555;font-size:10pt}.content{padding-left:.13in;display:flex;flex:1;min-width:0;overflow:hidden}.left{flex:1;overflow:hidden}.right{width:48%;padding-left:.10in;border-left:1px solid #555;overflow:hidden}.center .left{text-align:center}.bold{font-weight:bold}.page-no{position:absolute;bottom:.48in;left:0;right:0;text-align:center;font-size:10pt}.control{padding:10px;text-align:center;font:14px system-ui;background:#fff}.control button{padding:10px 17px;cursor:pointer}@media print{body{background:white}.control{display:none}.page{margin:0;box-shadow:none}}</style></head><body><div class="control"><button onclick="window.print()">Print or Save as PDF</button> · Choose “Save as PDF” as your printer destination.</div>${pageHTML}</body></html>`);printWindow.document.close();printWindow.focus();
});

})();
