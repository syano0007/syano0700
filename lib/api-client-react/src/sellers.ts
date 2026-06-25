import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/* ── Types ───────────────────────────────────────────────────── */

export interface StoreStats {
  totalProducts: number;
  averageRating: number | null;
  reviewCount: number;
  totalOrders: number;
  completionRate: number;
  totalRevenue: number;
  followerCount: number;
  sellerScore: number | null;
  sellerReviewCount: number;
}

export interface StoreProfile extends StoreStats {
  sellerId: number;
  storeName: string;
  storeSlug: string | null;
  storeDescription: string | null;
  storeLogo: string | null;
  storeBanner: string | null;
  categories: string[];
  city: string | null;
  website: string | null;
  socialLinks: string | null;
  sellerName: string;
  trustLevel: string;
  verifiedAt: string | null;
  memberSince: string;
}

export interface StorePreview {
  sellerId: number;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string | null;
  trustLevel: string;
  verifiedAt: string | null;
  memberSince: string;
  averageRating: number | null;
  reviewCount: number;
  followerCount: number;
}

export interface FollowStatus {
  following: boolean;
  followerCount: number;
}

export interface FollowingStore {
  sellerId: number;
  storeName: string | null;
  storeSlug: string | null;
  storeLogo: string | null;
  trustLevel: string;
  verifiedAt: string | null;
  followedAt: string;
}

export interface SellerReview {
  id: number;
  customerId: number;
  customerName: string;
  communicationRating: number;
  shippingRating: number;
  professionalismRating: number;
  comment: string | null;
  createdAt: string;
  sellerReply: string | null;
  sellerReplyAt: string | null;
  sellerReplyUpdatedAt: string | null;
}

export interface SellerReviewSummary {
  total: number;
  overallScore: number | null;
  avgCommunication: number | null;
  avgShipping: number | null;
  avgProfessionalism: number | null;
  repliedCount: number;
  responseRate: number;
}

export interface PatchSellerReviewReplyBody {
  reply: string | null;
}

export interface SellerReviewsResponse {
  reviews: SellerReview[];
  summary: SellerReviewSummary;
}

export interface PostSellerReviewBody {
  communicationRating: number;
  shippingRating: number;
  professionalismRating: number;
  comment?: string;
}

export interface SellerAnalytics {
  period: { days: number };
  revenueByDay: { day: string; revenue: number }[];
  topProducts: { productId: number; productName: string; revenue: number; unitsSold: number }[];
  topViewedProducts: { id: number; name: string; viewCount: number }[];
  followerGrowth: { day: string; newFollowers: number }[];
}

/* ── Store Profile ───────────────────────────────────────────── */

export const getStoreProfileUrl = (slug: string) =>
  `/api/sellers/store/${encodeURIComponent(slug)}` as const;

export const getStoreProfileQueryKey = (slug: string) =>
  [getStoreProfileUrl(slug)] as const;

export const getStoreProfile = async (
  slug: string,
  options?: RequestInit
): Promise<StoreProfile> =>
  customFetch<StoreProfile>(getStoreProfileUrl(slug), { ...options, method: "GET" });

