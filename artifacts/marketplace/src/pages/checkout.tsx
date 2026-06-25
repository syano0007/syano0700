import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCart, usePlaceOrder, useClearCart, getGetCartQueryKey, useGetDeliveryZones } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Truck, CheckCircle2, Phone, ShieldCheck, Star, MapPin, FileText,
  ChevronLeft, ChevronRight, Package, ArrowRight, User, Navigation, Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { useLocationContext } from "@/contexts/LocationContext";
import { LocationMapModal } from "@/components/LocationMapModal";

type Step = 1 | 2 | 3;

const STEP_KEYS = [
  { id: 1, key: "checkout.step_review" },
  { id: 2, key: "checkout.step_delivery" },
  { id: 3, key: "checkout.step_payment" },
] as const;

export default function Checkout() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { format } = useCurrency();

  const { location } = useLocationContext();

  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [successOrder, setSuccessOrder] = useState<{ id: number; total: number } | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  /* Hydrate zone from global location context on first render */
  useEffect(() => {
    if (selectedZoneId == null && location.zoneId != null) {
      setSelectedZoneId(location.zoneId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep zone in sync when the map modal fires from within checkout */
  useEffect(() => {
    const handler = (e: Event) => {
      const { zoneId } = (e as CustomEvent<{ zoneId: number | null }>).detail;
      if (zoneId != null) setSelectedZoneId(zoneId);
    };
    window.addEventListener("syano:location-updated", handler);
    return () => window.removeEventListener("syano:location-updated", handler);
  }, []);

  const { data: zones = [] } = useGetDeliveryZones();
  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;

  const { data: cart, isLoading } = useGetCart({ query: { queryKey: getGetCartQueryKey() } });

  const clearCart = useClearCart({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
  });

  const placeOrder = usePlaceOrder({
    mutation: {
      onSuccess: (order) => {
        setSuccessOrder({ id: order.id, total: order.total });
        clearCart.mutate();
      },
      onError: () => {
        toast({ title: t("checkout.order_failed"), description: t("checkout.order_failed_desc"), variant: "destructive" });
      }
    }
  });

  const handleNextStep = () => {
    if (step === 2) {
      if (!fullName.trim()) {
        toast({ title: t("checkout.name_required"), description: t("checkout.name_required_desc"), variant: "destructive" });
        return;
      }
      if (!phone.trim() || phone.trim().length < 6) {
        toast({ title: t("checkout.phone_required"), description: t("checkout.phone_required_desc"), variant: "destructive" });
        return;
      }
      if (!selectedZoneId) {
        toast({ title: t("checkout.zone_required"), description: t("checkout.zone_required_desc"), variant: "destructive" });
        return;
      }
      if (!address.trim()) {
        toast({ title: t("checkout.address_required"), description: t("checkout.address_required_desc"), variant: "destructive" });
        return;
      }
    }
    setStep((s) => (s < 3 ? (s + 1) as Step : s));
  };

  const handleSubmit = () => {
    const cityFromZone = selectedZone
      ? (lang === "ar" ? selectedZone.nameAr : selectedZone.nameEn)
      : "";
    placeOrder.mutate({
      data: {
        shippingAddress: address,
        customerPhone: phone.trim(),
        city: cityFromZone,
        deliveryNotes: notes.trim() || undefined,
        zoneId: selectedZoneId,
      }
    });
  };

  if (successOrder) {
    return (
      <Layout>
        <div className="container flex-1 flex items-center justify-center py-12 md:py-20 px-4">
          <div className="max-w-lg w-full text-center">
            <div className="relative mx-auto mb-6 h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-30" />
              <div className="relative h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("checkout.success_title")}</h1>
            <p className="text-muted-foreground mb-1">
              {t("checkout.order_confirmed", { id: successOrder.id })}
            </p>
            <p className="text-muted-foreground mb-6 text-sm">{t("checkout.success_desc")}</p>

            <div className="bg-card border rounded-xl p-5 mb-6 text-start space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkout.order_total")}</span>
                <span className="font-bold text-lg" translate="no">{format(successOrder.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkout.payment_method")}</span>
                <span className="font-medium">{t("checkout.demo_gateway")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkout.est_delivery")}</span>
                <span className="font-medium">{t("checkout.est_delivery_range")}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <p>{t("checkout.cod_note")}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setLocation("/orders")} className="flex-1 h-12 text-base font-semibold">
                <Package className="me-2 h-4 w-4" />
                {t("checkout.view_orders")}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/shop")} className="flex-1 h-12">
                {t("checkout.continue_shopping")}
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading || !cart || cart.items.length === 0) {
    if (!isLoading && (!cart || cart.items.length === 0)) setLocation("/cart");
    return (
      <Layout>
        <div className="container py-12 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 md:py-10 max-w-5xl">
        <h1 className="heading-section mb-6">{t("checkout.title")}</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEP_KEYS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <button
                className="flex flex-col items-center gap-1 flex-1"
                onClick={() => step > s.id && setStep(s.id as Step)}
                disabled={step <= s.id}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                    ? "bg-primary/10 text-primary border-2 border-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:block",
                  step >= s.id ? "text-foreground" : "text-muted-foreground"
                )}>
                  {t(s.key)}
                </span>
              </button>
              {idx < STEP_KEYS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2", step > s.id ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Left: Step content */}
          <div className="flex-1 w-full">

            {/* Step 1: Order Review */}
            {step === 1 && (
              <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b bg-muted/20">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    {t("checkout.review_title")}
                  </h2>
                </div>
                <div className="divide-y">
                  {cart.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-4 p-4 sm:p-5">
                      <div className="h-16 w-16 bg-muted rounded-lg border overflow-hidden shrink-0">
                        {((item as any).variantImageUrl || item.product.imageUrl)
                          ? <img src={(item as any).variantImageUrl || item.product.imageUrl!} alt={item.product.name} className="h-full w-full object-cover" />
                          : <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug line-clamp-2">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("checkout.qty", { count: item.quantity })} · {t("checkout.sold_by", { seller: item.product.sellerName })}</p>
                        {(item as any).variantDetails?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((item as any).variantDetails as Array<{ name: string; value: string }>).map((d) => (
                              <span key={d.name} className="inline-flex items-center gap-0.5 text-[10px] bg-muted border border-border/50 px-1.5 py-0.5 rounded-md font-medium">
                                <span className="text-muted-foreground">{d.name}:</span>
                                <span className="ms-0.5">{d.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {item.stockWarning && (
                          <p className="text-xs text-amber-600 font-medium mt-0.5">⚠ {t("checkout.limited_stock")}</p>
                        )}
                      </div>
                      <div className="text-end shrink-0">
                        {item.product.discountPercent ? (
                          <>
                            <div className="font-bold text-sm" translate="no">{format(item.subtotal)}</div>
                            <div className="text-xs text-muted-foreground line-through" translate="no">{format(item.product.price * item.quantity)}</div>
                          </>
                        ) : (
                          <div className="font-bold text-sm" translate="no">{format(item.subtotal)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Delivery Info */}
            {step === 2 && (
              <div className="bg-card border rounded-xl p-5 md:p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  {t("checkout.shipping_info")}
                </h2>

                {/* ── Address preview / edit card ───────────────── */}
                <div className={cn(
                  "mb-5 rounded-xl border p-4 flex items-start justify-between gap-3",
                  selectedZone
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/40 border-dashed border-border"
                )}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Navigation className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                        {t("checkout.address_preview_title")}
                      </p>
                      {selectedZone ? (
                        <>
                          <p className="font-semibold text-sm text-foreground leading-snug">
                            {lang === "ar" ? selectedZone.nameAr : selectedZone.nameEn}
                          </p>
                          {location.latitude != null && location.longitude != null && (
                            <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                              {location.latitude.toFixed(5)}°N, {location.longitude.toFixed(5)}°E
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("checkout.no_location_set")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 gap-1.5 text-xs"
                    onClick={() => setLocationModalOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {selectedZone
                      ? t("checkout.edit_location")
                      : t("checkout.set_location")}
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      {t("checkout.full_name")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="fullName"
                        placeholder={t("checkout.full_name_placeholder")}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="ps-9 h-11"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      {t("checkout.phone_label")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={t("checkout.phone_placeholder")}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="ps-9 h-11"
                        autoComplete="tel"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("checkout.phone_hint")}</p>
                  </div>

                  {/* Delivery Zone */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      <Navigation className="inline h-4 w-4 me-1.5 text-muted-foreground" />
                      {t("checkout.zone_label")} <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedZoneId ? String(selectedZoneId) : ""}
                      onValueChange={(v) => setSelectedZoneId(parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder={t("checkout.zone_placeholder")} />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        sideOffset={4}
                        avoidCollisions={false}
                        className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain"
                      >
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={String(zone.id)} className="min-h-[40px] cursor-pointer">
                            {lang === "ar" ? zone.nameAr : zone.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedZone && (
                      <div className={cn(
                        "flex items-center gap-2 text-sm rounded-lg px-3 py-2 border",
                        selectedZone.fee > 0
                          ? "bg-primary/5 border-primary/20 text-foreground"
                          : "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                      )}>
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        {selectedZone.fee > 0 ? (
                          <span>{t("checkout.delivery_fee_label")}: <span className="font-semibold" translate="no">{format(selectedZone.fee)}</span></span>
                        ) : (
                          <span className="font-medium">{t("checkout.free_delivery")}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Detailed Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      {t("checkout.full_address")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="address"
                      placeholder={t("checkout.address_placeholder")}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="min-h-[90px] leading-relaxed resize-none"
                      autoComplete="street-address"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">
                      {t("checkout.notes_label")} <span className="text-xs text-muted-foreground font-normal">({t("checkout.notes_optional")})</span>
                    </Label>
                    <div className="relative">
                      <FileText className="absolute start-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Textarea
                        id="notes"
                        placeholder={t("checkout.notes_placeholder")}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="ps-9 min-h-[70px] leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="bg-card border rounded-xl p-5 md:p-6 shadow-sm space-y-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  {t("checkout.payment_details")}
                </h2>

                <div className="border rounded-xl p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t("checkout.demo_gateway")}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t("checkout.demo_desc")}</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-xl p-4 opacity-60 cursor-not-allowed">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t("checkout.online_payment")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("checkout.online_payment_soon")}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold">{t("checkout.delivery_summary")}</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="font-medium text-foreground">{fullName}</span></p>
                    <p translate="no">{phone}</p>
                    {selectedZone && (
                      <p className="flex items-center gap-1.5">
                        <Navigation className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="font-medium text-foreground">{lang === "ar" ? selectedZone.nameAr : selectedZone.nameEn}</span>
                        {selectedZone.fee > 0 && (
                          <span className="text-xs" translate="no">· {format(selectedZone.fee)}</span>
                        )}
                      </p>
                    )}
                    <p>{address}</p>
                    {notes && <p className="italic">"{notes}"</p>}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  {[
                    { icon: ShieldCheck, text: t("checkout.trust_secure") },
                    { icon: CheckCircle2, text: t("checkout.trust_sellers") },
                    { icon: Star, text: t("checkout.trust_reviews") },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-3 mt-6">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} className="h-11 gap-2 flex-1 sm:flex-none">
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("checkout.back")}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setLocation("/cart")} className="h-11 gap-2 flex-1 sm:flex-none">
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("checkout.back_to_cart")}
                </Button>
              )}

              {step < 3 ? (
                <Button onClick={handleNextStep} className="h-11 gap-2 flex-1 sm:flex-none sm:min-w-[140px]">
                  {t("checkout.continue")} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="h-11 gap-2 flex-1 sm:flex-none sm:min-w-[180px] font-semibold"
                  disabled={placeOrder.isPending}
                >
                  {placeOrder.isPending
                    ? t("checkout.processing")
                    : t("checkout.pay", { amount: format(cart.total) })}
                  {!placeOrder.isPending && <ArrowRight className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Right: Order summary */}
          <div className="hidden lg:block w-96 space-y-4 sticky top-24">
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <h3 className="text-base font-bold mb-4">{t("checkout.order_summary")}</h3>

              <div className="space-y-2.5 mb-4 max-h-[200px] overflow-auto pe-1">
                {cart.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 text-sm">
                    <div className="h-10 w-10 bg-muted rounded-lg border overflow-hidden shrink-0">
                      {item.product.imageUrl && <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1 text-xs leading-snug">{item.product.name}</p>
                      <p className="text-muted-foreground text-xs">×{item.quantity}</p>
                    </div>
                    <div className="font-semibold text-xs shrink-0" translate="no">{format(item.subtotal)}</div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("checkout.subtotal")}</span>
                  <span className="font-medium text-foreground" translate="no">{format(cart.subtotal)}</span>
                </div>
                {cart.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("checkout.discount")}</span>
                    <span className="font-medium" translate="no">–{format(cart.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("checkout.shipping")}</span>
                  {selectedZone && selectedZone.fee > 0
                    ? <span className="font-medium text-foreground" translate="no">{format(selectedZone.fee)}</span>
                    : <span>{t("checkout.free")}</span>
                  }
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t text-foreground">
                  <span>{t("checkout.total")}</span>
                  <span translate="no">{format(cart.total + (selectedZone?.fee ?? 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LocationMapModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </Layout>
  );
}
