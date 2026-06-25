// @refresh reset
import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

// ─── Fallback UI — functional so hooks work ───────────────────────────────────

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();

  return (
    <div
      dir={dir}
      className="min-h-screen bg-background flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full text-center space-y-7">

        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-md">
            <span className="text-primary-foreground font-black text-sm select-none">S</span>
          </div>
          <span className="text-xl font-black text-foreground tracking-tight select-none">
            SYANO
          </span>
        </div>

        {/* Error icon */}
        <div className="flex items-center justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2.5">
          <h1 className="text-2xl font-bold text-foreground">
            {t("error_boundary.title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            {t("error_boundary.subtitle")}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-sm w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            {t("error_boundary.try_again")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-background text-foreground font-semibold text-sm hover:bg-muted active:scale-95 transition-all w-full sm:w-auto"
          >
            <Home className="h-4 w-4 shrink-0" />
            {t("error_boundary.go_home")}
          </a>
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full" />

        {/* Dev-only error details */}
        {import.meta.env.DEV && error && (
          <details className="text-start">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              {t("error_boundary.details")}
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-lg text-[11px] text-muted-foreground overflow-auto whitespace-pre-wrap break-all max-h-48 text-start">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── Error Boundary class component ──────────────────────────────────────────

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught render error:", error.message);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}
