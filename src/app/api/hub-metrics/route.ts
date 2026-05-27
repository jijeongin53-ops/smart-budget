import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/googleSheets';

export async function GET() {
  try {
    const projects = await getProjects();
    const count = projects.length;
    
    return NextResponse.json({
      metricName: "등록 사업 수",
      value: count
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}
