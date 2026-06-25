import { useState, useEffect } from "react";

/* ─── Design Tokens (matching marketplace index.css) ─── */
const G = "#059669";
const G_DARK = "#047857";
const G_LIGHT = "#ECFDF5";
const BG = "#F8FAFC";
const WHITE = "#FFFFFF";
const TEXT = "#111827";
const TEXT_2 = "#6B7280";
const BORDER = "#E5E7EB";
const DARK = "#0F172A";
const RED = "#EF4444";

/* ─── Real product image URLs (Pexels / Unsplash) ─── */
const IMG = {
  phone_samsung:   "https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=300",
  smartwatch:      "https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=300",
  headphones_sony: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=300",
  perfume:         "https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg?auto=compress&cs=tinysrgb&w=300",
  earbuds:         "https://images.pexels.com/photos/3394659/pexels-photo-3394659.jpeg?auto=compress&cs=tinysrgb&w=300",
  coffee_machine:  "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=300",
  shoes_nike:      "https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=300",
  phone_xiaomi:    "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=300",
  cookware:        "https://images.pexels.com/photos/6996085/pexels-photo-6996085.jpeg?auto=compress&cs=tinysrgb&w=300",
  watch_casio:     "https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=300",
  phone_iphone:    "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=300",
  headphones_jbl:  "https://images.pexels.com/photos/3394658/pexels-photo-3394658.jpeg?auto=compress&cs=tinysrgb&w=300",
  laptop_hp:       "https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=300",
  fragrance:       "https://images.pexels.com/photos/1961795/pexels-photo-1961795.jpeg?auto=compress&cs=tinysrgb&w=300",
  camera:          "https://images.pexels.com/photos/51383/photo-camera-subject-photography-51383.jpeg?auto=compress&cs=tinysrgb&w=300",
  keyboard:        "https://images.pexels.com/photos/1772123/pexels-photo-1772123.jpeg?auto=compress&cs=tinysrgb&w=300",
  gamepad:         "https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=300",
  shoes_adidas:    "https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&w=300",
  apple_watch:     "https://images.pexels.com/photos/1697214/pexels-photo-1697214.jpeg?auto=compress&cs=tinysrgb&w=300",
};

/* ─── Category images ─── */
const CAT_IMG = {
  electronics: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=160&q=80&auto=format&fit=crop",
  fashion:     "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=160&q=80&auto=format&fit=crop",
  home:        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=160&q=80&auto=format&fit=crop",
  beauty:      "https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg?auto=compress&cs=tinysrgb&w=160",
  cars:        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=160&q=80&auto=format&fit=crop",
  sports:      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=160&q=80&auto=format&fit=crop",
  gaming:      "https://images.pexels.com/photos/4317157/pexels-photo-4317157.jpeg?auto=compress&cs=tinysrgb&w=160",
  grocery:     "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=160&q=80&auto=format&fit=crop",
};

/* ─── Mock Data (with real image URLs) ─── */
const CATS = [
  { id:1, img:CAT_IMG.electronics, name:"إلكترونيات",        count:2356 },
  { id:2, img:CAT_IMG.fashion,     name:"أزياء",             count:1928 },
  { id:3, img:CAT_IMG.home,        name:"المنزل والطبخ",     count:2045 },
  { id:4, img:CAT_IMG.beauty,      name:"الجمال والعناية",   count:1324 },
  { id:5, img:CAT_IMG.cars,        name:"السيارات",          count:982  },
  { id:6, img:CAT_IMG.sports,      name:"الرياضة والترفيه",  count:1296 },
  { id:7, img:CAT_IMG.gaming,      name:"الألعاب",           count:1874 },
  { id:8, img:CAT_IMG.grocery,     name:"البقالة",           count:1102 },
];

