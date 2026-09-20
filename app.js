(()=>{'use strict';
const $=id=>document.getElementById(id);
$('year').textContent=String(new Date().getFullYear());
const askTab=$('ask-tab'),docTab=$('doc-tab');
function setTab(which){const doc=which==='doc';askTab.classList.toggle('selected',!doc);docTab.classList.toggle('selected',doc);askTab.setAttribute('aria-selected',String(!doc));docTab.setAttribute('aria-selected',String(doc));$('ask-panel').classList.toggle('hidden',doc);$('doc-panel').classList.toggle('hidden',!doc);history.replaceState(null,'',doc?'#pleading-paper':'#ask');}
askTab.addEventListener('click',()=>setTab('ask'));docTab.addEventListener('click',()=>setTab('doc'));if(location.hash==='#pleading-paper')setTab('doc');
for(const b of document.querySelectorAll('[data-question]')) b.addEventListener('click',()=>{$('question').value=b.dataset.question;$('question').focus();});
let config={turnstileSiteKey:null,ready:false};let widgetId=null;const historyTurns=[];
function showBubble(kind,text){const item=document.createElement('div');item.className='bubble '+kind;if(kind==='answer'){const title=document.createElement('span');title.className='answer-label';title.textContent='AI-generated general information';item.append(title);}item.append(document.createTextNode(text));$('conversation').append(item);item.scrollIntoView({behavior:'smooth',block:'nearest'});return item;}
async function init(){try{const res=await fetch('/api/config',{cache:'no-store'});if(!res.ok) return;config=await res.json();if(config.turnstileSiteKey) await loadTurnstile();}catch{}}
function loadTurnstile(){return new Promise((resolve)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{if(window.turnstile){$('turnstile-slot').hidden=false;widgetId=window.turnstile.render('#turnstile-slot',{sitekey:config.turnstileSiteKey,theme:'light',size:'normal'});}resolve();};script.onerror=resolve;document.head.append(script);});}
$('ask-form').addEventListener('submit',async e=>{
 e.preventDefault();const question=$('question').value.trim();if(!question)return;
 const button=$('ask-submit');button.disabled=true;button.textContent='Thinking…';$('ask-ideas').classList.add('hidden');showBubble('question',question);$('question').value='';
 try{
  let token=null;if(config.turnstileSiteKey){token=window.turnstile&&widgetId!==null?window.turnstile.getResponse(widgetId):null;if(!token)throw Error('Complete the verification below the question box, then try again.');}
  const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,jurisdiction:$('state').value,history:historyTurns,turnstileToken:token})});let data={};try{data=await r.json();}catch{}if(!r.ok)throw Error(data.error||'The AI is unavailable.');
  const answerBubble=showBubble('answer',data.answer);
  const toDoc=document.createElement('button');toDoc.type='button';toDoc.className='secondary to-doc';toDoc.textContent='Use this text on pleading paper ↗';toDoc.addEventListener('click',()=>{if($('doc-body').value.trim()&&!confirm('Replace the existing document text with this AI-generated text?'))return;$('doc-body').value=data.answer;setTab('doc');$('doc-body').focus();});answerBubble.append(toDoc);
  historyTurns.push({role:'user',content:question},{role:'assistant',content:data.answer});while(historyTurns.length>4)historyTurns.shift();
 }catch(err){showBubble('error',err.message||'Something went wrong. Please try again.');}finally{button.disabled=false;button.innerHTML='Ask <span aria-hidden="true">↗</span>';if(window.turnstile&&widgetId!==null)window.turnstile.reset(widgetId);$('question').focus();}
});
init();
const fieldMap={person:'person',address:'address',contact:'contact',county:'county',plaintiff:'plaintiff',defendant:'defendant',caseNumber:'case-number',title:'doc-title',body:'doc-body'};
function fields(){return Object.fromEntries(Object.entries(fieldMap).map(([key,id])=>[key,$(id).value.trim()]));}
function safeName(s){return String(s||'pleading-paper').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'pleading-paper';}
function preview(){const pages=window.Pleading.getPages(fields());const wrapper=$('document-preview');wrapper.replaceChildren();const banner=document.createElement('p');banner.className='doc-preview-banner';banner.textContent=`Formatting preview · ${pages.length} page${pages.length!==1?'s':''} · Review in Word or print preview before filing.`;wrapper.append(banner);
 for(let i=0;i<pages.length;i++){const page=document.createElement('div');page.className='paper-sheet';for(let j=0;j<28;j++){const row=document.createElement('div');row.className='paper-line';const no=document.createElement('span');no.className='paper-num';no.textContent=j+1;const text=document.createElement('span');text.className='paper-content';text.textContent=pages[i][j]||'\u00a0';row.append(no,text);page.append(row);}const pageNo=document.createElement('div');pageNo.className='paper-page-number';pageNo.textContent=`Page ${i+1}`;page.append(pageNo);wrapper.append(page);}
 wrapper.scrollIntoView({behavior:'smooth',block:'start'});}
$('preview-button').addEventListener('click',preview);
$('docx-button').addEventListener('click',()=>{const f=fields();const doc=window.Pleading.makeDocx(f);const link=document.createElement('a');const u=URL.createObjectURL(doc);link.href=u;link.download=safeName(f.title)+'.docx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);});
$('pdf-button').addEventListener('click',()=>{
 const f=fields(),pages=window.Pleading.getPages(f),esc=window.Pleading.escapeHTML;
 const pageHTML=pages.map((lines,i)=>`<section class="page">${lines.map((text,j)=>`<div class="line"><span class="num">${j+1}</span><span class="content">${esc(text)||'&nbsp;'}</span></div>`).join('')}<div class="page-no">${i+1}</div></section>`).join('');
 const printWindow=window.open('','_blank');if(!printWindow){alert('Allow pop-ups for this site, then use Print / Save as PDF again.');return;}
 printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title||'Pleading paper')}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#eceff3;font:11pt 'Times New Roman',serif}.page{background:#fff;width:8.5in;height:11in;padding:1in 1in .65in;position:relative;margin:14px auto;box-shadow:0 3px 16px #a3a9b5;break-after:page}.page:last-child{break-after:auto}.line{height:.2847in;line-height:.2847in;display:flex;white-space:pre}.num{width:.34in;flex:none;text-align:right;padding-right:.08in;border-right:1px solid #555}.content{padding-left:.16in;white-space:pre;overflow:hidden}.page-no{position:absolute;bottom:.5in;left:0;right:0;text-align:center;font-size:10pt}.control{padding:10px;text-align:center;font:14px system-ui;background:#fff}.control button{padding:10px 17px;cursor:pointer}@media print{body{background:white}.control{display:none}.page{margin:0;box-shadow:none}}</style></head><body><div class="control"><button onclick="window.print()">Print or Save as PDF</button> · Choose “Save as PDF” as your printer destination.</div>${pageHTML}</body></html>`);printWindow.document.close();printWindow.focus();
});
})();
