# API_STATE.md — SYANO (سوق سوريا)

## API Server
- **Framework:** Express v5
- **Language:** TypeScript → esbuild bundle
- **Entry:** `artifacts/api-server/src/index.ts`
- **App:** `artifacts/api-server/src/app.ts`
- **Routes:** `artifacts/api-server/src/routes/index.ts`
- **Build:** `node ./build.mjs` → `dist/index.mjs`
- **Start:** `node --enable-source-maps ./dist/index.mjs`
- **Base path:** `/api`

## OpenAPI
- **Spec source:** `lib/api-spec/`
- **Status:** MANUALLY EXTENDED — DO NOT REGENERATE without preserving extensions
- **Generator:** Orval
- **Generated output:** `lib/api-client-react/src/generated/`
- **Last generated:** Pre-migration (previous workspace)
- **Manual extensions preserved:**
  - `isBestDeal` field on Product types
  - `storeName` field on Product types
  - `hasVariants` field on Product types
  - `flashSaleEnd`, `flashSalePrice` fields
  - `q?: string` on `AdminListUsersParams`
  - Custom BestSellerProduct interface in best-sellers.ts

## Route Map (all verified 2026-06-08)

### Auth Routes (`/api/auth/*`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login, returns JWT |
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/logout` | Optional | Clear session |
| POST | `/api/auth/forgot-password` | None | Send OTP reset |
| POST | `/api/auth/verify-reset-otp` | None | Verify OTP (email+code) |
| POST | `/api/auth/reset-password` | None | Reset with token+password |
| GET | `/api/auth/me` | JWT | Get current user |

### Products Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | None | List products (paginated) |
| GET | `/api/products/best-sellers` | None | Best selling products |
| GET | `/api/products/:id` | None | Single product |
| POST | `/api/products` | seller/admin | Create product |
| PATCH | `/api/products/:id` | seller/admin | Update product |
| DELETE | `/api/products/:id` | seller/admin | Delete product |
| GET | `/api/products/:id/reviews` | None | Product reviews |
| POST | `/api/products/:id/reviews` | customer | Add review |
| GET | `/api/products/:id/variants` | None | Product variants |

### Variants Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/products/:id/variants/groups` | seller/admin | Create variant group |
| PATCH | `/api/products/:id/variants/groups/:groupId` | seller/admin | Update group |
| DELETE | `/api/products/:id/variants/groups/:groupId` | seller/admin | Delete group |
| POST | `/api/products/:id/variants` | seller/admin | Create variant |
| PATCH | `/api/products/:id/variants/:variantId` | seller/admin | Update variant |
| DELETE | `/api/products/:id/variants/:variantId` | seller/admin | Delete variant |

### Cart Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | customer | Get cart |
| POST | `/api/cart/items` | customer | Add item |
| PATCH | `/api/cart/items` | customer | Update quantity |
| PATCH | `/api/cart/items/:cartItemId` | customer | Update item |
| DELETE | `/api/cart/items/:cartItemId` | customer | Remove item |
| DELETE | `/api/cart/clear` | customer | Clear cart |

### Orders Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | customer | Place order (db.transaction + SELECT FOR UPDATE) |
| GET | `/api/orders` | JWT | List orders |
| GET | `/api/orders/:id` | JWT | Order detail |
| PATCH | `/api/orders/:id/status` | seller/admin | Update status |

### Seller Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/sellers/store/:slug` | None | Store page |
| GET | `/api/sellers/:id/store-preview` | None | Store preview |
| POST | `/api/sellers/:id/follow` | customer | Follow store |
| DELETE | `/api/sellers/:id/follow` | customer | Unfollow store |
| GET | `/api/sellers/:id/follow-status` | JWT | Follow status |
| GET | `/api/me/following-stores` | JWT | My followed stores |
| GET | `/api/sellers/:id/reviews` | None | Seller reviews |
| POST | `/api/sellers/:id/reviews` | customer | Add seller review |
| PATCH | `/api/sellers/store/branding` | seller | Update branding |

### Dashboard Routes
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/seller` | seller | Seller dashboard |
| GET | `/api/dashboard/seller/analytics` | seller | Seller analytics |
| GET | `/api/dashboard/customer` | customer | Customer dashboard |

### Admin Routes (`/api/admin/*`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/users` | admin | List users (supports ?q=) |
| DELETE | `/api/admin/users/:id` | admin | Delete user |
| PATCH | `/api/admin/users/:id/verify` | admin | Verify user |
| PATCH | `/api/admin/users/:id/suspend` | admin | Suspend user |
| PATCH | `/api/admin/users/:id/reactivate` | admin | Reactivate user |
| GET | `/api/admin/products` | admin | List products |
| PATCH | `/api/admin/products/:id` | admin | Update product |
| DELETE | `/api/admin/products/:id` | admin | Delete product |
| GET | `/api/admin/orders` | admin | List orders |
| GET | `/api/admin/stats` | admin | Platform stats |
| GET | `/api/admin/logs` | admin | Audit logs |

### Seller Applications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/seller-applications` | admin | List all |
| GET | `/api/seller-applications/my` | JWT | My application |
| PATCH | `/api/seller-applications/draft` | JWT | Save draft |
| DELETE | `/api/seller-applications/my` | JWT | Delete my app |
| POST | `/api/seller-applications` | JWT | Submit application |
| PATCH | `/api/seller-applications/:id/status` | admin | Approve/reject |

### Messaging
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/conversations` | JWT | List conversations |
| POST | `/api/conversations` | JWT | Start conversation |
| GET | `/api/conversations/:id/messages` | JWT | Get messages |
| POST | `/api/conversations/:id/messages` | JWT | Send message |

### Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | JWT | List notifications |
| PATCH | `/api/notifications/:id/read` | JWT | Mark read |
| PATCH | `/api/notifications/read-all` | JWT | Mark all read |
| GET | `/api/notifications/sse` | JWT | SSE stream |

### Push Subscriptions
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/push-subscriptions/vapid-public-key` | None | VAPID public key |
| POST | `/api/push-subscriptions` | JWT | Subscribe |
| DELETE | `/api/push-subscriptions` | JWT | Unsubscribe |

### Other
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/settings` | None | Platform settings |
| GET | `/api/search` | None | Full-text search |
| GET | `/sitemap.xml` | None | Sitemap |

## Authentication Middleware
- `requireAuth` — verifies JWT from `Authorization: Bearer` header
- `requireRole(role)` — checks user.role
- `requireActiveAccount` — blocks suspended accounts (returns 403 + SSE kick)

## Express v5 Type Quirks
- `req.params` values are `string | string[]` — always use `String(req.params.id)` before `parseInt`
- JWT_SECRET must be narrowed via IIFE const, not bare conditional

## Rate Limiting
- Login: rate limited (returns 429 → `rate_limited` error code on frontend)
- OTP: attempt counting + lockout via `reset_otp_attempts` / `reset_otp_locked_until`

## Error Code Mapping (frontend expectation)
- 429 → `rate_limited`
- 403 + ACCOUNT_SUSPENDED → suspended toast + redirect
- Invalid credentials / User not found → `no_account_found` (intentional — prevents email enumeration)
- Email already registered → `email_taken`
- Phone already registered → `phone_taken`
