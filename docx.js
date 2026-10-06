/* Client-side pleading-paper formatter. Blocks and layout rows share a single model
   for browser preview, Word export and print/PDF. No third-party libraries. */
(()=>{'use strict';
const E=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const blank=()=>({left:'',right:'',align:'left',bold:false});
const LINE_COUNT=28;
function wrap(text,width=73){
 const lines=[];for(const raw of String(text??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')){
  let rest=raw.trim();if(!rest){lines.push('');continue;}
  while(rest.length>width){let cut=rest.lastIndexOf(' ',width+1);if(cut<Math.floor(width/2))cut=width;lines.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trimStart();}
  lines.push(rest);
 }return lines;
}
function getPages(f){
 const lines=[],line=(left='',opts={})=>lines.push({left:String(left),right:String(opts.right||''),align:opts.align||'left',bold:!!opts.bold,rightBold:!!opts.rightBold});
 const person=(f.person||'').trim(),address=(f.address||'').trim(),contact=(f.contact||'').trim();
 const county=(f.county||'').trim(),plaintiff=(f.plaintiff||'').trim(),defendant=(f.defendant||'').trim();
 const caseNo=(f.caseNumber||'').trim(),title=(f.title||'').trim();
 const anyCaption=[person,address,contact,county,plaintiff,defendant,caseNo,title].some(Boolean);
 if(anyCaption){
  for(const field of [person,address,contact]){if(field)for(const v of wrap(field,73))line(v);}
  line();line('SUPERIOR COURT OF CALIFORNIA',{align:'center',bold:true});line('COUNTY OF '+(county||'________________').toUpperCase(),{align:'center'});line();
  const leftCaption=[plaintiff||'________________','Plaintiff / Petitioner,','v.',defendant||'________________','Defendant / Respondent.'];
  const rightCaption=['Case No.: '+(caseNo||'________________'),...(title?wrap(title.toUpperCase(),34):['DOCUMENT TITLE'])];
  const capRows=Math.max(leftCaption.length,rightCaption.length);
  for(let i=0;i<capRows;i++)line(leftCaption[i]||'',{right:rightCaption[i]||'',rightBold:i>0});
  line();
 }
 let numbered=0;
 for(const block of f.blocks||[]){
  if(!block || !['heading','subheading','paragraph','numbered','blank'].includes(block.kind))continue;
  const text=String(block.text||'').trim();
  if(block.kind==='blank'){line();continue;}
  if(!text)continue;
  if(block.kind==='heading'){
   if(lines.length && lines[lines.length-1].left!=='')line();
   for(const v of wrap(text.toUpperCase(),69))line(v,{align:'center',bold:true});
   numbered=0;line();continue;
  }
  if(block.kind==='subheading'){
   if(lines.length && lines[lines.length-1].left!=='')line();
   for(const v of wrap(text,73))line(v,{bold:true});
   continue;
  }
  const values=wrap(text,block.kind==='numbered'?68:73);
  if(block.kind==='numbered'){numbered++;values[0]=`${numbered}. ${values[0]}`;}
  for(const v of values)line(v);
  line();
 }
 // A completely blank form always contains one blank sheet.
 if(!lines.length)line();
 const pages=[];
 for(let i=0;i<lines.length;i+=LINE_COUNT){const page=lines.slice(i,i+LINE_COUNT);while(page.length<LINE_COUNT)page.push(blank());pages.push(page);}
 return pages;
}
// Pure-JS ZIP (STORED) encoder with CRC32, for Word .docx package.
const encoder=new TextEncoder();const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function createZip(files){
 let total=0,off=0;const chunks=[],dirs=[];
 const wr16=(a,o,v)=>{a[o]=v&255;a[o+1]=v>>>8&255;};
 const wr32=(a,o,v)=>{wr16(a,o,v);wr16(a,o+2,v>>>16);};
 for(const [name,text] of Object.entries(files)){
  const fname=encoder.encode(name),bytes=encoder.encode(text),crc=crc32(bytes);
  const header=new Uint8Array(30+fname.length);wr32(header,0,0x04034b50);wr16(header,4,20);wr16(header,8,0);wr32(header,14,crc);wr32(header,18,bytes.length);wr32(header,22,bytes.length);wr16(header,26,fname.length);header.set(fname,30);
  chunks.push(header,bytes);const directory=new Uint8Array(46+fname.length);wr32(directory,0,0x02014b50);wr16(directory,4,20);wr16(directory,6,20);wr32(directory,16,crc);wr32(directory,20,bytes.length);wr32(directory,24,bytes.length);wr16(directory,28,fname.length);wr32(directory,42,off);directory.set(fname,46);dirs.push(directory);
  off+=header.length+bytes.length;total+=header.length+bytes.length;
 }
 let dirSize=0;for(const d of dirs){dirSize+=d.length;total+=d.length;}const end=new Uint8Array(22);wr32(end,0,0x06054b50);wr16(end,8,dirs.length);wr16(end,10,dirs.length);wr32(end,12,dirSize);wr32(end,16,off);total+=end.length;
 const output=new Uint8Array(total);let pos=0;for(const b of [...chunks,...dirs,end]){output.set(b,pos);pos+=b.length;}return output;
}

const paragraph=(text,opt={})=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="338" w:lineRule="exact"/>${opt.align==='center'?'<w:jc w:val="center"/>':opt.align==='right'?'<w:jc w:val="right"/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="21"/>${opt.bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${E(text)||' '}</w:t></w:r></w:p>`;
function wordXML(pages){
 const cell=(text,width,opt={},span=1,border=false)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:''}${border?'<w:tcBorders><w:right w:val="single" w:sz="4" w:color="666666"/></w:tcBorders>':''}</w:tcPr>${paragraph(text,opt)}</w:tc>`;
 const table=page=>`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="430"/><w:gridCol w:w="4430"/><w:gridCol w:w="4500"/></w:tblGrid>${page.map((row,i)=>`<w:tr><w:trPr><w:trHeight w:val="389" w:hRule="exact"/><w:cantSplit/></w:trPr>${cell(String(i+1),430,{align:'right'},1,true)}${row.right?cell(row.left,4430,{},1,true)+cell(row.right,4500,{bold:row.rightBold}):cell(row.left,8930,{bold:row.bold,align:row.align},2)}</w:tr>`).join('')}</w:tbl>`;
 let body=pages.map((page,i)=>(i>0?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')+table(page)).join('');
 body+='<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1260" w:right="1440" w:bottom="1080" w:left="1440" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr>';
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}
function makeDocx(fields){const pages=getPages(fields);const files={
 '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/document.xml':wordXML(pages)};
 return new Blob([createZip(files)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
window.Pleading={getPages,makeDocx,escapeHTML:E};
})();
