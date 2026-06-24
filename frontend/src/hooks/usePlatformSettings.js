import { useQuery } from "@tanstack/react-query";
import { vendorSubscriptionsAPI } from "@/api/apiClient";

export function usePlatformSettings() {
  const { data } = useQuery({
    queryKey: ["platformSettings"],
    queryFn: () => vendorSubscriptionsAPI.getPlans(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const subscriptionMode = data?.subscription_mode ?? false;

  return {
    subscriptionMode,
    isSubscriptionEnforced: subscriptionMode,
  };
}
