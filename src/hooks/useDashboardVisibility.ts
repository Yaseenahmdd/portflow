"use client";

import { useEffect, useState } from "react";

export function useDashboardVisibility() {
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);

  useEffect(() => {
    function handleToggleVisibility(event: Event) {
      const detail = (event as CustomEvent<{ visible: boolean }>).detail;
      if (detail && typeof detail.visible === "boolean") {
        setIsAmountsVisible(detail.visible);
      } else {
        setIsAmountsVisible((current) => !current);
      }
    }

    function publishVisibilityState() {
      window.dispatchEvent(
        new CustomEvent("portflow:visibility-state", {
          detail: { visible: isAmountsVisible },
        })
      );
    }

    window.addEventListener("portflow:toggle-visibility", handleToggleVisibility as EventListener);
    publishVisibilityState();

    return () => {
      window.removeEventListener("portflow:toggle-visibility", handleToggleVisibility as EventListener);
    };
  }, [isAmountsVisible]);

  return { isAmountsVisible };
}
