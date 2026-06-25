import { Shield, ShieldCheck, Award } from "lucide-react";
import { useTranslation } from "react-i18next";

export type VerificationLevel = "none" | "basic" | "verified" | "business";

export interface TrustBadgeConfig {
  level: VerificationLevel;
  isVerified?: boolean;
  trustScore?: number | null;
  size?: "xs" | "sm" | "md";
  showScore?: boolean;
  allowNone?: boolean;
}

function getVerificationConfig(level: VerificationLevel, isVerified: boolean, allowNone = false) {
  if (level === "business") {
    return {
      icon: Award,
      classes: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
      dotClass: "bg-violet-500",
    };
  }
  if (level === "verified") {
    return {
      icon: ShieldCheck,
      classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }
  if (level === "basic" || isVerified) {
    return {
      icon: Shield,
      classes: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      dotClass: "bg-blue-400",
    };
  }
  if (allowNone) {
    return {
      icon: Shield,
      classes: "bg-muted text-muted-foreground border-border",
      dotClass: "bg-muted-foreground",
    };
  }
  return null;
}

export function SellerTrustBadge({
  level,
  isVerified = false,
  trustScore,
  size = "sm",
  showScore = false,
  allowNone = false,
}: TrustBadgeConfig) {
  const { t } = useTranslation();

  const config = getVerificationConfig(level, isVerified, allowNone);
  if (!config) return null;

  const Icon = config.icon;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-0.5",
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };

  const iconSizes = {
    xs: "h-2.5 w-2.5",
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
  };

  const label =
    level === "business"
      ? t("trust.level_business", "Business Verified")
      : level === "verified"
        ? t("trust.level_verified", "ID Verified")
        : level === "basic" || isVerified
          ? t("trust.level_basic", "Verified Seller")
          : t("trust.level_none", "Unverified");

  return (
    <span className={`inline-flex items-center font-bold rounded-full border ${sizeClasses[size]} ${config.classes}`}>
      <Icon className={`${iconSizes[size]} shrink-0`} />
      {label}
      {showScore && trustScore != null && (
        <span className="opacity-70">· {trustScore}</span>
      )}
    </span>
  );
}

export function TrustScoreBar({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const { t } = useTranslation();
  const band =
    score >= 75 ? { label: t("trust.band_trusted", "Trusted"), color: "bg-emerald-500" } :
    score >= 50 ? { label: t("trust.band_established", "Established"), color: "bg-blue-500" } :
    score >= 25 ? { label: t("trust.band_basic", "Basic"), color: "bg-amber-500" } :
                  { label: t("trust.band_new", "New"), color: "bg-muted-foreground" };

  if (size === "md") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">{t("trust.trust_score", "Trust Score")}</span>
          <span className="font-black text-foreground">{score}/100 <span className="font-normal text-muted-foreground">({band.label})</span></span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${band.color}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${band.color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{score}/100</span>
    </div>
  );
}
