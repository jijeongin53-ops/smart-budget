import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is no longer used. Files are uploaded directly to Google Apps Script." }, 
    { status: 405 }
  );
}
