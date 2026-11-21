import{W as V,P as W,M as z,S as H,C as O,V as A,R as _,a as G,G as I}from"./three-DfJbNVS6.js";import{v as U,w as B,x as q,y as s,z as Y}from"./index-PeuB30Zk.js";import"./gsap-DdEiTQuA.js";const N=`
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,Q=`
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;   // [-1,1], y down
uniform float uScroll;   // page scroll in viewport heights
uniform float uFrom;     // 0 gaming, 1 silent
uniform float uTo;
uniform float uProg;     // wipe progress 0..1
uniform float uDir;      // +1 travels upward (into Silent), -1 downward (into Gaming)

uniform vec3 cObsidian;
uniform vec3 cCarbon;
uniform vec3 cGraphite;
uniform vec3 cVermilion;
uniform vec3 cEmber;
uniform vec3 cPorcelain;
uniform vec3 cPorcelainHi;
uniform vec3 cWarmGray;
uniform vec3 cChampagne;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

// slow vertical drift of the key light with scroll (one gentle cycle every ~12 screens)
float drift() { return sin(uScroll * 0.52) * 0.09; }

vec3 gaming(vec2 uv, float aspect) {
  vec2 key = vec2(0.74 + uPointer.x * 0.035, 0.86 + drift() - uPointer.y * 0.03);
  vec2 rel = (uv - key) * vec2(aspect, 1.0);
  float d = length(rel);

  // obsidian depth with a carbon lift toward the key
  vec3 col = mix(cCarbon, cObsidian, smoothstep(0.0, 1.15, d));
  col += cGraphite * 0.16 * exp(-d * d * 3.2);

  // directional vermilion light shafts radiating down-left from an off-screen source
  vec2 src = key + vec2(0.16, 0.34);
  vec2 r2 = (uv - src) * vec2(aspect, 1.0);
  float ang = atan(r2.y, r2.x);
  float dist = length(r2);
  float rays = fbm(vec2(ang * 13.0, uTime * 0.035 + dist * 0.25));
  rays = smoothstep(0.52, 0.9, rays);
  float cone = smoothstep(0.75, 0.0, abs(ang + 2.05)) * smoothstep(0.15, 0.55, dist) * exp(-dist * 1.25);
  col += mix(cVermilion, cEmber, 0.35) * rays * cone * 0.085;

  // precise noise: a barely-there calibration lattice that fades into the dark
  vec2 g = abs(fract(gl_FragCoord.xy / 96.0) - 0.5);
  float lattice = step(0.4985, max(g.x, g.y));
  col += vec3(0.012) * lattice * smoothstep(1.1, 0.2, d);

  // vignette
  float v = length((uv - 0.5) * vec2(aspect, 1.0));
  col *= mix(1.0, 0.7, smoothstep(0.45, 1.3, v));
  return col;
}

