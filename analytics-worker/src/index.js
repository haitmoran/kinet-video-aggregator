const MAX_BODY_BYTES = 4096;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_ATTEMPT_LIMIT = 5;

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function responseHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
}

function json(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(origin),
  });
}

function cleanString(value, maximumLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximumLength);
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacBytes(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

async function hmac(value, secret) {
  return encodeBase64Url(await hmacBytes(value, secret));
}

function constantTimeEqual(first, second) {
  const length = Math.max(first.length, second.length);
  let difference = first.length ^ second.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function createSessionToken(username, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({ sub: username, iat: now, exp: now + SESSION_TTL_SECONDS })),
  );
  return `${payload}.${await hmac(payload, secret)}`;
}

async function verifySessionToken(token, env) {
  if (!token || !env.SESSION_SECRET || !env.ADMIN_USERNAME) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;

  const expectedSignature = await hmac(payload, env.SESSION_SECRET);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return (
      parsed.sub === env.ADMIN_USERNAME &&
      Number.isFinite(parsed.exp) &&
      parsed.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

async function ownerRequestIsAuthorized(request, env) {
  const authorization = request.headers.get("Authorization") ?? "";
  return verifySessionToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "", env);
}

async function readJson(request) {
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("Request is too large.");
  return JSON.parse(text);
}

async function collect(request, env, origin) {
  if (!env.DB || !env.ANALYTICS_SALT) {
    return json({ message: "Analytics storage is not configured." }, 503, origin);
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ message: "Invalid analytics event." }, 400, origin);
  }

  const eventType = cleanString(body.eventType, 30);
  if (!new Set(["page_view", "video_open"]).has(eventType)) {
    return json({ message: "Unsupported analytics event." }, 400, origin);
  }

  const visitorId = cleanString(body.visitorId, 100);
  const sessionId = cleanString(body.sessionId, 100);
  if (!/^[a-zA-Z0-9-]{12,100}$/.test(visitorId) || !/^[a-zA-Z0-9-]{12,100}$/.test(sessionId)) {
    return json({ message: "Invalid anonymous identifier." }, 400, origin);
  }

  const rawPath = cleanString(body.path, 240);
  const path = rawPath.startsWith("/") ? rawPath.split(/[?#]/, 1)[0] : "/";
  const referrer = cleanString(body.referrer, 160).toLowerCase();
  const deviceValue = cleanString(body.device, 20);
  const device = new Set(["Mobile", "Tablet", "Desktop", "TV"]).has(deviceValue)
    ? deviceValue
    : "Other";
  const itemId = cleanString(body.itemId, 80);
  const itemLabel = cleanString(body.itemLabel, 160);
  const country = cleanString(request.cf?.country ?? "Unknown", 32) || "Unknown";
  const occurredAt = new Date().toISOString();
  const day = occurredAt.slice(0, 10);

  const [visitorHash, sessionHash] = await Promise.all([
    hmac(visitorId, env.ANALYTICS_SALT),
    hmac(sessionId, env.ANALYTICS_SALT),
  ]);

  await env.DB.prepare(
    `INSERT INTO events
      (occurred_at, day, event_type, visitor_hash, session_hash, path, referrer, country, device, item_id, item_label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      occurredAt,
      day,
      eventType,
      visitorHash,
      sessionHash,
      path,
      referrer,
      country,
      device,
      itemId,
      itemLabel,
    )
    .run();

  return new Response(null, {
    status: 204,
    headers: { ...responseHeaders(origin), "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function loginAttemptKey(request, env) {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return hmac(address, env.SESSION_SECRET);
}

async function registerFailedLogin(key, existing, env) {
  const now = Math.floor(Date.now() / 1000);
  const withinWindow = existing && now - Number(existing.window_started) < LOGIN_WINDOW_SECONDS;
  const attemptCount = withinWindow ? Number(existing.attempt_count) + 1 : 1;
  const windowStarted = withinWindow ? Number(existing.window_started) : now;
  const blockedUntil = attemptCount >= LOGIN_ATTEMPT_LIMIT ? now + LOGIN_WINDOW_SECONDS : 0;

  await env.DB.prepare(
    `INSERT INTO login_attempts (identifier, attempt_count, window_started, blocked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(identifier) DO UPDATE SET
       attempt_count = excluded.attempt_count,
       window_started = excluded.window_started,
       blocked_until = excluded.blocked_until`,
  ).bind(key, attemptCount, windowStarted, blockedUntil).run();
}

async function login(request, env, origin) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ message: "Owner access is not configured." }, 503, origin);
  }

  const key = await loginAttemptKey(request, env);
  const attempt = await env.DB.prepare(
    "SELECT attempt_count, window_started, blocked_until FROM login_attempts WHERE identifier = ?",
  ).bind(key).first();
  const now = Math.floor(Date.now() / 1000);
  if (attempt && Number(attempt.blocked_until) > now) {
    return json({ message: "Too many attempts. Try again in 15 minutes." }, 429, origin);
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ message: "Invalid sign-in request." }, 400, origin);
  }

  const username = cleanString(body.username, 80);
  const password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
  const [providedPasswordHash, expectedPasswordHash] = await Promise.all([
    hmac(password, env.SESSION_SECRET),
    hmac(env.ADMIN_PASSWORD, env.SESSION_SECRET),
  ]);
  const validUsername = constantTimeEqual(username.toLowerCase(), env.ADMIN_USERNAME.toLowerCase());
  const validPassword = constantTimeEqual(providedPasswordHash, expectedPasswordHash);

  if (!validUsername || !validPassword) {
    await registerFailedLogin(key, attempt, env);
    return json({ message: "Incorrect owner credentials." }, 401, origin);
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE identifier = ?").bind(key).run();
  return json(
    {
      token: await createSessionToken(env.ADMIN_USERNAME, env.SESSION_SECRET),
      expiresIn: SESSION_TTL_SECONDS,
    },
    200,
    origin,
  );
}

function rows(result) {
  return result?.results ?? [];
}

function rankedItems(result, labelKey) {
  return rows(result).map((row) => ({
    label: String(row[labelKey] ?? "Unknown"),
    value: Number(row.value ?? 0),
  }));
}

function dateRange(days) {
  const result = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}

async function summary(request, env, origin) {
  if (!(await ownerRequestIsAuthorized(request, env))) {
    return json({ message: "Owner authentication required." }, 401, origin);
  }

  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const range = dateRange(days);
  const firstDay = range[0];

  const statements = [
    env.DB.prepare(
      `SELECT
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS visitors,
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_hash END) AS sessions,
        SUM(CASE WHEN event_type = 'video_open' THEN 1 ELSE 0 END) AS video_opens
       FROM events WHERE day >= ?`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
       FROM events WHERE event_type = 'page_view' AND day >= ?
       GROUP BY day ORDER BY day ASC`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT path AS label, COUNT(*) AS value
       FROM events WHERE event_type = 'page_view' AND day >= ?
       GROUP BY path ORDER BY value DESC LIMIT 5`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT COALESCE(NULLIF(item_label, ''), item_id) AS label, COUNT(*) AS value
       FROM events WHERE event_type = 'video_open' AND day >= ? AND item_id != ''
       GROUP BY item_id, item_label ORDER BY value DESC LIMIT 5`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT CASE WHEN referrer = '' THEN 'Direct' ELSE referrer END AS label, COUNT(*) AS value
       FROM events WHERE event_type = 'page_view' AND day >= ?
       GROUP BY label ORDER BY value DESC LIMIT 5`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT country AS label, COUNT(*) AS value
       FROM events WHERE event_type = 'page_view' AND day >= ?
       GROUP BY country ORDER BY value DESC LIMIT 5`,
    ).bind(firstDay),
    env.DB.prepare(
      `SELECT device AS label, COUNT(*) AS value
       FROM events WHERE event_type = 'page_view' AND day >= ?
       GROUP BY device ORDER BY value DESC LIMIT 5`,
    ).bind(firstDay),
  ];
  const [totalsResult, trendResult, pagesResult, videosResult, referrersResult, countriesResult, devicesResult] =
    await env.DB.batch(statements);
  const totalsRow = rows(totalsResult)[0] ?? {};
  const trendByDay = new Map(
    rows(trendResult).map((row) => [String(row.day), { views: Number(row.views), visitors: Number(row.visitors) }]),
  );

  return json(
    {
      rangeDays: days,
      generatedAt: new Date().toISOString(),
      totals: {
        views: Number(totalsRow.views ?? 0),
        visitors: Number(totalsRow.visitors ?? 0),
        sessions: Number(totalsRow.sessions ?? 0),
        videoOpens: Number(totalsRow.video_opens ?? 0),
      },
      trend: range.map((day) => ({ day, views: trendByDay.get(day)?.views ?? 0, visitors: trendByDay.get(day)?.visitors ?? 0 })),
      topPages: rankedItems(pagesResult, "label"),
      topVideos: rankedItems(videosResult, "label"),
      referrers: rankedItems(referrersResult, "label"),
      countries: rankedItems(countriesResult, "label"),
      devices: rankedItems(devicesResult, "label"),
    },
    200,
    origin,
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ status: "ok" }, 200, request.headers.get("Origin") ?? "*");
    }

    const origin = allowedOrigin(request, env);
    if (!origin) return json({ message: "Origin not allowed." }, 403, "null");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });

    try {
      if (url.pathname === "/v1/collect" && request.method === "POST") return collect(request, env, origin);
      if (url.pathname === "/v1/admin/login" && request.method === "POST") return login(request, env, origin);
      if (url.pathname === "/v1/admin/summary" && request.method === "GET") return summary(request, env, origin);
      return json({ message: "Not found." }, 404, origin);
    } catch (error) {
      console.error("Analytics Worker request failed", error);
      return json({ message: "Analytics service unavailable." }, 500, origin);
    }
  },

  async scheduled(_event, env, context) {
    context.waitUntil(
      env.DB.batch([
        env.DB.prepare("DELETE FROM events WHERE occurred_at < datetime('now', '-180 days')"),
        env.DB.prepare("DELETE FROM login_attempts WHERE window_started < unixepoch('now') - 86400"),
      ]),
    );
  },
};
