// =============================================================================
// KOFY AI WORKER
// The brain of the Kofy customer communication system.
//
// ENVIRONMENT VARIABLES (set in Cloudflare Workers -> Settings -> Variables):
//   ANTHROPIC_KEY    -- your Anthropic API key (sk-ant-...)
//   NOTION_KEY_AI    -- your Notion integration token (ntn_...)
//   MS_CLIENT_ID     -- Azure app client ID
//   MS_TENANT_ID     -- Azure directory tenant ID
//   MS_CLIENT_SECRET -- Azure app client secret (encrypt this)
//   KOFY_EMAIL       -- email inbox to monitor (admin@kofy.io)
//   WA_PHONE_ID      -- WhatsApp phone number ID  (added once Meta approves)
//   WA_TOKEN         -- WhatsApp permanent access token (added once Meta approves)
//   WA_VERIFY_TOKEN  -- a secret word you choose, used to verify the webhook
//   APPROVER_PHONE   -- phone number that receives approval requests e.g. 12125551234
//
// ROUTES:
//   POST /message      -- receive a message from any platform and process it
//   GET  /check-email  -- manually trigger an inbox check (for testing)
//   GET  /webhook      -- WhatsApp webhook verification (Meta calls this once)
//   POST /webhook      -- incoming WhatsApp messages (customers + approver replies)
//
// CRON:
//   Runs every 5 minutes via Cloudflare Cron Trigger to check for new emails
// =============================================================================

const NOTION_API = "https://api.notion.com/v1";

const DB = {
  knowledge: "3699b62600a08027aa83f396bf275daa",
  replies:   "3699b62600a08003a7ecc79d345993f5",
  log:       "36a9b62600a080f19a8ffa3f2a1c7828",
};

// Automated senders we never reply to
// NOTE: @facebookmail.com intentionally NOT in this list -- Meta sends important
//       verification and business emails that you need to see and click on.
// NOTE: @wixforms.com intentionally NOT in this list -- these are real customer
//       form submissions from the Kofy website and should be processed.
const NO_REPLY_PATTERNS = [
  // Generic no-reply patterns
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
  "notifications@", "notification@", "mailer@", "automailer@",
  "bounce@", "postmaster@", "maildaemon@",
  "newsletter@", "news@", "updates@", "updates-",
  "marketing@", "promotions@", "promo@",
  "security@", "unread-messages@", "posts-recap", "follow-suggestions",

  // Social / messaging platforms
  "@instagram.com", "@mail.instagram.com",
  "@discord.com",

  // E-commerce & fulfilment
  "@printful.com", "@newsletter.printful.com", "@info.printful.com",
  "@shop.tiktok.com",

  // Payments
  "@paypal.com", "@communications.paypal.com",
  "@coinbase.com",

  // Marketing / form / survey tools
  "@typeform.com",
  "@involve.me", "onboarding.involve.me",
  "@qr-code-generator.com",

  // VPN / software spam
  "@expressvpn.com", "@news.expressvpn.com",

  // Gumroad creator spam
  "@creators.gumroad.com",

  // Wix platform notifications (NOT wixforms.com -- those are real customer forms)
  "@notifications.wix.com", "@team.wix.com",

  // Notion platform notifications
  "@mail.notion.so",

  // Infrastructure / providers
  "@godaddy.com", "@google.com", "@microsoft.com",
  "@amazonses.com", "@sendgrid.net", "@mailchimp.com",

  // Known irrelevant senders
  "@thebagbroker.com",

  // Self-emails (prevent the inbox from processing its own address)
  "admin@kofy.io",

  // Notion platform notifications (both subdomains)
  "@updates.notion.so",

  // Twilio marketing/onboarding
  "@twilio.com",

  // Microsoft system-generated Exchange addresses
  "@onmicrosoft.com",

  // Shipping carriers
  "@ups.com", "pkginfo@",

  // Developer platform billing/onboarding
  "@mail.anthropic.com",
  "@em1.cloudflare.com",
  "@resend.dev",

  // Maersk shipping registration
  "registration@",
];

function isAutomatedSender(email) {
  const lower = email.toLowerCase();
  return NO_REPLY_PATTERNS.some(p => lower.includes(p));
}