const MOSAIC = [
  { name:"هاتف سامسونج جالاكسي A54", price:"١٬٢٩٩٬٠٠٠", old:"١٬٥٩٩٬٠٠٠", disc:19, img:IMG.phone_samsung, bg:"linear-gradient(135deg,#1e3a8a,#2563eb)" },
  { name:"ساعة ذكية Huawei Band 7",   price:"٣٩٩٬٠٠٠",   old:"٤٥٠٬٠٠٠",   disc:11, img:IMG.smartwatch,   bg:"linear-gradient(135deg,#4c1d95,#7c3aed)" },
  { name:"سماعة سوني WH-CH520",       price:"٤٩٩٬٠٠٠",   old:"٦٦٠٬٠٠٠",   disc:24, img:IMG.headphones_sony, bg:"linear-gradient(135deg,#064e3b,#059669)" },
  { name:"عطر دور سوهار 100 مل",      price:"٥٩٩٬٠٠٠",   old:"٦٦٠٬٠٠٠",   disc:9,  img:IMG.perfume,      bg:"linear-gradient(135deg,#7c2d12,#dc2626)" },
];

const DEALS = [
  { id:1, img:IMG.earbuds,        name:"ريدمي بودز 4 برو",        price:"٢٩٩٬٠٠٠", old:"٣٨٠٬٠٠٠", disc:21, rating:4.8, reviews:128, seller:"متجر التقنية" },
  { id:2, img:IMG.coffee_machine, name:"ماكينة قهوة ميبيتا",       price:"١٬٣٩٩٬٠٠٠",old:"١٬٩٠٠٬٠٠٠",disc:26, rating:4.6, reviews:56,  seller:"بيت المنزل" },
  { id:3, img:IMG.shoes_nike,     name:"حذاء نايكي رياضي",         price:"٣٥٩٬٠٠٠", old:"٤٠٠٬٠٠٠", disc:10, rating:4.7, reviews:231, seller:"عالم الرياضة" },
  { id:4, img:IMG.phone_xiaomi,   name:"شاومي ريدمي نوت 12",       price:"١٬١٩٩٬٠٠٠",old:"١٬٤٠٠٬٠٠٠",disc:14, rating:4.5, reviews:87,  seller:"موبايل برو" },
  { id:5, img:IMG.cookware,       name:"طقم قدور فوري 10 قطع",     price:"٣٩٩٬٠٠٠", old:"٤٨٠٬٠٠٠", disc:17, rating:4.4, reviews:42,  seller:"مطبخ كو" },
  { id:6, img:IMG.watch_casio,    name:"ساعة كاسيو الرجال",        price:"٤٤٩٬٠٠٠", old:"٥٠٠٬٠٠٠", disc:10, rating:4.6, reviews:64,  seller:"بيت الساعات" },
];

const BEST_SELLERS = [
  { id:1, img:IMG.phone_iphone,   name:"هاتف آيفون 14 برو",         price:"٢٬٥٩٩٬٠٠٠", rating:4.8, reviews:329, seller:"Apple Store SY" },
  { id:2, img:IMG.apple_watch,    name:"ساعة آبل سيريز 9",           price:"١٬٦٤٩٬٠٠٠", rating:4.9, reviews:98,  seller:"Tech Center" },
  { id:3, img:IMG.headphones_jbl, name:"سماعة JBL Tune 510BT",      price:"٢٩٩٬٠٠٠",   rating:4.7, reviews:37,  seller:"Electronics Hub" },
  { id:4, img:IMG.laptop_hp,      name:"لابتوب HP Core i5",          price:"٢٬١٩٩٬٠٠٠", rating:4.6, reviews:74,  seller:"Computer World" },
  { id:5, img:IMG.fragrance,      name:"عطر طاقة كلاسيكية",          price:"٣٩٩٬٠٠٠",   rating:4.5, reviews:113, seller:"Perfume Palace" },
  { id:6, img:IMG.gamepad,        name:"يد تحكم بلاي ستيشن 5",      price:"٢٤٩٬٠٠٠",   rating:4.9, reviews:86,  seller:"Gaming Zone SY" },
];

