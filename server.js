const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const {execFile}=require("child_process");
const util=require("util");
const archiver=require("archiver");
const {Document,Packer,Paragraph,TextRun}=require("docx");
const XLSX=require("xlsx");
const PptxGenJS=require("pptxgenjs");
const exec=util.promisify(execFile);

const app=express();
const PORT=Number(process.env.PORT||1000);
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,"public");
const DATA=path.join(ROOT,"data");
const UPLOADS=path.join(ROOT,"uploads");
const CONVERTED=path.join(ROOT,"converted");
const TMP=path.join(ROOT,"temp");
const TOOLS=path.join(ROOT,"tools");
const DIRS={drivers:path.join(UPLOADS,"drivers"),apps:path.join(UPLOADS,"apps"),windows:path.join(UPLOADS,"windows"),icons:path.join(UPLOADS,"icons")};
const FILES={drivers:path.join(DATA,"drivers.json"),apps:path.join(DATA,"apps.json"),windows:path.join(DATA,"windows.json"),site:path.join(DATA,"site.json")};
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  process.env.BORA_ADMIN_PASSWORD ||
  (process.env.NODE_ENV === "production" ? "" : "admin123");

if (process.env.NODE_ENV === "production" && !ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD is required in production.");
}
const MAX_UPLOAD=2*1024*1024*1024;

for(const d of [DATA,UPLOADS,CONVERTED,TMP,TOOLS,...Object.values(DIRS)])fs.mkdirSync(d,{recursive:true});
for(const f of [FILES.drivers,FILES.apps,FILES.windows])if(!fs.existsSync(f))fs.writeFileSync(f,"[]");

const defaultConfig={version:6,brand:{name:"BORA",subtitle:"DOCUMENT WORKSPACE",tagline:"Every file. One clean workflow.",description:"Convert, edit and organize documents, PDFs, images and OCR from one fast workspace.",logoText:"B",logoImage:""},theme:{primary:"#6d45ed",secondary:"#2b7af3",mode:"light"},background:{type:"aurora",speed:22,opacity:.13,grid:true,customImage:"",motion:"medium",clarity:96,particles:"on",scan:"on"},settings:{autoRefreshSeconds:5,showAdminNav:true},tools:[]};
function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return fallback}}
function writeJSON(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2))}
function readSite(){const x=readJSON(FILES.site,defaultConfig);return {...defaultConfig,...x,brand:{...defaultConfig.brand,...(x.brand||{})},theme:{...defaultConfig.theme,...(x.theme||{})},background:{...defaultConfig.background,...(x.background||{})},settings:{...defaultConfig.settings,...(x.settings||{})},tools:Array.isArray(x.tools)?x.tools:[]}}
function writeSite(x){writeJSON(FILES.site,x)}
function readList(t){return readJSON(FILES[t],[])}
function id(){return Date.now().toString(36)+"-"+crypto.randomBytes(5).toString("hex")}
function decodeFilename(name){
  name=String(name||"file");

  // Fix UTF-8 filename that was incorrectly decoded as Latin-1
  try{
    const fixed=Buffer.from(name,"latin1").toString("utf8");

    // Only use the decoded version if it is valid UTF-8
    if(fixed && !fixed.includes("\uFFFD")){
      return fixed;
    }
  }catch{}

  return name;
}

function safeName(n){
  n=decodeFilename(n);

  const ext=path.extname(n||"").toLowerCase();

  const base=path.basename(n||"file",ext)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g,"-")
    .replace(/\s+/g," ")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
    .trim()
    .slice(0,120)
    ||"file";

  return base+ext;
}
function typeOk(t){return Object.hasOwn({drivers:1,apps:1,windows:1},t)}
function requireAdmin(req,res,next){const p=req.get("x-admin-password")||"";if(p!==ADMIN_PASSWORD)return res.status(401).json({error:"Unauthorized"});next()}
function publicItem(type,x){return {...x,url:`/download/${type}/${encodeURIComponent(x.id)}`}}
function storage(type){
  return multer.diskStorage({
    destination:(_r,_f,cb)=>cb(null,DIRS[type]),

    filename:(_r,f,cb)=>{
      const original=decodeFilename(f.originalname);

      const finalName=
        `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName(original)}`;

      cb(null,finalName);
    }
  });
}
const uploaders={drivers:multer({storage:storage("drivers"),limits:{fileSize:MAX_UPLOAD}}),apps:multer({storage:storage("apps"),limits:{fileSize:MAX_UPLOAD}}),windows:multer({storage:storage("windows"),limits:{fileSize:MAX_UPLOAD}})};
const iconUpload=multer({storage:storage("icons"),limits:{fileSize:8*1024*1024}});

