// Korbi, 8 Nov 2026: "Minesweeper should always be theoretically solvable ... never a point where the player has to guess between two
// possible options ... across all gamemodes." mines-engine.js deals only fields its own solver clears; this test does not trust that
// solver. It plays every dealt field with an independent exact one (every mine placement the numbers and the count allow, by component,
// so what it calls forced is forced in all of them) and fails if at any point no cell is certainly safe, or one it calls safe is a mine.
// A field whose frontier is too wide for this search is skipped (counted), not passed.
import { deal, SHAPES, SIZES, LEVELS } from "../mines-engine.js";
// exact: given opened set, find cells forced safe / forced mine over ALL consistent mine placements (with total count)
function exactStep(f, open) {
  const n=f.n, nb=f.nb, nums=f.nums;
  const cons=[]; // constraints from open numbered cells
  const frontier=new Set();
  for(let i=0;i<n;i++) if(open[i]){ const hid=nb[i].filter(j=>!open[j]); if(hid.length){ cons.push({cells:hid,k:nums[i]}); hid.forEach(j=>frontier.add(j)); } }
  const hiddenAll=[]; for(let i=0;i<n;i++) if(!open[i]) hiddenAll.push(i);
  const interior=hiddenAll.filter(j=>!frontier.has(j));
  // components of frontier by shared constraints
  const comp=new Map(); let c=0; const adj=new Map(); for(const j of frontier) adj.set(j,new Set());
  for(const k of cons) for(const a of k.cells) for(const b of k.cells) adj.get(a).add(b);
  const comps=[]; for(const j of frontier){ if(comp.has(j)) continue; const st=[j], cs=[]; comp.set(j,c); while(st.length){const x=st.pop(); cs.push(x); for(const y of adj.get(x)) if(!comp.has(y)){comp.set(y,c); st.push(y);} } comps.push(cs); c++; }
  const res=[]; // per comp: for each mine-count m: {ways, mineCount per cell}
  let aborted=false;
  for(const cs of comps){
    const idx=new Map(cs.map((x,i)=>[x,i])), mine=new Int8Array(cs.length).fill(-1);
    const cc=cons.filter(k=>idx.has(k.cells[0])).map(k=>({cells:k.cells.map(x=>idx.get(x)),k:k.k}));
    const of=cs.map(()=>[]); cc.forEach(k=>k.cells.forEach(i=>of[i].push(k)));
    const byM=new Map(); let nodes=0;
    const ok=(k)=>{let m=0,u=0; for(const i of k.cells){ if(mine[i]===1)m++; else if(mine[i]<0)u++; } return m<=k.k && m+u>=k.k; };
    const rec=(i,m)=>{ if(++nodes>3e6){aborted=true;return;} if(i===cs.length){ let e=byM.get(m); if(!e){e={ways:0,cnt:new Array(cs.length).fill(0)}; byM.set(m,e);} e.ways++; for(let j=0;j<cs.length;j++) if(mine[j]===1) e.cnt[j]++; return;}
      for(const v of [0,1]){ mine[i]=v; if(of[i].every(ok)) rec(i+1,m+v); if(aborted) return; } mine[i]=-1; };
    rec(0,0); if(aborted) return {aborted:true};
    res.push({cs,byM});
  }
  const minesLeft=f.count; // no flags tracked: all hidden mines unknown
  // DP over components for total count distribution (ways as BigInt-ish via Number); interior has C(interior, r) ways
  const C=(a,b)=>{ if(b<0||b>a) return 0; let r=1; for(let i=0;i<b;i++) r=r*(a-i)/(i+1); return r; };
  const dist=[]; // dist over frontier mines total
  let cur=new Map([[0,1]]);
  for(const {byM} of res){ const nx=new Map(); for(const [m0,w0] of cur) for(const [m,e] of byM) nx.set(m0+m,(nx.get(m0+m)||0)+w0*e.ways); cur=nx; }
  const safe=[], mines=[];
  // cell is forced safe if no consistent global solution has it as mine
  for(let r=0;r<res.length;r++){
    // other comps distribution
    let oth=new Map([[0,1]]);
    res.forEach(({byM},q)=>{ if(q===r) return; const nx=new Map(); for(const [m0,w0] of oth) for(const [m,e] of byM) nx.set(m0+m,(nx.get(m0+m)||0)+w0*e.ways); oth=nx; });
    const {cs,byM}=res[r];
    cs.forEach((cell,j)=>{ let asMine=0, asSafe=0;
      for(const [m,e] of byM) for(const [mo,wo] of oth){ const rest=minesLeft-m-mo; const ways=C(interior.length,rest); if(!ways) continue; asMine+=e.cnt[j]*wo*ways; asSafe+=(e.ways-e.cnt[j])*wo*ways; }
      if(asMine===0) safe.push(cell); else if(asSafe===0) mines.push(cell); });
  }
  // interior cells: safe if rest never has mines in interior ... forced safe if for all combos rest==0
  if(interior.length){ let any=false, all=true; for(const [m,w] of cur){ const rest=minesLeft-m; if(rest<0||rest>interior.length) continue; if(C(interior.length,rest)>0){ if(rest>0) any=true; if(rest<interior.length) all=false; } } if(!any) safe.push(...interior); }
  return {safe,mines};
}
function play(f){
  const open=new Uint8Array(f.n); const flood=i=>{const q=[i]; open[i]=1; for(let k=0;k<q.length;k++){const c=q[k]; if(f.nums[c]===0) for(const j of f.nb[c]) if(!open[j]&&!f.mine[j]){open[j]=1;q.push(j);} }};
  flood(f.start);
  for(;;){ let left=0; for(let i=0;i<f.n;i++) if(!open[i]&&!f.mine[i]) left++; if(!left) return "ok";
    const r=exactStep(f,open); if(r.aborted) return "abort"; if(!r.safe.length) return "GUESS";
    for(const c of r.safe) if(f.mine[c]) return "UNSOUND"; for(const c of r.safe) if(!open[c]) flood(c); }
}
let played = 0, skipped = 0, bad = [];
const SEEDS = Number(process.env.MINES_SEEDS) || 2, sizes = process.env.MINES_ALL ? Object.keys(SIZES) : ["small", "medium"];
for (const shape of Object.keys(SHAPES)) for (const size of sizes) for (const level of Object.keys(LEVELS)) for (let seed = 1; seed <= SEEDS; seed++) {
  for (const team of [false, true]) {
    const r = play(deal({ seed, shape, size, level, team }));
    if (r === "abort") skipped++; else { played++; if (r !== "ok") bad.push(`${shape}.${size}.${level}#${seed}${team ? " team" : ""}: ${r}`); }
  }
}
if (bad.length) { console.log("FAIL a dealt field needs a guess:", bad.join("; ")); process.exit(1); }
console.log(`ok   ${played} dealt fields (${skipped} too wide to check) are cleared by certain deductions alone, solo and as a team`);
console.log("all passed");
