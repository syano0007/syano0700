import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface DeliveryZone {
  id: number;
  nameEn: string;
  nameAr: string;
  fee: number;
}

export const getDeliveryZonesQueryKey = () => ["getDeliveryZones"] as const;

export function useGetDeliveryZones(
  options?: Omit<UseQueryOptions<DeliveryZone[], unknown, DeliveryZone[], ReturnType<typeof getDeliveryZonesQueryKey>>, "queryKey" | "queryFn">
): UseQueryResult<DeliveryZone[], unknown> {
  return useQuery({
    queryKey: getDeliveryZonesQueryKey(),
    queryFn: () => customFetch<DeliveryZone[]>("/api/delivery-zones", { method: "GET" }),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}
