import { GoogleGenerativeAI } from "@google/generative-ai";

interface ReviewResult {
  status: "통과" | "주의" | "거부";
  reviewComment: string;
  suggestions?: string;
}

// 1. 규칙 기반 백업 검토 로직 (Gemini API Key가 없을 때 Failover용)
function runRuleBasedReview(
  expense: { itemName: string; amount: number; notes: string; date: string },
  project: { name: string; remainingBudget: number; guideline: string },
  existingExpenses: any[]
): ReviewResult {
  // a) 예산 초과 검사
  if (expense.amount > project.remainingBudget) {
    return {
      status: "거부",
      reviewComment: `[예산 초과] 신청하신 금액(${expense.amount.toLocaleString()}원)이 현재 사업 잔여예산(${project.remainingBudget.toLocaleString()}원)을 초과합니다.`,
      suggestions: "집행 금액을 잔액 범위 내로 조정하거나 예산 증액 처리가 필요합니다."
    };
  }

  // 가이드라인 파싱
  let guidelineObj: any = {};
  try {
    guidelineObj = JSON.parse(project.guideline);
  } catch (e) {
    guidelineObj = {};
  }

  const denyList = guidelineObj.deny || ["유흥비", "개인식대", "자산취득비(비지정)", "선물구입"];
  const limitations = guidelineObj.limitations || {};

  // b) 항목 적격성 검사
  const isDenied = denyList.some((deniedItem: string) => 
    expense.itemName.includes(deniedItem) || expense.notes.includes(deniedItem)
  );

  if (isDenied) {
    return {
      status: "거부",
      reviewComment: `[적격성 위반] 입력하신 항목('${expense.itemName}')은 해당 사업 가이드라인에서 명시적으로 제한하는 불허용 항목(유흥비, 개인식대 등)에 해당합니다.`,
      suggestions: "정부지원사업 규정에 부합하는 적격 항목(예: 연구장비비, 회의비 등)으로 변경해 주세요."
    };
  }

  // c) 한도 제한 검사 (회의비 등)
  if (expense.itemName.includes("회의비") && limitations["회의비"]) {
    // 3만원 한도 경고 (보통 1인당 3만원)
    if (expense.amount > 100000 && expense.notes.indexOf("명") === -1) {
      return {
        status: "주의",
        reviewComment: `[한도 주의] 회의비 집행 시 '1인당 30,000원 이하' 규정이 적용될 수 있으나 적요에 참석 인원이 명시되어 있지 않습니다.`,
        suggestions: "적요에 참석자 명단 및 인원을 구체적으로 작성해 주시기 바랍니다. (예: 연구개발 회의비(4명))"
      };
    }
  }

  // d) 중복 집행 검사
  const isDuplicate = existingExpenses.some(prev => 
    prev.projectId === existingExpenses[0]?.projectId &&
    prev.itemName === expense.itemName &&
    Math.abs(prev.amount - expense.amount) < 10 && // 금액이 사실상 동일
    prev.date === expense.date
  );

  if (isDuplicate) {
    return {
      status: "주의",
      reviewComment: `[중복 의심] 동일한 날짜(${expense.date})에 동일한 항목명('${expense.itemName}') 및 금액(${expense.amount.toLocaleString()}원)으로 이미 신청된 내역이 존재합니다. 이중 청구 여부를 확인해 주십시오.`,
      suggestions: "이중 청구가 아니라면 적요에 고유 식별 명칭을 작성하거나 청구 일자를 분리해 주세요."
    };
  }

  // 모든 검증 통과
  return {
    status: "통과",
    reviewComment: "가이드라인 적격성 검사를 만족하며, 기존 집행 내역과의 중복 의심 항목이 발견되지 않았습니다. 잔여 예산 한도 내에서 정상 집행 가능합니다.",
    suggestions: "승인 후 예산 기록을 완료해 주세요."
  };
}

