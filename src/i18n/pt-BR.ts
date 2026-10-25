import type { en, TranslationShape } from './en';

export const ptBR = {
  common: {
    title: 'Spendspacey · Sua conta',
    language: 'Idioma',
    retry: 'Tentar novamente',
    back: 'Voltar',
    connectionRetry: 'Testar a conexão',
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
  pwa: {
    prepared:
      'Preparado para uso offline sob verificação. Este documento não está confirmado como pronto; um documento controlado precisa verificar seus arquivos salvos.',
    repaired:
      'O reparo foi concluído. Recarregue ou reabra o Spendspacey para usá-lo. Outros documentos abertos mantêm os arquivos atuais.',
    preparing: 'Preparando o aplicativo para uso offline…',
    ready:
      'A estrutura do aplicativo está pronta para uso offline. Entrar e sair precisam de conexão.',
    unavailable:
      'O uso offline não está garantido. Conecte-se para preparar ou recuperar o aplicativo.',
    waiting:
      'Uma atualização está pronta. Feche todas as janelas do Spendspacey e abra o aplicativo novamente para usá-la.',
    recovery:
      'Alguns arquivos precisam de recuperação. Abra a recuperação, reconecte e inicie o reparo. Depois recarregue ou reabra o Spendspacey. Outros documentos mantêm seus arquivos. Nenhum login ou saída será iniciado.',
    repair: 'Abrir recuperação',
  },
  errors: {
    offlineRestore:
      'Conecte-se para restaurar sua sessão e tente novamente. Você ainda pode mudar o idioma.',
    offlineSignIn:
      'Conecte-se para entrar. Você pode testar a conexão; o login não começará automaticamente.',
    offlineSignOut:
      'Conecte-se para sair. Sua sessão não foi encerrada. Você pode testar a conexão.',
    offlineCallback:
      'Não foi possível concluir este login offline. Volte ou conecte-se e inicie um novo login.',

    previewAuthentication: 'O login com o Google está indisponível neste endereço.',
    configuration:
      'Não foi possível iniciar o Spendspacey. Verifique a configuração pública do aplicativo.',
    restore: 'Não foi possível restaurar sua sessão. Tente novamente.',
    signIn: 'Não foi possível iniciar o login. Tente novamente.',
    signOut:
      'Não foi possível sair da sua conta no serviço. Sua sessão local pode ter sido encerrada. Reconecte-se e tente novamente.',
    callback: 'Não foi possível concluir o login. Comece novamente.',
    cancelled: 'O login foi cancelado. Você pode tentar novamente quando quiser.',
    invalidCallback: 'Este link de login está indisponível ou expirou. Comece novamente.',
    signupDisabled: 'Esta conta não pode entrar no Spendspacey.',
    storage:
      'O login precisa do armazenamento do navegador. Permita o armazenamento e tente novamente.',
  },
} as const satisfies TranslationShape<typeof en>;
