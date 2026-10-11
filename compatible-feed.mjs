import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';

// One shared, on-demand encoder for the explicitly configured A&E feed.
// No user-supplied URLs or arbitrary filenames reach ffmpeg or the filesystem.
export function createCompatibleFeed({getSource,validateSource,spawnProcess=spawn,root=os.tmpdir(),idleMs=90000,startupMs=20000}){
  let current=null,starting=null;
  const stop=s=>{
    if(!s||s.stopped)return;
    s.stopped=true;clearInterval(s.idleTimer);
    if(current===s)current=null;
    s.child?.kill('SIGTERM');
    const killTimer=setTimeout(()=>s.child?.kill('SIGKILL'),3000);killTimer.unref();
    s.child?.once('close',()=>{clearTimeout(killTimer);fs.rm(s.dir,{recursive:true,force:true}).catch(()=>{})});
    if(!s.child)fs.rm(s.dir,{recursive:true,force:true}).catch(()=>{});
  };
  async function ensure(){
    if(current&&!current.stopped){current.used=Date.now();return current}
    if(starting)return starting;
    starting=(async()=>{
      const source=await getSource();if(!source)throw new Error('A&E source unavailable');
      await validateSource(source);
      const dir=await fs.mkdtemp(path.join(root,'velora-ae-'));
      const s={dir,used:Date.now(),stopped:false,error:null};current=s;
      const prefix='segment-'+randomBytes(6).toString('hex')+'-';
      const args=['-hide_banner','-loglevel','error','-nostdin','-rw_timeout','10000000',
        '-protocol_whitelist','http,https,tcp,tls,crypto','-i',source,
        '-map','0:v:0','-map','0:a:0?','-c:v','libx264','-threads','2','-preset','veryfast','-tune','zerolatency',
        '-vf','scale=854:480:force_original_aspect_ratio=decrease:force_divisible_by=2','-pix_fmt','yuv420p',
        '-profile:v','main','-level','3.1','-r','30','-g','60','-keyint_min','60','-sc_threshold','0',
        '-b:v','1200k','-maxrate','1400k','-bufsize','2400k','-c:a','aac','-b:a','96k','-ac','2','-ar','48000',
        '-f','hls','-hls_time','2','-hls_list_size','6','-hls_delete_threshold','2',
        '-hls_flags','delete_segments+independent_segments+temp_file',
        '-hls_segment_filename',path.join(dir,prefix+'%08d.ts'),path.join(dir,'index.m3u8')];
      try{
        s.child=spawnProcess('ffmpeg',args,{stdio:['ignore','ignore','pipe']});
        s.child.stderr.on('data',()=>{}); // Drain; do not expose upstream addresses.
        s.child.once('error',()=>{s.error=new Error('Compatibility encoder unavailable');stop(s)});
        s.child.once('exit',()=>{s.error=new Error('A&E conversion stopped');stop(s)});
        s.idleTimer=setInterval(()=>{if(Date.now()-s.used>idleMs)stop(s)},Math.min(idleMs,15000));s.idleTimer.unref();
      }catch(e){stop(s);throw e}
      return s;
    })().finally(()=>{starting=null});
    return starting;
  }
  async function serve(req,res,file){
    const headers={'access-control-allow-origin':'*','cache-control':'no-store'};
    const reply=(status,message)=>{if(!res.destroyed){res.writeHead(status,{...headers,'content-type':'text/plain'});res.end(message)}};
    if(file!=='index.m3u8'&&!/^segment-[a-f0-9]{12}-\d+\.ts$/.test(file))return reply(404,'Not found');
    try{
      const s=file==='index.m3u8'?await ensure():current;
      if(!s||s.stopped)return reply(404,'Stream expired; reload the playlist');
      s.used=Date.now();
      const started=Date.now();
      let body;
      do{
        if(res.destroyed)return;
        if(s.error||s.stopped)throw s.error||new Error('Stream stopped');
        try{body=await fs.readFile(path.join(s.dir,file));break}catch(e){
          if(e.code!=='ENOENT'||file!=='index.m3u8')throw e;
        }
        if(Date.now()-started>=startupMs){stop(s);throw new Error('A&E source did not start in time')}
        await new Promise(resolve=>setTimeout(resolve,200));
      }while(true);
      if(!res.destroyed){res.writeHead(200,{...headers,'content-type':file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'});res.end(body)}
    }catch{reply(503,'A&E is temporarily unavailable; please retry')}
  }
  return {serve,close(){stop(current)}};
}
