const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={drivers:[],apps:[],windows:[],cat:"all",pass:"",filter:"all",cancel:false,downloads:[]};
const fmt=n=>{n=+n||0;if(n<1024)return n+" B";if(n<1048576)return(n/1024).toFixed(1)+" KB";if(n<1073741824)return(n/1048576).toFixed(1)+" MB";return(n/1073741824).toFixed(1)+" GB"};
const esc=x=>String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2800)}
async function getJSON(url,opts){const r=await fetch(url,opts);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Request failed");return d}
function page(id){$$(".page").forEach(x=>x.classList.remove("active"));$("#"+id)?.classList.add("active");$$(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.page===id));window.scrollTo({top:0,behavior:"auto"});if(id==="drivers")loadDrivers();if(id==="apps")loadApps();if(id==="windows")loadWindows();if(id==="history")renderHistory()}
$$("[data-page]").forEach(b=>b.onclick=()=>page(b.dataset.page));


let site={tools:[],brand:{},theme:{},background:{},settings:{}};
const defaultCats=[["convert","Convert","Document format conversion"],["pdf","PDF Tools","Merge, split, compress, protect and edit PDFs"],["image","Image Tools","Image conversion and optimization"],["ocr","OCR","Scan images and PDFs into editable text"],["other","Other Tools","Custom tools added by the owner"]];
function iconMarkup(t){ return `<span>${esc(t.icon||"TOOL")}</span>`; }
function renderTools(){
  const q=($("#toolSearch")?.value||"").toLowerCase();
  const cats=defaultCats;
  $("#toolSections").innerHTML=cats.map(([cat,title,sub])=>{
    if(state.filter!=="all"&&state.filter!==cat)return "";
    const a=(site.tools||[]).filter(x=>x.enabled!==false&&x.cat===cat&&(`${x.title} ${x.desc}`).toLowerCase().includes(q)).sort((x,y)=>(x.order||0)-(y.order||0));
    if(!a.length)return "";
    return `<section class="tool-section"><div class="section-label"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><span class="section-count">${a.length} tools</span></div><div class="tool-grid">${a.map(t=>`<button class="tool-card" data-tool="${esc(t.id)}"><span class="tool-icon ${esc(t.c||"purple")}">${iconMarkup(t)}</span><strong>${esc(t.title)}</strong><small>${esc(t.desc||"")}</small><span class="tool-arrow">→</span></button>`).join("")}</div></section>`
  }).join("")||`<div class="panel">No tools match your search.</div>`;
  $$(".tool-card").forEach(b=>b.onclick=()=>openTool(b.dataset.tool));
}
function applySite(){
  const b=site.brand||{},t=site.theme||{},bg=site.background||{};
  document.title=(b.name||"BORA")+" — Document Converter";
  const boraBrand=(String(b.logoText||"").trim().length>=2?String(b.logoText).trim():(String(b.name||"").trim().length>=2?String(b.name).trim():"BORA"));$(".brand-copy strong").textContent=boraBrand;
  $(".brand-copy small").textContent=b.subtitle||"DOCUMENT WORKSPACE";
  $(".hero h1").innerHTML=esc(b.tagline||"Every file. One clean workflow.").replace(/\.\s*/,".<br><span>");
  $(".hero p").textContent=b.description||"Convert, edit and organize documents, PDFs, images and OCR from one fast workspace.";
  const shortcutEl=$(".shortcut"); if(shortcutEl) shortcutEl.textContent="BORA V7 • MOTION UI";
  const root=document.documentElement;
  if(t.primary)root.style.setProperty("--p",t.primary);
  if(t.secondary)root.style.setProperty("--p2",t.secondary);
  if(bg.type==="image"&&bg.customImage)document.querySelector(".ambient").style.backgroundImage=`url("${bg.customImage}")`;
  else document.querySelector(".ambient").style.backgroundImage="";
  document.querySelector(".ambient").style.setProperty("--ambient-opacity",String(bg.opacity??.13));
  document.querySelector(".ambient").style.setProperty("--ambient-speed",(Number(bg.speed)||22)+"s");
  const amb=document.querySelector(".ambient");
  amb.classList.remove("particles","grid-mode","aurora");
  amb.classList.add(bg.type==="particles"?"particles":bg.type==="grid"?"grid-mode":"aurora");
  amb.classList.toggle("no-grid",bg.grid===false || bg.type==="particles");
  renderTools();
}
async function loadSite(){
  try{site=await getJSON("/api/site/config");applySite();}catch(e){console.warn(e)}
}
$("#toolSearch").oninput=renderTools;
$$(".tool-tab").forEach(b=>b.onclick=()=>{$$(".tool-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.filter=b.dataset.filter;renderTools()});
loadSite();
setInterval(()=>loadSite(),Math.max(3000,Number(site.settings?.autoRefreshSeconds||5)*1000));


function showModal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden");$("#modalBody").innerHTML=""}
$("#close").onclick=closeModal;$("#modalBackdrop").onclick=closeModal;document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
function pickerHtml(accept="*",multiple=false){return `<div class="dropzone" id="drop"><div class="drop-ring"></div><input id="toolFile" type="file" accept="${accept}" ${multiple?"multiple":""}><div class="upload-content"><div class="upload-icon"><span>↑</span></div><strong>Drag & Drop files here</strong><span>or click to choose files</span><small>${accept==="*"?"Any supported file":accept}</small><em class="upload-hint">Secure local workspace • ${multiple?"Multiple files supported":"One file"}</em></div></div><div id="filePreview" class="file-preview"></div><div id="files" class="file-list"></div>`}
function bindPicker(cb){
 const dz=$("#drop"),inp=$("#toolFile"); if(!dz||!inp)return;
 ["dragenter","dragover"].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.add("drag")}));
 ["dragleave","drop"].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.remove("drag")}));
 dz.addEventListener("drop",e=>{if(e.dataTransfer.files.length){try{inp.files=e.dataTransfer.files}catch{};cb()}});inp.onchange=cb;
}
function fileKind(f){const t=(f.type||"").toLowerCase();if(t.startsWith("image/"))return "image";if(t.includes("pdf"))return "pdf";if(t.includes("word")||/\.docx?$/i.test(f.name))return "doc";if(t.includes("sheet")||/\.(xlsx?|csv)$/i.test(f.name))return "sheet";if(t.includes("presentation")||/\.pptx?$/i.test(f.name))return "ppt";return "file"}
function listFiles(){const fs=[...($("#toolFile")?.files||[])];const preview=$("#filePreview"),list=$("#files");if(preview)preview.innerHTML=fs.map((f,i)=>{const k=fileKind(f),isImg=k==="image";const icon={image:"IMG",pdf:"PDF",doc:"DOC",sheet:"XLS",ppt:"PPT",file:"FILE"}[k];const url=isImg?URL.createObjectURL(f):"";return `<div class="preview-card"><div class="preview-media ${k}">${isImg?`<img src="${url}" alt="">`:`<span>${icon}</span>`}<div class="preview-check">✓</div></div><div class="preview-meta"><strong title="${esc(f.name)}">${esc(f.name)}</strong><span>${fmt(f.size)}${f.type?" • "+esc(f.type):""}</span></div></div>`}).join("");if(list)list.innerHTML=fs.map(f=>`<div class="file-chip"><span><b>${esc(fileKind(f).toUpperCase())}</b> ${esc(f.name)}</span><b>${fmt(f.size)}</b></div>`).join("");return fs}
function progressUi(){return `<div class="conversion-status" id="conversionStatus"><span class="status-dot"></span><b id="statusText">Ready</b><span id="statusDetail">Waiting for conversion</span></div><div class="progress"><i id="bar"></i><span id="progressGlow"></span></div><div class="result" id="result"></div>`}
function setBar(n){const b=$("#bar");if(b)b.style.width=Math.max(0,Math.min(100,n))+"%";const s=$("#statusDetail");if(s)s.textContent=n>=100?"Conversion finished":"Processing… "+Math.round(n)+"%"}
function setStatus(text,detail=""){const a=$("#statusText"),b=$("#statusDetail");if(a)a.textContent=text;if(b)b.textContent=detail}
function showSuccess(message="Conversion completed"){const r=$("#result");if(!r)return;r.classList.add("success-result");r.innerHTML=`<div class="success-animation"><span>✓</span></div><div class="success-copy"><strong>${esc(message)}</strong><small>Your file is ready. You can download it now or find it in Download Center.</small></div>`;setStatus("Completed","Ready to download")}
function addDownload(blob,name,meta="Ready") {const u=URL.createObjectURL(blob);state.downloads.unshift({id:Date.now()+Math.random(),blob,url:u,name,size:blob.size,meta,time:new Date().toLocaleTimeString()});renderDownloadCenter();return u}
function renderDownloadCenter(){const box=$("#downloadCenterList"),count=$("#downloadCount");if(count)count.textContent=state.downloads.length;if(!box)return;box.innerHTML=state.downloads.length?state.downloads.map(d=>`<div class="download-item"><div class="download-file-icon">${esc((d.name.split(".").pop()||"FILE").toUpperCase().slice(0,4))}</div><div class="download-item-main"><strong title="${esc(d.name)}">${esc(d.name)}</strong><span>${fmt(d.size)} • ${esc(d.meta)} • ${esc(d.time)}</span></div><a class="primary small-download" href="${d.url}" download="${esc(d.name)}">↓</a></div>`).join(""):`<div class="download-empty"><div>↓</div><strong>No files yet</strong><span>Converted files will appear here.</span></div>`}
function initDownloadCenter(){const fab=$("#downloadFab"),panel=$("#downloadCenter");fab?.addEventListener("click",()=>{panel?.classList.toggle("hidden");panel?.setAttribute("aria-hidden",panel?.classList.contains("hidden")?"true":"false")});$("#closeDownloadCenter")?.addEventListener("click",()=>{panel?.classList.add("hidden")});$("#clearDownloads")?.addEventListener("click",()=>{state.downloads.forEach(d=>URL.revokeObjectURL(d.url));state.downloads=[];renderDownloadCenter();toast("Download Center cleared")});renderDownloadCenter()}
initDownloadCenter();

