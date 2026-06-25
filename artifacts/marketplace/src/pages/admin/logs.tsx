import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminListLogs } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { ScrollText, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;

const ACTION_STYLES: Record<string, string> = {
  DELETE_USER: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  DELETE_PRODUCT: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  UPDATE_PRODUCT: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  UPDATE_ORDER_STATUS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  UPDATE_SETTINGS: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};


function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetadataTooltip({ metadata }: { metadata: Record<string, unknown> | null | undefined }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("admin.logs_details")}
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 top-6 z-20 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
            <p className="text-xs font-semibold text-foreground mb-2">{t("admin.logs_details")}</p>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminLogs() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminListLogs({ page, limit: PAGE_SIZE });

  const logs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("admin.logs_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("admin.logs_subtitle")}</p>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <div className="text-center">
                <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("common.loading")}</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <div className="text-center">
                <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">{t("admin.logs_empty")}</p>
                <p className="text-xs mt-1 opacity-70">{t("admin.logs_empty_hint")}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.logs_col_actor")}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.logs_col_action")}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.logs_col_target")}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.logs_col_time")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{log.actorName}</div>
                        <div className="text-xs text-muted-foreground">ID #{log.actorId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={ACTION_STYLES[log.action] ?? "bg-muted/40 text-foreground"}
                        >
                          {formatAction(log.action)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">
                          {t(`admin.target_${log.targetType}`, { defaultValue: log.targetType })}
                        </span>
                        {log.targetId && (
                          <span className="text-muted-foreground ms-1">#{log.targetId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <MetadataTooltip metadata={log.metadata as Record<string, unknown> | null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && logs.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                {t("admin.logs_total", { count: total })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-11 w-11 p-0"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-11 w-11 p-0"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
