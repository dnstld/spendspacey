export const en = {
  common: {
    title: 'Spendspacey · Your account',
    language: 'Language',
    retry: 'Try again',
    back: 'Back',
  },
  auth: {
    loading: 'Getting your space ready…',
    signIn: 'Sign in with Google',
    signingIn: 'Connecting to Google…',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    callbackLoading: 'Completing sign-in…',
    avatar: 'Google profile photo',
    avatarFallback: 'Profile photo unavailable',
    unknownName: 'Name unavailable',
    unknownEmail: 'Email unavailable',
  },
  errors: {
    configuration: 'Spendspacey could not start. Check the public application configuration.',
    restore: 'We could not restore your session. Please try again.',
    signIn: 'We could not start sign-in. Please try again.',
    signOut: 'We could not sign you out. Please try again.',
    callback: 'We could not complete sign-in. Please start again.',
    cancelled: 'Sign-in was cancelled. You can try again when you are ready.',
    invalidCallback: 'This sign-in link is unavailable or has expired. Please start again.',
    signupDisabled: 'This account cannot sign in to Spendspacey.',
    storage: 'Sign-in needs browser storage. Allow storage and try again.',
  },
} as const;

export type TranslationShape<T> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};
