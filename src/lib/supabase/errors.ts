const REFRESH_TOKEN_REUSE_MESSAGE = "Invalid Refresh Token: Already Used";

export function isRefreshTokenReuseError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  return message.includes(REFRESH_TOKEN_REUSE_MESSAGE);
}
