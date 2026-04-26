export const ease = [0.25, 0.46, 0.45, 0.94];

export const pageVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -10 },
};

export const pageTransition = { duration: 0.28, ease };

export const staggerContainer = {
  initial:  {},
  animate:  { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

export const fadeInUp = {
  initial:  { opacity: 0, y: 14 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
};

export const fadeIn = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.22, ease } },
};

export const scaleIn = {
  initial:  { opacity: 0, scale: 0.94 },
  animate:  { opacity: 1, scale: 1, transition: { duration: 0.22, ease } },
};

export const slideInRight = {
  initial:  { opacity: 0, x: 24 },
  animate:  { opacity: 1, x: 0, transition: { duration: 0.28, ease } },
};

export const slideUp = {
  initial:  { opacity: 0, y: '100%' },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
  exit:     { opacity: 0, y: '100%', transition: { duration: 0.22, ease } },
};

export const cardHover = {
  rest:  { y: 0, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
  hover: { y: -3, boxShadow: '0 8px 24px rgba(15,23,42,0.10)', transition: { duration: 0.2, ease } },
};

export const buttonTap = {
  whileHover: { scale: 1.02, transition: { duration: 0.15 } },
  whileTap:   { scale: 0.97, transition: { duration: 0.1 } },
};

export const iconHover = {
  rest:  { rotate: 0, scale: 1 },
  hover: { scale: 1.15, transition: { duration: 0.18, ease } },
};
