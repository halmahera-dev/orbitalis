import { getAuth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: NextRequest) {
  return toNextJsHandler(getAuth()).POST(request);
}
