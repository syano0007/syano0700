import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { AppNotification, NotificationCount, MessageResponse } from "./generated/api.schemas";

/* ────────────────────────────────────────────────
   List Notifications
──────────────────────────────────────────────── */

export const getListNotificationsUrl = () => `/api/notifications` as const;
export const getListNotificationsQueryKey = () => [getListNotificationsUrl()] as const;

export const listNotifications = async (options?: RequestInit): Promise<AppNotification[]> =>
  customFetch<AppNotification[]>(getListNotificationsUrl(), { ...options, method: "GET" });

export function useListNotifications<
  TData = AppNotification[],
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: Partial<UseQueryOptions<AppNotification[], TError, TData>>;
    request?: RequestInit;
  }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getListNotificationsQueryKey();
  const queryFn: QueryFunction<AppNotification[]> = ({ signal }) =>
    listNotifications({ signal, ...request });
  const query = useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

/* ────────────────────────────────────────────────
   Get Notification Count
──────────────────────────────────────────────── */

export const getGetNotificationCountUrl = () => `/api/notifications/count` as const;
export const getGetNotificationCountQueryKey = () =>
  [getGetNotificationCountUrl()] as const;

export const getNotificationCount = async (
  options?: RequestInit
): Promise<NotificationCount> =>
  customFetch<NotificationCount>(getGetNotificationCountUrl(), {
    ...options,
    method: "GET",
  });

export function useGetNotificationCount<
  TData = NotificationCount,
  TError = ErrorType<unknown>,
>(
  options?: {
    query?: Partial<UseQueryOptions<NotificationCount, TError, TData>>;
    request?: RequestInit;
  }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetNotificationCountQueryKey();
  const queryFn: QueryFunction<NotificationCount> = ({ signal }) =>
    getNotificationCount({ signal, ...request });
  const query = useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

/* ────────────────────────────────────────────────
   Mark Single Notification Read
──────────────────────────────────────────────── */

export const getMarkNotificationReadUrl = (id: number) =>
  `/api/notifications/${id}/read` as const;

export const markNotificationRead = async (
  id: number,
  options?: RequestInit
): Promise<AppNotification> =>
  customFetch<AppNotification>(getMarkNotificationReadUrl(id), {
    ...options,
    method: "POST",
  });

export type MarkNotificationReadMutationVariables = { id: number };

export const getMarkNotificationReadMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<
      AppNotification,
      TError,
      MarkNotificationReadMutationVariables,
      TContext
    >;
  }
): UseMutationOptions<
  AppNotification,
  TError,
  MarkNotificationReadMutationVariables,
  TContext
> => {
  const { mutation: mutationOptions } = options ?? {};
  const mutationFn: MutationFunction<
    AppNotification,
    MarkNotificationReadMutationVariables
  > = ({ id }) => markNotificationRead(id);
  return { mutationFn, ...mutationOptions };
};

export function useMarkNotificationRead<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<
      AppNotification,
      TError,
      MarkNotificationReadMutationVariables,
      TContext
    >;
  }
): UseMutationResult<
  AppNotification,
  TError,
  MarkNotificationReadMutationVariables,
  TContext
> {
  return useMutation(getMarkNotificationReadMutationOptions(options));
}

/* ────────────────────────────────────────────────
   Mark All Notifications Read
──────────────────────────────────────────────── */

export const getMarkAllNotificationsReadUrl = () =>
  `/api/notifications/read-all` as const;

export const markAllNotificationsRead = async (
  options?: RequestInit
): Promise<MessageResponse> =>
  customFetch<MessageResponse>(getMarkAllNotificationsReadUrl(), {
    ...options,
    method: "POST",
  });

export const getMarkAllNotificationsReadMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<MessageResponse, TError, void, TContext>;
  }
): UseMutationOptions<MessageResponse, TError, void, TContext> => {
  const { mutation: mutationOptions } = options ?? {};
  const mutationFn: MutationFunction<MessageResponse, void> = () =>
    markAllNotificationsRead();
  return { mutationFn, ...mutationOptions };
};

export function useMarkAllNotificationsRead<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: {
    mutation?: UseMutationOptions<MessageResponse, TError, void, TContext>;
  }
): UseMutationResult<MessageResponse, TError, void, TContext> {
  return useMutation(getMarkAllNotificationsReadMutationOptions(options));
}
