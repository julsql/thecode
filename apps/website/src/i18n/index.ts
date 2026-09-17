import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { translations, DEFAULT_LANG, SUPPORTED_LANGS } from './translations';
import type { Lang, TranslationKey } from './translations';

export type { Lang, TranslationKey };
export { DEFAULT_LANG, SUPPORTED_LANGS };

function normalizeLang(value: unknown): Lang {
  return SUPPORTED_LANGS.includes(value as Lang) ? (value as Lang) : DEFAULT_LANG;
}

export function useI18n() {
  const route = useRoute();
  const router = useRouter();

  const lang = computed<Lang>(() => normalizeLang(route.params.lang));

  const t = (key: TranslationKey): string => {
    return translations[lang.value][key] ?? translations[DEFAULT_LANG][key];
  };

  const localePath = (path: string = ''): string => {
    const trimmed = path.replace(/^\/+/, '');
    return trimmed ? `/${lang.value}/${trimmed}` : `/${lang.value}`;
  };

  const switchLang = (target: Lang) => {
    if (target === lang.value) return;
    const tail = route.path.replace(/^\/(en|fr)/, '');
    const newPath = `/${target}${tail}` || `/${target}`;
    router.push(newPath);
  };

  return { lang, t, localePath, switchLang };
}
