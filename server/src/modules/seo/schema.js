/**
 * JSON-LD Schema generators — Organization, LocalBusiness, Service,
 * FAQPage, HowTo, BreadcrumbList, SiteLinksSearchBox, Speakable.
 *
 * All functions return plain objects; call JSON.stringify() when embedding.
 */

const BASE_URL = process.env.PUBLIC_URL || 'https://www.zappyone.com';

function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Zappy',
    alternateName: 'Zappy Services',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    description: "India's fastest on-demand service platform. Book verified professionals for mobile repair, bike puncture, electricians, plumbers, and birthday decorations.",
    foundingDate: '2024',
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English', 'Hindi', 'Telugu', 'Kannada', 'Tamil'],
    },
    sameAs: [
      'https://play.google.com/store/apps/details?id=com.zappy.app',
      'https://apps.apple.com/in/app/zappy',
    ],
  };
}

function siteLinksSearchBox() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function localBusiness(city, category) {
  const base = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${BASE_URL}/in/${city.slug}${category ? `/${category.slug}` : ''}#localbusiness`,
    name: category ? `Zappy ${category.name} in ${city.name}` : `Zappy ${city.name}`,
    description: category
      ? category.descTemplate(city.name)
      : `Zappy connects you with verified home service professionals in ${city.name}. Mobile repair, bike puncture, electricians, plumbers, and more — available 24/7.`,
    url: `${BASE_URL}/in/${city.slug}${category ? `/${category.slug}` : ''}`,
    telephone: '+91-8000-ZAPPY1',
    priceRange: category ? category.startingPrice : '₹149–₹9999',
    image: `${BASE_URL}/og-image.jpg`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city.name,
      addressRegion: city.state,
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: city.lat,
      longitude: city.lng,
    },
    areaServed: {
      '@type': 'City',
      name: city.name,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      reviewCount: '2840',
      bestRating: '5',
    },
  };
  return base;
}

function serviceSchema(city, category) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${category.name} in ${city.name}`,
    description: category.descTemplate(city.name),
    url: `${BASE_URL}/in/${city.slug}/${category.slug}`,
    provider: {
      '@type': 'Organization',
      name: 'Zappy',
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'City',
      name: city.name,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${category.plural} in ${city.name}`,
      itemListElement: category.features.map((f, i) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: f,
        },
        position: i + 1,
      })),
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: category.startingPrice.replace('₹', '').replace(',', ''),
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'INR',
        minPrice: category.startingPrice.replace('₹', '').replace(',', ''),
      },
    },
    serviceType: category.name,
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: `${BASE_URL}/in/${city.slug}/${category.slug}`,
      servicePhone: '+91-8000-ZAPPY1',
      availableLanguage: ['English', 'Hindi'],
    },
  };
}

function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}

function howToSchema(howTo, city, category) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: `Step-by-step guide to book ${category.name} in ${city.name} through Zappy.`,
    totalTime: `PT${category.avgTime.replace(/\D/g, '')}M`,
    supply: category.features.map(f => ({ '@type': 'HowToSupply', name: f })),
    step: howTo.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(({ name, url }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${BASE_URL}${url}`,
    })),
  };
}

function speakable(headline, summary) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: headline,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['[data-speakable="true"]'],
    },
    description: summary,
  };
}

module.exports = {
  BASE_URL,
  organization,
  siteLinksSearchBox,
  localBusiness,
  serviceSchema,
  faqSchema,
  howToSchema,
  breadcrumbSchema,
  speakable,
};
