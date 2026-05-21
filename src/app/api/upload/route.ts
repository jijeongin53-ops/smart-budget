import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;
    
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          // 허용할 파일 확장자 (이미지, PDF, 오피스 문서 등)
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip', 'text/csv'
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 최대 50MB
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Vercel Blob 클라이언트 업로드 완료:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Vercel Blob Client Upload API error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to upload file to Vercel Blob" }, 
      { status: 400 } // Vercel Blob 클라이언트 스펙상 에러는 400으로 내려야 함
    );
  }
}
