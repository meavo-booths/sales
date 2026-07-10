/** First issue message from a Zod error — the shared user-facing validation message. */
export function firstZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues.length > 0) return issues[0].message;
  }
  return "Invalid input";
}
