import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REFRESH_SKEW_MS,
  XaiAuthError,
  authErrorCode,
  buildDeviceCodeBody,
  buildRefreshBody,
  buildTokenPollBody,
  needsRefresh,
  parseDeviceCode,
  parseStoredTokens,
  parseTokenResponse,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceCode,
  xaiAuthMessage,
  type AuthHttpRequest,
  type AuthHttpResponse,
  type AuthTransport,
} from "./device.ts";
import { XAI_OAUTH_CLIENT_ID, XAI_OAUTH_SCOPE } from "./config.ts";

function recorder(
  reply: AuthHttpResponse | ((request: AuthHttpRequest, call: number) => AuthHttpResponse),
) {
  const calls: AuthHttpRequest[] = [];
  const transport: AuthTransport = async (request) => {
    calls.push(request);
    return typeof reply === "function" ? reply(request, calls.length) : reply;
  };
  return { calls, transport };
}

const ok = (data: unknown): AuthHttpResponse => ({ status: 200, data, headers: {} });
const fail = (status: number, error: string): AuthHttpResponse => ({
  status,
  data: { error, error_description: "..." },
  headers: {},
});

const DEVICE = {
  device_code: "dev-123",
  user_code: "ABCD-EFGH",
  verification_uri: "https://accounts.x.ai/device",
  verification_uri_complete: "https://accounts.x.ai/device?user_code=ABCD-EFGH",
  expires_in: 600,
  interval: 5,
};

const TOKEN = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "openid api:access",
};

const fixedSleep = () => {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
};

describe("corpos form urlencoded", () => {
  it("device code manda client_id e todos os escopos", () => {
    const body = new URLSearchParams(buildDeviceCodeBody());
    assert.equal(body.get("client_id"), XAI_OAUTH_CLIENT_ID);
    assert.equal(body.get("scope"), XAI_OAUTH_SCOPE);
    assert.match(XAI_OAUTH_SCOPE, /offline_access/);
    assert.match(XAI_OAUTH_SCOPE, /grok-cli:access/);
  });

  it("polling usa grant_type device_code e o device_code", () => {
    const body = new URLSearchParams(buildTokenPollBody("dev-123"));
    assert.equal(body.get("grant_type"), "urn:ietf:params:oauth:grant-type:device_code");
    assert.equal(body.get("client_id"), XAI_OAUTH_CLIENT_ID);
    assert.equal(body.get("device_code"), "dev-123");
  });

  it("refresh usa grant_type refresh_token", () => {
    const body = new URLSearchParams(buildRefreshBody("refresh-1"));
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "refresh-1");
  });
});

describe("parseDeviceCode", () => {
  it("normaliza a resposta e usa o fallback de verification_uri", () => {
    const parsed = parseDeviceCode({ ...DEVICE, verification_uri_complete: undefined });
    assert.deepEqual(parsed, {
      deviceCode: "dev-123",
      userCode: "ABCD-EFGH",
      verificationUri: "https://accounts.x.ai/device",
      verificationUriComplete: "https://accounts.x.ai/device",
      expiresInSeconds: 600,
      intervalSeconds: 5,
    });
  });

  it("usa os padrões da RFC quando expires_in/interval faltam", () => {
    const parsed = parseDeviceCode({
      device_code: "x",
      user_code: "y",
      verification_uri: "https://exemplo",
    });
    assert.equal(parsed.expiresInSeconds, 600);
    assert.equal(parsed.intervalSeconds, 5);
  });

  it("recusa resposta sem os campos obrigatórios", () => {
    assert.throws(
      () => parseDeviceCode({ user_code: "x", verification_uri: "y" }),
      (error) => error instanceof XaiAuthError && error.code === "invalid_response",
    );
    assert.throws(() => parseDeviceCode("texto"), XaiAuthError);
  });
});

describe("requestDeviceCode", () => {
  it("faz POST no endpoint real com cabeçalho de formulário", async () => {
    const { calls, transport } = recorder(ok(DEVICE));
    const code = await requestDeviceCode(transport);
    assert.equal(code.userCode, "ABCD-EFGH");
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.url, "https://auth.x.ai/oauth2/device/code");
    assert.match(calls[0]?.headers["Content-Type"] ?? "", /x-www-form-urlencoded/);
    assert.match(calls[0]?.body ?? "", /client_id=/);
  });

  it("invalid_client avisa que a xAI bloqueou o login experimental", async () => {
    const { transport } = recorder(fail(401, "invalid_client"));
    await assert.rejects(
      () => requestDeviceCode(transport),
      (error) =>
        error instanceof XaiAuthError &&
        error.code === "invalid_request" &&
        /bloqueou/.test(error.message),
    );
  });

  it("falha de transporte vira erro de rede", async () => {
    const transport: AuthTransport = async () => {
      throw new Error("Network request failed");
    };
    await assert.rejects(
      () => requestDeviceCode(transport),
      (error) => error instanceof XaiAuthError && error.code === "network",
    );
  });
});

