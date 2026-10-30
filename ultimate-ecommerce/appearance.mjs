export const colorPacks=[
 ['violet','Astral Violet','#7959da','#f7f5fc'],['ocean','Ocean Blue','#2479bf','#f3f7fc'],['emerald','Emerald','#22866a','#f3f9f5'],['rose','Rose Quartz','#bb5278','#fcf4f7'],['amber','Golden Amber','#ac791d','#fbf8f0'],['teal','Lagoon Teal','#16818a','#f1f9fa'],['indigo','Indigo Ink','#555ac0','#f5f5fc'],['slate','Slate Studio','#52677d','#f4f6f8'],['coral','Coral Sunset','#c2624c','#fcf5f2'],['forest','Forest Green','#51763e','#f5f8f0'],['cocoa','Cocoa Earth','#8c624b','#faf5f0'],['sky','Clear Sky','#328ba6','#f2f9fc']
].map(([id,name,accent,background])=>({id,name,accent,background,surface:'#ffffff',text:'#252736',muted:'#737788',border:'#e4e6ee'}));
export const frontendLayouts=[['nest','Nest','Original platform/themes/nest Blade templates.'],['shofy','Shofy','Original platform/themes/shofy Blade templates.'],['martvill','MartVill / Othoba','Original CMS theme blocks, templates and storefront views.'],['shopperzz','Shopperzz','Original Vue storefront components and compiled bundle.'],['grostore','GroStore','Original frontend/default Blade layouts and sections.'],['footstep','Footstep / সোহাগ অনলাইন','Original compiled React storefront and assets.']].map(([id,name,description])=>({id,name,description}));
export const backendLayouts=frontendLayouts.map(l=>({...l,description:'Original '+l.name+' admin engine, views and navigation.'}));
export const defaultAppearance=()=>({frontend:{layout:'nest',pack:'violet',mode:'light'},backend:{layout:'shopperzz',pack:'violet',mode:'light'},customPacks:[]});
export function resolveAppearance(saved,legacyTheme){const result=defaultAppearance();if(!saved&&frontendLayouts.some(l=>l.id===legacyTheme))result.frontend.layout=legacyTheme;const resolved={...result,...saved,frontend:{...result.frontend,...saved?.frontend},backend:{...result.backend,...saved?.backend},customPacks:saved?.customPacks||[]};for(const target of ['frontend','backend'])if(resolved[target].layout==='astrallab')resolved[target].layout=result[target].layout;return resolved}
export function validateAppearance(input,current){
 const result=structuredClone(current);
 for(const target of ['frontend','backend'])if(input[target]){
  for(const key of ['layout','pack','mode'])if(input[target][key]!==undefined)result[target][key]=input[target][key];
 }
 if(input.customPack){
  const p=input.customPack;
  if(!/^[a-z][a-z0-9-]{2,40}$/.test(p.id||'')||colorPacks.some(c=>c.id===p.id))throw Error('Choose a unique custom color pack ID (3–41 lowercase characters).');
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>60)throw Error('Enter a color pack name under 60 characters.');
  const clean={id:p.id,name:p.name.trim()};for(const key of ['accent','background','surface','text','muted','border']){if(!/^#[a-f0-9]{6}$/i.test(p[key]||''))throw Error('Every color must be a six-digit hex value.');clean[key]=p[key];}
  result.customPacks=result.customPacks.filter(c=>c.id!==p.id);if(result.customPacks.length>=100)throw Error('The custom color pack limit is 100.');result.customPacks.push(clean);
 }
 for(const target of ['frontend','backend']){
  if(!(target==='frontend'?frontendLayouts:backendLayouts).some(l=>l.id===result[target].layout))throw Error('Choose a valid layout.');
  if(![...colorPacks,...result.customPacks].some(p=>p.id===result[target].pack))throw Error('Choose an existing color pack.');
  if(!['light','dark','night'].includes(result[target].mode))throw Error('Choose Light, Dark or Night mode.');
 }
 return result;
}
