"use client";

import { useEffect } from "react";
import { addRecentTool } from "@/lib/userState";

export function TrackToolUse({ slug }: { slug: string }) {
  useEffect(() => {
    addRecentTool(slug);
  }, [slug]);
  return null;
}