import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { EVENT_SLUG } from "@/lib/config";
import type { PublicEvent } from "@/lib/types";

export async function getPublicEvent(): Promise<PublicEvent | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_event", { p_slug: EVENT_SLUG });
  if (error) throw new Error(error.message);
  return (data as PublicEvent | null) ?? null;
}
