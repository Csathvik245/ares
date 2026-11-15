import credits from '../../public/photos/credits.json';
/** Metadata transcribed from the science team's documented NASA image matches. */
export function photoDetails(path?:string){
 const key=path?.replace(/^\//,'');
 return key && Object.hasOwn(credits,key) ? credits[key as keyof typeof credits] : undefined;
}