export function useGetStoreProfile<TData = StoreProfile, TError = ErrorType<unknown>>(
  slug: string,
  options?: { query?: UseQueryOptions<StoreProfile, TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getStoreProfileQueryKey(slug);
  const queryFn: QueryFunction<StoreProfile> = ({ signal }) =>
    getStoreProfile(slug, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!slug, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Store Preview (by seller ID) ───────────────────────────── */

export const getStorePreviewUrl = (sellerId: number) =>
  `/api/sellers/${sellerId}/store-preview` as const;

export const getStorePreviewQueryKey = (sellerId: number) =>
  [getStorePreviewUrl(sellerId)] as const;

export const getStorePreview = async (
  sellerId: number,
  options?: RequestInit
): Promise<StorePreview> =>
  customFetch<StorePreview>(getStorePreviewUrl(sellerId), { ...options, method: "GET" });

export function useGetStorePreview<TData = StorePreview, TError = ErrorType<unknown>>(
  sellerId: number,
  options?: { query?: UseQueryOptions<StorePreview, TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getStorePreviewQueryKey(sellerId);
  const queryFn: QueryFunction<StorePreview> = ({ signal }) =>
    getStorePreview(sellerId, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!sellerId, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Follow Status ───────────────────────────────────────────── */

export const getFollowStatusUrl = (sellerId: number) =>
  `/api/sellers/${sellerId}/follow-status` as const;

export const getFollowStatusQueryKey = (sellerId: number) =>
  [getFollowStatusUrl(sellerId)] as const;

export const getFollowStatus = async (
  sellerId: number,
  options?: RequestInit
): Promise<FollowStatus> =>
  customFetch<FollowStatus>(getFollowStatusUrl(sellerId), { ...options, method: "GET" });

export function useGetFollowStatus<TData = FollowStatus, TError = ErrorType<unknown>>(
  sellerId: number,
  options?: { query?: UseQueryOptions<FollowStatus, TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getFollowStatusQueryKey(sellerId);
  const queryFn: QueryFunction<FollowStatus> = ({ signal }) =>
    getFollowStatus(sellerId, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!sellerId, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Follow Store ────────────────────────────────────────────── */

type FollowStoreMutationResult = FollowStatus;

export const followStore = async (sellerId: number): Promise<FollowStoreMutationResult> =>
  customFetch<FollowStoreMutationResult>(`/api/sellers/${sellerId}/follow`, { method: "POST" });

export const getFollowStoreMutationOptions = (
  options?: UseMutationOptions<FollowStoreMutationResult, ErrorType<unknown>, number>
): UseMutationOptions<FollowStoreMutationResult, ErrorType<unknown>, number> => ({
  mutationFn: (sellerId: number) => followStore(sellerId),
  ...options,
});

export function useFollowStore(
  options?: UseMutationOptions<FollowStoreMutationResult, ErrorType<unknown>, number>
): UseMutationResult<FollowStoreMutationResult, ErrorType<unknown>, number> {
  const qc = useQueryClient();
  return useMutation({
    ...getFollowStoreMutationOptions(options),
    onSuccess: (data, sellerId, ctx, mutation) => {
      qc.setQueryData(getFollowStatusQueryKey(sellerId), data);
      options?.onSuccess?.(data, sellerId, ctx, mutation);
    },
  });
}

/* ── Unfollow Store ──────────────────────────────────────────── */

export const unfollowStore = async (sellerId: number): Promise<FollowStatus> =>
  customFetch<FollowStatus>(`/api/sellers/${sellerId}/follow`, { method: "DELETE" });

export function useUnfollowStore(
  options?: UseMutationOptions<FollowStatus, ErrorType<unknown>, number>
): UseMutationResult<FollowStatus, ErrorType<unknown>, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sellerId: number) => unfollowStore(sellerId),
    onSuccess: (data, sellerId, ctx, mutation) => {
      qc.setQueryData(getFollowStatusQueryKey(sellerId), data);
      options?.onSuccess?.(data, sellerId, ctx, mutation);
    },
    ...options,
  });
}

/* ── Following Stores ────────────────────────────────────────── */

export const getFollowingStoresQueryKey = () => ["/api/me/following-stores"] as const;

export const getFollowingStores = async (options?: RequestInit): Promise<FollowingStore[]> =>
  customFetch<FollowingStore[]>("/api/me/following-stores", { ...options, method: "GET" });

export function useGetFollowingStores<TData = FollowingStore[], TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<FollowingStore[], TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getFollowingStoresQueryKey();
  const queryFn: QueryFunction<FollowingStore[]> = ({ signal }) =>
    getFollowingStores({ signal, ...request });
  const query = useQuery({ queryKey, queryFn, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Seller Reviews ──────────────────────────────────────────── */

export const getSellerReviewsUrl = (sellerId: number) =>
  `/api/sellers/${sellerId}/reviews` as const;

export const getSellerReviewsQueryKey = (sellerId: number) =>
  [getSellerReviewsUrl(sellerId)] as const;

export const getSellerReviews = async (
  sellerId: number,
  options?: RequestInit
): Promise<SellerReviewsResponse> =>
  customFetch<SellerReviewsResponse>(getSellerReviewsUrl(sellerId), { ...options, method: "GET" });

export function useGetSellerReviews<TData = SellerReviewsResponse, TError = ErrorType<unknown>>(
  sellerId: number,
  options?: { query?: Partial<UseQueryOptions<SellerReviewsResponse, TError, TData>>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSellerReviewsQueryKey(sellerId);
  const queryFn: QueryFunction<SellerReviewsResponse> = ({ signal }) =>
    getSellerReviews(sellerId, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!sellerId, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Post Seller Review ──────────────────────────────────────── */

export const postSellerReview = async (
  sellerId: number,
  body: PostSellerReviewBody
): Promise<SellerReview> =>
  customFetch<SellerReview>(`/api/sellers/${sellerId}/reviews`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export function usePostSellerReview(
  sellerId: number,
  options?: UseMutationOptions<SellerReview, ErrorType<unknown>, PostSellerReviewBody>
): UseMutationResult<SellerReview, ErrorType<unknown>, PostSellerReviewBody> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => postSellerReview(sellerId, body),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: getSellerReviewsQueryKey(sellerId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

/* ── Patch Seller Review Reply ───────────────────────────────── */

export const patchSellerReviewReply = async (
  reviewId: number,
  body: PatchSellerReviewReplyBody
): Promise<SellerReview> =>
  customFetch<SellerReview>(`/api/sellers/reviews/${reviewId}/reply`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export function usePatchSellerReviewReply(
  sellerId: number,
  options?: UseMutationOptions<SellerReview, ErrorType<unknown>, { reviewId: number; reply: string | null }>
): UseMutationResult<SellerReview, ErrorType<unknown>, { reviewId: number; reply: string | null }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reply }) => patchSellerReviewReply(reviewId, { reply }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: getSellerReviewsQueryKey(sellerId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

/* ── Seller Review Status ────────────────────────────────────── */

export interface SellerReviewStatus {
  eligible: boolean;
  alreadyReviewed: boolean;
  deliveredOrderId: number | null;
  existingReview: {
    id: number;
    communicationRating: number;
    shippingRating: number;
    professionalismRating: number;
    comment: string | null;
    createdAt: string;
  } | null;
}

export const getSellerReviewStatusUrl = (sellerId: number) =>
  `/api/sellers/${sellerId}/review-status` as const;

export const getSellerReviewStatusQueryKey = (sellerId: number) =>
  [getSellerReviewStatusUrl(sellerId)] as const;

export const getSellerReviewStatus = async (
  sellerId: number,
  options?: RequestInit
): Promise<SellerReviewStatus> =>
  customFetch<SellerReviewStatus>(getSellerReviewStatusUrl(sellerId), { ...options, method: "GET" });

export function useGetSellerReviewStatus<TData = SellerReviewStatus, TError = ErrorType<unknown>>(
  sellerId: number,
  options?: { query?: UseQueryOptions<SellerReviewStatus, TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSellerReviewStatusQueryKey(sellerId);
  const queryFn: QueryFunction<SellerReviewStatus> = ({ signal }) =>
    getSellerReviewStatus(sellerId, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, enabled: !!sellerId, ...queryOptions });
  return { ...query, queryKey };
}

/* ── Seller Analytics ────────────────────────────────────────── */

export const getSellerAnalyticsUrl = (days?: number) =>
  `/api/dashboard/seller/analytics${days ? `?days=${days}` : ""}` as const;

export const getSellerAnalyticsQueryKey = (days?: number) =>
  [getSellerAnalyticsUrl(days)] as const;

export const getSellerAnalytics = async (
  days?: number,
  options?: RequestInit
): Promise<SellerAnalytics> =>
  customFetch<SellerAnalytics>(getSellerAnalyticsUrl(days), { ...options, method: "GET" });

export function useGetSellerAnalytics<TData = SellerAnalytics, TError = ErrorType<unknown>>(
  days?: number,
  options?: { query?: UseQueryOptions<SellerAnalytics, TError, TData>; request?: RequestInit }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSellerAnalyticsQueryKey(days);
  const queryFn: QueryFunction<SellerAnalytics> = ({ signal }) =>
    getSellerAnalytics(days, { signal, ...request });
  const query = useQuery({ queryKey, queryFn, ...queryOptions });
  return { ...query, queryKey };
}
