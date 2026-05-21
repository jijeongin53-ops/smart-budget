import { NextRequest, NextResponse } from "next/server";
import { uploadFileToDrive } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // 파일 데이터를 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Google Drive 업로드 수행
    const result = await uploadFileToDrive(file.name, file.type, buffer);
    
    return NextResponse.json({
      success: true,
      file: {
        name: result.name,
        url: result.url,          // 구글 드라이브 뷰어 링크
        downloadUrl: result.downloadUrl, // 직접 다운로드 URL
        driveId: result.id       // 드라이브 내 고유 ID
      }
    });
  } catch (error: any) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file to Google Drive" }, 
      { status: 500 }
    );
  }
}
