/**
 * Configuração do login de conta xAI (device code, RFC 8628).
 *
 * ATENÇÃO: estes valores NÃO SÃO OFICIAIS. O `client_id` público e os escopos
 * foram copiados do Grok CLI e podem ser bloqueados/rotacionados pela xAI a
 * qualquer momento. O recurso é experimental, exige uma conta SuperGrok ou
 * X Premium+ e nunca substitui a chave de API (que continua tendo prioridade).
 *
 * Descoberta documentada: https://auth.x.ai/.well-known/openid-configuration
 */

export const XAI_OAUTH_DISCOVERY_URL = "https://auth.x.ai/.well-known/openid-configuration";

export const XAI_OAUTH_DEVICE_CODE_URL = "https://auth.x.ai/oauth2/device/code";
export const XAI_OAUTH_TOKEN_URL = "https://auth.x.ai/oauth2/token";

/** Client público do Grok CLI — não oficial. */
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";

/** Escopos do Grok CLI — não oficiais. */
export const XAI_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "grok-cli:access",
  "api:access",
] as const;

export const XAI_OAUTH_SCOPE = XAI_OAUTH_SCOPES.join(" ");

/** Base da API usada quando o login de conta está ativo (mesma da chave). */
export const XAI_API_BASE = "https://api.x.ai/v1";

/** Texto mostrado na interface para deixar o aviso explícito. */
export const XAI_OAUTH_NOTICE =
  "Experimental e não oficial: usa o login do Grok CLI, que a xAI pode bloquear. Requer SuperGrok ou X Premium+.";
