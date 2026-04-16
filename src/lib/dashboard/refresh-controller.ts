let refreshHandler: (() => void) | null = null;
let hasPendingRefreshRequest = false;

export function requestDashboardRefresh() {
  if (refreshHandler) {
    refreshHandler();
    return;
  }

  hasPendingRefreshRequest = true;
}

export function registerDashboardRefreshHandler(handler: () => void) {
  refreshHandler = handler;

  if (hasPendingRefreshRequest) {
    hasPendingRefreshRequest = false;
    handler();
  }

  return () => {
    if (refreshHandler === handler) {
      refreshHandler = null;
    }
  };
}