app.disable("x-powered-by");
app.use(express.json({limit:"20mb"}));
app.use(express.urlencoded({extended:true,limit:"20mb"}));
app.use(express.static(PUBLIC,{index:"index.html",maxAge:0}));
app.use("/converted",express.static(CONVERTED,{maxAge:0}));
app.use("/media",express.static(UPLOADS,{maxAge:0}));

app.get("/api/status",(req,res)=>res.json({ok:true,name:"BORA Document Converter",version:"6.0.0",admin:(req.get("x-admin-password")||"")===ADMIN_PASSWORD}));
app.get("/api/site/config",(_req,res)=>{const s=readSite();res.json({...s,tools:s.tools.filter(t=>t.enabled!==false).sort((a,b)=>(a.order||0)-(b.order||0))})});

for(const t of ["drivers","apps","windows"])app.get("/api/"+t,(_q,res)=>res.json(readList(t).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(x=>publicItem(t,x))));
app.get("/download/:type/:id",(req,res)=>{const{type,id}=req.params;if(!typeOk(type))return res.status(404).send("Not found");const x=readList(type).find(v=>v.id===id);if(!x)return res.status(404).send("File not found");const f=path.join(DIRS[type],x.fileName);if(!fs.existsSync(f))return res.status(404).send("File missing");res.download(f,x.originalName||x.fileName)});

function addUpload(type,req,res){
 if(!req.file)return res.status(400).json({error:"Please choose a file."});
 if(type==="apps"&&!/\.apk$/i.test(req.file.originalname))return res.status(400).json({error:"Android upload must be .apk"});
 const decodedOriginalName=decodeFilename(req.file.originalname);

const x={
  id:id(),
  originalName:decodedOriginalName,
  fileName:req.file.filename,
  size:req.file.size,
  createdAt:new Date().toISOString()
};
 if(type==="drivers")Object.assign(x,{category:String(req.body.category||"printer"),brand:String(req.body.brand||""),model:String(req.body.model||""),title:String(req.body.title||`${req.body.brand||""} ${req.body.model||""}`.trim()||req.file.originalname),windows:String(req.body.windows||""),version:String(req.body.version||""),description:String(req.body.description||"")});
 else if(type==="apps")Object.assign(x,{name:String(req.body.name||path.basename(
  decodedOriginalName,
  path.extname(decodedOriginalName)
)),version:String(req.body.version||""),versionCode:String(req.body.versionCode||""),whatsNew:String(req.body.whatsNew||""),description:String(req.body.description||"")});
 else Object.assign(x,{name:String(req.body.name||req.file.originalname),version:String(req.body.version||""),windows:String(req.body.windows||""),description:String(req.body.description||"")});
 const a=readList(type);a.unshift(x);writeJSON(FILES[type],a);res.json({ok:true,item:publicItem(type,x)});
}
app.post("/api/admin/drivers",requireAdmin,uploaders.drivers.single("file"),(r,s)=>addUpload("drivers",r,s));
app.post("/api/admin/apps",requireAdmin,uploaders.apps.single("file"),(r,s)=>addUpload("apps",r,s));
app.post("/api/admin/windows",requireAdmin,uploaders.windows.single("file"),(r,s)=>addUpload("windows",r,s));
app.get("/api/admin/check",requireAdmin,(_r,s)=>s.json({ok:true,admin:true}));