function openImagePdf(){showModal("JPG / PNG → PDF",`<div class="tool-form">${pickerHtml("image/jpeg,image/png,image/webp",true)}${progressUi()}<button id="go" class="primary convert-btn">Create PDF</button></div>`);bindPicker(listFiles);$("#go").onclick=async()=>{const fs=listFiles();if(!fs.length)return toast("Choose images.");const{jsPDF}=jspdf;const pdf=new jsPDF({unit:"pt",format:"a4"});try{for(let i=0;i<fs.length;i++){const im=await imageData(fs[i]),pw=pdf.internal.pageSize.getWidth()-40,ph=pdf.internal.pageSize.getHeight()-40,s=Math.min(pw/im.width,ph/im.height),w=im.width*s,h=im.height*s;if(i)pdf.addPage();pdf.addImage(im.url,"JPEG",20+(pw-w)/2,20+(ph-h)/2,w,h,undefined,"FAST");setBar((i+1)/fs.length*100)}const b=pdf.output("blob");downloadBlob(b,"BORA-images-to-pdf.pdf");addHistory(`${fs.length} images`,"Images → PDF");showSuccess("PDF created successfully")}catch(e){$("#result").textContent=e.message}}}

function openPdfText(){showModal("PDF → Text",`<div class="tool-form">${pickerHtml(".pdf,application/pdf")}${progressUi()}<button id="go" class="primary">Extract Text</button></div>`);bindPicker(listFiles);$("#go").onclick=async()=>{const f=listFiles()[0];if(!f)return toast("Choose PDF.");try{const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;let text="";for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();text+=`\\n--- Page ${i} ---\\n`+c.items.map(x=>x.str).join(" ")+"\\n";setBar(i/pdf.numPages*100)}const b=new Blob([text],{type:"text/plain;charset=utf-8"});downloadBlob(b,base(f.name)+".txt");addHistory(f.name,"PDF → Text");$("#result").innerHTML=`<textarea style="min-height:220px">${esc(text)}</textarea><div class="result-actions"><button class="primary" id="dl">Download TXT</button></div>`;$("#dl").onclick=()=>downloadBlob(b,base(f.name)+".txt")}catch(e){$("#result").textContent=e.message}}}

