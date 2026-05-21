import { NextResponse } from "next/server";
import { getProjects, addProject } from "@/lib/googleSheets";

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ success: true, data: projects });
  } catch (error: any) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, totalBudget, period, files } = body;

    if (!id || !name || !totalBudget || !period) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await addProject({
      id,
      name,
      totalBudget: parseInt(totalBudget, 10),
      period,
      files
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to add project:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

