import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError, getGetMeQueryKey } from "@booking/api";

/**
 * One client for the app. A 401 anywhere means the session ended: forget the
 * user and go to sign-in, then come back here.
 */
export function createQueryClient(onSignedOut: () => void) {
  const handle = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(getGetMeQueryKey(), { user: null });
      onSignedOut();
    }
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(error instanceof ApiError) && count < 2,
      },
    },
  });
  return queryClient;
}