function pdfEditorBody(key){
 const names={"merge-pdf":"Merge PDF","split-pdf":"Split PDF","rotate-pdf":"Rotate PDF","pages-pdf":"Delete / Extract Pages","reorder-pdf":"Reorder Pages","watermark-pdf":"Watermark PDF"};return `<div class="tool-form"><p class="meta">${names[key]}</p>${pickerHtml(".pdf,application/pdf",key==="merge-pdf")}<div class="two">${key==="split-pdf"?'<input id="range" placeholder="Pages: 1-3,5,8">':""}${key==="rotate-pdf"?'<select id="angle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>':""}${key==="pages-pdf"?'<input id="pages" placeholder="Keep pages: 1,3,5-7">':""}${key==="reorder-pdf"?'<input id="order" placeholder="New order: 3,1,2,4">':""}${key==="watermark-pdf"?'<input id="wm" placeholder="Watermark text">':""}</div>${progressUi()}<button id="go" class="primary convert-btn">Run Tool</button></div>`}
async function openPdfEditor(key){showModal(key.replace(/-/g," ").replace(/\b\w/g,x=>x.toUpperCase()),pdfEditorBody(key));bindPicker(listFiles);$("#go").onclick=async()=>{const fs=listFiles();if(!fs.length)return toast("Choose PDF.");try{const{PDFDocument,degrees}=PDFLib;const docs=[];for(const f of fs)docs.push(await PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true}));let out=await PDFDocument.create();
if(key==="merge-pdf"){for(const d of docs){for(const p of await out.copyPages(d,d.getPageIndices()))out.addPage(p)}}
else{let d=docs[0],ids=d.getPageIndices();if(key==="split-pdf"||key==="pages-pdf"||key==="reorder-pdf"){let wanted=key==="split-pdf"?parsePages($("#range").value,ids.length):key==="pages-pdf"?parsePages($("#pages").value,ids.length):$("#order").value.split(",").map(x=>+x.trim()-1).filter(x=>x>=0&&x<ids.length);if(!wanted.length)return toast("Enter valid page numbers.");for(const i of wanted)out.addPage((await out.copyPages(d,[i]))[0])}
else if(key==="rotate-pdf"){out=await PDFDocument.load(await d.save());for(const p of out.getPages())p.setRotation(degrees((+$("#angle").value)||90))}
else if(key==="watermark-pdf"){for(const p of await out.copyPages(d,ids)){out.addPage(p);const{width,height}=p.getSize();p.drawText($("#wm").value||"BORA",{x:width*.25,y:height*.5,size:38,opacity:.25,rotate:degrees(25)})}}
}const b=new Blob([await out.save()],{type:"application/pdf"});downloadBlob(b,"BORA-"+key+".pdf");addHistory(fs[0].name,key);setBar(100);showSuccess("PDF tool completed successfully")}catch(e){$("#result").textContent=e.message}}}
function parsePages(s,n){const a=[];(s||"").split(",").forEach(v=>{if(v.includes("-")){let[x,y]=v.split("-").map(Number);for(let i=x;i<=y;i++)if(i>=1&&i<=n)a.push(i-1)}else{let i=+v;if(i>=1&&i<=n)a.push(i-1)}});return [...new Set(a)]}

