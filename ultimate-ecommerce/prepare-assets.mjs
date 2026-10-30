import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'../E-commerce-6/local-app/shopperzz/public/images/seeder/product/fashion/men/clothing');
const preferred=['classic_sweatshirt',"classics_french_men's_hoodie",'black_jacket','brown_jacket','classic_chino','classic_gabardine_pant','denim_jacket','denim_jeans','classic_sportswear','team_red_hoodie','classic_gabardine','classic_sportswear'];
const available=fs.readdirSync(source,{withFileTypes:true}).filter(f=>f.isDirectory()).map(f=>f.name).filter(d=>fs.existsSync(path.join(source,d,'1.png')));
fs.mkdirSync(path.join(root,'public/assets'),{recursive:true});
for(let i=0;i<12;i++){
 const folder=fs.existsSync(path.join(source,preferred[i],'1.png'))?preferred[i]:available[i%available.length];
 fs.copyFileSync(path.join(source,folder,'1.png'),path.join(root,'public/assets',`product-${i+1}.png`));
}
console.log('Prepared 12 product images from the supplied local Shopperzz assets.');