app.get("/api/admin/site",requireAdmin,(_r,res)=>res.json(readSite()));
app.put("/api/admin/site",requireAdmin,(req,res)=>{
 const cur=readSite(),b=req.body||{};
 const next={...cur};
 for(const k of ["brand","theme","background","settings"])if(b[k]&&typeof b[k]==="object")next[k]={...cur[k],...b[k]};
 if(Array.isArray(b.tools))next.tools=b.tools.map((t,i)=>({...t,id:String(t.id||id()),order:Number(t.order??i+1),enabled:t.enabled!==false}));
 writeSite(next);res.json({ok:true,site:next});
});
app.post("/api/admin/site/icon",requireAdmin,iconUpload.single("file"),(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Choose an icon image."});
 res.json({ok:true,url:`/media/icons/${encodeURIComponent(req.file.filename)}`});
});
app.post("/api/admin/site/background",requireAdmin,iconUpload.single("file"),(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Choose a background image."});
 const s=readSite();s.background.customImage=`/media/icons/${encodeURIComponent(req.file.filename)}`;s.background.type="image";writeSite(s);res.json({ok:true,site:s});
});
app.get("/api/admin/tools",requireAdmin,(_r,res)=>res.json(readSite().tools.sort((a,b)=>(a.order||0)-(b.order||0))));
app.post("/api/admin/tools",requireAdmin,(req,res)=>{
 const s=readSite(),t=req.body||{};
 if(!t.title||!t.operation&&t.action!=="link")return res.status(400).json({error:"Tool title and an operation are required."});
 const x={id:String(t.id||id()),cat:String(t.cat||"convert"),title:String(t.title),desc:String(t.desc||""),icon:String(t.icon||"TOOL"),iconImage:String(t.iconImage||""),c:String(t.c||"purple"),action:String(t.action||"browser"),operation:String(t.operation||""),url:String(t.url||""),accept:String(t.accept||"*"),enabled:t.enabled!==false,order:Number(t.order||s.tools.length+1)};
 s.tools.push(x);writeSite(s);res.json({ok:true,tool:x});
});
app.put("/api/admin/tools/:id",requireAdmin,(req,res)=>{
 const s=readSite(),i=s.tools.findIndex(t=>t.id===req.params.id);if(i<0)return res.status(404).json({error:"Tool not found"});
 s.tools[i]={...s.tools[i],...(req.body||{}),id:s.tools[i].id,order:Number((req.body?.order ?? s.tools[i].order ?? (i+1)))};writeSite(s);res.json({ok:true,tool:s.tools[i]});
});
app.delete("/api/admin/tools/:id",requireAdmin,(req,res)=>{
 const s=readSite(),x=s.tools.find(t=>t.id===req.params.id);if(!x)return res.status(404).json({error:"Tool not found"});
 s.tools=s.tools.filter(t=>t.id!==req.params.id);writeSite(s);res.json({ok:true});
});

app.put("/api/admin/:type/:id",requireAdmin,(req,res)=>{const{type,id}=req.params;if(!typeOk(type))return res.status(404).json({error:"Unknown type"});const a=readList(type),x=a.find(v=>v.id===id);if(!x)return res.status(404).json({error:"Item not found"});const fields=type==="drivers"?["category","brand","model","title","windows","version","description"]:type==="apps"?["name","version","versionCode","whatsNew","description"]:["name","version","windows","description"];for(const k of fields)if(req.body[k]!==undefined)x[k]=String(req.body[k]);x.updatedAt=new Date().toISOString();writeJSON(FILES[type],a);res.json({ok:true,item:publicItem(type,x)})});
app.delete("/api/admin/:type/:id",requireAdmin,(req,res)=>{const{type,id}=req.params;if(!typeOk(type))return res.status(404).json({error:"Unknown type"});const a=readList(type),x=a.find(v=>v.id===id);if(!x)return res.status(404).json({error:"Item not found"});writeJSON(FILES[type],a.filter(v=>v.id!==id));try{if(x.fileName)fs.unlinkSync(path.join(DIRS[type],x.fileName))}catch{}res.json({ok:true})});
app.get("/api/admin/backup",requireAdmin,(_r,res)=>{res.setHeader("Content-Type","application/zip");res.setHeader("Content-Disposition",'attachment; filename="BORA-V6-backup.zip"');const z=archiver("zip",{zlib:{level:9}});z.pipe(res);for(const[t,f]of Object.entries(FILES)){z.file(f,{name:`data/${path.basename(f)}`});if(t!=="site")z.directory(DIRS[t],`uploads/${t}`)}z.directory(DIRS.icons,"uploads/icons");z.append(JSON.stringify({name:"BORA Document Converter",version:"6.0.0",createdAt:new Date().toISOString()},null,2),{name:"backup-info.json"});z.finalize()});

