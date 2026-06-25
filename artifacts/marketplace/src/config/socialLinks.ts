export interface SocialLink {
  key: string;
  platform: string;
  href: string;
  handle: string;
  hoverColor: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    key: "fb",
    platform: "Facebook",
    href: "https://www.facebook.com/SyanoMarket",
    handle: "SyanoMarket",
    hoverColor: "#1877F2",
  },
  {
    key: "ig",
    platform: "Instagram",
    href: "https://www.instagram.com/syano.market/",
    handle: "@syano.market",
    hoverColor: "#E1306C",
  },
  {
    key: "x",
    platform: "X (Twitter)",
    href: "https://x.com/Syanomarket",
    handle: "@Syanomarket",
    hoverColor: "#E7E9EA",
  },
  {
    key: "tg",
    platform: "Telegram",
    href: "https://t.me/+chFQsTQLhKthZmY0",
    handle: "Syano",
    hoverColor: "#26A5E4",
  },
  {
    key: "wa",
    platform: "WhatsApp",
    href: "https://chat.whatsapp.com/B7NFVFWglpX0OoLhFj9R2m",
    handle: "Syano Group",
    hoverColor: "#25D366",
  },
];

export default SOCIAL_LINKS;
