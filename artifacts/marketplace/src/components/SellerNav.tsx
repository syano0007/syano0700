import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Package, ShoppingCart, Boxes, Store, ShieldCheck, MessageCircle, Settings, BarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/seller/dashboard",      icon: LayoutDashboard, key: "dashboard"      },
  { href: "/seller/analytics",      icon: BarChart2,       key: "analytics"      },
  { href: "/seller/products",       icon: Package,         key: "products"       },
  { href: "/seller/orders",         icon: ShoppingCart,    key: "orders"         },
  { href: "/seller/inventory",      icon: Boxes,           key: "inventory"      },
  { href: "/seller/messages",       icon: MessageCircle,   key: "messages"       },
  { href: "/seller/trust",          icon: ShieldCheck,     key: "trust"          },
  { href: "/seller/store-settings", icon: Settings,        key: "store_settings" },
];

export function SellerNav() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const storeName = (user as any)?.storeName || user?.name || t("seller_dashboard.title");

  return (
    <div>
      {/* Seller identity header */}
      <div className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-b">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="flex items-center gap-3 py-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20 shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm truncate text-foreground">{storeName}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px] font-bold shrink-0">
                <ShieldCheck className="h-2.5 w-2.5" />
                {t("seller.verified")}
              </span>
            </div>
            <div className="ms-auto">
              <span className="text-xs text-muted-foreground hidden sm:block">{t("seller_nav.seller_panel", "Seller Panel")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="border-b bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="container max-w-6xl px-0 sm:px-6">
          <nav className="flex overflow-x-auto px-4 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map(({ href, icon: Icon, key }) => {
              const isActive =
                location === href ||
                (href !== "/seller/dashboard" && location.startsWith(href));
              return (
                <Link key={href} href={href}>
                  <div
                    className={`
                      flex items-center gap-2 px-4 sm:px-5 py-3.5 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-all duration-150 shrink-0
                      ${isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }
                    `}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    <span>{t(`seller_nav.${key}`)}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
