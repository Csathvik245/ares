import type { Site, CostGrid } from './planner';
export const layers = [
  {id:'difficulty', name:'Walking difficulty', type:'Combined', source:'slope', legend:'Easy → impassable'},
  {id:'slope', name:'Slope', type:'Topographic', source:'slope', legend:'0–25° · steeper blocked'},
  {id:'sand', name:'Soft sand risk', type:'Thermal', source:'thermalInertia', legend:'Thermal inertia < 175'},
  {id:'rock', name:'Boulders', type:'Optical / terrain', source:'rock', legend:'0–1 · > 0.75 blocked'},
  {id:'science', name:'Science value', type:'Spectral', source:'science', legend:'0–1 · higher is better'},
] as const;
export type OverlayName = typeof layers[number]['id'];
export function raster(site: Site, cost: CostGrid, kind: OverlayName | 'hillshade' | 'zone', zone?: Uint8Array) {
  const canvas = document.createElement('canvas'); canvas.width=site.width;canvas.height=site.height;
  const ctx=canvas.getContext('2d')!;const img=ctx.createImageData(site.width,site.height);
  for(let i=0;i<site.width*site.height;i++) {
    let color=[0,0,0,0];
    if(kind==='hillshade') {
      const x=i%site.width,y=Math.floor(i/site.width), z=site.layers.elevation;
      const dx=(z[y*site.width+Math.min(x+1,site.width-1)]-z[y*site.width+Math.max(0,x-1)])/(2*site.cellSizeM.x);
      const dy=(z[Math.min(y+1,site.height-1)*site.width+x]-z[Math.max(0,y-1)*site.width+x])/(2*site.cellSizeM.y);
      const shade=Math.max(30,Math.min(200,120+(-dx+dy)*90));color=[shade,shade*.8,shade*.67,255];
    } else if(kind==='zone') color=zone?.[i] ? [79,209,255,75] : [0,0,0,0];
    else if(kind==='science') color=[167,139,250,Math.round(site.layers.science[i]*180)];
    else if(kind==='sand') color=[255,176,32,site.layers.thermalInertia[i]<175?150:0];
    else if(kind==='rock') color=[235,234,230,Math.round(site.layers.rock[i]*210)];
    else if(kind==='slope') color=[255,176,32,Math.round(Math.min(1,site.layers.slope[i]/25)*180)];
    else {const v=cost.secPerM[i];color=Number.isFinite(v)?[255,176,32,Math.min(180,v*35)]:[255,77,90,210];}
    for(let c=0;c<4;c++) img.data[i*4+c]=Number.isFinite(color[c])?color[c]:0;
  }
  ctx.putImageData(img,0,0);return canvas.toDataURL();
}
