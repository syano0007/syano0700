import { Helmet } from "react-helmet-async";

const SITE_NAME = "SYANO — سوق سوريا";
const SITE_URL  = "https://syanomarket.online";

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
}

export default function SEO({
  title,
  description,
  image,
  url,
  type = "website",
  noindex = false,
}: SEOProps) {
  const fullTitle = title.includes("SYANO")
    ? title
    : `${title} | ${SITE_NAME}`;
  const canonicalUrl  = url ?? (typeof window !== "undefined" ? window.location.href : SITE_URL);
  const ogImage       = image ?? "/og-default.jpg";
  const robotsContent = noindex ? "noindex,nofollow" : "index,follow";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description"        content={description} />
      <meta name="robots"             content={robotsContent} />
      <link rel="canonical"           href={canonicalUrl} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:url"         content={canonicalUrl} />
      <meta property="og:type"        content={type} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={ogImage} />
    </Helmet>
  );
}
