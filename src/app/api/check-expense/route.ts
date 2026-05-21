import { NextRequest, NextResponse } from "next/server";
import { getProjects, getExpenses } from "@/lib/googleSheets";
import { reviewExpense } from "@/lib/aiEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, date, itemName, amount, notes } = body;

    if (!projectId || !date || !itemName || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (projectId, date, itemName, amount)" },
        { status: 400 }
      );
    }

    // 1. 사업 정보 조회
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: `Project not found for ID: ${projectId}` },
        { status: 404 }
      );
    }

    // 2. 기존 집행 내역 조회
    const allExpenses = await getExpenses();
    const existingExpenses = allExpenses.filter(e => e.projectId === projectId);

    // 3. AI 검토 엔진 가동
    const reviewResult = await reviewExpense(
      { itemName, amount, notes: notes || "", date, projectId },
      project,
      existingExpenses
    );

    return NextResponse.json({
      success: true,
      review: reviewResult
    });

  } catch (error: any) {
    console.error("AI check API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error in AI Review" },
      { status: 500 }
    );
  }
}