// =============================================================================
// ENTRY POINT
// =============================================================================

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/message") {
      return handleMessage(request, env);
    }

    if (request.method === "GET" && path === "/check-email") {
      const result = await checkEmails(env);
      return cors(new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      }));
    }

    if (request.method === "GET" && path === "/webhook") {
      return verifyWebhook(url, env);
    }

    if (request.method === "POST" && path === "/webhook") {
      return handleWebhook(request, env);
    }

    if (request.method === "GET" && path === "/debug-notion") {
      const result = await savePending({
        name:             "Debug test entry",
        platform:         "Instagram",
        original_message: "This is a test message",
        suggested_reply:  "This is a test reply",
        flag:             "Red",
        flag_reason:      "Debug test",
        source_url:       "",
        source_context:   "Debug",
        customer_handle:  "@testuser",
      }, env);
      return cors(new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      }));
    }

    return new Response("Not found", { status: 404 });
  },

  // Cron: runs every 5 minutes to check for new emails
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkEmails(env));
  },
};

// =============================================================================
// HANDLE ANY INCOMING MESSAGE
// =============================================================================

async function handleMessage(request, env) {
  const body = await request.json();
  const { platform, customer_handle, message, source_url, source_context } = body;

  if (!message) {
    return cors(new Response(JSON.stringify({ error: "message is required" }), { status: 400 }));
  }

  const knowledge = await getKnowledge(env);
  const ai = await askClaude({ message, platform, customer_handle, source_context, knowledge, env });

  if (!ai.ok) {
    return cors(new Response(JSON.stringify({ error: "Claude error", detail: ai.error }), { status: 500 }));
  }

  const { flag, reason, reply } = ai;

  if (flag === "green") {
    await sendReply({ platform, customer_handle, source_url, reply, env });
    await logReply({
      name:             "Green " + platform + " -- " + customer_handle,
      platform,
      original_message: message,
      reply_sent:       reply,
      reply_type:       "Auto",
      flag_was:         "Green",
      source_url,
      customer_handle,
    }, env);
    return cors(new Response(JSON.stringify({ flag, reply, sent: true })));
  }

  const flagLabel = flag === "yellow" ? "Yellow" : "Red";

  await savePending({
    name:             flagLabel + " " + platform + " -- " + customer_handle,
    platform,
    original_message: message,
    suggested_reply:  reply,
    flag:             flagLabel,
    flag_reason:      reason,
    source_url:       source_url || "",
    source_context:   source_context || "",
    customer_handle:  customer_handle || "",
  }, env);

  await notifyApprover({ platform, source_context, source_url, message, reply, flag, reason, env });

  return cors(new Response(JSON.stringify({ flag, reply, sent: false, reason })));
}

// =============================================================================
// CLAUDE
// =============================================================================

