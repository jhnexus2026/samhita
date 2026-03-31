import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * Calls `onchange` for every INSERT, UPDATE, or DELETE.
 * Cleans up the channel on unmount.
 *
 * @param table  - the Postgres table name (e.g. "cases")
 * @param onchange - callback fired on any change (receives the payload)
 * @param filter - optional Supabase realtime filter string (e.g. "case_id=eq.5")
 */
export function useRealtimeTable(
  table: string,
  onchange: () => void,
  filter?: string
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelName = filter ? `public:${table}:${filter}` : `public:${table}`;

    const opts: Record<string, any> = {
      event: "*",
      schema: "public",
      table,
    };
    if (filter) opts.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes" as any, opts, () => {
        onchange();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]); // intentionally exclude onchange to avoid resubscribing on every render
}
