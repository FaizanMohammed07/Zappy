/**
 * App languages + translation dictionaries.
 *
 * English is the source language: components call t('some.key', 'English text'),
 * and if a translation is missing for the active language the English fallback is
 * shown. This makes partial coverage SAFE — untranslated strings never break the
 * UI — so translations can be expanded continuously post-launch.
 *
 * To translate a new string: add its key here under hi/te. To translate a new
 * screen: wrap its strings with t('key', 'English default') in the component.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी' },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు' },
];

export const translations = {
  hi: {
    // Bottom nav
    'nav.home': 'होम',
    'nav.bookings': 'बुकिंग',
    'nav.book': 'बुक करें',
    'nav.track': 'ट्रैक',
    'nav.profile': 'प्रोफ़ाइल',
    // Home
    'home.greeting': 'क्या ठीक करवाना है',
    'home.tagline': 'भरोसेमंद प्रो, मिनटों में आपके दरवाज़े पर।',
    'home.bookAgain': 'फिर से बुक करें',
    'home.tapToBook': 'बुक करने के लिए टैप करें',
    // Common actions
    'common.book': 'बुक करें',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'common.retry': 'फिर कोशिश करें',
    'common.save': 'सेव करें',
    'common.search': 'खोजें',
    'common.viewAll': 'सभी देखें',
    'common.from': 'से',
    'common.loading': 'लोड हो रहा है…',
    // Profile menu
    'profile.wallet': 'वॉलेट',
    'profile.rewards': 'रिवॉर्ड्स',
    'profile.bookings': 'मेरी बुकिंग',
    'profile.payments': 'भुगतान के तरीके',
    'profile.notifications': 'सूचनाएं',
    'profile.support': 'सहायता',
    'profile.language': 'भाषा',
    'profile.logout': 'लॉग आउट',
    // Rewards
    'rewards.title': 'रिवॉर्ड्स',
    'rewards.yourPoints': 'आपके पॉइंट्स',
    'rewards.redeem': 'रिडीम करें',
    'rewards.scratchWin': 'स्क्रैच करें और जीतें',
    'rewards.tapScratch': 'स्क्रैच करने के लिए टैप करें',
  },
  te: {
    // Bottom nav
    'nav.home': 'హోమ్',
    'nav.bookings': 'బుకింగ్‌లు',
    'nav.book': 'బుక్ చేయండి',
    'nav.track': 'ట్రాక్',
    'nav.profile': 'ప్రొఫైల్',
    // Home
    'home.greeting': 'ఏం రిపేర్ చేయాలి',
    'home.tagline': 'నమ్మకమైన నిపుణులు, నిమిషాల్లో మీ ఇంటి వద్దకు.',
    'home.bookAgain': 'మళ్ళీ బుక్ చేయండి',
    'home.tapToBook': 'బుక్ చేయడానికి ట్యాప్ చేయండి',
    // Common actions
    'common.book': 'బుక్ చేయండి',
    'common.cancel': 'రద్దు చేయండి',
    'common.confirm': 'నిర్ధారించండి',
    'common.retry': 'మళ్ళీ ప్రయత్నించండి',
    'common.save': 'సేవ్ చేయండి',
    'common.search': 'వెతకండి',
    'common.viewAll': 'అన్నీ చూడండి',
    'common.from': 'నుండి',
    'common.loading': 'లోడ్ అవుతోంది…',
    // Profile menu
    'profile.wallet': 'వాలెట్',
    'profile.rewards': 'రివార్డ్‌లు',
    'profile.bookings': 'నా బుకింగ్‌లు',
    'profile.payments': 'చెల్లింపు పద్ధతులు',
    'profile.notifications': 'నోటిఫికేషన్‌లు',
    'profile.support': 'సహాయం',
    'profile.language': 'భాష',
    'profile.logout': 'లాగ్ అవుట్',
    // Rewards
    'rewards.title': 'రివార్డ్‌లు',
    'rewards.yourPoints': 'మీ పాయింట్‌లు',
    'rewards.redeem': 'రిడీమ్ చేయండి',
    'rewards.scratchWin': 'స్క్రాచ్ చేసి గెలవండి',
    'rewards.tapScratch': 'స్క్రాచ్ చేయడానికి ట్యాప్ చేయండి',
  },
};