const STORES = [
  { id:1, initials:"شم", name:"متجر الشمر",       cat:"الإلكترونيات",    rating:4.9, reviews:1256, color:"#2563eb", products:284 },
  { id:2, initials:"بم", name:"بيت المطبخ",       cat:"أدوات المطبخ",   rating:4.8, reviews:892,  color:"#d97706", products:193 },
  { id:3, initials:"من", name:"منزلك الجميل",     cat:"المنزل والديكور", rating:4.7, reviews:1103, color:"#059669", products:147 },
  { id:4, initials:"جم", name:"الجمال الطبيعي",  cat:"العناية الشخصية", rating:4.9, reviews:765,  color:"#7c3aed", products:210 },
];

const NEW_ARRIVALS = [
  { id:1, img:IMG.camera,      name:"كاميرا كانون EOS R50",    price:"٢٬٥٩٩٬٠٠٠", rating:4.8, reviews:12  },
  { id:2, img:IMG.keyboard,    name:"كيبورد لوجيتك MX Keys",  price:"٤٨٠٬٠٠٠",   rating:4.7, reviews:34  },
  { id:3, img:IMG.gamepad,     name:"يد تحكم Xbox الجديدة",   price:"٢٩٩٬٠٠٠",   rating:4.6, reviews:8   },
  { id:4, img:IMG.fragrance,   name:"عطر فرزاتشي الجديد",    price:"٦٥٠٬٠٠٠",   rating:4.5, reviews:22  },
  { id:5, img:IMG.shoes_adidas,name:"اديداس ألترابوست 24",   price:"٦٢٠٬٠٠٠",   rating:4.7, reviews:19  },
  { id:6, img:IMG.cookware,    name:"طاجن ذكي 5 لتر",         price:"٤٩٠٬٠٠٠",   rating:4.4, reviews:6   },
];

/* ─── Sub-components ─── */

function Stars({ r }: { r: number }) {
  return (
    <span style={{ color:"#F59E0B", fontSize:11 }}>
      {"★".repeat(Math.round(r))}{"☆".repeat(5 - Math.round(r))}
    </span>
  );
}

function Countdown() {
  const [t, setT] = useState({ h:12, m:45, s:30 });
  useEffect(() => {
    const iv = setInterval(() => setT(p => {
      let { h, m, s } = p;
      if (--s < 0) { s=59; if (--m < 0) { m=59; if (--h < 0) h=23; } }
      return { h, m, s };
    }), 1000);
    return () => clearInterval(iv);
  }, []);
  const pad = (n: number) => String(n).padStart(2,"0");
  return (
    <span style={{ display:"flex", alignItems:"center", gap:4 }}>
      {[pad(t.h), pad(t.m), pad(t.s)].map((v,i) => (
        <span key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
          <span style={{ background:DARK, color:"#fff", fontWeight:700, fontSize:15, padding:"3px 7px", borderRadius:6, fontVariantNumeric:"tabular-nums" }}>{v}</span>
          {i<2 && <span style={{ color:TEXT, fontWeight:700 }}>:</span>}
        </span>
      ))}
    </span>
  );
}