function openImageTool(key){
 const titles={"image-format":"JPG / PNG / WebP","image-compress":"Compress Image","image-resize":"Resize Image"};
 showModal(titles[key],`<div class="tool-form">${pickerHtml("image/jpeg,image/png,image/webp",true)}<div class="two"><select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select><input id="width" type="number" placeholder="Width (optional)"></div><div class="two"><input id="quality" type="number" min="10" max="100" value="85" placeholder="Quality %"><select id="fit"><option value="contain">Keep ratio</option><option value="stretch">Stretch</option></select></div>${progressUi()}<div id="fileDownloads" class="result-downloads"></div><button id="go" class="primary convert-btn">Convert to Individual Files</button></div>`);
 bindPicker(listFiles);
 $("#go").onclick=async()=>{
   const fs=listFiles();if(!fs.length)return toast("Choose images.");
   $("#go").disabled=true;$("#fileDownloads").innerHTML="";setStatus("Preparing","Reading selected files…");
   try{
     const type=$("#fmt").value,ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[type],outputs=[];
     for(let i=0;i<fs.length;i++){
       const r=await imageData(fs[i]),w=+$("#width").value||r.width,h=+$("#width").value?Math.round(r.height*(w/r.width)):r.height;
       const c=document.createElement("canvas");c.width=w;c.height=h;
       const ctx=c.getContext("2d");
       if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}
       ctx.drawImage(r.img,0,0,w,h);
       const b=await new Promise((resolve,reject)=>c.toBlob(x=>x?resolve(x):reject(Error("Image encoding failed")),type,+$("#quality").value/100));
       outputs.push({blob:b,name:`${base(fs[i].name)}.${ext}`});
       setBar((i+1)/fs.length*100);setStatus("Converting",`${i+1} of ${fs.length} files`);
     }
     const box=$("#fileDownloads");
     box.innerHTML=`<div class="download-summary"><b>Completed</b><span>${outputs.length} file${outputs.length>1?"s":""} ready — no ZIP created</span></div>`;
     outputs.forEach(x=>{
       const u=addDownload(x.blob,x.name,"Individual output");
       const a=document.createElement("a");a.className="primary file-download";a.href=u;a.download=x.name;a.textContent=`↓ ${x.name}`;
       box.appendChild(a);
     });
     showSuccess(`${outputs.length} file${outputs.length>1?"s":""} converted successfully`);addHistory(`${fs.length} image(s)`,titles[key]);toast("Conversion complete — individual files are ready");
   }catch(e){$("#result").textContent=e.message}
   finally{$("#go").disabled=false}
 };
}
function openSimpleTool(key){const titles={"txt-pdf":"TXT → PDF","html-pdf":"HTML → PDF","csv-excel":"CSV ↔ Excel"};showModal(titles[key],`<div class="tool-form">${pickerHtml(key==="html-pdf"?".html,.htm":key==="csv-excel"?".csv,.xlsx,.xls":".txt,text/plain",false)}${key==="csv-excel"?'<select id="direction"><option value="csv-xlsx">CSV → Excel</option><option value="xlsx-csv">Excel → CSV</option></select>':""}${progressUi()}<button id="go" class="primary convert-btn">Convert</button></div>`);bindPicker(listFiles);$("#go").onclick=async()=>{const f=listFiles()[0];if(!f)return toast("Choose a file.");try{if(key==="txt-pdf"){const{jsPDF}=jspdf,pdf=new jsPDF();const text=await f.text();const lines=pdf.splitTextToSize(text,540);let y=40;for(const line of lines){if(y>790){pdf.addPage();y=40}pdf.text(line,30,y);y+=14}downloadBlob(pdf.output("blob"),base(f.name)+".pdf")}
else if(key==="html-pdf"){const div=document.createElement("div");div.style.cssText="position:fixed;left:-10000px;top:0;width:800px;background:#fff;padding:30px;color:#111";div.innerHTML=await f.text();document.body.appendChild(div);const c=await html2canvas(div,{scale:1.5});document.body.removeChild(div);const{jsPDF}=jspdf,pdf=new jsPDF({unit:"px",format:[c.width,c.height]});pdf.addImage(c.toDataURL("image/jpeg",.92),"JPEG",0,0,c.width,c.height);downloadBlob(pdf.output("blob"),base(f.name)+".pdf")}
else{const dir=$("#direction").value;if(!window.XLSX)throw Error("Excel engine not loaded");if(dir==="csv-xlsx"){const wb=XLSX.utils.book_new(),ws=XLSX.utils.csv_to_sheet(await f.text());XLSX.utils.book_append_sheet(wb,ws,"Sheet1");downloadBlob(XLSX.write(wb,{bookType:"xlsx",type:"array"}),base(f.name)+".xlsx")}else{const wb=XLSX.read(await f.arrayBuffer(),{type:"array"}),csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),base(f.name)+".csv")}}addHistory(f.name,titles[key]);setBar(100);showSuccess("Conversion completed successfully")}catch(e){$("#result").textContent=e.message}}}
function openOcr(key){const lang=key==="ocr-en"?"eng":key==="ocr-km"?"khm":key==="ocr-zh"?"chi_sim":key==="ocr-th"?"tha":"eng";showModal(key==="ocr-editor"?"OCR Editor":"OCR — "+lang.toUpperCase(),`<div class="tool-form">${pickerHtml("image/*,.pdf,application/pdf")}${key==="ocr-editor"?'<textarea id="ocrText" placeholder="Recognized text will appear here…"></textarea><div class="result-actions"><button id="txt" class="primary">Export TXT</button><button id="pdf" class="secondary">Export PDF</button></div>':""}${progressUi()}<button id="go" class="primary convert-btn">Start OCR</button></div>`);bindPicker(listFiles);$("#go").onclick=async()=>{const f=listFiles()[0];if(!f)return toast("Choose an image or PDF.");try{const fd=new FormData();fd.append("file",f);fd.append("lang",lang);const d=await postForm("/api/convert/ocr",fd,p=>setBar(p));const text=d.text||"";if($("#ocrText"))$("#ocrText").value=text;else downloadBlob(new Blob([text],{type:"text/plain;charset=utf-8"}),base(f.name)+"-ocr.txt");addHistory(f.name,"OCR "+lang.toUpperCase());showSuccess("OCR completed successfully");$("#result").insertAdjacentHTML("beforeend",`<p class="ocr-result-preview">${esc((text||"").slice(0,300))}</p>`)}catch(e){$("#result").textContent=e.message}};$("#txt")?.addEventListener("click",()=>downloadBlob(new Blob([$("#ocrText").value],{type:"text/plain"}),"BORA-OCR.txt"));$("#pdf")?.addEventListener("click",()=>{const{jsPDF}=jspdf,pdf=new jsPDF();pdf.text(pdf.splitTextToSize($("#ocrText").value,540),30,40);downloadBlob(pdf.output("blob"),"BORA-OCR.pdf")})}

