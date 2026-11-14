import { useMutation, useQuery, useQueryClient } from "react-query";
import { QueryKeys } from "@hooks/queryKeys";
import { isApiError, v1 } from "@lib/api/v1";
import { normalizeRefCode } from "@lib/affiliate/ref";
import type {
  Affiliate,
  AffiliateApplyInput,
  AffiliateStats,
  AffiliateUpdateInput,
  CommissionsPage,
  PayoutsResponse
} from "@lib/affiliate/types";

/** Retry network and server failures, never 4xx answers. */
const retry = (count: number, error: unknown) =>
  count < 2 &&
  !(isApiError(error) && error.status >= 400 && error.status < 500);

/** The signed-in user's affiliate account, or null if they haven't applied. */
export const fetchAffiliate = async (): Promise<Affiliate | null> => {
  try {
    return await v1<Affiliate>("/affiliate");
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
};

export const useAffiliate = (enabled = true) =>
  useQuery([QueryKeys.AFFILIATE], fetchAffiliate, {
    enabled,
    retry,
    staleTime: 30000
  });

export const useAffiliateStats = (
  range: { from: string; to: string },
  enabled = true
) =>
  useQuery(
    [QueryKeys.AFFILIATE_STATS, range.from, range.to],
    () =>
      v1<AffiliateStats>("/affiliate/stats", {
        query: { from: range.from, to: range.to }
      }),
    { enabled, retry, keepPreviousData: true, staleTime: 60000 }
  );

export const useAffiliateCommissions = (page: number, enabled = true) =>
  useQuery(
    [QueryKeys.AFFILIATE_COMMISSIONS, page],
    () => v1<CommissionsPage>("/affiliate/commissions", { query: { page } }),
    { enabled, retry, keepPreviousData: true, staleTime: 60000 }
  );

export const useAffiliatePayouts = (enabled = true) =>
  useQuery(
    [QueryKeys.AFFILIATE_PAYOUTS],
    () => v1<PayoutsResponse>("/affiliate/payouts"),
    { enabled, retry, staleTime: 60000 }
  );

/** Live availability of a code; idle until the code is well-formed. */
export const useAffiliateCodeAvailable = (rawCode: string) => {
  const code = normalizeRefCode(rawCode);
  return useQuery(
    [QueryKeys.AFFILIATE_CODE_AVAILABLE, code],
    () =>
      v1<{ available: boolean }>("/affiliate/code_available", {
        query: { code }
      }),
    { enabled: !!code, retry: false, staleTime: 60000 }
  );
};

const useInvalidateAffiliate = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries(QueryKeys.AFFILIATE);
    queryClient.invalidateQueries(QueryKeys.AFFILIATE_STATS);
  };
};

export const useApplyAffiliate = () => {
  const invalidate = useInvalidateAffiliate();
  return useMutation(
    (input: AffiliateApplyInput) =>
      v1<Affiliate>("/affiliate", { method: "POST", body: input }),
    { onSuccess: invalidate }
  );
};

export const useUpdateAffiliate = () => {
  const invalidate = useInvalidateAffiliate();
  return useMutation(
    (input: AffiliateUpdateInput) =>
      v1<Affiliate>("/affiliate", { method: "PATCH", body: input }),
    { onSuccess: invalidate }
  );
};
