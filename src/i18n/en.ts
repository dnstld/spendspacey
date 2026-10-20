export const en = {
  common: {
    title: 'Spendspacey · Your account',
    language: 'Language',
    retry: 'Try again',
    back: 'Back',
    connectionRetry: 'Try the connection',
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
  pwa: {
    prepared: 'Prepared for offline use. Reload or reopen Spendspacey to finish.',
    repaired:
      'Verified repair is ready. Reload or reopen Spendspacey to use it. Other open documents keep their current files.',
    preparing: 'Preparing the app for offline use…',
    ready: 'The app shell is ready for offline use. Fresh sign-in and sign-out need a connection.',
    unavailable: 'Offline readiness is unavailable. Connect to prepare or recover the app.',
    waiting: 'An update is ready. Close all Spendspacey windows, then reopen the app to use it.',
    recovery:
      'Some app files need recovery. Open recovery, reconnect, and deliberately repair. Then reload or reopen Spendspacey. Other documents keep their files. No sign-in or sign-out starts.',
    repair: 'Open recovery',
  },
  errors: {
    offlineRestore:
      'Connect to restore your session, then try again. You can still change language.',
    offlineSignIn:
      'Connect to sign in. You can try the connection explicitly; sign-in will not start automatically.',
    offlineSignOut:
      'Connect to sign out. Your session has not been signed out. You can try the connection explicitly.',
    offlineCallback:
      'This sign-in could not finish offline. Return or connect and start a fresh sign-in.',

    previewAuthentication: 'Google sign-in is unavailable at this address.',
    configuration: 'Spendspacey could not start. Check the public application configuration.',
    restore: 'We could not restore your session. Please try again.',
    signIn: 'We could not start sign-in. Please try again.',
    signOut:
      'We could not sign you out with the service. Your local session may have ended. Reconnect and try again.',
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