async function openServerTool(key){const labels={"pdf-word":"PDF → Word","word-pdf":"Word → PDF","excel-pdf":"Excel → PDF","pdf-excel":"PDF → Excel","ppt-pdf":"PowerPoint → PDF","pdf-ppt":"PDF → PowerPoint","compress-pdf":"Compress PDF","password-pdf":"Password / Remove Password","remove-bg":"Remove Background (AI)"};showModal(labels[key],`<div class="tool-form">${pickerHtml(key==="pdf-word"?".pdf":key==="word-pdf"?".doc,.docx":key==="excel-pdf"?".xls,.xlsx":key==="pdf-excel"?".pdf":key==="ppt-pdf"?".ppt,.pptx":key==="pdf-ppt"?".pdf":key==="compress-pdf"?".pdf":"*")}${key==="password-pdf"?'<div class="two"><input id="password" type="password" placeholder="Password (leave empty to remove)"><select id="mode"><option value="protect">Protect</option><option value="remove">Remove</option></select></div>':""}${key==="pdf-excel"?'<select id="sheetMode"><option value="text">Extract text rows</option></select>':""}${progressUi()}<button id="go" class="primary convert-btn">Run Conversion</button></div>`);bindPicker(listFiles);$("#go").onclick=async()=>{const f=listFiles()[0];if(!f)return toast("Choose a file.");const fd=new FormData();fd.append("file",f);fd.append("operation",key);if($("#password")){fd.append("password",$("#password").value);fd.append("mode",$("#mode").value)}try{const d=await postForm("/api/convert",fd,p=>setBar(p));if(d.downloadUrl){const b=await fetch(d.downloadUrl).then(r=>r.blob());downloadBlob(b,d.filename||("BORA-"+key));}addHistory(f.name,labels[key]);showSuccess(d.filename||"File ready")}catch(e){$("#result").innerHTML=`<b>Conversion failed</b><p>${esc(e.message)}</p><small>Install the required server engine shown in the error, then restart BORA.</small>`}}}
async function postForm(url,fd,progress){const r=await fetch(url,{method:"POST",body:fd});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Server conversion failed");if(progress)progress(100);return d}
function base(n){return n.replace(/\.[^.]+$/,"")}
function imageData(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>res({url:u,img,width:img.naturalWidth,height:img.naturalHeight});img.onerror=rej;img.src=u})}
function downloadBlob(blob,name){const u=addDownload(blob,name,"Converted file");const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()}

async function loadDrivers(){try{state.drivers=await getJSON("/api/drivers");renderDrivers()}catch(e){toast(e.message)}}function renderDrivers(){const q=($("#ds")?.value||"").toLowerCase(),a=state.drivers.filter(x=>(state.cat==="all"||x.category===state.cat)&&`${x.brand} ${x.model} ${x.title} ${x.description}`.toLowerCase().includes(q));$("#dl").innerHTML=a.length?a.map(x=>`<div class="item"><div><strong>${esc(x.title)}</strong><div class="meta">${esc(x.brand)} · ${esc(x.model)} · ${esc(x.windows||"")} · ${fmt(x.size)}<br>${esc(x.description||"")}</div></div><a class="primary" href="${x.url}" download>Download</a></div>`).join(""):`<div class="panel">No drivers found.</div>`}
async function loadApps(){try{state.apps=await getJSON("/api/apps");$("#al").innerHTML=state.apps.length?state.apps.map(x=>`<div class="item"><div><strong>${esc(x.name)}</strong><div class="meta">Version ${esc(x.version||"—")} · ${fmt(x.size)}<br>${esc(x.whatsNew||x.description||"")}</div></div><a class="primary" href="${x.url}" download>Download APK</a></div>`).join(""):`<div class="panel">No APKs uploaded yet.</div>`}catch(e){toast(e.message)}}
async function loadWindows(){try{state.windows=await getJSON("/api/windows");renderWindows()}catch(e){toast(e.message)}}function renderWindows(){const q=($("#ws")?.value||"").toLowerCase(),a=state.windows.filter(x=>`${x.name} ${x.version} ${x.windows} ${x.description}`.toLowerCase().includes(q));$("#wl").innerHTML=a.length?a.map(x=>`<div class="item"><div><strong>${esc(x.name)}</strong><div class="meta">${esc(x.windows||"")} · ${fmt(x.size)}<br>${esc(x.description||"")}</div></div><a class="primary" href="${x.url}" download>Download</a></div>`).join(""):`<div class="panel">No Windows files found.</div>`}
$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.cat=b.dataset.cat;renderDrivers()});$("#ds").oninput=renderDrivers;$("#ws").oninput=renderWindows;

