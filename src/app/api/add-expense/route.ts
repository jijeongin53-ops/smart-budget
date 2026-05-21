import { NextRequest, NextResponse } from "next/server";
import { addExpense } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, date, itemName, amount, status, reviewComment, notes, files } = body;

    if (!projectId || !date || !itemName || amount === undefined || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Google Sheets 'Expenses'에 추가 및 잔액 차감 처리 수행
    const newId = await addExpense({
      projectId,
      date,
      itemName,
      amount: parseInt(amount, 10),
      status,
      reviewComment: reviewComment || "",
      notes: notes || "",
      files: files || []
    });

    return NextResponse.json({
      success: true,
      expenseId: newId,
      message: "Expense plan successfully recorded in Google Sheets"
    });

  } catch (error: any) {
    console.error("Add expense API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record expense" },
      { status: 500 }
    );
  }
}