vec3 silent(vec2 uv, float aspect) {
  vec2 key = vec2(0.26 + uPointer.x * 0.03, 0.9 + drift() - uPointer.y * 0.025);
  float d = length((uv - key) * vec2(aspect, 1.0));

  // porcelain under one huge diffused source — no bloom, only gradient
  vec3 col = mix(cPorcelainHi, cPorcelain, smoothstep(0.0, 1.25, d));
  col = mix(col, cWarmGray, 0.22 * smoothstep(0.75, 1.8, d));

  // champagne warmth gathering low on the opposite side
  float w = length((uv - vec2(0.96, -0.05)) * vec2(aspect, 1.0));
  col = mix(col, cChampagne, 0.07 * smoothstep(1.0, 0.0, w));

  // very fine paper: fibre (directional low-amp fbm) + tooth (per-pixel grain)
  float fibre = fbm(gl_FragCoord.xy * vec2(0.035, 0.11)) - 0.5;
  float tooth = hash(gl_FragCoord.xy) - 0.5;
  col += fibre * 0.012 + tooth * 0.016;
  return col;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;

  // THE SWITCH LINE wipe: into Silent travels upward, into Gaming downward
  float soft = 0.08;
  float e = uProg * (1.0 + 2.0 * soft) - soft;
  float front = uDir > 0.0 ? e : 1.0 - e;
  float covered = uDir > 0.0
    ? 1.0 - smoothstep(front - soft, front + soft, uv.y)
    : smoothstep(front - soft, front + soft, uv.y);
  float s = mix(uFrom, uTo, covered);

  vec3 col = vec3(0.0);
  if (s < 0.999) col += gaming(uv, aspect) * (1.0 - s);
  if (s > 0.001) col += silent(uv, aspect) * s;

  // hairline at the wipe front
  float wipeEnergy = sin(3.14159265 * clamp(uProg, 0.0, 1.0));
  float line = exp(-abs(uv.y - front) * uRes.y * 0.9) * wipeEnergy;
  col = mix(col, mix(cVermilion, cChampagne, uTo), line * 0.55);

  // dither against banding
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
`,c=t=>{const i=parseInt(t.slice(1),16);return new A((i>>16&255)/255,(i>>8&255)/255,(i&255)/255)},j=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;function Z(t,i){const a=new V({canvas:t,antialias:!1,alpha:!1,depth:!1,stencil:!1,powerPreference:"low-power",preserveDrawingBuffer:!1});a.autoClear=!1;let y=!1;a.debug&&(a.debug.onShaderError=()=>{y=!0});let u=i.quality;const x=i.world==="silent"?1:0,o={uRes:{value:new G(1,1)},uTime:{value:0},uPointer:{value:new G},uScroll:{value:0},uFrom:{value:x},uTo:{value:x},uProg:{value:1},uDir:{value:1},cObsidian:{value:c(s.obsidian)},cCarbon:{value:c(s.carbon)},cGraphite:{value:c(s.graphite)},cVermilion:{value:c(s.vermilion)},cEmber:{value:c(s.ember)},cPorcelain:{value:c(s.muteBlack)},cPorcelainHi:{value:c(s.muteCarbon)},cWarmGray:{value:c(s.muteSurface)},cChampagne:{value:c(s.steel)}},b=e=>new _({glslVersion:I,vertexShader:N,fragmentShader:Q,uniforms:o,defines:{OCT:e==="high"?4:3},depthTest:!1,depthWrite:!1});let v=b(u);const P=new W(2,2),d=new z(P,v);d.frustumCulled=!1;const C=new H;C.add(d);const R=new O,m=()=>{const[,e]=Y(u),l=u==="high"?1:.75;a.setPixelRatio(Math.min(window.devicePixelRatio||1,e)*l),a.setSize(window.innerWidth,window.innerHeight,!1),a.getDrawingBufferSize(o.uRes.value)},r={x:0,y:0,tx:0,ty:0},k=U((e,l)=>{r.tx=e,r.ty=l,f()});let p=window.scrollY/Math.max(1,window.innerHeight),h=p;const S=()=>{p=window.scrollY/Math.max(1,window.innerHeight),f()};window.addEventListener("scroll",S,{passive:!0}),window.addEventListener("resize",m);let g=0,w=0;const M=e=>{const l=e==="silent"?1:0;o.uTo.value===l&&o.uProg.value>=1||(o.uFrom.value=o.uProg.value>=.5?o.uTo.value:o.uFrom.value,o.uTo.value=l,o.uDir.value=l===1?1:-1,o.uProg.value=0,g=performance.now(),w=B.worldSwitch*q[e].speed*1e3,f())};let n=0,T=!1;const D=performance.now(),E=e=>{if(n=0,!document.hidden){if(r.x+=(r.tx-r.x)*.05,r.y+=(r.ty-r.y)*.05,h+=(p-h)*.08,o.uPointer.value.set(r.x,r.y),o.uScroll.value=h,o.uTime.value=(e-D)/1e3,o.uProg.value<1&&(o.uProg.value=Math.min(1,j(Math.min(1,(e-g)/w))),(e-g)/w>=1&&(o.uProg.value=1)),a.render(C,R),y){i.onLost();return}T||(T=!0,i.onReady()),n=requestAnimationFrame(E)}};function f(){!n&&!document.hidden&&(n=requestAnimationFrame(E))}const F=()=>{document.hidden?(cancelAnimationFrame(n),n=0):f()};document.addEventListener("visibilitychange",F);const L=e=>{e.preventDefault(),cancelAnimationFrame(n),n=0,i.onLost()};return t.addEventListener("webglcontextlost",L),m(),f(),{setWorld:M,setQuality(e){if(e===u)return;u=e;const l=v;v=b(e),d.material=v,l.dispose(),m()},dispose(){cancelAnimationFrame(n),k(),window.removeEventListener("scroll",S),window.removeEventListener("resize",m),document.removeEventListener("visibilitychange",F),t.removeEventListener("webglcontextlost",L),P.dispose(),v.dispose(),a.dispose(),a.forceContextLoss()}}}export{Z as createEnvironment};