describe("pollDeviceToken", () => {
  const base = {
    deviceCode: "dev-123",
    intervalSeconds: 5,
    expiresInSeconds: 60,
    now: 1_700_000_000_000,
  };

  it("authorization_pending continua e devolve o token no sucesso", async () => {
    const { waits, sleep } = fixedSleep();
    const { calls, transport } = recorder((_request, call) =>
      call < 3 ? fail(400, "authorization_pending") : ok(TOKEN),
    );
    const tokens = await pollDeviceToken(transport, { ...base, sleep });
    assert.equal(tokens.accessToken, "access-1");
    assert.equal(tokens.refreshToken, "refresh-1");
    assert.equal(tokens.expiresAt, base.now + 3600_000);
    assert.deepEqual(waits, [5000, 5000, 5000]);
    assert.equal(calls.length, 3);
  });

  it("slow_down soma 5 s ao intervalo e avisa a UI", async () => {
    const { waits, sleep } = fixedSleep();
    const intervals: number[] = [];
    const { transport } = recorder((_request, call) =>
      call === 1 ? fail(400, "slow_down") : ok(TOKEN),
    );
    await pollDeviceToken(transport, {
      ...base,
      sleep,
      onSlowDown: (interval) => intervals.push(interval),
    });
    assert.deepEqual(waits, [5000, 10000]);
    assert.deepEqual(intervals, [10]);
  });

  it("expired_token encerra com o texto de código expirado", async () => {
    const { sleep } = fixedSleep();
    const { transport } = recorder(fail(400, "expired_token"));
    await assert.rejects(
      () => pollDeviceToken(transport, { ...base, sleep }),
      (error) =>
        error instanceof XaiAuthError &&
        error.code === "expired_token" &&
        /expirou/.test(error.message),
    );
  });

  it("access_denied encerra com o texto de recusa", async () => {
    const { sleep } = fixedSleep();
    const { transport } = recorder(fail(400, "access_denied"));
    await assert.rejects(
      () => pollDeviceToken(transport, { ...base, sleep }),
      (error) => error instanceof XaiAuthError && error.code === "access_denied",
    );
  });

  it("esgota o prazo quando o servidor só responde pending", async () => {
    const { waits, sleep } = fixedSleep();
    const { transport } = recorder(fail(400, "authorization_pending"));
    await assert.rejects(
      () => pollDeviceToken(transport, { ...base, expiresInSeconds: 12, sleep }),
      (error) => error instanceof XaiAuthError && error.code === "expired_token",
    );
    assert.deepEqual(waits, [5000, 5000]);
  });

  it("não espera além do prazo quando o intervalo é maior", async () => {
    const { waits, sleep } = fixedSleep();
    const { transport } = recorder(fail(400, "authorization_pending"));
    await assert.rejects(
      () => pollDeviceToken(transport, { ...base, intervalSeconds: 30, expiresInSeconds: 10, sleep }),
      XaiAuthError,
    );
    assert.deepEqual(waits, []);
  });

  it("5xx vira erro de servidor", async () => {
    const { sleep } = fixedSleep();
    const { transport } = recorder({ status: 503, data: {}, headers: {} });
    await assert.rejects(
      () => pollDeviceToken(transport, { ...base, sleep }),
      (error) => error instanceof XaiAuthError && error.code === "server",
    );
  });
});

describe("refreshAccessToken", () => {
  it("renova e preserva o refresh antigo quando a resposta não manda outro", async () => {
    const { calls, transport } = recorder(
      ok({ access_token: "access-2", expires_in: 1800, token_type: "Bearer" }),
    );
    const tokens = await refreshAccessToken(transport, "refresh-1", { now: 1000 });
    assert.equal(tokens.accessToken, "access-2");
    assert.equal(tokens.refreshToken, "refresh-1");
    assert.equal(tokens.expiresAt, 1000 + 1800_000);
    assert.match(calls[0]?.body ?? "", /refresh_token=refresh-1/);
  });

  it("invalid_grant pede para entrar de novo", async () => {
    const { transport } = recorder(fail(400, "invalid_grant"));
    await assert.rejects(
      () => refreshAccessToken(transport, "refresh-1"),
      (error) =>
        error instanceof XaiAuthError &&
        error.code === "invalid_grant" &&
        /entre de novo/i.test(error.message),
    );
  });
});

describe("tokens guardados", () => {
  it("parseStoredTokens aceita objeto válido e ignora lixo", () => {
    const parsed = parseStoredTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 123,
      tokenType: "Bearer",
      scope: "api:access",
    });
    assert.deepEqual(parsed, {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 123,
      tokenType: "Bearer",
      scope: "api:access",
    });
    assert.equal(parseStoredTokens({ accessToken: "" }), null);
    assert.equal(parseStoredTokens(null), null);
    assert.equal(parseStoredTokens("texto"), null);
  });

  it("needsRefresh respeita a margem de 1 minuto e token sem validade", () => {
    const token = parseTokenResponse(TOKEN, 10_000);
    assert.ok(token);
    assert.equal(needsRefresh(token, token.expiresAt - REFRESH_SKEW_MS - 1), false);
    assert.equal(needsRefresh(token, token.expiresAt - REFRESH_SKEW_MS), true);
    assert.equal(needsRefresh({ ...token, expiresAt: 0 }, Date.now()), false);
    assert.equal(needsRefresh(null, 0), false);
  });

  it("authErrorCode aceita formato plano e aninhado", () => {
    assert.equal(authErrorCode({ error: "authorization_pending" }), "authorization_pending");
    assert.equal(authErrorCode({ error: { code: "slow_down" } }), "slow_down");
    assert.equal(authErrorCode({ code: "expired_token" }), "expired_token");
    assert.equal(authErrorCode("texto"), "");
  });

  it("todo código conhecido tem mensagem em português", () => {
    for (const code of [
      "expired_token",
      "access_denied",
      "invalid_grant",
      "unauthorized",
      "rate_limit",
      "server",
      "network",
    ] as const) {
      assert.ok(xaiAuthMessage(code).length > 10);
    }
  });
});
