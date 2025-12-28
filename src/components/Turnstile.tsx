"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: TurnstileOptions
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "invisible";
  tabindex?: number;
  action?: string;
  cData?: string;
  "response-field"?: boolean;
  "response-field-name"?: string;
}

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "invisible";
  action?: string;
  className?: string;
}

export function Turnstile({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = "dark",
  size = "normal",
  action,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    // Remove existing widget if any
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // Widget may already be removed
      }
    }

    // Clear the container
    containerRef.current.innerHTML = "";

    // Render new widget
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      "error-callback": onError,
      "expired-callback": onExpire,
      theme,
      size,
      action,
    });
  }, [siteKey, onVerify, onError, onExpire, theme, size, action]);

  useEffect(() => {
    // If turnstile is already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(
      'script[src*="turnstile"]'
    );

    if (existingScript) {
      // Script exists, wait for it to load
      window.onTurnstileLoad = renderWidget;
      return;
    }

    // Load the script
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true;

      window.onTurnstileLoad = renderWidget;

      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget may already be removed
        }
      }
    };
  }, [renderWidget]);

  return <div ref={containerRef} className={className} />;
}

// Hook for accessing turnstile token
export function useTurnstileToken() {
  const tokenRef = useRef<string | null>(null);

  const setToken = useCallback((token: string) => {
    tokenRef.current = token;
  }, []);

  const getToken = useCallback(() => {
    return tokenRef.current;
  }, []);

  const clearToken = useCallback(() => {
    tokenRef.current = null;
  }, []);

  return { setToken, getToken, clearToken };
}