async function adminItems(){try{const[d,a,w]=await Promise.all([getJSON("/api/drivers"),getJSON("/api/apps"),getJSON("/api/windows")]);const all=[...d.map(x=>["drivers",x]),...a.map(x=>["apps",x]),...w.map(x=>["windows",x])];$("#items").innerHTML=all.length?all.map(([t,x])=>`<div class="admin-row"><div><strong>${esc(x.title||x.name)}</strong><br><span class="muted">${t} · ${fmt(x.size)}</span></div><div class="muted">${esc(x.version||"")}</div><div class="muted">${esc(x.windows||"")}</div><button class="ghost" onclick="editItem('${t}','${x.id}')">Edit</button><button class="ghost" onclick="delItem('${t}','${x.id}')">Delete</button></div>`).join(""):"No uploads yet."}catch(e){toast(e.message)}}
$("#unlock").onclick=async()=>{const p=$("#pw").value;try{await getJSON("/api/admin/check",{headers:{"x-admin-password":p}});state.pass=p;$("#panel").classList.remove("hidden");$("#stat").textContent="Admin unlocked";adminItems();adminSite();toast("Owner mode unlocked")}catch{$("#panel").classList.add("hidden");state.pass="";$("#stat").textContent="Wrong password";toast("Wrong password")}}
$("#pw").onkeydown=e=>{if(e.key==="Enter")$("#unlock").click()};$("#refreshAdmin").onclick=adminItems;
$("#backupBtn").onclick=async()=>{try{const r=await fetch("/api/admin/backup",{headers:{"x-admin-password":state.pass}});if(!r.ok)throw Error("Backup failed");downloadBlob(await r.blob(),"BORA-backup.zip")}catch(e){toast(e.message)}};
async function upload(url,form){if(!state.pass)throw Error("Unlock Admin first");const btn=form.querySelector("button[type=submit]");btn.disabled=true;try{await getJSON(url,{method:"POST",headers:{"x-admin-password":state.pass},body:new FormData(form)});form.reset();toast("Uploaded successfully");adminItems()}finally{btn.disabled=false}}
$("#df").onsubmit=e=>{e.preventDefault();upload("/api/admin/drivers",e.target).catch(x=>toast(x.message))};$("#af").onsubmit=e=>{e.preventDefault();upload("/api/admin/apps",e.target).catch(x=>toast(x.message))};$("#wf").onsubmit=e=>{e.preventDefault();upload("/api/admin/windows",e.target).catch(x=>toast(x.message))};
window.delItem=async(t,id)=>{if(!confirm("Delete this item?"))return;try{await getJSON(`/api/admin/${t}/${id}`,{method:"DELETE",headers:{"x-admin-password":state.pass}});adminItems();toast("Deleted")}catch(e){toast(e.message)}};
window.editItem=async(t,id)=>{const list=await getJSON(`/api/${t}`),x=list.find(v=>v.id===id);if(!x)return;const fields=t==="drivers"?["title","brand","model","category","windows","version","description"]:t==="apps"?["name","version","versionCode","whatsNew","description"]:["name","version","windows","description"];showModal("Edit item",`<div class="tool-form">${fields.map(k=>`<label>${k}<input id="edit-${k}" value="${esc(x[k]||"")}"></label>`).join("")}<button class="primary" id="saveEdit">Save changes</button></div>`);$("#saveEdit").onclick=async()=>{const body={};fields.forEach(k=>body[k]=$("#edit-"+k).value);try{await getJSON(`/api/admin/${t}/${id}`,{method:"PUT",headers:{"x-admin-password":state.pass,"Content-Type":"application/json"},body:JSON.stringify(body)});closeModal();adminItems();toast("Saved")}catch(e){toast(e.message)}}};

