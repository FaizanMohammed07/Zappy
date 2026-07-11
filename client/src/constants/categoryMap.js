// Single source of truth for the 3D Helper character assets. Every surface that
// represents a service category (Home grid, sticky rail, All Services catalog,
// order history) reads from this map — never hardcode a per-page icon set.
export const categoryMap = [
  {
    id: 'phones', label: 'Phones', targetId: 'shelf-phones', catalogKey: 'mobile',
    img: '/images/characters/phone2.mp4', thumb: '/images/characters/thumb/phones.png',
    price: '₹99', tint: 'rgba(37, 99, 235, 0.1)', shadow: 'rgba(37, 99, 235, 0.18)',
  },
  {
    id: 'laptops', label: 'Laptops', targetId: 'shelf-laptops', catalogKey: null,
    img: '/images/characters/laptops2.mp4', thumb: '/images/characters/thumb/laptops.png',
    price: '₹149', tint: 'rgba(109, 77, 246, 0.1)', shadow: 'rgba(109, 77, 246, 0.18)',
  },
  {
    id: 'cars', label: 'Cars', targetId: 'shelf-cars', catalogKey: 'vehicle',
    img: '/images/characters/cars2.mp4', thumb: '/images/characters/thumb/cars.png',
    price: '₹199', tint: 'rgba(14, 165, 160, 0.1)', shadow: 'rgba(14, 165, 160, 0.18)',
  },
  {
    id: 'elders', label: 'Elders', targetId: 'shelf-elders', catalogKey: 'helper',
    img: '/images/characters/elders.mp4', thumb: '/images/characters/thumb/elders.png',
    price: '₹299', tint: 'rgba(225, 29, 116, 0.1)', shadow: 'rgba(225, 29, 116, 0.18)',
  },
  {
    id: 'pets', label: 'Pets', targetId: 'shelf-pets', catalogKey: 'pet',
    img: '/images/characters/pet.mp4#t=1', thumb: '/images/characters/thumb/pets.png',
    price: '₹149', tint: 'rgba(245, 158, 11, 0.1)', shadow: 'rgba(245, 158, 11, 0.18)',
  },
  {
    id: 'events', label: 'Events', targetId: 'shelf-events', catalogKey: 'event',
    img: '/images/characters/event.mp4#t=1', thumb: '/images/characters/thumb/events.png',
    price: '₹499', tint: 'rgba(192, 38, 211, 0.1)', shadow: 'rgba(192, 38, 211, 0.18)',
  },
  {
    // Home also covers the catalog's "Smart Devices" filter (smart TV, router,
    // CCTV, lock, home automation) — same underlying service set, different label.
    id: 'home', label: 'Home', targetId: 'shelf-home', catalogKey: 'smart_device',
    img: '/images/characters/home.mp4', thumb: '/images/characters/thumb/home.png',
    price: '₹99', tint: 'rgba(8, 145, 178, 0.1)', shadow: 'rgba(8, 145, 178, 0.18)',
  },
  {
    id: 'more', label: 'More', targetId: 'shelf-more', catalogKey: null,
    img: '/images/characters/more.mp4', thumb: '/images/characters/thumb/more.png',
    price: 'View all', tint: 'rgba(138, 142, 168, 0.1)', shadow: 'rgba(138, 142, 168, 0.18)',
  },
];

// Look up a character by the catalog/order-history category key (e.g. 'vehicle', 'pet').
export function getCharacterByCatalogKey(catalogKey) {
  return categoryMap.find((c) => c.catalogKey === catalogKey) || null;
}
