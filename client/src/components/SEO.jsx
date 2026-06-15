import { useEffect } from 'react';

export const BASE_URL = 'https://www.zappyone.com';

function setMeta(name, content, prop = false) {
  if (!content) return;
  const attr = prop ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id, data) {
  let el = document.querySelector(`script[data-seo="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-seo', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id) {
  const el = document.querySelector(`script[data-seo="${id}"]`);
  if (el) el.remove();
}

export default function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noIndex = false,
  jsonLd,
  keywords,
}) {
  useEffect(() => {
    const prevTitle = document.title;

    if (title) document.title = title;

    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('og:title', title || document.title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', canonical, true);
    setMeta('og:image', ogImage || `${BASE_URL}/og-default.jpg`, true);
    setMeta('og:site_name', 'Zappy', true);
    setMeta('og:locale', 'en_IN', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title || document.title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage || `${BASE_URL}/og-default.jpg`);
    setMeta('twitter:site', '@zappyone');
    setMeta('robots', noIndex ? 'noindex,nofollow' : 'index,follow,max-snippet:-1,max-image-preview:large');

    setLink('canonical', canonical);

    const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    schemas.forEach((schema, i) => setJsonLd(`page-${i}`, schema));

    return () => {
      document.title = prevTitle;
      schemas.forEach((_, i) => removeJsonLd(`page-${i}`));
    };
  }, [title, description, canonical, ogImage, ogType, noIndex, jsonLd, keywords]);

  return null;
}

/* ─── Pre-built schemas for common pages ───────────────────────────────── */

export const HOME_SCHEMA = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}/#webpage`,
    name: 'Zappy — Instant Home Services India',
    url: BASE_URL,
    description: 'Book verified professionals instantly for 100+ home services across India. Arrive in 30 minutes.',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    about: { '@id': `${BASE_URL}/#organization` },
    inLanguage: 'en-IN',
  },
];

export const PLANS_SCHEMA = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Zappy Premium Plans — Surge Protection, Cashback & Priority Booking',
    url: `${BASE_URL}/plans`,
    description: 'Upgrade to Zappy Premium for zero surge pricing, higher cashback, zero platform fees, and priority worker assignment.',
    isPartOf: { '@id': `${BASE_URL}/#website` },
    inLanguage: 'en-IN',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Zappy Subscription Plans',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Zappy Free',
        description: 'Basic access to all Zappy services with standard pricing and 5% wallet cashback.',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Zappy Gold',
        description: 'Priority booking, higher cashback, reduced platform fees, surge cap protection.',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Zappy Platinum',
        description: 'No surge pricing ever, zero platform fees, maximum cashback, express dispatch.',
      },
    ],
  },
];

export function serviceSchema(serviceName, serviceDesc, minPrice, maxPrice) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: serviceName,
      description: serviceDesc,
      provider: { '@id': `${BASE_URL}/#organization` },
      areaServed: { '@type': 'Country', 'name': 'India' },
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: BASE_URL,
        availableLanguage: ['English', 'Hindi', 'Telugu'],
      },
      ...(minPrice != null && {
        offers: {
          '@type': 'Offer',
          priceCurrency: 'INR',
          priceSpecification: {
            '@type': 'PriceSpecification',
            minPrice,
            maxPrice,
            priceCurrency: 'INR',
          },
        },
      }),
    },
  ];
}
