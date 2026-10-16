export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const requestId =
    error &&
    typeof error === "object" &&
    "requestId" in error &&
    typeof error.requestId === "string"
      ? error.requestId
      : undefined;
  return (
    <div role="alert" className="error-note">
      {error instanceof Error ? error.message : String(error)}
      {requestId && <small>Request ID: {requestId}</small>}
    </div>
  );
}
