import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest { return {id:"/",name:"Souki Livreur",short_name:"Souki Livreur",start_url:"/livreur",scope:"/",display:"standalone",background_color:"#ffffff",theme_color:"#1E8A3C",icons:[{src:"/pwa-icon-192.png",sizes:"192x192",type:"image/png"},{src:"/pwa-icon-512.png",sizes:"512x512",type:"image/png"}]} }