async function askClaude({ message, platform, customer_handle, source_context, knowledge, env }) {
  const knowledgeText = knowledge.length > 0
    ? knowledge.map(k => "Q: " + k.question + "\nA: " + k.answer).join("\n\n")
    : "No knowledge base entries yet -- use your best judgment and flag as yellow when in any doubt.";

  const systemPrompt = [
    "You are the customer communication assistant for Kofy.",
    "Your job is to draft replies to customer messages that perfectly match the Kofy brand voice and tone.",
    "",
    "KNOWLEDGE BASE -- use this to answer accurately:",
    knowledgeText,
    "",
    "FLAG RULES -- you must choose exactly one:",
    '- "green"  -> You are fully confident. The reply is accurate, on-brand, and safe to send automatically.',
    '- "yellow" -> Probably right but something is slightly uncertain. Send for quick human review.',
    '- "red"    -> Outside your knowledge, sensitive, or requires human judgment. Always flag.',
    "",
    "TONE -- warm, concise, real. Never robotic. Sound like a person from the Kofy team, not a support bot.",
    "",
    "RESPONSE FORMAT -- respond with valid JSON only, no extra text, no markdown code blocks:",
    '{"flag": "green" or "yellow" or "red", "reason": "one short sentence", "reply": "your drafted reply"}',
  ].join("\n");

  const userPrompt = [
    "Platform: " + (platform || "unknown"),
    "Customer: " + (customer_handle || "unknown"),
    "Context:  " + (source_context || "direct message"),
    'Message:  "' + message.replace(/"/g, "'") + '"',
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data };

    const raw = data.content[0].text.trim();

    // Extract the JSON object robustly -- handles markdown blocks and surrounding text
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return { ok: false, error: "No JSON in Claude response: " + raw.slice(0, 100) };

    const parsed = JSON.parse(match[0]);
    return { ok: true, ...parsed };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================

async function getKnowledge(env) {
  try {
    const res = await fetch(NOTION_API + "/databases/" + DB.knowledge + "/query", {
      method:  "POST",
      headers: notionHeaders(env),
      body:    JSON.stringify({
        filter: { property: "Active", checkbox: { equals: true } },
      }),
    });
    const data = await res.json();
    if (!data.results) return [];

    return data.results
      .map(page => ({
        question: page.properties.Name?.title?.[0]?.text?.content || "",
        answer:   page.properties.Answer?.rich_text?.[0]?.text?.content || "",
      }))
      .filter(k => k.question && k.answer);

  } catch {
    return [];
  }
}

// =============================================================================
// SAVE TO PENDING REPLIES
// =============================================================================

async function savePending({ name, platform, original_message, suggested_reply, flag, flag_reason, source_url, source_context, customer_handle }, env) {
  const flagSelect = flag.includes("Yellow") ? "Yellow" : flag.includes("Red") ? "Red" : flag;

  const properties = {
    Name:               { title:     [{ text: { content: name } }] },
    Platform:           { select:    { name: platform } },
    "Original Message": { rich_text: [{ text: { content: original_message.slice(0, 2000) } }] },
    "Suggested Reply":  { rich_text: [{ text: { content: suggested_reply.slice(0, 2000) } }] },
    "Flag Reason":      { rich_text: [{ text: { content: flag_reason } }] },
    Status:             { select:    { name: "Pending" } },
    "Source Context":   { rich_text: [{ text: { content: source_context } }] },
    "Customer Handle":  { rich_text: [{ text: { content: customer_handle } }] },
  };

  // Match the exact option names set up in Notion
  if (flagSelect === "Yellow") properties["Flag"] = { select: { name: "Yellow" } };
  if (flagSelect === "Red")    properties["Flag"] = { select: { name: "Red" } };

  if (source_url) properties["Source URL"] = { url: source_url };

  const res  = await fetch(NOTION_API + "/pages", {
    method:  "POST",
    headers: notionHeaders(env),
    body:    JSON.stringify({ parent: { database_id: DB.replies }, properties }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// =============================================================================
// LOG SENT REPLY
// =============================================================================

async function logReply({ name, platform, original_message, reply_sent, reply_type, flag_was, source_url, customer_handle }, env) {
  const properties = {
    Name:               { title:     [{ text: { content: name } }] },
    Platform:           { select:    { name: platform } },
    "Original Message": { rich_text: [{ text: { content: original_message.slice(0, 2000) } }] },
    "Reply Sent":       { rich_text: [{ text: { content: reply_sent } }] },
    "Reply Type":       { select:    { name: reply_type } },
    "Flag Was":         { select:    { name: flag_was } },
    "Customer Handle":  { rich_text: [{ text: { content: customer_handle } }] },
  };

  if (source_url) properties["Source URL"] = { url: source_url };

  await fetch(NOTION_API + "/pages", {
    method:  "POST",
    headers: notionHeaders(env),
    body:    JSON.stringify({ parent: { database_id: DB.log }, properties }),
  });
}

// =============================================================================
// NOTIFY APPROVER VIA WHATSAPP
// =============================================================================

async function notifyApprover({ platform, source_context, source_url, message, reply, flag, reason, env }) {
  if (!env.WA_PHONE_ID || !env.WA_TOKEN || !env.APPROVER_PHONE) return;

  const flagHeader = flag === "yellow" ? "🟡 YELLOW FLAG" : "🔴 RED FLAG";

  const lines = [
    flagHeader,
    platform + (source_context ? " — " + source_context : ""),
    source_url ? source_url : null,
    "",
    "Customer said:",
    '"' + message + '"',
    "",
    "Suggested reply:",
    '"' + reply + '"',
    "",
    "Reason: " + reason,
    "",
    "Reply YES to send this, or type your own reply to send that instead.",
  ].filter(l => l !== null).join("\n");

  await sendWhatsApp(env.APPROVER_PHONE, lines, env);
}

// =============================================================================
// SEND REPLY ON PLATFORM
// =============================================================================

async function sendReply({ platform, customer_handle, source_url, reply, env, message_id }) {
  if (platform === "Email" && message_id) {
    const token = await getMSToken(env);
    await sendEmailReply(token, env.KOFY_EMAIL, message_id, reply);
    return;
  }
  // Other platforms wired up as credentials become available
  console.log("[SEND] " + platform + " -> " + customer_handle + ": " + reply);
}

// =============================================================================
// EMAIL -- MICROSOFT GRAPH
// =============================================================================

async function getMSToken(env) {
  const res = await fetch(
    "https://login.microsoftonline.com/" + env.MS_TENANT_ID + "/oauth2/v2.0/token",
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     env.MS_CLIENT_ID,
        client_secret: env.MS_CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await res.json();
  return data.access_token;
}

async function getUnreadEmails(token, email) {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/users/" + email + "/mailFolders/inbox/messages" +
    "?$filter=isRead eq false&$top=20&$orderby=receivedDateTime asc&$select=id,subject,from,body,receivedDateTime",
    { headers: { "Authorization": "Bearer " + token } }
  );
  const data = await res.json();
  return data.value || [];
}

async function markAsRead(token, email, messageId) {
  await fetch("https://graph.microsoft.com/v1.0/users/" + email + "/messages/" + messageId, {
    method:  "PATCH",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
}

async function sendEmailReply(token, email, messageId, replyText) {
  await fetch("https://graph.microsoft.com/v1.0/users/" + email + "/messages/" + messageId + "/reply", {
    method:  "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ comment: replyText }),
  });
}

// =============================================================================
// AI PRE-SCREEN  — cheap pass to filter junk that slipped past the pattern list
// =============================================================================

async function preScreenEmail(from, subject, bodyPreview, env) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system: [
          "You filter emails for Kofy, a product/packaging brand.",
          "Decide: is this email from a real person genuinely contacting Kofy",
          "(customer question, supplier, order inquiry, partnership, complaint)?",
          "Or is it automated junk (newsletter, notification, marketing, billing,",
          "platform alert, shipping update, system email, SaaS onboarding)?",
          'Reply with JSON only: {"real":true} or {"real":false}',
        ].join(" "),
        messages: [{
          role:    "user",
          content: "From: " + from + "\nSubject: " + subject + "\nPreview: " + bodyPreview.slice(0, 300),
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return true; // fail open — API error → treat as real, don't lose emails

    const raw   = data.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return true;

    const parsed = JSON.parse(match[0]);
    return parsed.real !== false; // default true if ambiguous

  } catch {
    return true; // fail open — network error → treat as real
  }
}

async function checkEmails(env) {
  if (!env.MS_CLIENT_ID || !env.MS_TENANT_ID || !env.MS_CLIENT_SECRET) {
    return { skipped: "Microsoft credentials not configured" };
  }

  const processed = [];
  const skipped   = [];

  try {
    const token  = await getMSToken(env);
    const emails = await getUnreadEmails(token, env.KOFY_EMAIL);

    for (const email of emails) {
      const from    = email.from?.emailAddress?.address || "unknown";
      const subject = email.subject || "(no subject)";

      // ── LAYER 1: Pattern filter (instant, zero token cost) ──────────────
      if (isAutomatedSender(from)) {
        await markAsRead(token, env.KOFY_EMAIL, email.id);
        skipped.push({ from, subject, reason: "pattern-filter" });
        continue;
      }

      // Strip HTML and clean up the body (needed for layer 2 + 3)
      const rawBody   = email.body?.content || "";
      const plainBody = rawBody
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      // ── LAYER 2: AI pre-screen (cheap — catches unknown junk automatically) ─
      const isReal = await preScreenEmail(from, subject, plainBody, env);
      if (!isReal) {
        await markAsRead(token, env.KOFY_EMAIL, email.id);
        skipped.push({ from, subject, reason: "ai-filtered" });
        continue;
      }

      // Mark as read now so we never double-process a real email
      await markAsRead(token, env.KOFY_EMAIL, email.id);

      const knowledge = await getKnowledge(env);
      const ai = await askClaude({
        message:         plainBody,
        platform:        "Email",
        customer_handle: from,
        source_context:  'Email -- Subject: "' + subject + '"',
        knowledge,
        env,
      });

      if (!ai.ok) {
        processed.push({ from, subject, error: ai.error });
        continue;
      }

      const { flag, reason, reply } = ai;

      if (flag === "green") {
        await sendEmailReply(token, env.KOFY_EMAIL, email.id, reply);
        await logReply({
          name:             "Green Email -- " + from,
          platform:         "Email",
          original_message: plainBody,
          reply_sent:       reply,
          reply_type:       "Auto",
          flag_was:         "Green",
          source_url:       "",
          customer_handle:  from,
        }, env);
      } else {
        const flagLabel = flag === "yellow" ? "Yellow" : "Red";
        await savePending({
          name:             flagLabel + " Email -- " + from,
          platform:         "Email",
          original_message: plainBody,
          suggested_reply:  reply,
          flag:             flagLabel,
          flag_reason:      reason,
          source_url:       "",
          source_context:   'Email -- Subject: "' + subject + '" | msgid: ' + email.id,
          customer_handle:  from,
        }, env);
        await notifyApprover({
          platform:       "Email",
          source_context: 'Email -- Subject: "' + subject + '"',
          source_url:     "",
          message:        plainBody,
          reply,
          flag,
          reason,
          env,
        });
      }

      processed.push({ from, subject, flag, reply });
    }

  } catch (e) {
    return { error: e.message, processed, skipped };
  }

  return { processed, skipped, total: processed.length + skipped.length };
}

// =============================================================================
// WHATSAPP WEBHOOK VERIFICATION
// =============================================================================

function verifyWebhook(url, env) {
  const mode      = url.searchParams.get("hub.mode");
  const token     = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WA_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// =============================================================================
// UNIFIED WEBHOOK ROUTER — handles WhatsApp, Instagram DMs, Instagram comments
// =============================================================================

async function handleWebhook(request, env) {
  const body = await request.json();

  try {
    const object = body.object;

    // ── WhatsApp ────────────────────────────────────────────────────────────
    if (object === "whatsapp_business_account") {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages) return cors(new Response("OK"));

      for (const msg of value.messages) {
        if (msg.type !== "text") continue;

        const from    = msg.from;
        const text    = msg.text.body.trim();
        const contact = value.contacts?.find(c => c.wa_id === from);
        const name    = contact?.profile?.name || from;

        const approverNumber = (env.APPROVER_PHONE || "").replace(/\D/g, "");
        if (from === approverNumber) {
          await handleApprovalReply({ text, env });
          continue;
        }

        await handleMessage(new Request("https://kofy-ai/message", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            platform:        "WhatsApp",
            customer_handle: from,
            message:         text,
            source_context:  "WhatsApp DM",
          }),
        }), env);
      }
      return cors(new Response("OK"));
    }

    // ── Instagram ───────────────────────────────────────────────────────────
    if (object === "instagram") {
      const entry = body.entry?.[0];
      if (!entry) return cors(new Response("OK"));

      // Instagram DMs
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const text = event.message?.text;
          if (!text) continue; // skip stickers, reactions, etc.

          const senderId = event.sender?.id;
          if (!senderId || senderId === env.IG_PAGE_ID) continue; // skip own echoes

          await handleMessage(new Request("https://kofy-ai/message", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              platform:        "Instagram",
              customer_handle: senderId,
              message:         text,
              source_context:  "Instagram DM",
              source_url:      "",
            }),
          }), env);
        }
      }

      // Instagram comments on posts
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field !== "comments") continue;

          const val      = change.value;
          const text     = val?.text;
          const username = val?.from?.username || val?.from?.id || "unknown";
          const mediaId  = val?.media?.id || "";
          const commentId = val?.id || "";

          if (!text) continue;

          await handleMessage(new Request("https://kofy-ai/message", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              platform:        "Instagram",
              customer_handle: "@" + username,
              message:         text,
              source_context:  "Instagram comment",
              source_url:      commentId ? "https://www.instagram.com/p/" + mediaId : "",
              _comment_id:     commentId, // used by dispatchReply
            }),
          }), env);
        }
      }

      return cors(new Response("OK"));
    }

  } catch (e) {
    console.error("Webhook error:", e.message);
  }

  return cors(new Response("OK"));
}

