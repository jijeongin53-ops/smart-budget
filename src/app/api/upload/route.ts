import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // Vercel Blob에 파일 업로드 (퍼블릭 접근 허용)
    const blob = await put(file.name, file, {
      access: 'public',
    });
    
    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        url: blob.url,          // Blob URL
        downloadUrl: blob.url,  // Blob은 다운로드 URL이 동일함
        driveId: blob.url       // 하위 호환성을 위해 ID 대신 URL 반환
      }
    });
  } catch (error: any) {
    console.error("Vercel Blob Upload API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file to Vercel Blob" }, 
      { status: 500 }
    );
  }
}
