import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 bg-card border rounded-xl p-5 sm:p-8 shadow-sm text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
          <h1 className="text-2xl font-bold text-foreground">{t("not_found.title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t("not_found.desc")}</p>
        <Link href="/">
          <Button className="w-full">{t("not_found.back_home")}</Button>
        </Link>
      </div>
    </div>
  );
}
