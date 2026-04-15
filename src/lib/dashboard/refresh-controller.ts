interface DashboardRefreshRequest {
  forceRefresh?: boolean;
}

let refreshHandler: ((request?: DashboardRefreshRequest) => void) | null = null;
let pendingRefreshRequest: DashboardRefreshRequest | null = null;

export function requestDashboardRefresh(request?: DashboardRefreshRequest) {
  if (refreshHandler) {
    refreshHandler(request);
    return;
  }

  pendingRefreshRequest = request || {};
}

export function registerDashboardRefreshHandler(handler: (request?: DashboardRefreshRequest) => void) {
  refreshHandler = handler;

  if (pendingRefreshRequest) {
    const request = pendingRefreshRequest;
    pendingRefreshRequest = null;
    handler(request);
  }

  return () => {
    if (refreshHandler === handler) {
      refreshHandler = null;
    }
  };
}
