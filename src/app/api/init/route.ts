import { NextResponse } from "next/server";
import { initBudgetSheets } from "@/lib/googleSheets";

export async function GET() {
  try {
    await initBudgetSheets();
    return NextResponse.json({ success: true, message: "Google Sheets initialized successfully" });
  } catch (error: any) {
    console.error("Sheets initialization failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST 요청으로도 동일하게 동작하도록 지원
export async function POST() {
  return GET();
}
