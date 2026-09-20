/* Self-contained, client-side California-style pleading-paper formatting.
   No external libraries or uploading text. Provides an actual editable .docx file. */
(()=>{'use strict';
const E = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const WIDTH = 72; // Conservative line length: prevents the numbered row from wrapping in Word.
function wrap(text,width=WIDTH){
 const normalized=String(text??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ');
 const result=[];
 for(const raw of normalized.split('\n')){
  if(!raw.trim()){result.push('');continue;}
  let rest=raw.trim();
  while(rest.length>width){let cut=rest.lastIndexOf(' ',width+1);if(cut<Math.floor(width/2))cut=width;result.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trimStart();}
  result.push(rest);
 }
 return result;
}
function getPages(fields){
 const pages=[];let first=Array(28).fill('');
 const assign=(start,max,text)=>{wrap(text).slice(0,max).forEach((line,i)=>{first[start+i]=line;});};
 assign(0,2,fields.person);assign(2,2,fields.address);assign(4,2,fields.contact);
 first[7]='SUPERIOR COURT OF CALIFORNIA';first[8]='COUNTY OF '+(fields.county||'__________________').toUpperCase();
 assign(10,2,'Plaintiff / Petitioner: '+(fields.plaintiff||'__________________'));
 assign(12,2,'Defendant / Respondent: '+(fields.defendant||'__________________'));
 first[14]='Case No.: '+(fields.caseNumber||'__________________');
 assign(15,2,(fields.title||'DOCUMENT TITLE').toUpperCase());
 let idx=17;pages.push(first);
 const content=wrap(fields.body||'');
 if(content.every(line=>!line)) content.length=0;
 for(const line of content){
  if(idx>=28){pages.push(Array(28).fill(''));idx=0;}
  pages[pages.length-1][idx++]=line;
 }
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
const paragraph = (txt,bold=false) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="260" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="21"/>${bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${E(txt)||' '}</w:t></w:r></w:p>`;
function wordXML(pages){
 const table=(lines,isFirstPage)=>`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="430"/><w:gridCol w:w="8930"/></w:tblGrid>${lines.map((text,i)=>`<w:tr><w:trPr><w:trHeight w:val="410" w:hRule="exact"/><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="430" w:type="dxa"/><w:tcBorders><w:right w:val="single" w:sz="4" w:color="666666"/></w:tcBorders></w:tcPr>${paragraph(String(i+1))}</w:tc><w:tc><w:tcPr><w:tcW w:w="8930" w:type="dxa"/></w:tcPr>${paragraph(text,isFirstPage && i===7)}</w:tc></w:tr>`).join('')}</w:tbl>`;
 let body=pages.map((page,i)=>(i>0?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')+table(page,i===0)).join('');
 body+=`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1050" w:left="1440" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr>`;
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
