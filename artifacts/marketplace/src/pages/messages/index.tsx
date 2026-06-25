import { useTranslation } from "react-i18next";
import { MessageCircle, Bot, ChevronRight, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { MessagingPanel } from "@/components/MessagingPanel";

export default function MessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-20 text-center">
          <MessageCircle className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground">{t("messages.login_prompt")}</p>
          <Link href="/login">
            <Button className="mt-4">{t("messages.login_btn")}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden bg-background text-foreground"
      style={{ height: "100dvh" }}
    >
      <Navbar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0">
        <div className="flex-1 overflow-hidden flex flex-col p-4 min-h-0 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{t("messages.title")}</h1>
            </div>
            <Link href="/support">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-colors text-sm font-medium">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">{t("support.agent_name")}</span>
                <Sparkles className="h-3.5 w-3.5 opacity-70" />
              </button>
            </Link>
          </div>

          {/* Smart Support Banner */}
          <Link href="/support">
            <div className="mb-3 shrink-0 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-emerald-500/5 p-3 flex items-center gap-3 hover:bg-primary/10 transition-colors cursor-pointer">
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Bot className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{t("support.agent_name")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("support.agent_subtitle")}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("support.online")}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Link>

          <MessagingPanel role="customer" userId={user.id} />
        </div>
      </main>
    </div>
  );
}
