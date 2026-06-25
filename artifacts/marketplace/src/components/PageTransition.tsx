import { useLocation, useSearch } from "wouter";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const search = useSearch();
  // Include search params so category/filter navigation also triggers the
  // enter animation (e.g. /products?category=A → /products?category=B).
  const key = location + search;
  return (
    <div key={key} className="page-transition">
      {children}
    </div>
  );
}
