import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import language resources
import enUSCommon from '../locales/en-US/common.json'
import enUSChat from '../locales/en-US/chat.json'
import enUSUi from '../locales/en-US/ui.json'
import enUSNotebook from '../locales/en-US/notebook.json'
import enUSSettings from '../locales/en-US/settings.json'
import enUSShortcuts from '../locales/en-US/shortcuts.json'

// Configure i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en-US',
    lng: 'en-US',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false
    },

    resources: {
      'en-US': {
        common: enUSCommon,
        chat: enUSChat,
        ui: enUSUi,
        notebook: enUSNotebook,
        settings: enUSSettings,
        shortcuts: enUSShortcuts
      }
    },

    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    },

    defaultNS: 'common'
  })

export default i18n
