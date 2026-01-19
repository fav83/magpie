import { Helmet } from 'react-helmet-async';

interface PageHelmetProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
}

const siteUrl = import.meta.env.VITE_SITE_URL || 'https://magpie.example.com';

export function PageHelmet({ title, description, path = '', image }: PageHelmetProps) {
  const fullTitle = title.includes('Magpie') ? title : `${title} | Magpie`;
  const canonicalUrl = `${siteUrl}${path}`;
  const imageUrl = image ? `${siteUrl}${image}` : `${siteUrl}/og-image.png`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:type" content="website" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
