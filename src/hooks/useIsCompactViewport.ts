"use client";

import { useEffect, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

export function useIsCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);

    const updateViewport = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  return isCompactViewport;
}
