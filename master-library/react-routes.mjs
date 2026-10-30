export const reactRoutes=()=>[
 {path:'/',name:'public.home',label:'Original storefront',access:'public',parameterized:false},
 {path:'/#products-section',name:'public.products',label:'Product catalog',access:'public',parameterized:false},
 ...[['cart','Shopping cart'],['track','Track demo order']].map(([id,label])=>({path:'/?portal='+id,name:'public.'+id,label,access:'public',parameterized:false})),
 ...[['orders','Orders'],['products','Products & categories'],['banners','Banner manager'],['tracking','Tracking settings'],['settings','Store settings'],['sql','Database setup information']].map(([id,label])=>({path:'/admin?tab='+id,name:'admin.'+id,label,access:'admin',parameterized:false}))
];
