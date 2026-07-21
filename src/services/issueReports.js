import { authenticatedFetch } from "./authenticatedRequest";
import { buildIssueReportPayload } from "./issueReportPayload";

export { buildIssueReportPayload } from "./issueReportPayload";

export async function submitIssueReport(brokerApiUrl, input) {
  const response = await authenticatedFetch(`${brokerApiUrl}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildIssueReportPayload(input)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Issue report could not be submitted.");
  return payload;
}
