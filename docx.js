/* Client-side pleading-paper formatter. Blocks and layout rows share a single model
   for browser preview, Word export and print/PDF. No third-party libraries. */
(()=>{'use strict';
const E=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clampSize=n=>Math.max(8,Math.min(16,Number(n)||11));
const blank=()=>({left:'',right:'',align:'left',bold:false,italic:false,underline:false,fontSize:11,runs:null});
const LINE_COUNT=28;
function wrap(text,width=73){
 const lines=[];for(const raw of String(text??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')){
  let rest=raw.trim();if(!rest){lines.push('');continue;}
  while(rest.length>width){let cut=rest.lastIndexOf(' ',width+1);if(cut<Math.floor(width/2))cut=width;lines.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trimStart();}
  lines.push(rest);
 }return lines;
}
function wrapWidth(base,fontSize){const size=clampSize(fontSize);return Math.max(46,Math.min(94,Math.round(base*11/size)));}
function sameStyle(a,b){return a&&b&&a.fontSize===b.fontSize&&!!a.bold===!!b.bold&&!!a.italic===!!b.italic&&!!a.underline===!!b.underline;}
function pushRun(list,text,style){if(!text)return;const run={text:String(text),fontSize:clampSize(style.fontSize),bold:!!style.bold,italic:!!style.italic,underline:!!style.underline};const last=list[list.length-1];if(last&&sameStyle(last,run))last.text+=run.text;else list.push(run);}
function richRunsFromHTML(html,defaults={}){
 const template=document.createElement('template');template.innerHTML=String(html||'');const runs=[];
 const base={fontSize:clampSize(defaults.fontSize||11),bold:!!defaults.bold,italic:!!defaults.italic,underline:!!defaults.underline};
 const newline=style=>{if(!runs.length||!runs[runs.length-1].text.endsWith('\n'))pushRun(runs,'\n',style);};
 function walk(node,style){
  if(node.nodeType===Node.TEXT_NODE){pushRun(runs,(node.nodeValue||'').replace(/\u00a0/g,' '),style);return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const tag=node.tagName.toLowerCase();if(tag==='br'){newline(style);return;}
  const next={...style};
  if(tag==='strong'||tag==='b')next.bold=true;if(tag==='em'||tag==='i')next.italic=true;if(tag==='u')next.underline=true;
  if(tag==='span'){const raw=node.getAttribute('data-pt')||node.style.fontSize;if(raw)next.fontSize=clampSize(parseFloat(raw));}
  const block=tag==='div'||tag==='p';for(const child of node.childNodes)walk(child,next);if(block)newline(next);
 }
 for(const child of template.content.childNodes)walk(child,base);
 while(runs.length&&runs[runs.length-1].text==='\n')runs.pop();
 if(runs.length&&runs[runs.length-1].text.endsWith('\n'))runs[runs.length-1].text=runs[runs.length-1].text.replace(/\n+$/,'');
 return runs.filter(r=>r.text);
}
function compressChars(chars){const runs=[];for(const c of chars)pushRun(runs,c.ch,c);return runs;}
function trimChars(chars){let a=0,b=chars.length;while(a<b&&/\s/.test(chars[a].ch))a++;while(b>a&&/\s/.test(chars[b-1].ch))b--;return chars.slice(a,b);}
function wrapRichRuns(runs,maxUnits=73){
 const all=[];let current=[];for(const run of runs){for(const ch of run.text){if(ch==='\n'){all.push(current);current=[];}else current.push({ch,fontSize:run.fontSize,bold:run.bold,italic:run.italic,underline:run.underline});}}all.push(current);
 const out=[];
 for(const logical of all){if(!logical.length){out.push([]);continue;}let rest=logical.slice();while(rest.length){let units=0,lastSpace=-1,cut=rest.length;for(let i=0;i<rest.length;i++){units+=Math.max(.72,rest[i].fontSize/11);if(/\s/.test(rest[i].ch))lastSpace=i;if(units>maxUnits){cut=lastSpace>=0?lastSpace:i;break;}}if(cut===rest.length){out.push(compressChars(trimChars(rest)));break;}if(cut<=0)cut=Math.max(1,lastSpace+1);const line=trimChars(rest.slice(0,cut));out.push(compressChars(line));rest=rest.slice(cut);while(rest.length&&/\s/.test(rest[0].ch))rest.shift();}}
 return out.length?out:[[]];
}
function plainFromRuns(runs){return (runs||[]).map(r=>r.text).join('');}
function getPages(f){
 const lines=[],line=(left='',opts={})=>lines.push({left:String(left),right:String(opts.right||''),align:opts.align||'left',bold:!!opts.bold,italic:!!opts.italic,underline:!!opts.underline,rightBold:!!opts.rightBold,fontSize:clampSize(opts.fontSize||11),runs:Array.isArray(opts.runs)?opts.runs:null});
 const person=(f.person||'').trim(),address=(f.address||'').trim(),contact=(f.contact||'').trim();
 const county=(f.county||'').trim(),plaintiff=(f.plaintiff||'').trim(),defendant=(f.defendant||'').trim();
 const caseNo=(f.caseNumber||'').trim(),title=(f.title||'').trim();
 const anyCaption=[person,address,contact,county,plaintiff,defendant,caseNo,title].some(Boolean);
 if(anyCaption){
  for(const field of [person,address,contact]){if(field)for(const v of wrap(field,73))line(v,{fontSize:11});}
  line();line('SUPERIOR COURT OF CALIFORNIA',{align:'center',bold:true,fontSize:11});line('COUNTY OF '+(county||'________________').toUpperCase(),{align:'center',fontSize:11});line();
  const leftCaption=[plaintiff||'________________','Plaintiff / Petitioner,','v.',defendant||'________________','Defendant / Respondent.'];
  const rightCaption=['Case No.: '+(caseNo||'________________'),...(title?wrap(title.toUpperCase(),34):['DOCUMENT TITLE'])];
  const capRows=Math.max(leftCaption.length,rightCaption.length);for(let i=0;i<capRows;i++)line(leftCaption[i]||'',{right:rightCaption[i]||'',rightBold:i>0,fontSize:11});line();
 }
 let numbered=0;
 for(const block of f.blocks||[]){
  if(!block||!['heading','subheading','paragraph','numbered','blank'].includes(block.kind))continue;
  if(block.kind==='blank'){line();continue;}
  const fontSize=clampSize(block.fontSize||11),bold=!!block.bold,italic=!!block.italic,underline=!!block.underline;
  if(block.kind==='paragraph'||block.kind==='numbered'){
   const source=block.html||E(block.text||'').replace(/\n/g,'<br>');let rich=richRunsFromHTML(source,{fontSize:11});if(!plainFromRuns(rich).trim())continue;
   const richLines=wrapRichRuns(rich,block.kind==='numbered'?68:73);if(block.kind==='numbered'){numbered++;const prefix={text:`${numbered}. `,fontSize:11,bold:false,italic:false,underline:false};richLines[0]=[prefix,...richLines[0]];}
   for(const r of richLines)line(plainFromRuns(r),{fontSize:11,runs:r});line();continue;
  }
  const text=String(block.text||'').trim();if(!text)continue;
  if(block.kind==='heading'){if(lines.length&&lines[lines.length-1].left!=='')line();for(const v of wrap(text.toUpperCase(),wrapWidth(69,fontSize)))line(v,{align:'center',bold,italic,underline,fontSize});numbered=0;line();continue;}
  if(block.kind==='subheading'){if(lines.length&&lines[lines.length-1].left!=='')line();for(const v of wrap(text,wrapWidth(73,fontSize)))line(v,{bold,italic,underline,fontSize});continue;}
 }
 if(!lines.length)line();const pages=[];for(let i=0;i<lines.length;i+=LINE_COUNT){const page=lines.slice(i,i+LINE_COUNT);while(page.length<LINE_COUNT)page.push(blank());pages.push(page);}return pages;
}

const encoder=new TextEncoder();const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function createZip(files){let total=0,off=0;const chunks=[],dirs=[];const wr16=(a,o,v)=>{a[o]=v&255;a[o+1]=v>>>8&255;};const wr32=(a,o,v)=>{wr16(a,o,v);wr16(a,o+2,v>>>16);};for(const[name,text]of Object.entries(files)){const fname=encoder.encode(name),bytes=encoder.encode(text),crc=crc32(bytes);const header=new Uint8Array(30+fname.length);wr32(header,0,0x04034b50);wr16(header,4,20);wr16(header,8,0);wr32(header,14,crc);wr32(header,18,bytes.length);wr32(header,22,bytes.length);wr16(header,26,fname.length);header.set(fname,30);chunks.push(header,bytes);const directory=new Uint8Array(46+fname.length);wr32(directory,0,0x02014b50);wr16(directory,4,20);wr16(directory,6,20);wr32(directory,16,crc);wr32(directory,20,bytes.length);wr32(directory,24,bytes.length);wr16(directory,28,fname.length);wr32(directory,42,off);directory.set(fname,46);dirs.push(directory);off+=header.length+bytes.length;total+=header.length+bytes.length;}let dirSize=0;for(const d of dirs){dirSize+=d.length;total+=d.length;}const end=new Uint8Array(22);wr32(end,0,0x06054b50);wr16(end,8,dirs.length);wr16(end,10,dirs.length);wr32(end,12,dirSize);wr32(end,16,off);total+=end.length;const output=new Uint8Array(total);let pos=0;for(const b of[...chunks,...dirs,end]){output.set(b,pos);pos+=b.length;}return output;}

function paragraph(input,opt={}){const runs=Array.isArray(input)?input:[{text:String(input??''),fontSize:opt.fontSize||11,bold:false,italic:false,underline:false}];const xmlRuns=(runs.length?runs:[{text:' ',fontSize:opt.fontSize||11}]).map(run=>{const hp=Math.round(clampSize(run.fontSize||opt.fontSize||11)*2);const b=opt.bold||run.bold,i=opt.italic||run.italic,u=opt.underline||run.underline;return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>${b?'<w:b/>':''}${i?'<w:i/>':''}${u?'<w:u w:val="single"/>':''}</w:rPr><w:t xml:space="preserve">${E(run.text)||' '}</w:t></w:r>`;}).join('');return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="338" w:lineRule="exact"/>${opt.align==='center'?'<w:jc w:val="center"/>':opt.align==='right'?'<w:jc w:val="right"/>':''}</w:pPr>${xmlRuns}</w:p>`;}
function wordXML(pages){
 const cell=(input,width,opt={},span=1,border=false)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${border?'<w:tcBorders><w:right w:val="single" w:sz="4" w:color="666666"/></w:tcBorders>':''}</w:tcPr>${paragraph(input,opt)}</w:tc>`;
 const table=page=>`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="430"/><w:gridCol w:w="4430"/><w:gridCol w:w="4500"/></w:tblGrid>${page.map((row,i)=>`<w:tr><w:trPr><w:trHeight w:val="389" w:hRule="exact"/><w:cantSplit/></w:trPr>${cell(String(i+1),430,{align:'right',fontSize:10},1,true)}${row.right?cell(row.left,4430,{fontSize:row.fontSize},1,true)+cell(row.right,4500,{bold:row.rightBold,fontSize:row.fontSize}):cell(row.runs||row.left,8930,{bold:row.bold,italic:row.italic,underline:row.underline,align:row.align,fontSize:row.fontSize},2)}</w:tr>`).join('')}</w:tbl>`;
 let body=pages.map((page,i)=>(i>0?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')+table(page)).join('');body+='<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1260" w:right="1440" w:bottom="1080" w:left="1440" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr>';return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}
function makeDocx(fields){const pages=getPages(fields);const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':wordXML(pages)};return new Blob([createZip(files)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
window.Pleading={getPages,makeDocx,escapeHTML:E};
})();