const convertUpload=multer({dest:TMP,limits:{fileSize:MAX_UPLOAD}});
function extOf(n){return path.extname(n).toLowerCase()}
async function tool(cmd,args,options={}){return exec(cmd,args,{windowsHide:true,maxBuffer:50*1024*1024,...options})}
async function findCmd(names){for(const n of names){try{await tool(n,["--version"]);return n}catch{}}return null}
async function findPython(){return await findCmd(process.platform==="win32"?["python.exe","py.exe","python3.exe"]:["python3","python"])}
async function libreOffice(input,outDir,convertTo){
 const cmd=await findCmd(process.platform==="win32"?["soffice.exe","libreoffice.exe"]:["soffice","libreoffice"]);
 if(!cmd)throw Error("LibreOffice/soffice is required. Install LibreOffice and restart BORA.");
 await tool(cmd,["--headless","--convert-to",convertTo,"--outdir",outDir,input],{timeout:180000});
 const base=path.basename(input,path.extname(input));const wanted=fs.readdirSync(outDir).filter(x=>x.toLowerCase().startsWith(base.toLowerCase()+".")&&x.toLowerCase().endsWith("."+convertTo.split(":")[0].toLowerCase()));
 if(!wanted.length)throw Error("LibreOffice did not create the expected output file.");
 return path.join(outDir,wanted[0]);
}
async function pdftotext(input,out){
 const cmd=await findCmd(["pdftotext"]);if(!cmd)throw Error("pdftotext is required. Install Poppler.");
 await tool(cmd,[input,out],{timeout:180000});return out;
}
async function pdftoppm(input,outDir,prefix){
 const cmd=await findCmd(["pdftoppm"]);if(!cmd)throw Error("pdftoppm is required. Install Poppler.");
 await tool(cmd,["-png","-r","150",input,path.join(outDir,prefix)],{timeout:240000});
 return fs.readdirSync(outDir).filter(x=>x.startsWith(prefix)&&x.endsWith(".png")).sort().map(x=>path.join(outDir,x));
}
function outPath(original,suffix,ext){return path.join(CONVERTED,`${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${safeName(path.basename(original,extOf(original)))}${suffix}.${ext}`)}
function cleanupLater(...files){setTimeout(()=>files.forEach(f=>{try{fs.rmSync(f,{recursive:true,force:true})}catch{}}),15*60*1000)}

async function pdfToWord(input,output){
 const py=await findPython();
 if(py){
   const script=path.join(TOOLS,"pdf_to_word.py");
   try{
     await tool(py,[script,input,output],{timeout:600000});
     if(fs.existsSync(output)&&fs.statSync(output).size>1000)return {method:"pdf2docx"};
   }catch(e){console.warn("pdf2docx path unavailable:",e.message)}
 }
 const txt=path.join(TMP,id()+".txt");
 await pdftotext(input,txt);
 const raw=fs.readFileSync(txt,"utf8");
 const paras=raw.split(/\r?\n/).map(x=>x.trimEnd()).filter((x,i,a)=>x.trim()||i===0);
 const doc=new Document({sections:[{properties:{},children:paras.map(line=>new Paragraph({spacing:{after:80},children:[new TextRun(line)]}))}]});
 fs.writeFileSync(output,await Packer.toBuffer(doc));
 cleanupLater(txt);
 return {method:"text-fallback"};
}

