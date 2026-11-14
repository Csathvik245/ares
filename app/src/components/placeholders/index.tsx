// Integration I3: replace these exports with app/src/design components when they land.
export {HelmetHud as Hud} from '../HelmetHud';
export {MissionBriefing as OpeningScreen} from '../MissionBriefing';
import {useState} from 'react';
import {WORK_BURN} from '../../lib/planner';
import type {DemoStop} from '../../lib/MissionContext';
export function StopCard({stop,onClose}:{stop:DemoStop;onClose:()=>void}){
 const [failed,setFailed]=useState(false);
 return <div className="detail-backdrop"><section role="dialog" aria-modal="true" aria-label={stop.label} className="stop-detail"><button autoFocus onClick={onClose}>Close details</button><h2>{stop.label}</h2>{stop.photo&&!failed?<figure><img src={`/${stop.photo.replace(/^\//,'')}`} alt={`Rover view associated with ${stop.label}`} onError={()=>setFailed(true)}/><figcaption>{stop.photoCredit??'Credit pending'}</figcaption></figure>:<p>Rover photo pending from science team.</p>}<p>{stop.why??'Science description pending.'}</p><p>Science time: {stop.dwellMin} min · Oxygen cost: {(stop.dwellMin*WORK_BURN).toFixed(1)} nominal min (work-burn model)</p><p>Tools: {stop.tools?.join(', ')??'Awaiting science checklist'}</p></section></div>
}