// =============================================================================
// HANDLE APPROVER REPLY
// =============================================================================

async function handleApprovalReply({ text, env }) {
  const trimmed = text.trim();
  const upper   = trimmed.toUpperCase();

  // STATUS command — show how many items are waiting
  if (upper === "STATUS" || upper === "QUEUE") {
    const count = await countPending(env);
    await sendWhatsApp(
      env.APPROVER_PHONE,
      count === 0
        ? "✅ No pending items — queue is clear."
        : `📋 ${count} item${count > 1 ? "s" : ""} waiting in the queue.`,
      env
    );
    return;
  }

  // Fetch the oldest pending item
  const item = await getOldestPending(env);

  if (!item) {
    await sendWhatsApp(env.APPROVER_PHONE, "✅ No pending items — queue is clear.", env);
    return;
  }

  // YES / SÍ / SI / Y → send suggested reply
  // Anything else      → send that text as the reply
  const isYes     = ["YES", "SI", "SÍ", "S", "Y"].includes(upper);
  const replyText = isYes ? item.suggestedReply : trimmed;
  const status    = isYes ? "Approved" : "Edited";
  const replyType = isYes ? "Approved" : "Edited";
  const flagLabel = item.flag.includes("Yellow") ? "Yellow" : "Red";

  // Send the reply on the original platform
  await dispatchReply({
    platform:       item.platform,
    customerHandle: item.customerHandle,
    sourceContext:  item.sourceContext,
    reply:          replyText,
    env,
  });

  // Update Notion status + store final reply
  await updatePendingStatus(item.pageId, status, replyText, env);

  // Log to Reply Log
  await logReply({
    name:             status + " " + item.platform + " -- " + item.customerHandle,
    platform:         item.platform,
    original_message: item.originalMessage,
    reply_sent:       replyText,
    reply_type:       replyType,
    flag_was:         flagLabel,
    source_url:       "",
    customer_handle:  item.customerHandle,
  }, env);

  // Confirm to approver
  const preview = replyText.length > 200 ? replyText.slice(0, 197) + "…" : replyText;
  await sendWhatsApp(
    env.APPROVER_PHONE,
    "✅ Sent to " + item.customerHandle + ":\n\"" + preview + "\"",
    env
  );

  // If more items are waiting, show the next one automatically
  const next = await getOldestPending(env);
  if (next) {
    const remaining = await countPending(env);
    await notifyApproverItem(next, remaining, env);
  }
}

