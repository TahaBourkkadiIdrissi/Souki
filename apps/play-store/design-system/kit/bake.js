// Pré-rend chaque écran (kit/screens/*.html) en HTML statique autonome : styles et images en ligne, aucun script.
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),{execFileSync}=require('child_process');
const BL={'0b53cf425c8e83f8a5a2282baf9cee15':'/mnt/user-data/uploads/Souki/apps/mobile/assets/brand/splash-symbol.png','60fbc2d104b309d3f604a56617ccfb4a':'/mnt/user-data/uploads/Souki/apps/mobile/assets/brand/symbol.png','66217af1d3f4c0b14d46f20c4a2853b3':'/mnt/user-data/uploads/Souki/apps/mobile/assets/illustrations/recolte-tomate.svg','58357c657b3225347dab2c459b843f1c':'/home/claude/ds/project/assets/Photos/tomate.png'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]),f=u.startsWith('/_blob/')?BL[u.slice(7)]:'/home/claude/ds'+u;
 if(!f||!fs.existsSync(f)){r.writeHead(404);return r.end()}let b=fs.readFileSync(f);
 if(u.includes('/kit/screens/'))b=b.toString().replace('<head>','<head><link rel="stylesheet" href="/gen/tokens.css">'+(q.url.includes('?dark')?'<script>window.FORCE_THEME="dark"</script>':'')+(q.url.includes('?ar')?'<script>window.FORCE_LANG="ar";window.AR='+fs.readFileSync('/home/claude/ds/project/kit/ar.json','utf8')+'</script>':''));
 r.writeHead(200,{'content-type':{'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream'});r.end(b)}).listen(8124);
const cache={};
function data(src,w){const key=src+w;if(cache[key])return cache[key];
 let f=src.startsWith('/_blob/')?BL[src.slice(7)]:path.resolve('/home/claude/ds/project/kit/screens',src);
 if(f.endsWith('.svg'))return cache[key]='data:image/svg+xml;base64,'+fs.readFileSync(f).toString('base64');
 const out=execFileSync('python3',['-c',`import sys,io,base64;from PIL import Image;im=Image.open(sys.argv[1]);im=im.convert('RGBA');im.thumbnail((${w},${w}));b=io.BytesIO();im.save(b,'WEBP',quality=72);print(base64.b64encode(b.getvalue()).decode())`,f]).toString().trim();
 return cache[key]='data:image/webp;base64,'+out}
(async()=>{const b=await chromium.launch();const kit=fs.readFileSync('project/kit/souki-v5.css','utf8').replace(/<\/style/gi,'<\\/style');
 const vars=fs.readFileSync('gen/tokens.css','utf8').split('\n').filter(l=>!l.startsWith('@font-face')).join('\n');
 const jobs=[];for(const f of fs.readdirSync('project/kit/screens')){jobs.push([f,'']);if(f.startsWith('Screen')&&!/Tablet|System/.test(f))jobs.push([f,'Dark']);if(f.startsWith('Screen'))jobs.push([f,'Ar'])}
 for(const [f,v] of jobs){const c=f.replace('.html','')+v;let src=fs.readFileSync('project/kit/screens/'+f,'utf8');if(v)src=src.replace(/group="([^"]+)"/,'group="$1 · '+(v==='Ar'?'arabe':'sombre')+'"');
  const marker=src.split('\n')[0],w=+(marker.match(/width=(\d+)/)||[0,1200])[1],h=+(marker.match(/height=(\d+)/)||[0,900])[1];
  const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8124/project/kit/screens/'+f+(v==='Dark'?'?dark':v==='Ar'?'?ar':''));await p.waitForTimeout(400);
  let body=await p.evaluate(()=>{document.querySelectorAll('script').forEach(s=>s.remove());return document.body.innerHTML});
  let extra=await p.evaluate(()=>[...document.querySelectorAll('head style')].map(s=>s.textContent).join('\n'));
  body=body.replace(/src="([^"]+)"/g,(m,s)=>{if(s.startsWith('data:'))return m;const big=/couronne|basket|celebration|empty-|splash|recolte/.test(s),fg=/presentation/.test(s),pl=/\/play\//.test(s);return `src="${data(s,fg?620:pl?200:big?360:200)}"`});
  const fix=t=>t.replace(/url\(\/_blob\/([0-9a-f]+)\)/g,(m,id)=>`url(${data('/_blob/'+id,256)})`);body=fix(body);extra=fix(extra);
  const out=`${marker}\n<!doctype html><html><head><meta charset="utf-8"><style>${vars}\n${src.includes("souki-v5")?kit:""}\n${extra}</style></head><body>${body}</body></html>\n`;
  fs.mkdirSync(`project/components/${c}`,{recursive:true});fs.writeFileSync(`project/components/${c}/preview.html`,out);
  console.log(c,Math.round(out.length/1024)+'KB',errs.join(';'));await p.close()}
 await b.close();srv.close()})();
