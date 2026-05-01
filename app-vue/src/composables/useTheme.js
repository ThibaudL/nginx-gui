import { ref, watch } from 'vue'

const stored = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const isDark = ref(stored ? stored === 'dark' : prefersDark)

function apply(dark) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

apply(isDark.value)
watch(isDark, apply)

export function useTheme() {
  return {
    isDark,
    toggle: () => { isDark.value = !isDark.value }
  }
}
