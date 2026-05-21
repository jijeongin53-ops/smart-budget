import { google } from "googleapis";

export async function getGoogleSheets() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("Google service account email or private key is missing in .env.local");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  
  return { sheets, spreadsheetId: process.env.GOOGLE_SHEET_ID };
}

export async function getGoogleDrive() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("Google service account email or private key is missing in .env.local");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ],
  });

  const client = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: client as any });
  
  return { drive, folderId: process.env.GOOGLE_DRIVE_FOLDER_ID };
}

// 시트 초기화 함수: Projects, Expenses 시트 자동 생성 및 헤더 설정
export async function initBudgetSheets() {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not defined in .env.local");
  }

  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = response.data.sheets?.map(s => s.properties?.title) || [];
  
  const requiredSheets = ["Projects", "Expenses"];
  const requests = requiredSheets
    .filter(title => !existingTitles.includes(title))
    .map(title => ({
      addSheet: {
        properties: { title }
      }
    }));

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    // Projects 헤더 설정
    if (requests.some(req => req.addSheet?.properties?.title === "Projects")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Projects!A1:G1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["사업ID", "사업명", "가이드라인", "잔여예산", "예산총액", "기간", "상태"]]
        }
      });
      
      // 초기 샘플 사업 데이터 추가
      const sampleGuideline = JSON.stringify({
        allow: ["연구장비비", "재료비", "회의비", "여비", "인건비", "도서구입비"],
        deny: ["유흥비", "개인식대", "자산취득비(비지정)", "선물구입"],
        limitations: {
          "회의비": "1인당 30,000원 이하",
          "여비": "시외출장 시 여비 교통비만 허용",
          "도서구입비": "사업 관련 전공 도서만 가능"
        }
      }, null, 2);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Projects!A:G",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            ["PROJ-101", "인공지능 예산 관리 솔루션 개발", sampleGuideline, "50000000", "50000000", "2026-03-01 ~ 2026-12-31", "진행중"],
            ["PROJ-102", "스마트 팩토리 IoT 통합 사업", sampleGuideline, "30000000", "30000000", "2026-04-01 ~ 2026-11-30", "진행중"]
          ]
        }
      });
    }

    // Expenses 헤더 설정
    if (requests.some(req => req.addSheet?.properties?.title === "Expenses")) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Expenses!A1:I1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["ID", "사업ID", "날짜", "항목명", "금액", "상태", "검토의견", "적요", "증빙파일"]]
        }
      });
    }
  }

  return true;
}

// 사업 정보(Projects) 조회
export async function getProjects() {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Projects!A2:G1000",
  });
  
  const rows = response.data.values || [];
  return rows.map((row) => ({
    id: row[0] || "",
    name: row[1] || "",
    guideline: row[2] || "{}",
    remainingBudget: parseInt(row[3] || "0", 10),
    totalBudget: parseInt(row[4] || "0", 10),
    period: row[5] || "",
    status: row[6] || "진행중",
  }));
}

// 집행 계획(Expenses) 조회
export async function getExpenses() {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Expenses!A2:I1000",
  });
  
  const rows = response.data.values || [];
  return rows.map((row) => {
    let files = [];
    try {
      if (row[8]) files = JSON.parse(row[8]);
    } catch(e) {
      files = [];
    }
    
    return {
      id: row[0] || "",
      projectId: row[1] || "",
      date: row[2] || "",
      itemName: row[3] || "",
      amount: parseInt(row[4] || "0", 10),
      status: row[5] || "검토중",
      reviewComment: row[6] || "",
      notes: row[7] || "",
      files: files,
    };
  });
}

// 집행 계획(Expenses) 등록 및 예산 차감
export async function addExpense(expense: {
  projectId: string;
  date: string;
  itemName: string;
  amount: number;
  status: string;
  reviewComment: string;
  notes: string;
  files: any[];
}) {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  
  const newId = `EXP-${Date.now()}`;
  const filesString = expense.files ? JSON.stringify(expense.files) : "[]";
  
  // Expenses 시트에 내역 추가
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Expenses!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        newId, 
        expense.projectId, 
        expense.date, 
        expense.itemName, 
        expense.amount, 
        expense.status, 
        expense.reviewComment, 
        expense.notes, 
        filesString
      ]]
    }
  });

  // '승인' 또는 '주의' 등 예산 집행이 승인된 경우 Projects 시트의 잔여예산 차감
  if (expense.status === "승인" || expense.status === "주의" || expense.status === "통과") {
    await deductProjectBudget(expense.projectId, expense.amount);
  }
  
  return newId;
}

// 예산 잔액 차감 처리 내부 헬퍼
async function deductProjectBudget(projectId: string, amount: number) {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Projects!A:D",
  });
  
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === projectId);
  
  if (rowIndex === -1) return; // 사업을 찾을 수 없는 경우 무시

  const sheetRow = rowIndex + 1;
  const currentRemaining = parseInt(rows[rowIndex][3] || "0", 10);
  const newRemaining = Math.max(0, currentRemaining - amount);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Projects!D${sheetRow}`, // D열이 잔여예산
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newRemaining.toString()]]
    }
  });
}

// 구글 드라이브 파일 업로드 모듈
export async function uploadFileToDrive(
  fileName: string, 
  mimeType: string, 
  fileBuffer: Buffer
) {
  const { drive, folderId } = await getGoogleDrive();
  
  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  };
  
  const { Readable } = await import("stream");
  const media = {
    mimeType: mimeType,
    body: Readable.from(fileBuffer),
  };
  
  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id, webViewLink, webContentLink",
  });
  
  // 공유 가능한 링크로 권한 변경 (전체 공개 읽기 권한 설정)
  try {
    await drive.permissions.create({
      fileId: file.data.id!,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  } catch (error) {
    console.error("Failed to create Google Drive file permissions:", error);
  }
  
  return {
    id: file.data.id,
    name: fileName,
    url: file.data.webViewLink,
    downloadUrl: file.data.webContentLink,
  };
}

// 신규 사업(Projects) 등록
export async function addProject(project: {
  id: string;
  name: string;
  totalBudget: number;
  period: string;
}) {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not defined in .env.local");
  }

  // 기본 표준 가이드라인 세팅
  const sampleGuideline = JSON.stringify({
    allow: ["연구장비비", "재료비", "회의비", "여비", "인건비", "도서구입비"],
    deny: ["유흥비", "개인식대", "자산취득비(비지정)", "선물구입"],
    limitations: {
      "회의비": "1인당 30,000원 이하",
      "여비": "시외출장 시 여비 교통비만 허용",
      "도서구입비": "사업 관련 전공 도서만 가능"
    }
  }, null, 2);

  // Projects 시트 맨 아래에 행 추가 (잔여예산은 초기 등록 시 예산총액과 동일하게 삽입)
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Projects!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        project.id,
        project.name,
        sampleGuideline,
        project.totalBudget.toString(), // 잔여예산
        project.totalBudget.toString(), // 예산총액
        project.period,
        "진행중"
      ]]
    }
  });
}

// 사업 종료 및 결산 처리
export async function closeProject(projectId: string) {
  const { sheets, spreadsheetId } = await getGoogleSheets();
  
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not defined in .env.local");
  }

  // 1) 전체 Projects를 가져와서 해당 projectId가 몇 번째 행인지 찾음
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Projects!A:A",
  });
  
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === projectId);
  
  if (rowIndex === -1) {
    throw new Error(`Project ID ${projectId} not found.`);
  }

  const sheetRow = rowIndex + 1; // 1-indexed

  // 2) G열의 해당 행에 "종료" 업데이트
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Projects!G${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["종료"]]
    }
  });
}

