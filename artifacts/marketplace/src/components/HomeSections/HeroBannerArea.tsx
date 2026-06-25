// @refresh reset
/**
 * HeroBannerArea — Cinematic hero slider with Amazon-2.0 gradient blend
 *
 * An absolute overlay gradient (not CSS mask) fades the bottom of the image
 * into the section background colour. This keeps the image fully composited
 * behind the frosted-glass cards, so backdrop-blur on the cards picks up the
 * real image colours rather than transparent alpha.
 */
import { HeroBannerCarousel } from "./HeroBannerCarousel";

export function HeroBannerArea() {
  return (
    <div className="w-full relative">
      {/* Carousel — full image, no mask */}
      <div className="overflow-hidden rounded-2xl">
        <HeroBannerCarousel heightClass="h-[200px] md:h-[320px] lg:h-[360px]" />
      </div>

      {/* Amazon-2.0 gradient overlay: transparent → section bg
          Sits on top of the image so the image stays composited behind cards */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none rounded-2xl
                   bg-gradient-to-b from-transparent from-[65%]
                   via-transparent via-[75%]
                   to-[#fcfdfe] to-[100%]
                   dark:to-neutral-950"
      />
    </div>
  );
}
