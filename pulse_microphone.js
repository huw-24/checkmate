(() => {
  const panel=document.getElementById('pulse'),canvas=document.getElementById('pulseCanvas');
  const indicator=document.getElementById('micIndicator');
  if(!panel||!canvas)return;
  const ctx=canvas.getContext('2d');
  let stream=null,ac=null,analyser=null,source=null,samples=null,enabled=false;
  let prev=0;
  const n=96;
  const levels=new Float32Array(n);
  const targets=new Float32Array(n);
  let spectrum=null;
  async function stop(){
    const wasEnabled=enabled;
    enabled=false;
    stream?.getTracks().forEach(t=>t.stop());stream=null;
    source?.disconnect();source=null;analyser=null;samples=null;
    if(ac){await ac.close().catch(()=>{});ac=null;}
    panel.setAttribute('aria-pressed','false');indicator.textContent='MIC OFF · CLICK TO ENABLE';
    if(wasEnabled)window.dispatchEvent(new Event('match-microphone-disconnected'));
  }
  async function toggle(){
    if(enabled){await stop();return;}
    if(!navigator.mediaDevices?.getUserMedia){indicator.textContent='USE HTTPS OR LOCALHOST';return;}
    indicator.textContent='REQUESTING MICROPHONE…';
    try{
      const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false},video:false});
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx){media.getTracks().forEach(t=>t.stop());throw Error('Unsupported');}
      const context=new AudioCtx();await context.resume();
      const input=context.createMediaStreamSource(media),a=context.createAnalyser();
      a.fftSize=2048;a.smoothingTimeConstant=.9;input.connect(a);
      stream=media;ac=context;source=input;analyser=a;samples=new Uint8Array(a.fftSize);spectrum=new Uint8Array(a.frequencyBinCount);
      enabled=true;panel.setAttribute('aria-pressed','true');indicator.textContent='MIC LIVE · LOCAL ONLY';
      media.getAudioTracks()[0]?.addEventListener('ended',()=>{if(enabled)stop();});
    }catch(e){indicator.textContent=e?.name==='NotAllowedError'?'MIC PERMISSION DENIED':'MIC UNAVAILABLE';throw e;}
  }
  window.MatchMic={start:async()=>{if(!enabled)await toggle();},isConnected:()=>enabled&&!!stream?.active,stop};
  panel.addEventListener('click',()=>{if(!window.matchDevicesReady)return;toggle().catch(console.error);});
  panel.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(window.matchDevicesReady)toggle().catch(console.error);}});
  function draw(now){
    const w=canvas.width,h=canvas.height;
    const dt=Math.min(50,Math.max(1,now-prev||16));prev=now;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1.65;
    const dx=w/n;
    if(enabled&&analyser&&spectrum){
      analyser.getByteFrequencyData(spectrum);
      // Distinct frequency bands create independent motion across the bars.
      // Smooth neighboring bins, then ease each bar separately.
      const minBin=2, maxBin=Math.min(spectrum.length-1,380);
      for(let i=0;i<n;i++){
        const u=i/(n-1);
        const center=Math.round(minBin+(maxBin-minBin)*Math.pow(u,1.65));
        let sum=0,weights=0;
        for(let j=-3;j<=3;j++){
          const idx=Math.max(0,Math.min(spectrum.length-1,center+j));
          const weight=4-Math.abs(j);
          sum+=spectrum[idx]*weight;weights+=weight;
        }
        const normalized=sum/(weights*255);
        const shaped=Math.pow(Math.max(0,(normalized-.065)/.7),1.15);
        targets[i]=Math.min(.92,shaped);
      }
    }else{
      // Quiet idle bars; no simulated sound when the microphone is off.
      targets.fill(0);
    }
    for(let i=0;i<n;i++){
      // Responsive rise (~85ms), graceful fall (~230ms).
      const tau=targets[i]>levels[i]?85:230;
      levels[i]+=(targets[i]-levels[i])*(1-Math.exp(-dt/tau));
      const bar=Math.max(3,3+levels[i]*h*.85);
      const x=(i+.5)*dx;
      ctx.beginPath();
      ctx.moveTo(x,h/2-bar/2);
      ctx.lineTo(x,h/2+bar/2);
      ctx.stroke();
    }
  requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());ac?.close().catch(()=>{});});
})();
