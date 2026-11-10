const { createFixedWindowGate } = require("./security");

const HOUR_MS = 60 * 60 * 1000;

// Decides how an emergency trigger (panic PIN or the trigger button) is handled
// when many arrive at once.
//
// - "user_limited": this account already triggered its allowance this hour; an
//   emergency for it is already in progress.
// - "global_limited": too many emergencies platform-wide to deliver inline. The
//   trigger must still be recorded so the dispatcher delivers it shortly.
// - "ok": record it and deliver now.
//
// The per-user limit is checked first, so refused attempts from one account
// never use up the platform-wide allowance. Before this, a few accounts
// repeating their own panic PIN could block everyone else's duress delivery.
function createEmergencyDispatchQuota({ userLimitPerHour = 2, globalLimitPerHour = 50, windowMs = HOUR_MS } = {}) {
  const userGate = createFixedWindowGate({ name: "emergency_dispatch_user", windowMs, limit: userLimitPerHour });
  const globalGate = createFixedWindowGate({ name: "emergency_dispatch_global", windowMs, limit: globalLimitPerHour });

  return function takeEmergencyDispatchQuota(userId) {
    const user = userGate(`user:${String(userId)}`);
    if (!user.allowed) return { status: "user_limited", retryAfter: user.retryAfter };
    const global = globalGate("global");
    if (!global.allowed) return { status: "global_limited", retryAfter: global.retryAfter };
    return { status: "ok", retryAfter: 0 };
  };
}

module.exports = { createEmergencyDispatchQuota };