// =============================================================================
// APPROVAL HELPERS
// =============================================================================

async function getOldestPending(env) {
  try {
    const res = await fetch(NOTION_API + "/databases/" + DB.replies + "/query", {
      method:  "POST",
      headers: notionHeaders(env),
      body:    JSON.stringify({
        filter:    { property: "Status", select: { equals: "Pending" } },
        sorts:     [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 1,
      }),
    });
    const data = await res.json();
    const page = data.results?.[0];
    if (!page) return null;

    return {
      pageId:          page.id,
      platform:        page.properties.Platform?.select?.name || "Unknown",
      customerHandle:  page.properties["Customer Handle"]?.rich_text?.[0]?.text?.content || "unknown",
      originalMessage: page.properties["Original Message"]?.rich_text?.[0]?.text?.content || "",
      suggestedReply:  page.properties["Suggested Reply"]?.rich_text?.[0]?.text?.content || "",
      flag:            page.properties.Flag?.select?.name || "",
      sourceContext:   page.properties["Source Context"]?.rich_text?.[0]?.text?.content || "",
    };
  } catch {
    return null;
  }
}

async function countPending(env) {
  try {
    const res = await fetch(NOTION_API + "/databases/" + DB.replies + "/query", {
      method:  "POST",
      headers: notionHeaders(env),
      body:    JSON.stringify({
        filter:    { property: "Status", select: { equals: "Pending" } },
        page_size: 100,
      }),
    });
    const data = await res.json();
    return data.results?.length || 0;
  } catch {
    return 0;
  }
}

async function updatePendingStatus(pageId, status, finalReply, env) {
  await fetch(NOTION_API + "/pages/" + pageId, {
    method:  "PATCH",
    headers: notionHeaders(env),
    body:    JSON.stringify({
      properties: {
        Status:        { select:    { name: status } },
        "Final Reply": { rich_text: [{ text: { content: finalReply.slice(0, 2000) } }] },
      },
    }),
  });
}

async function dispatchReply({ platform, customerHandle, sourceContext, reply, env }) {
  if (platform === "Email") {
    // Source context format: 'Email -- Subject: "..." | msgid: <id>'
    const match = sourceContext.match(/msgid:\s*(.+)/);
    if (match) {
      const msgId = match[1].trim();
      const token = await getMSToken(env);
      await sendEmailReply(token, env.KOFY_EMAIL, msgId, reply);
      return true;
    }
    return false;
  }

  if (platform === "WhatsApp") {
    const phone = customerHandle.replace(/\D/g, "");
    await sendWhatsApp(phone, reply, env);
    return true;
  }

  if (platform === "Instagram") {
    if (!env.IG_TOKEN) {
      console.log("[DISPATCH] Instagram token not configured yet");
      return false;
    }

    // If source context has a comment ID, reply to the comment
    const commentMatch = sourceContext.match(/comment_id:\s*(.+)/);
    if (commentMatch) {
      const commentId = commentMatch[1].trim();
      await replyToInstagramComment(commentId, reply, env);
      return true;
    }

    // Otherwise send a DM
    const userId = customerHandle.replace(/^@/, "");
    await sendInstagramDM(userId, reply, env);
    return true;
  }

  // YouTube — not wired yet
  console.log("[DISPATCH] " + platform + " -> " + customerHandle + ": " + reply);
  return false;
}

async function sendInstagramDM(recipientId, text, env) {
  await fetch("https://graph.facebook.com/v19.0/" + env.IG_PAGE_ID + "/messages", {
    method:  "POST",
    headers: {
      "Authorization": "Bearer " + env.IG_TOKEN,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message:   { text },
    }),
  });
}

