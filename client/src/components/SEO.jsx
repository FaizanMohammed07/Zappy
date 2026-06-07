import { useEffect } from 'react';

const BASE_URL = 'https://www.zappyone.com';

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

/**
 * SEO — React meta tag injector for SPA pages.
 *
 * Props:
 *   title        — page <title> + og:title
 *   description  — meta description + og:description
 *   canonical    — canonical URL (full https://...)
 *   ogImage      — og:image URL
 *   ogType       — og:type (default "website")
 *   noIndex      — set true to add noindex,nofollow
 *   jsonLd       — array of JSON-LD objects to inject (or single object)
 */
export default function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noIndex = false,
  jsonLd,
}) {
  useEffect(() => {
    const prevTitle = document.title;

    if (title) document.title = title;

    setMeta('description', description);
    setMeta('og:title', title || document.title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', canonical, true);
    setMeta('og:image', ogImage || `${BASE_URL}/og-default.jpg`, true);
    setMeta('og:site_name', 'Zappy', true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title || document.title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage || `${BASE_URL}/og-default.jpg`);
    setMeta('robots', noIndex ? 'noindex,nofollow' : 'index,follow');

    setLink('canonical', canonical);

    const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    schemas.forEach((schema, i) => setJsonLd(`page-${i}`, schema));

    return () => {
      document.title = prevTitle;
      schemas.forEach((_, i) => removeJsonLd(`page-${i}`));
    };
  }, [title, description, canonical, ogImage, ogType, noIndex, jsonLd]);

  return null;
}
