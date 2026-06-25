import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertOctagon, Mail, Phone } from "lucide-react";

export default function AccountSuspended() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const SUPPORT_EMAIL = "support@syano.online";
  const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertOctagon className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            {t("suspended.title")}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {t("suspended.desc")}
          </p>
          {user && (
            <p className="text-sm text-muted-foreground">
              {t("suspended.logged_in_as", { name: user.name, email: user.email })}
            </p>
          )}
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-5 space-y-3 text-start">
          <p className="text-sm font-semibold text-foreground">{t("suspended.contact_support")}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-3 text-sm text-primary hover:underline"
          >
            <Mail className="h-4 w-4 shrink-0" />
            {SUPPORT_EMAIL}
          </a>
          {SUPPORT_PHONE && (
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-3 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4 shrink-0" />
              {SUPPORT_PHONE}
            </a>
          )}
        </div>

        <Button variant="outline" onClick={logout} className="w-full">
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );
}
