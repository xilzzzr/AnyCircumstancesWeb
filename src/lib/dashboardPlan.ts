export type DashboardPlanState = "paid" | "free" | "inactive";

// Only a successful, recognized billing response can establish the plan state.
export function dashboardPlanState(data: { ok?: boolean; status?: string }): DashboardPlanState {
  if (data.ok !== true) throw new Error("billing_status_unavailable");
  switch (data.status) {
    case "active":
    case "trial":
    case "trialing":
      return "paid";
    case "none":
    case "pending_setup":
      return "free";
    case "past_due":
    case "paused":
    case "canceled":
    case "cancelled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "expired":
      return "inactive";
    default:
      throw new Error("billing_status_unavailable");
  }
}
