import type { en, TranslationShape } from './en';

export const ptBR = {
  common: {
    title: 'Spendspacey · Sua conta',
    language: 'Idioma',
    retry: 'Tentar novamente',
    back: 'Voltar',
  },
  auth: {
    loading: 'Preparando seu espaço…',
    signIn: 'Entrar com o Google',
    signingIn: 'Conectando ao Google…',
    signOut: 'Sair',
    signingOut: 'Saindo…',
    callbackLoading: 'Concluindo o login…',
    avatar: 'Foto do perfil do Google',
    avatarFallback: 'Foto de perfil indisponível',
    unknownName: 'Nome indisponível',
    unknownEmail: 'E-mail indisponível',
  },
  errors: {
    previewAuthentication: 'O login com o Google está indisponível nesta prévia.',
    configuration:
      'Não foi possível iniciar o Spendspacey. Verifique a configuração pública do aplicativo.',
    restore: 'Não foi possível restaurar sua sessão. Tente novamente.',
    signIn: 'Não foi possível iniciar o login. Tente novamente.',
    signOut: 'Não foi possível sair da sua conta. Tente novamente.',
    callback: 'Não foi possível concluir o login. Comece novamente.',
    cancelled: 'O login foi cancelado. Você pode tentar novamente quando quiser.',
    invalidCallback: 'Este link de login está indisponível ou expirou. Comece novamente.',
    signupDisabled: 'Esta conta não pode entrar no Spendspacey.',
    storage:
      'O login precisa do armazenamento do navegador. Permita o armazenamento e tente novamente.',
  },
} as const satisfies TranslationShape<typeof en>;