// 2. 메인 AI 검토 엔진 (Gemini 1.5 Flash 탑재)
export async function reviewExpense(
  expense: { itemName: string; amount: number; notes: string; date: string; projectId: string },
  project: { name: string; remainingBudget: number; guideline: string },
  existingExpenses: any[]
): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // API Key가 없거나 테스트용 값이면 규칙 기반 로직으로 안전하게 대체(Failover)
  if (!apiKey || apiKey === "your_gemini_api_key_here" || apiKey.trim() === "") {
    console.warn("GEMINI_API_KEY is not defined. Falling back to Rule-Based validation.");
    return runRuleBasedReview(expense, project, existingExpenses);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } // JSON 출력 강제
    });

    const existingSummary = existingExpenses
      .filter(e => e.projectId === expense.projectId)
      .map(e => `- 날짜: ${e.date}, 항목: ${e.itemName}, 금액: ${e.amount}원, 적요: ${e.notes}, 상태: ${e.status}`)
      .join("\n");

    const prompt = `
당신은 정부지원사업 예산 집행 및 회계 관리 전문가입니다.
사용자가 입력한 새로운 예산 집행 계획이 사업 가이드라인과 기존 내역에 부합하는지 엄격히 검토하여 결과를 JSON으로 반환해 주세요.

[사업 정보]
- 사업명: ${project.name}
- 잔여 예산: ${project.remainingBudget}원
- 가이드라인 (허용/불허용/규정):
${project.guideline}

[기존 집행 내역 (동일 사업)]
${existingSummary || "없음"}

[신규 신청 내역]
- 신청 날짜: ${expense.date}
- 항목명: ${expense.itemName}
- 금액: ${expense.amount}원
- 적요(상세내용): ${expense.notes}

[검토 기준]
1. 중복 집행 여부: 동일한 날짜에 유사한 항목명과 금액이 중복 청구되었는지, 혹은 단기간 내 동일한 적요로 불필요하게 반복 집행되었는지 분석.
2. 항목 적격성: 가이드라인의 불허용 리스트나 예산 사용 규정에 위배되는 항목(개인식대, 유흥비, 사업목적과 무관한 자산 취득 등)이 포함되었는지 판단.
3. 예산 초과 여부: 신청 금액이 잔여 예산을 초과하는지 체크.

[반환 포맷 (JSON)]
반드시 아래의 구조를 가진 JSON만 출력해 주세요. JSON 외의 설명이나 백틱(\`\`\`) 없이 순수 JSON만 반환해야 합니다:
{
  "status": "통과" | "주의" | "거부",
  "reviewComment": "구체적인 회계 규정 기반의 검토 사유 설명 (존댓말 사용, 매우 전문적인 논조)",
  "suggestions": "주의나 거부 판정 시 사용자가 무엇을 수정해야 하는지에 대한 친절한 보완 방법 제시"
}
`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // JSON 파싱 시도
    try {
      const parsed: ReviewResult = JSON.parse(textResponse.trim());
      
      // 혹시 잔여예산 초과했는데 통과 처리했으면 강제로 "거부" 전환하는 안전장치
      if (expense.amount > project.remainingBudget) {
        parsed.status = "거부";
        parsed.reviewComment = `[AI 검토 보완 - 예산 초과] 신청 금액(${expense.amount.toLocaleString()}원)이 사업 잔여예산(${project.remainingBudget.toLocaleString()}원)을 초과하여 거부되었습니다.\n` + parsed.reviewComment;
      }
      
      return parsed;
    } catch (parseError) {
      console.error("AI JSON Parse Error:", parseError, textResponse);
      // JSON 파싱 에러 시 단순 텍스트 대응 또는 규칙 기반으로 대체
      return runRuleBasedReview(expense, project, existingExpenses);
    }

  } catch (error) {
    console.error("Gemini AI Review Engine Error:", error);
    // API 장애 발생 시 규칙 기반으로 안전하게 대체
    return runRuleBasedReview(expense, project, existingExpenses);
  }
}
