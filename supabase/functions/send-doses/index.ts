import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Kullanıcının saat diliminde şu anki "HH:MM".
function localHHMM(tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const { data: subs } = await supabase.from("push_subs").select("*");
  const subByUser: Record<string, any> = {};
  (subs || []).forEach((s) => { subByUser[s.user_id] = s; });

  const { data: meds, error } = await supabase.from("meds").select("id,user_id,data");
  if (error) return new Response(error.message, { status: 500 });

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hasan@example.com",
    Deno.env.get("VAPID_PUBLIC")!,
    Deno.env.get("VAPID_PRIVATE")!
  );

  let sent = 0;
  for (const m of (meds || [])) {
    const sub = subByUser[m.user_id];
    if (!sub) continue;
    const tz = sub.tz || "Europe/Istanbul";
    const hm = localHHMM(tz);
    const times = m.data && m.data.times;
    if (!Array.isArray(times) || !times.includes(hm)) continue;
    const name = (m.data && m.data.name) || "İlaç";
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title: "ECZANEM", body: name + " — ilaç saati " + hm })
      );
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 410 || e.statusCode === 404)) {
        await supabase.from("push_subs").delete().eq("id", sub.id).catch(() => {});
      }
    }
  }
  return new Response("sent " + sent, { status: 200 });
});