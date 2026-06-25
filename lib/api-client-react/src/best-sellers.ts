import { useQuery } from "@tanstack/react-query";
import type {
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface BestSellerProduct {
  id: number;
  sellerId: number;
  sellerName: string;
  name: string;
  description: string;
  price: number;
  discountPercent: number | null;
  finalPrice: number;
  category: string;
  subcategory: string | null;
  stock: number;
  imageUrl: string | null;
  imageUrls?: string[] | null;
  createdAt: string;
  averageRating: number | null;
  reviewCount: number;
  salesCount: number;
  featured: boolean;
  isBestDeal?: boolean;
  storeName?: string | null;
  nameAr?: string | null;
  hasVariants?: boolean;
}

export const getGetBestSellersUrl = (limit = 8) =>
  `/api/products/best-sellers?limit=${limit}` as const;

export const getGetBestSellersQueryKey = (limit = 8) =>
  [getGetBestSellersUrl(limit)] as const;

export const getBestSellers = async (
  limit = 8,
  options?: RequestInit
): Promise<BestSellerProduct[]> =>
  customFetch<BestSellerProduct[]>(getGetBestSellersUrl(limit), {
    ...options,
    method: "GET",
  });

export function useGetBestSellers<
  TData = BestSellerProduct[],
  TError = ErrorType<unknown>,
>(
  limit = 8,
  options?: {
    query?: UseQueryOptions<BestSellerProduct[], TError, TData>;
    request?: RequestInit;
  }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions, request } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetBestSellersQueryKey(limit);
  const queryFn: QueryFunction<BestSellerProduct[]> = ({ signal }) =>
    getBestSellers(limit, { signal, ...request });
  const query = useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}
