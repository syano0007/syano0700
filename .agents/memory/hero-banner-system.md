---
name: Hero Banner System V5 (graduated from approved Canvas mockup)
description: Architecture of HeroV4.tsx — flex-row desktop layout matching the approved mockup; circular FloatCard thumbnails; always-dark section bg; DB banner priority with built-in 5-slide fallback.
---

# Hero Banner System V5 (June 2026 — Mockup Graduation)

## Component File
`artifacts/marketplace/src/components/HeroV4.tsx`

## Layout Architecture

### Desktop (≥ md)
- **Wrapper**: `hidden md:block` div with `paddingTop:32, paddingBottom:24, paddingLeft:100, paddingRight:32`
- **Flex row**: `display:"flex", gap:24, height:552, direction:"ltr"` (image always LEFT)
- **Image panel**: `flex:"0 0 50%"`, `borderRadius:18`, `overflow:"hidden"`, `background:"#030303"`
- **Text panel**: `flex:1`, `direction: isRTL ? "rtl" : "ltr"`, language-aware text direction
- **Section bg**: Always dark `backgroundColor:"#040404"` + radial-gradient grid dots `rgba(255,255,255,0.009) 1px` at `32px 32px`
- **Border**: `borderBottom:"1px solid rgba(255,255,255,0.06)"`

### Mobile (< md)
- `md:hidden`, `height:"clamp(420px,72vh,580px)"`, full-width image + dark overlay (rgba 0.65) + text overlay

## FloatCard — Exact Mockup Values
- `background:"rgba(6,6,6,0.93)"`, `backdropFilter:"blur(28px)"`, `border:"rgba(255,255,255,0.08)"`
- `borderRadius:15`, `padding:"11px 14px"`, `gap:11`
- `boxShadow:"0 18px 52px rgba(0,0,0,0.84), 0 4px 16px rgba(0,0,0,0.60)"`
- Label: `fontSize:10.5, color:"#5a626e"` | Price: `fontSize:14, fontWeight:800, color:"#f3f3f3"`
- **Thumbnail: `width:48, height:48, borderRadius:"50%"` — circular, not rounded-rect**

## Card Positions (mockup values)
| Card | Position | Width |
|---|---|---|
| Card 1 | `{ top:36, right:18 }` | 200px |
| Card 2 | `{ top:205, left:14 }` | 172px |
| Card 3 | `{ bottom:50, left:38 }` | 207px |

## Badge Position
`top:120, left:28` (NOT `top:135, left:40` as in older versions)

## Right-Edge Blend
`width:"22%"` gradient `linear-gradient(to left, #040404 0%, transparent 100%)` — NOT 45%

## Text Panel Values
- Description: `color:"#8b9aac"`
- CTA primary: `color:"#000000"`, `fontWeight:800`, `borderRadius:8`, `padding:"12px 24px"`, `background:"#10b981"`
- CTA secondary: `color:"#b0b8c4"`, `borderRadius:8`, `border:"1px solid rgba(255,255,255,0.14)"`
- Stats numbers: `fontSize:"clamp(22px, 2.4vw, 32px)"`, `fontWeight:700`
- Stats format: `"12,000+"` NOT `"+12,000"`

## HERO_SLIDES (5 built-in slides — DB banners take priority)
IDs: `electronics` (1649771=headphones), `fashion` (1926769), `perfumes` (3059609), `home` (1571458), `jewelry` (1407305)

## DB Banner Flow
- `GET ${BASE}api/banners` → if empty → built-in slides auto-play at 5,000ms
- DB banners → BannerCarousel at 6,000ms, impression tracking, prev/next arrows, dot indicators
- `hasBanners = banners.length > 1` — single banner shows no arrows

## Recovery Check
Module 21 (`heroBannerSystem`) checks `home.tsx uses HeroBanner`. This is a **known false negative** — score 95/100 is correct. HeroV4 has its own carousel.

**Why always-dark section**: Hero is designed for the dark-dominant aesthetic regardless of app theme. The rest of the page respects dark/light mode; the hero section does not.
