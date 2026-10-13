import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");

  const { data: meds, error } = await supabase.from("meds").select("id,user_id,data");
  if (error) return new Response(error.message, { status: 500 });
  const due = (meds || []).filter((m) => {
    const t = m.data && m.data.times;
    return Array.isArray(t) && t.includes(hm);
  });
  if (!due.length) return new Response("no due", { status: 200 });

  const userIds = [...new Set(due.map((m) => m.user_id))];
  const { data: subs } = await supabase.from("push_subs").select("*").in("user_id", userIds);

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hasan@example.com",
    Deno.env.get("VAPID_PUBLIC")!,
    Deno.env.get("VAPID_PRIVATE")!
  );

  let sent = 0;
  for (const m of due) {
    const sub = (subs || []).find((s) => s.user_id === m.user_id);
    if (!sub) continue;
    const name = (m.data && m.data.name) || "İlaç";
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title: "ECZANEM", body: name + " — ilaç saati " + hm })
      );
      sent++;
    } catch (e) {
      // 410/404 = abonelik geçersiz → temizle
      if (e && (e.statusCode === 410 || e.statusCode === 404)) {
        await supabase.from("push_subs").delete().eq("id", sub.id).catch(() => {});
      }
    }
  }
  return new Response("sent " + sent, { status: 200 });
});