function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function hasDataMessage(value: unknown): value is { data: { message: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null &&
    "message" in value.data &&
    typeof value.data.message === "string"
  );
}

export function toErrorMessage(
  error: unknown,
  fallback = "An unknown error occurred.",
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (hasMessage(error) && error.message) {
    return error.message;
  }

  if (hasDataMessage(error) && error.data.message) {
    return error.data.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}