function ProductCard({ p, showDisc=false }: { p:any; showDisc?:boolean }) {
  const [hov, setHov] = useState(false);
  const [wished, setWished] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background:WHITE, borderRadius:16, border:`1px solid ${BORDER}`,
        overflow:"hidden", display:"flex", flexDirection:"column",
        boxShadow: hov ? "0 8px 28px rgba(0,0,0,0.12)" : "0 1px 6px rgba(0,0,0,0.06)",
        transform: hov ? "translateY(-2px)" : "none",
        transition:"all 0.2s ease", cursor:"pointer", position:"relative",
      }}
    >
      {/* Image area */}
      <div style={{ position:"relative", height:170, overflow:"hidden", background:"#F1F5F9" }}>
        <img
          src={p.img}
          alt={p.name}
          loading="lazy"
          style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.3s ease", transform: hov ? "scale(1.06)" : "scale(1)" }}
        />
        {/* Discount badge */}
        {(showDisc && p.disc) && (
          <span style={{ position:"absolute", top:10, right:10, background:RED, color:"#fff", fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>
            -{p.disc}%
          </span>
        )}
        {/* Heart */}
        <button
          onClick={e=>{e.stopPropagation();setWished(w=>!w);}}
          style={{ position:"absolute", top:10, left:10, background:"#fff", border:"none", borderRadius:20, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 1px 6px rgba(0,0,0,0.15)", fontSize:14, color: wished ? RED : TEXT_2 }}
        >
          {wished ? "♥" : "♡"}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding:"12px 14px 14px", flex:1, display:"flex", flexDirection:"column", gap:6 }}>
        <div style={{ fontSize:11, color:TEXT_2, fontWeight:500 }}>{p.seller || "متجر سيانو"}</div>
        <div style={{ fontSize:13, fontWeight:600, color:TEXT, lineHeight:1.45, minHeight:38, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
          {p.name}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <Stars r={p.rating} />
          <span style={{ fontSize:11, color:TEXT_2 }}>({p.reviews})</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
          <span style={{ fontSize:15, fontWeight:800, color:G }}>{p.price}</span>
          {showDisc && p.old && <span style={{ fontSize:12, color:TEXT_2, textDecoration:"line-through" }}>{p.old}</span>}
        </div>
        <button style={{ marginTop:6, background:G, color:"#fff", border:"none", borderRadius:10, padding:"9px 0", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          أضف للسلة
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function HomepageV4() {
  return (
    <div dir="rtl" style={{ fontFamily:"Cairo, system-ui, sans-serif", background:BG, color:TEXT, minHeight:"100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        a { text-decoration: none; }
        input, select, button { font-family: inherit; }
      `}</style>

      {/* ══════════════════════════════════════════
          1. HEADER
      ══════════════════════════════════════════ */}
      <header style={{ background:WHITE, borderBottom:`1px solid ${BORDER}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 10px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px", height:60, display:"flex", alignItems:"center", gap:16 }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg,${G},${G_DARK})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18 }}>S</div>
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:TEXT, lineHeight:1 }}>SYANO</div>
              <div style={{ fontSize:10, color:TEXT_2, lineHeight:1 }}>سوق سوريا</div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            {["الرئيسية","الأقسام","العروض","وصل جديداً"].map((l,i) => (
              <a key={l} href="#" style={{ padding:"6px 12px", fontSize:13, fontWeight: i===0 ? 700 : 500, color: i===0 ? G : TEXT, borderRadius:8, background: i===0 ? G_LIGHT : "transparent" }}>
                {l}
              </a>
            ))}
          </nav>

          {/* Search bar */}
          <div style={{ flex:1, display:"flex", alignItems:"center", background:"#F1F5F9", border:`1.5px solid ${BORDER}`, borderRadius:12, overflow:"hidden" }}>
            <button style={{ background:G, border:"none", color:"#fff", padding:"9px 16px", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            <input placeholder="ابحث عن أي شيء..." style={{ flex:1, border:"none", background:"transparent", padding:"9px 14px", fontSize:13, outline:"none", color:TEXT }} />
          </div>

          {/* Right icons */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <button style={{ position:"relative", background:"none", border:`1.5px solid ${BORDER}`, borderRadius:10, cursor:"pointer", padding:"7px 12px", display:"flex", alignItems:"center", gap:5, fontSize:13, color:TEXT, fontWeight:600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              سلة
              <span style={{ background:RED, color:"#fff", width:17, height:17, borderRadius:9, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>3</span>
            </button>
            <button style={{ background:"none", border:`1.5px solid ${BORDER}`, color:TEXT, padding:"7px 14px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:600 }}>تسجيل الدخول</button>
            <button style={{ background:G, border:"none", color:"#fff", padding:"8px 16px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:700 }}>إنشاء حساب</button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          2. HERO + PRODUCT MOSAIC
      ══════════════════════════════════════════ */}
      <section style={{ background:`linear-gradient(135deg,${G_LIGHT} 0%,#EFF6FF 100%)`, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"36px 20px", display:"grid", gridTemplateColumns:"1fr 480px", gap:40, alignItems:"center" }}>

          {/* Content */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${G}15`, border:`1px solid ${G}28`, color:G, fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:20, maxWidth:"fit-content" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              السوق الإلكتروني الأول في سوريا
            </span>

            <div>
              <h1 style={{ fontSize:46, fontWeight:900, color:TEXT, lineHeight:1.1, margin:0 }}>
                سوق <span style={{ color:G }}>سوريا</span>
              </h1>
              <h2 style={{ fontSize:28, fontWeight:800, color:TEXT, lineHeight:1.3, margin:"6px 0 0", opacity:0.85 }}>
                كل ما تحتاجه في مكان واحد
              </h2>
            </div>

            <p style={{ color:TEXT_2, fontSize:15, lineHeight:1.75, margin:0 }}>
              منتجات عالية الجودة من متاجر موثوقة في حلب وسوريا<br />
              شحن سريع · حماية المشتري · الدفع عند الاستلام
            </p>

            {/* Hero search */}
            <div style={{ display:"flex", alignItems:"stretch", background:WHITE, border:`2px solid ${G}`, borderRadius:14, overflow:"hidden", boxShadow:"0 4px 20px rgba(5,150,105,0.15)" }}>
              <input
                placeholder="ابحث عن أي منتج... (هاتف، لابتوب، ملابس...)"
                style={{ flex:1, border:"none", background:"transparent", padding:"14px 18px", fontSize:14, outline:"none", color:TEXT, fontFamily:"inherit" }}
              />
              <button style={{ background:G, border:"none", color:"#fff", padding:"14px 22px", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", gap:7, fontWeight:700, fontSize:14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                بحث
              </button>
            </div>

            {/* CTAs */}
            <div style={{ display:"flex", gap:12 }}>
              <button style={{ background:G, border:"none", color:"#fff", padding:"13px 28px", borderRadius:12, cursor:"pointer", fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                تسوق الآن
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <button style={{ background:WHITE, border:`2px solid ${G}`, color:G, padding:"13px 28px", borderRadius:12, cursor:"pointer", fontSize:15, fontWeight:700 }}>
                استعرض الفئات
              </button>
            </div>

            {/* Trust bullets */}
            <div style={{ display:"flex", gap:22, flexWrap:"wrap", paddingTop:2 }}>
              {[
                { icon:<><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>, label:"بائعون موثوقون" },
                { icon:<><rect x="1" y="3" rx="2" ry="2" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>, label:"شحن سريع" },
                { icon:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, label:"حماية المشتري" },
                { icon:<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, label:"دفع آمن" },
              ].map(s => (
                <div key={s.label} style={{ display:"flex", alignItems:"center", gap:7, color:TEXT_2, fontSize:13, fontWeight:600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2">{s.icon}</svg>
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Product Mosaic */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:TEXT_2, marginBottom:10, display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:G, fontWeight:700 }}>عروض مميزة اليوم</span>
              <span style={{ cursor:"pointer" }}>عرض الكل ←</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {MOSAIC.map((p,i) => (
                <div key={i} style={{ borderRadius:16, overflow:"hidden", cursor:"pointer", position:"relative", minHeight:170 }}>
                  {/* Background image */}
                  <img src={p.img} alt={p.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                  {/* Gradient overlay */}
                  <div style={{ position:"absolute", inset:0, background:p.bg, opacity:0.75 }} />
                  {/* Discount */}
                  <span style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.5)", color:"#fff", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, zIndex:2 }}>
                    -{p.disc}%
                  </span>
                  {/* Info at bottom */}
                  <div style={{ position:"absolute", bottom:0, insetInline:0, padding:"10px 12px", zIndex:2 }}>
                    <div style={{ color:"rgba(255,255,255,0.95)", fontSize:12, fontWeight:700, lineHeight:1.3, marginBottom:4 }}>{p.name}</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                      <span style={{ color:"#fff", fontWeight:800, fontSize:14 }}>{p.price}</span>
                      <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11, textDecoration:"line-through" }}>{p.old}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. POPULAR CATEGORIES
      ══════════════════════════════════════════ */}
      <section style={{ background:WHITE, borderBottom:`1px solid ${BORDER}`, padding:"28px 0" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>الفئات الأكثر شيوعاً</h2>
            <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>عرض الكل</a>
          </div>
          <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:4 }}>
            {CATS.map(c => (
              <div key={c.id} style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                cursor:"pointer", flexShrink:0, width:88,
              }}>
                <div style={{ width:80, height:80, borderRadius:18, overflow:"hidden", border:`2px solid ${BORDER}`, position:"relative" }}>
                  <img src={c.img} alt={c.name} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:TEXT, textAlign:"center", lineHeight:1.3 }}>{c.name}</div>
                <div style={{ fontSize:10, color:TEXT_2 }}>{c.count.toLocaleString()} منتج</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. TODAY'S DEALS
      ══════════════════════════════════════════ */}
      <section style={{ background:WHITE, padding:"36px 0 32px", borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>عروض اليوم</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, background:DARK, borderRadius:10, padding:"7px 14px" }}>
                <span style={{ color:"#94A3B8", fontSize:11, fontWeight:600 }}>تنتهي خلال</span>
                <Countdown />
              </div>
            </div>
            <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>عرض الكل</a>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14 }}>
            {DEALS.map(p => <ProductCard key={p.id} p={p} showDisc />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. BEST SELLERS
      ══════════════════════════════════════════ */}
      <section style={{ background:BG, padding:"36px 0 32px", borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>الأكثر مبيعاً</h2>
            <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>عرض الكل</a>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14 }}>
            {BEST_SELLERS.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. VERIFIED STORES + SELLER CTA
      ══════════════════════════════════════════ */}
      <section style={{ background:WHITE, padding:"36px 0 32px", borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px", display:"grid", gridTemplateColumns:"1fr 320px", gap:24 }}>

          {/* Verified stores */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>متاجر موثوقة</h2>
                <span style={{ background:G_LIGHT, color:G, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, border:`1px solid ${G}30` }}>موثّق</span>
              </div>
              <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>عرض الكل</a>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {STORES.map(s => (
                <div key={s.id} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:`linear-gradient(135deg,${s.color},${s.color}cc)`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18, flexShrink:0 }}>{s.initials}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                      <span style={{ fontWeight:700, fontSize:15, color:TEXT }}>{s.name}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={G}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div style={{ fontSize:12, color:TEXT_2 }}>{s.cat} · {s.products} منتج</div>
                  </div>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ color:"#F59E0B", fontSize:13 }}>★</span>
                      <span style={{ fontSize:13, fontWeight:700, color:TEXT }}>{s.rating}</span>
                    </div>
                    <div style={{ fontSize:11, color:TEXT_2 }}>({s.reviews.toLocaleString()})</div>
                  </div>
                  <button style={{ background:G_LIGHT, border:`1px solid ${G}30`, color:G, padding:"7px 18px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:700, flexShrink:0 }}>
                    تابع
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Side CTA cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {/* Sell CTA */}
            <div style={{ background:`linear-gradient(135deg,${G},${G_DARK})`, borderRadius:18, padding:"24px 22px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ width:44, height:44, background:"rgba(255,255,255,0.2)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h3 style={{ color:"#fff", fontSize:18, fontWeight:800, lineHeight:1.3, margin:0 }}>هل تريد بيع منتجاتك؟</h3>
              <p style={{ color:"rgba(255,255,255,0.8)", fontSize:13, lineHeight:1.65, margin:0 }}>
                انضم لأكثر من 1,200 بائع على سيانو وابدأ في الربح اليوم.
              </p>
              <button style={{ background:WHITE, border:"none", color:G, padding:"11px 20px", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:800, maxWidth:"fit-content", display:"flex", alignItems:"center", gap:6 }}>
                افتح متجرك الآن
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* Courier CTA */}
            <div style={{ background:`linear-gradient(135deg,#1e3a8a,#1e40af)`, borderRadius:18, padding:"24px 22px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ width:44, height:44, background:"rgba(255,255,255,0.2)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="1" y="3" rx="2" ry="2" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <h3 style={{ color:"#fff", fontSize:18, fontWeight:800, lineHeight:1.3, margin:0 }}>هل تريد العمل كمندوب؟</h3>
              <p style={{ color:"rgba(255,255,255,0.8)", fontSize:13, lineHeight:1.65, margin:0 }}>
                اعمل بمواعيدك، اكسب أسبوعياً، وكن جزءاً من فريق سيانو.
              </p>
              <button style={{ background:WHITE, border:"none", color:"#1e40af", padding:"11px 20px", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:800, maxWidth:"fit-content", display:"flex", alignItems:"center", gap:6 }}>
                سجّل الآن
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. NEW ARRIVALS
      ══════════════════════════════════════════ */}
      <section style={{ background:BG, padding:"36px 0 32px", borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>وصل جديداً</h2>
            <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>عرض الكل</a>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14 }}>
            {NEW_ARRIVALS.map(p => (
              <ProductCard key={p.id} p={{ ...p, seller:"جديد هذا الأسبوع" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. EXPLORE CATEGORIES (photo grid)
      ══════════════════════════════════════════ */}
      <section style={{ background:WHITE, padding:"36px 0 32px", borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:TEXT }}>تسوق حسب الفئة</h2>
            <a href="#" style={{ color:G, fontSize:13, fontWeight:600 }}>كل الفئات</a>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:12 }}>
            {[
              { name:"إلكترونيات", img:CAT_IMG.electronics },
              { name:"أزياء",       img:CAT_IMG.fashion     },
              { name:"المنزل",      img:CAT_IMG.home        },
              { name:"الجمال",      img:CAT_IMG.beauty      },
              { name:"الرياضة",     img:CAT_IMG.sports      },
              { name:"السيارات",    img:CAT_IMG.cars        },
              { name:"الألعاب",     img:CAT_IMG.gaming      },
              { name:"البقالة",     img:CAT_IMG.grocery     },
            ].map((c,i) => (
              <div key={i} style={{ borderRadius:14, overflow:"hidden", cursor:"pointer", position:"relative", aspectRatio:"3/4" }}>
                <img src={c.img} alt={c.name} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)" }} />
                <div style={{ position:"absolute", bottom:0, insetInline:0, padding:"10px 10px", color:"#fff", fontWeight:700, fontSize:13, textAlign:"center" }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. APP DOWNLOAD STRIP
      ══════════════════════════════════════════ */}
      <section style={{ background:`linear-gradient(135deg,${G},${G_DARK})`, padding:"32px 0" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ color:"#fff", fontSize:22, fontWeight:900, margin:"0 0 6px" }}>حمّل تطبيق سيانو</h3>
            <p style={{ color:"rgba(255,255,255,0.8)", fontSize:14, margin:0 }}>تسوّق بسهولة من هاتفك في أي وقت ومن أي مكان</p>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            {["App Store","Google Play"].map(s => (
              <button key={s} style={{ background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.35)", color:"#fff", padding:"12px 22px", borderRadius:12, cursor:"pointer", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10. FOOTER
      ══════════════════════════════════════════ */}
      <footer style={{ background:DARK, color:"rgba(255,255,255,0.7)", padding:"40px 0 24px" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:32, marginBottom:32 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg,${G},${G_DARK})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18 }}>S</div>
                <span style={{ fontWeight:900, fontSize:18, color:"#fff" }}>SYANO</span>
              </div>
              <p style={{ fontSize:13, lineHeight:1.75, maxWidth:240 }}>السوق الإلكتروني الأول في سوريا. منتجات عالية الجودة، شحن سريع، دفع آمن.</p>
            </div>
            {[
              { title:"روابط سريعة", links:["الرئيسية","المنتجات","العروض","المتاجر"] },
              { title:"الحساب",      links:["تسجيل الدخول","إنشاء حساب","طلباتي","المفضلة"] },
              { title:"الدعم",       links:["تواصل معنا","الشكاوى","سياسة الخصوصية","الشروط"] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ color:"#fff", fontWeight:700, fontSize:14, marginBottom:14 }}>{col.title}</h4>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {col.links.map(l => (
                    <a key={l} href="#" style={{ color:"rgba(255,255,255,0.6)", fontSize:13, transition:"color 0.15s" }}>{l}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", paddingTop:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12 }}>© 2026 SYANO · جميع الحقوق محفوظة</span>
            <span style={{ fontSize:12 }}>صُنع في سوريا بكل فخر</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
