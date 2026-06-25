---
name: Product image audit
description: Verified Pexels IDs for all 42 seeded products after June 2026 audit. Key IDs confirmed working and category-matched.
---

# Product Image Audit — June 2026

## Rule
Every product image must match its name, category, and description. No sharing of non-perfume images across different product types.

**Why:** Demo products showed Dyson hair dryer with perfume bottles, chino pants with a woman in a dress, Samsung TV with a "Black Friday Sale" sign — all severely hurt marketplace credibility.

## Verified Safe Pexels IDs by Category

### Electronics
- `1649771` — Sony WH-1000XM5 headphones (over-ear, dark bg)
- `699122` — Samsung Galaxy smartphone
- `18105` — MacBook Pro laptop
- `1201996` — Samsung TV in living room (replaces 5632399 which was a sale sign)
- `190819` — smartwatch face
- `1444416` — mirrorless camera
- `3587477` — earbuds/audio
- `577585` — tablet
- `3945683` — Bluetooth speaker

### Fashion
- `1926769` — woman in floral dress ✅ (Floral Maxi Dress)
- `2529148` — leather jacket ✅ (Men's Leather Jacket)
- `1040945` — Nike sneakers
- `1152077` — leather handbag
- `2048584` — running shoes
- `2220280` — men's casual trousers ✅ (Chino Pants)
- `996329` — casual clothing secondary
- `1619651` — women's shoes ✅ (Stiletto Heels)
- `2213005` — heels secondary
- `6149284` — dark modest fashion ✅ (Nida Abaya) — very dark avg color (48,58,58)

### Home & Living
- `1643383` — Scandinavian sofa
- `1279107` — floor lamp / lighting
- `243757` — ceramic dinnerware
- `1571458` — Persian rug/carpet pattern
- `1839919` — gallery/wall art ✅ (Canvas Wall Art)
- `3246603` — art secondary
- `1438761` — stainless steel cookware
- `1034584` — white bedding/pillows ✅ (Memory Foam Pillow) — very light neutral, copyright 2018
- `3952234` — bedroom bedding secondary

### Beauty
- `3059609` — perfume bottles scene (D&G, Daisy, L'Imperatrice)
- `965989` — perfume bottle (shared by Chanel N°5 + Tom Ford — both perfume, acceptable)
- `1115128` — La Mer skincare cream jar
- `3373716` — eyeshadow palette (Urban Decay)
- `2533266` — makeup products ✅ (Charlotte Tilbury Lipstick)
- `3373725` — makeup secondary
- `3993449` — hair styling (Anna Avilova) ✅ (Dyson Hair Dryer)
- `5069441` — hair products secondary

### Sports & Fitness
- `3775549` — adjustable dumbbells
- `1552252` — yoga mat
- `2048584` — running shoes (shared with Fashion)
- `4498480` — resistance/fitness bands ✅ (Karolina Grabowska) (Resistance Bands)
- `5638567` — fitness accessories secondary

### Jewelry
- `1407305` — Rolex-style watch
- `248077` — diamond pendant necklace
- `1413420` — emerald ring
- `5442799` — pearl jewelry ✅ (Pearl Bracelet)
- `3490348` — elegant jewelry secondary

### Books
- `1907785` — book (Atomic Habits)
- `2908984` — different book (Andrew Neel) ✅ (Think & Grow Rich)
- `1370295` — book secondary

### Food & Grocery
- `1029757` — olive oil bottle
- `4021992` — botanical/rose (Karolina Grabowska) ✅ (Damascus Rose Water)
- `3764578` — bottles/natural secondary

## DON'T USE (404 or confirmed wrong)
- `2897951`, `6347456`, `2117890`, `3756149`, `1643923`, `1374816`, `5986038`, `3838461`, `5414849`, `8032022`, `4170387` — all 404
- `5632399` — "Black Friday Sale" sign (NOT a TV)
- `279628` — outdoor patio/bench (NOT a pillow)
- `3623507` — outdoor street scene (NOT an abaya)
- `7691009` — floor lamp object (NOT a abaya)
- `6186528` — person in blue denim outfit (NOT bedding)
- `693502` — flower/lavender close-up (NOT a TV)

## Bootstrap file
All corrections are in `artifacts/api-server/src/lib/bootstrap-demo-data.ts`.
The idempotency guard (`COUNT >= 42 → skip`) means fresh DB restores get correct images automatically.
On existing DB: corrections are already applied directly via SQL UPDATE.