async function replyToInstagramComment(commentId, text, env) {
  await fetch("https://graph.facebook.com/v19.0/" + commentId + "/replies", {
    method:  "POST",
    headers: {
      "Authorization": "Bearer " + env.IG_TOKEN,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ message: text }),
  });
}

async function notifyApproverItem(item, remaining, env) {
  const flagHeader = item.flag.includes("Yellow") ? "🟡 YELLOW FLAG" : "🔴 RED FLAG";
  const context    = item.sourceContext
    ? item.sourceContext.split("|")[0].replace(/^Email -- /, "").trim()
    : "";

  const lines = [
    flagHeader + (remaining > 1 ? " (" + remaining + " waiting)" : ""),
    item.platform + (context ? " — " + context : ""),
    "",
    "Customer said:",
    '"' + item.originalMessage.slice(0, 300) + (item.originalMessage.length > 300 ? "…" : "") + '"',
    "",
    "Suggested reply:",
    '"' + item.suggestedReply.slice(0, 300) + (item.suggestedReply.length > 300 ? "…" : "") + '"',
    "",
    "Reply YES to send, or type your own reply.",
  ].join("\n");

  await sendWhatsApp(env.APPROVER_PHONE, lines, env);
}

async function sendWhatsApp(to, text, env) {
  if (!env.WA_PHONE_ID || !env.WA_TOKEN) return;
  await fetch("https://graph.facebook.com/v19.0/" + env.WA_PHONE_ID + "/messages", {
    method:  "POST",
    headers: {
      "Authorization": "Bearer " + env.WA_TOKEN,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

// =============================================================================
// HELPERS
// =============================================================================

function notionHeaders(env) {
  return {
    "Authorization":  "Bearer " + env.NOTION_KEY_AI,
    "Notion-Version": "2022-06-28",
    "Content-Type":   "application/json",
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function cors(res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
