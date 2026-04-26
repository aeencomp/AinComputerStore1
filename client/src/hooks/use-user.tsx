import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, customerAuthMeQueryFn, customerAuthMeQueryKey } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export type { User };

export function useUser() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: customerAuthMeQueryKey,
    queryFn: customerAuthMeQueryFn,
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/logout', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerAuthMeQueryKey });
    },
  });
}
