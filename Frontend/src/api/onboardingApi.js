import { apiRequest, getStoredSession, persistSession } from "./client";

export function getOnboardingStatus() {
  const session = getStoredSession();
  return session?.onboarding || { status: "PENDING", verificationType: null };
}

export async function submitVerification({ method, idNumber }) {
  const path = method === "BVN" ? "/api/onboarding/bvn" : "/api/onboarding/nin";
  const body = method === "BVN" ? { bvn: idNumber } : { nin: idNumber };

  const result = await apiRequest({
    path,
    method: "POST",
    body,
  });

  const session = getStoredSession();
  const nextSession = {
    ...session,
    onboarding: {
      status: result.onboardingStatus,
      verificationType: result.verificationType,
    },
  };
  persistSession(nextSession);

  return {
    status: result.onboardingStatus,
    method: result.verificationType,
    idNumber,
    verifiedAt: result.verifiedAt,
  };
}