app.post("/api/convert",convertUpload.single("file"),async(req,res)=>{
 const f=req.file;if(!f)return res.status(400).json({error:"Please choose a file."});
 const op=req.body.operation;
 let jobDir=null;
 try{
   let result;
   if(op==="word-pdf"||op==="excel-pdf"||op==="ppt-pdf"){
     jobDir=fs.mkdtempSync(path.join(TMP,"office-"));
     result=await libreOffice(f.path,jobDir,"pdf");
     const final=outPath(f.originalname,"","pdf");fs.copyFileSync(result,final);result=final;
   }
   else if(op==="pdf-word"){result=outPath(f.originalname,"","docx");const meta=await pdfToWord(f.path,result);console.log(`PDF→Word: ${meta.method}`)}
   else if(op==="pdf-excel"){
     const txt=path.join(TMP,id()+".txt");await pdftotext(f.path,txt);
     const rows=fs.readFileSync(txt,"utf8").split(/\r?\n/).filter(Boolean).map(x=>[x]);
     const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"PDF Text");
     result=outPath(f.originalname,"","xlsx");XLSX.writeFile(wb,result);cleanupLater(txt);
   }
   else if(op==="pdf-ppt"){
     const dir=fs.mkdtempSync(path.join(TMP,"ppt-"));const imgs=await pdftoppm(f.path,dir,"page");
     const ppt=new PptxGenJS();ppt.layout="LAYOUT_WIDE";
     for(const img of imgs){const s=ppt.addSlide();s.background={color:"FFFFFF"};s.addImage({path:img,x:0,y:0,w:13.333,h:7.5})}
     result=outPath(f.originalname,"","pptx");await ppt.writeFile({fileName:result});cleanupLater(dir);
   }
   else if(op==="compress-pdf"){
     const cmd=await findCmd(["qpdf"]);if(!cmd)throw Error("qpdf is required for reliable PDF compression. Install qpdf.");
     result=outPath(f.originalname,"-compressed","pdf");await tool(cmd,["--stream-data=compress","--object-streams=generate",f.path,result],{timeout:240000});
   }
   else if(op==="password-pdf"){
     const cmd=await findCmd(["qpdf"]);if(!cmd)throw Error("qpdf is required for PDF password protection/removal.");
     const mode=req.body.mode,password=String(req.body.password||"");result=outPath(f.originalname,mode==="remove"?"-unlocked":"-protected","pdf");
     if(mode==="remove")await tool(cmd,["--decrypt",f.path,result],{timeout:180000});
     else{if(!password)throw Error("Enter a password.");await tool(cmd,["--encrypt",password,password,"256","--",f.path,result],{timeout:180000})}
   }
   else if(op==="remove-bg")throw Error("Background removal is not configured. Add a local rembg service or an approved AI endpoint in the server configuration.");
   else throw Error("Unknown conversion operation.");
   const filename=path.basename(result);res.json({ok:true,filename,downloadUrl:`/converted/${encodeURIComponent(filename)}`});
 }catch(e){console.error(e);res.status(500).json({error:e.message||"Conversion failed"})}
 finally{try{fs.unlinkSync(f.path)}catch{}if(jobDir)try{fs.rmSync(jobDir,{recursive:true,force:true})}catch{}}
});

app.post("/api/convert/ocr",convertUpload.single("file"),async(req,res)=>{
 const f=req.file,lang=String(req.body.lang||"eng");if(!f)return res.status(400).json({error:"Please choose a file."});
 try{
   const cmd=await findCmd(["tesseract"]);if(!cmd)throw Error("Tesseract OCR is required. Install Tesseract and the language data for "+lang+".");
   const out=path.join(TMP,id());let input=f.path;
   if(extOf(f.originalname)===".pdf"){
     const dir=fs.mkdtempSync(path.join(TMP,"ocr-"));const imgs=await pdftoppm(f.path,dir,"page");let all="";
     for(const img of imgs){const base=img.replace(/\.png$/,"");await tool(cmd,[img,base,"-l",lang,"txt"],{timeout:180000});try{all+=fs.readFileSync(base+".txt","utf8")+"\n"}catch{}}
     cleanupLater(dir);return res.json({ok:true,text:all});
   }
   await tool(cmd,[input,out,"-l",lang,"txt"],{timeout:180000});const text=fs.readFileSync(out+".txt","utf8");cleanupLater(out+".txt");res.json({ok:true,text});
 }catch(e){res.status(500).json({error:e.message||"OCR failed"})}finally{try{fs.unlinkSync(f.path)}catch{}}
});

app.use((err,req,res,_next)=>{console.error(err);if(err instanceof multer.MulterError)return res.status(400).json({error:err.message});res.status(500).json({error:err.message||"Server error"})});
app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log(" BORA DOCUMENT CONVERTER V6");
  console.log(` Website: http://127.0.0.1:${PORT}`);
  console.log(" Owner/Admin mode: protected");
  console.log(" PDF → Word: pdf2docx preferred, text fallback");
  console.log("========================================");
});