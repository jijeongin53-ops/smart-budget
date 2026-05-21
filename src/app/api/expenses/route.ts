import { NextResponse } from "next/server";
import { getExpenses } from "@/lib/googleSheets";

export async function GET() {
  try {
    const expenses = await getExpenses();
    return NextResponse.json({ success: true, data: expenses });
  } catch (error: any) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