async function adminSite(){
  if(!state.pass)return toast("Unlock Admin first.");
  try{
    const s=await getJSON("/api/admin/site",{headers:{"x-admin-password":state.pass}});
    const rows=(s.tools||[]).sort((a,b)=>(a.order||0)-(b.order||0));
    $("#siteName").value=s.brand?.name||"BORA";$("#siteSubtitle").value=s.brand?.subtitle||"DOCUMENT WORKSPACE";
    $("#siteTagline").value=s.brand?.tagline||"";$("#siteDesc").value=s.brand?.description||"";
    $("#logoText").value=s.brand?.logoText||"";$("#logoImage").value=s.brand?.logoImage||"";
    $("#bgType").value=s.background?.type||"aurora";$("#bgSpeed").value=s.background?.speed||22;$("#bgOpacity").value=s.background?.opacity??.13;$("#bgImage").value=s.background?.customImage||"";if($("#bgMotion"))$("#bgMotion").value=s.background?.motion||"medium";if($("#bgClarity"))$("#bgClarity").value=s.background?.clarity||96;if($("#bgGrid"))$("#bgGrid").value=s.background?.grid||"on";if($("#bgParticles"))$("#bgParticles").value=s.background?.particles||"on";if($("#bgScan"))$("#bgScan").value=s.background?.scan||"on";
    $("#toolAdminList").innerHTML=rows.map(t=>`<div class="tool-admin-row">
      <div class="tool-mini-icon">${t.iconImage?`<img src="${esc(t.iconImage)}">`:esc(t.icon||"TOOL")}</div>
      <div><strong>${esc(t.title)}</strong><small>${esc(t.cat)} · ${esc(t.operation||t.url||"")}</small></div>
      <label class="switch"><input type="checkbox" ${t.enabled!==false?"checked":""} onchange="toggleTool('${esc(t.id)}',this.checked)"><span></span></label>
      <button class="ghost" onclick="editTool('${esc(t.id)}')">Edit</button>
      <button class="ghost danger" onclick="deleteTool('${esc(t.id)}')">Delete</button>
    </div>`).join("")||"<div class='muted'>No tools.</div>";
  }catch(e){toast(e.message)}
}
async function saveSite(){
  const body={brand:{name:$("#siteName").value,subtitle:$("#siteSubtitle").value,tagline:$("#siteTagline").value,description:$("#siteDesc").value,logoText:$("#logoText").value,logoImage:$("#logoImage").value},
    background:{type:$("#bgType").value,speed:+$("#bgSpeed").value||22,opacity:+$("#bgOpacity").value||.13,customImage:$("#bgImage").value,motion:$("#bgMotion")?.value||"medium",clarity:+$("#bgClarity")?.value||96,grid:$("#bgGrid")?.value||"on",particles:$("#bgParticles")?.value||"on",scan:$("#bgScan")?.value||"on"}};
  try{const d=await getJSON("/api/admin/site",{method:"PUT",headers:{"x-admin-password":state.pass,"Content-Type":"application/json"},body:JSON.stringify(body)});site=d.site;applySite();toast("Website settings saved.");adminSite()}catch(e){toast(e.message)}
}
async function uploadIconFile(input,target){
  const f=input.files?.[0];if(!f)return;
  const fd=new FormData();fd.append("file",f);
  try{const d=await getJSON("/api/admin/site/icon",{method:"POST",headers:{"x-admin-password":state.pass},body:fd});$(target).value=d.url;toast("Image uploaded.");}catch(e){toast(e.message)}
}
function toolForm(t={}){
  return `<div class="tool-form admin-tool-form">
    <div class="two"><label>Title<input id="t-title" value="${esc(t.title||"")}"></label><label>Category<select id="t-cat"><option value="convert">Convert</option><option value="pdf">PDF</option><option value="image">Image</option><option value="ocr">OCR</option><option value="other">Other</option></select></label></div>
    <label>Description<input id="t-desc" value="${esc(t.desc||"")}"></label>
    <div class="two"><label>Icon text<input id="t-icon" value="${esc(t.icon||"TOOL")}"></label><label>Icon image URL<input id="t-image" value="${esc(t.iconImage||"")}" placeholder="/media/icons/..."></label></div>
    <div class="two"><label>Color<select id="t-color"><option value="purple">Purple</option><option value="blue">Blue</option><option value="green">Green</option><option value="orange">Orange</option><option value="red">Red</option><option value="dark">Dark</option></select></label><label>Order<input id="t-order" type="number" value="${Number(t.order||1)}"></label></div>
    <div class="two"><label>Action<select id="t-action"><option value="browser">Browser tool</option><option value="server">Server operation</option><option value="link">External link</option></select></label><label>Operation<input id="t-operation" value="${esc(t.operation||"")}" placeholder="pdf-word / image-format / ..."></label></div>
    <label>File type accept<input id="t-accept" value="${esc(t.accept||"*")}"></label>
    <label>External URL (only for link)<input id="t-url" value="${esc(t.url||"")}" placeholder="https://..."></label>
    <label class="checkline"><input id="t-enabled" type="checkbox" ${t.enabled!==false?"checked":""}> Visible to public users</label>
    <button class="primary" id="saveTool">Save tool</button>
  </div>`;
}
function readToolForm(){
  return {title:$("#t-title").value,cat:$("#t-cat").value,desc:$("#t-desc").value,icon:$("#t-icon").value,iconImage:$("#t-image").value,c:$("#t-color").value,order:+$("#t-order").value||1,action:$("#t-action").value,operation:$("#t-operation").value,accept:$("#t-accept").value,url:$("#t-url").value,enabled:$("#t-enabled").checked};
}
window.editTool=async id=>{
  const t=(site.tools||[]).find(x=>x.id===id);if(!t)return;
  showModal("Edit Tool",toolForm(t));$("#t-cat").value=t.cat||"convert";$("#t-color").value=t.c||"purple";$("#t-action").value=t.action||"browser";
  $("#saveTool").onclick=async()=>{try{await getJSON(`/api/admin/tools/${id}`,{method:"PUT",headers:{"x-admin-password":state.pass,"Content-Type":"application/json"},body:JSON.stringify(readToolForm())});closeModal();loadSite();adminSite();toast("Tool updated.")}catch(e){toast(e.message)}};
};
window.deleteTool=async id=>{if(!confirm("Delete this tool?"))return;try{await getJSON(`/api/admin/tools/${id}`,{method:"DELETE",headers:{"x-admin-password":state.pass}});loadSite();adminSite();toast("Tool deleted.")}catch(e){toast(e.message)}};
window.toggleTool=async(id,on)=>{try{await getJSON(`/api/admin/tools/${id}`,{method:"PUT",headers:{"x-admin-password":state.pass,"Content-Type":"application/json"},body:JSON.stringify({enabled:on})});loadSite();}catch(e){toast(e.message)}};
$("#saveSite")?.addEventListener("click",saveSite);
$("#newTool")?.addEventListener("click",()=>{showModal("Add New Tool",toolForm());$("#saveTool").onclick=async()=>{try{await getJSON("/api/admin/tools",{method:"POST",headers:{"x-admin-password":state.pass,"Content-Type":"application/json"},body:readToolForm()});closeModal();loadSite();adminSite();toast("New tool added.")}catch(e){toast(e.message)}}});
$("#loadSiteAdmin")?.addEventListener("click",adminSite);
$("#iconUpload")?.addEventListener("change",e=>uploadIconFile(e.target,"#logoImage"));
$("#bgUpload")?.addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f||!state.pass)return;
  const fd=new FormData();fd.append("file",f);
  try{const d=await getJSON("/api/admin/site/background",{method:"POST",headers:{"x-admin-password":state.pass},body:fd});site=d.site;applySite();adminSite();toast("Background uploaded and applied.")}catch(x){toast(x.message)}
});

$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("bora-theme",document.body.classList.contains("dark")?"dark":"light");$("#themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾"};if(localStorage.getItem("bora-theme")==="dark"){$("#themeBtn").click()}
let lang="en";$("#langBtn").onclick=()=>{lang=lang==="en"?"km":"en";$("#langBtn").textContent=lang.toUpperCase();toast(lang==="km"?"ភាសាខ្មែរ — UI tools ready":"English — UI tools ready")};
loadDrivers();loadApps();loadWindows();


/* =========================================================
   BORA V13 — TOOL ROUTER + PDF/IMAGE RESOLUTION
   ========================================================= */
function openTool(key){
  const browserTools = new Set([
    "pdf-jpg","pdf-png","jpg-pdf","png-pdf",
    "image-format","image-compress","image-resize",
    "txt-pdf","html-pdf","csv-excel"
  ]);
  if(browserTools.has(key)){
    if(["pdf-jpg","pdf-png","jpg-pdf","png-pdf"].includes(key)) return openPdfImageTool(key);
    if(["jpg-pdf","png-pdf"].includes(key)) return openImagePdfTool(key); if(["image-format","image-compress","image-resize"].includes(key)) return openImageTool(key);
    return openSimpleTool(key);
  }
  if(/^ocr-/.test(key)) return openOcr(key);
  return openServerTool(key);
}

function resolutionHtml(){
  return `
    <label>Output resolution
      <select id="outputResolution">
        <option value="auto">Auto / Standard</option>
        <option value="720">720p — HD</option>
        <option value="1080" selected>1080p — Full HD</option>
        <option value="2k">2K — 2560px</option>
        <option value="4k">4K — 3840px</option>
      </select>
    </label>
    <label>Image quality
      <select id="outputQuality">
        <option value=".82">82%</option>
        <option value=".90" selected>90%</option>
        <option value=".94">94%</option>
        <option value=".98">98%</option>
      </select>
    </label>`;
}

