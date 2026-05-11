import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enUSCommon from './locales/en-US/common.json'
import enUSChat from './locales/en-US/chat.json'
import enUSSettings from './locales/en-US/settings.json'
import enUSNotebook from './locales/en-US/notebook.json'
import enUSUI from './locales/en-US/ui.json'
import enUSQuiz from './locales/en-US/quiz.json'
import enUSAnki from './locales/en-US/anki.json'
import enUSShortcuts from './locales/en-US/shortcuts.json'

const resources = {
  'en-US': {
    common: enUSCommon,
    chat: enUSChat,
    settings: enUSSettings,
    notebook: enUSNotebook,
    ui: enUSUI,
    quiz: enUSQuiz,
    anki: enUSAnki,
    shortcuts: enUSShortcuts
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en-US',
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  })

export default i18n
