import { NextResponse } from "next/server";
import { closeProject } from "@/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Missing required field: projectId" }, { status: 400 });
    }

    await closeProject(projectId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to close project:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
