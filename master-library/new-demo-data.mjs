const image=name=>'/assets/images/'+name;
const categories=[
 ['bags','Bags & backpacks','ব্যাগ ও ব্যাকপ্যাক','luggage_bunny_pink_1792050506373.jpg'],
 ['gifts','Gift boxes','উপহার','gift_box_pink_teddy_1792050433788.jpg'],
 ['toys','Toys','খেলনা','rescue_toy_truck_set_1792050432743.jpg']
].map(([slug,name,name_bn,photo],i)=>({id:'library-category-'+(i+1),slug,name,name_bn,image_url:image(photo),sub_label:'Local demo collection',sort_order:i+1,is_active:true}));
const rows=[
 ['Pink Teddy Gift Box','পিংক টেডি গিফট বক্স','gifts','gift_box_pink_teddy_1792050433788.jpg',1290,1590],
 ['Mint Bear Gift Box','মিন্ট বেয়ার গিফট বক্স','gifts','gift_box_mint_bear_1792050466062.jpg',1390,1690],
 ['Sunshine Gift Box','সানশাইন গিফট বক্স','gifts','gift_box_yellow_sunshine_1792050506416.jpg',1190,1490],
 ['Astronaut Kids Luggage','অ্যাস্ট্রোনট কিডস লাগেজ','bags','luggage_astronaut_kids_1792050465126.jpg',2490,2990],
 ['Bunny Pink Luggage','বানি পিংক লাগেজ','bags','luggage_bunny_pink_1792050506373.jpg',2490,2990],
 ['Dinosaur Kids Luggage','ডাইনোসর কিডস লাগেজ','bags','luggage_dinosaur_kids_1792050467536.jpg',2590,3190],
 ['Unicorn Kids Luggage','ইউনিকর্ন কিডস লাগেজ','bags','luggage_unicorn_kids_1792050431878.jpg',2590,3190],
 ['Rescue Toy Truck Set','রেসকিউ টয় ট্রাক সেট','toys','rescue_toy_truck_set_1792050432743.jpg',890,1090]
];
export function newDemoData(){
 const products=rows.map(([name,name_bn,category,photo,price,old_price],i)=>({id:'library-product-'+(i+1),category_id:categories.find(c=>c.slug===category).id,category_slug:category,name,name_bn,slug:name.toLowerCase().replace(/\W+/g,'-'),description:'Sample product for the local Master Library preview. Photo supplied in the source archive.',short_description:'Local demo product',price,old_price,discount_percent:Math.round((old_price-price)/old_price*100),badge:i<3?'GIFT':i===7?'TOY':'NEW',sold_count:15+i*7,rating:4.8,review_count:12+i,stock:25+i,is_featured:true,is_flash_sale:i<4,is_hot_deal:true,is_active:true,image_url:image(photo),images:[image(photo)],variants:[],created_at:'2026-10-30T00:00:00.000Z'}));
 const orders=products.slice(0,2).map((p,i)=>({id:'library-order-'+(i+1),order_number:'DEMO-100'+i,customer_name:i?'Ayesha Demo':'Rahim Demo',phone:i?'01700000002':'01700000001',address:'Demo address, Dhaka',delivery_zone:'zone-1',delivery_charge:60,subtotal:p.price,discount:0,total:p.price+60,payment_method:'COD',status:i?'shipped':'pending',created_at:'2026-10-30T00:00:00.000Z',items:[{product_id:p.id,product_name:p.name,quantity:1,unit_price:p.price,total:p.price,image_url:p.image_url}]}));
 return {littlehug_products:products,littlehug_categories:categories,littlehug_orders:orders,littlehug_banners:[{id:'library-banner-1',title:'Source demo banner',image_url:image('hero_banner_littlehug_1792050430352.jpg'),link:'#products-section',sort_order:1,is_active:true}]};
}
