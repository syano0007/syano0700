import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "auto" | "light" | "dark";
          language?: string;
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset:  (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

type TurnstileConfig = { siteKey: string | null; enabled: boolean };

let _cfg: TurnstileConfig | null = null;
let _cfgP: Promise<TurnstileConfig> | null = null;

function fetchConfig(): Promise<TurnstileConfig> {
  if (_cfg)  return Promise.resolve(_cfg);
  if (_cfgP) return _cfgP;
  _cfgP = fetch("/api/auth/turnstile-config")
    .then((r) => r.json())
    .then((d: TurnstileConfig) => { _cfg = d; return d; })
    .catch(() => {
      const fallback: TurnstileConfig = { siteKey: null, enabled: false };
      _cfg = fallback;
      return fallback;
    });
  return _cfgP;
}

let _scriptP: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (_scriptP) return _scriptP;
  _scriptP = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("cf-ts-script");
    if (existing) {
      const poll = () => (window.turnstile ? resolve() : setTimeout(poll, 50));
      poll();
      return;
    }
    window.onloadTurnstileCallback = () => { resolve(); };
    const s = document.createElement("script");
    s.id    = "cf-ts-script";
    s.src   = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";
    s.async = true;
    s.onload = () => {
      if (window.turnstile) resolve();
      else {
        const poll = () => (window.turnstile ? resolve() : setTimeout(poll, 50));
        setTimeout(poll, 50);
      }
    };
    s.onerror = () => { _scriptP = null; reject(new Error("Turnstile script load failed")); };
    document.head.appendChild(s);
  });
  return _scriptP;
}

fetchConfig().then((cfg) => {
  if (cfg.enabled && cfg.siteKey) loadScript().catch(() => {});
}).catch(() => {});

export type TurnstileHandle = { reset: () => void };

type Props = {
  onVerify:   (token: string) => void;
  onExpire?:  () => void;
  onError?:   () => void;
  onEnabled?: (enabled: boolean) => void;
  containerId: string;
};

const TurnstileWidget = forwardRef<TurnstileHandle, Props>(
  function TurnstileWidget({ onVerify, onExpire, onError, onEnabled, containerId }, ref) {
    const { i18n } = useTranslation();
    const [enabled, setEnabled] = useState<boolean | null>(null);

    const siteKeyRef   = useRef<string | null>(null);
    const widgetId     = useRef<string | null>(null);
    const innerRef     = useRef<HTMLDivElement>(null);
    const onVerifyRef  = useRef(onVerify);
    const onExpireRef  = useRef(onExpire);
    const onErrorRef   = useRef(onError);
    const onEnabledRef = useRef(onEnabled);
    onVerifyRef.current  = onVerify;
    onExpireRef.current  = onExpire;
    onErrorRef.current   = onError;
    onEnabledRef.current = onEnabled;

    const doReset = useCallback(() => {
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.reset(widgetId.current); } catch {}
      }
    }, []);

    useImperativeHandle(ref, () => ({ reset: doReset }), [doReset]);

    useEffect(() => {
      let cancelled = false;
      Promise.all([fetchConfig(), loadScript()])
        .then(([cfg]) => {
          if (cancelled) return;
          const active = cfg.enabled && !!cfg.siteKey;
          siteKeyRef.current = cfg.siteKey;
          onEnabledRef.current?.(active);
          setEnabled(active);
        })
        .catch(() => {
          if (!cancelled) {
            onEnabledRef.current?.(false);
            setEnabled(false);
          }
        });
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) {
          try { window.turnstile.remove(widgetId.current); } catch {}
          widgetId.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i18n.language]);

    useEffect(() => {
      if (!enabled || !siteKeyRef.current || !innerRef.current || !window.turnstile) return;
      if (widgetId.current) return;
      widgetId.current = window.turnstile.render(innerRef.current, {
        sitekey:            siteKeyRef.current,
        callback:           (token) => onVerifyRef.current(token),
        "expired-callback": ()      => { onExpireRef.current?.(); },
        "error-callback":   ()      => { onErrorRef.current?.(); },
        theme:    "auto",
        language: i18n.language === "ar" ? "ar" : "en",
        size:     "compact",
      });
    }, [enabled, i18n.language]);

    if (!enabled) return null;

    return (
      <div
        dir="ltr"
        aria-label="Human verification"
        className="w-full py-1"
      >
        <div
          ref={innerRef}
          id={containerId}
          style={{
            width: "fit-content",
            marginInlineStart: "auto",
            marginInlineEnd: "auto",
          }}
        />
      </div>
    );
  },
);

export default TurnstileWidget;