function targetLongEdge(v){
  return ({auto:2200,720:1280,1080:1920,"2k":2560,"4k":3840}[v]||1920);
}

function openPdfImageTool(key){
  const isJpg=key==="pdf-jpg";
  const title=isJpg?"PDF → JPG":"PDF → PNG";
  showModal(title,`
    <div class="tool-form">
      ${pickerHtml(".pdf,application/pdf")}
      <div class="resolution-box">${resolutionHtml()}</div>
      ${progressUi()}
      <button id="go" class="primary convert-btn">Convert</button>
    </div>
  `);
  bindPicker(listFiles);
  $("#go").onclick=async()=>{
    const f=listFiles()[0];
    if(!f)return toast("Choose a PDF file.");
    try{
      if(!window.pdfjsLib)throw Error("PDF engine did not load.");
      const resolution=$("#outputResolution")?.value||"1080";
      const quality=Number($("#outputQuality")?.value||.90);
      const data=await f.arrayBuffer();
      const pdf=await window.pdfjsLib.getDocument({data}).promise;
      const edge=targetLongEdge(resolution);
      for(let i=1;i<=pdf.numPages;i++){
        setStatus?.(`Rendering page ${i}/${pdf.numPages}…`);
        const page=await pdf.getPage(i);
        const base=page.getViewport({scale:1});
        const longest=Math.max(base.width,base.height);
        const scale=Math.max(.5,edge/longest);
        const vp=page.getViewport({scale});
        const canvas=document.createElement("canvas");
        canvas.width=Math.ceil(vp.width);
        canvas.height=Math.ceil(vp.height);
        const ctx=canvas.getContext("2d",{alpha:false});
        ctx.fillStyle="#ffffff";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:ctx,viewport:vp}).promise;
        const mime=isJpg?"image/jpeg":"image/png";
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality));
        if(!blob)throw Error("Could not create output image.");
        downloadBlob(blob,`BORA-${String(i).padStart(2,"0")}-${resolution.toUpperCase()}.${isJpg?"jpg":"png"}`);
        setBar?.(Math.round(i/pdf.numPages*100));
      }
      showSuccess(`${pdf.numPages} page(s) converted at ${resolution==="auto"?"standard":resolution.toUpperCase()}.`);
    }catch(e){
      const r=$("#result"); if(r)r.innerHTML=`<b>Conversion failed</b><p>${esc(e.message||"Unknown error")}</p>`;
      else toast(e.message||"Conversion failed");
    }
  };
}

function openImagePdfTool(key){
  const isJpg=key==="jpg-pdf";
  const title=isJpg?"JPG → PDF":"PNG → PDF";
  showModal(title,`
    <div class="tool-form">
      ${pickerHtml(isJpg?"image/jpeg,.jpg,.jpeg":"image/png",true)}
      ${resolutionHtml()}
      ${progressUi()}
      <button id="go" class="primary convert-btn">Convert</button>
    </div>
  `);
  bindPicker(listFiles);
  $("#go").onclick=async()=>{
    const files=listFiles();
    if(!files.length)return toast(`Choose ${isJpg?"JPG":"PNG"} images.`);
    try{
      if(!window.jspdf?.jsPDF)throw Error("PDF engine did not load.");
      const {jsPDF}=window.jspdf;
      const resolution=$("#outputResolution")?.value||"1080";
      const edge=targetLongEdge(resolution);
      let pdf=null;
      for(let i=0;i<files.length;i++){
        const d=await imageData(files[i]);
        const scale=Math.min(1,edge/Math.max(d.width,d.height));
        const w=Math.max(1,Math.round(d.width*scale));
        const h=Math.max(1,Math.round(d.height*scale));
        const canvas=document.createElement("canvas");
        canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext("2d",{alpha:false});
        ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,w,h);
        ctx.drawImage(d.img,0,0,w,h);
        const data=canvas.toDataURL(isJpg?"image/jpeg":"image/png",Number($("#outputQuality")?.value||.90));
        const landscape=w>h;
        const orientation=landscape?"l":"p";
        if(!pdf) pdf=new jsPDF({orientation,unit:"mm",format:"a4",compress:true});
        else pdf.addPage("a4",orientation);
        const pageW=landscape?297:210, pageH=landscape?210:297;
        const margin=8, maxW=pageW-margin*2, maxH=pageH-margin*2;
        const fit=Math.min(maxW/w,maxH/h);
        const pw=w*fit, ph=h*fit;
        pdf.addImage(data,isJpg?"JPEG":"PNG",(pageW-pw)/2,(pageH-ph)/2,pw,ph);
        setBar?.(Math.round((i+1)/files.length*100));
      }
      pdf.save(`BORA-${isJpg?"JPG":"PNG"}-to-PDF-${resolution.toUpperCase()}.pdf`);
      showSuccess(`${files.length} image(s) converted successfully.`);
    }catch(e){toast(e.message||"Conversion failed")}
  };
}

function initBoraIntro(){
  const el=$("#boraIntro");
  if(!el)return;
  const key="bora_intro_v18_seen";
  if(sessionStorage.getItem(key)==="1"){
    el.remove();
    return;
  }
  sessionStorage.setItem(key,"1");
  el.classList.add("is-active");
  el.setAttribute("aria-hidden","false");
  document.documentElement.classList.add("bora-intro-open");
  setTimeout(()=>{
    el.classList.add("is-leaving");
    document.documentElement.classList.remove("bora-intro-open");
    setTimeout(()=>el.remove(),520);
  },2600);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initBoraIntro);
else initBoraIntro();
