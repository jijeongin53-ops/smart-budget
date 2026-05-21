"use client";

import { useState, useEffect, useRef } from "react";

interface Project {
  id: string;
  name: string;
  guideline: string;
  remainingBudget: number;
  totalBudget: number;
  period: string;
  status: string;
}

interface Expense {
  id: string;
  projectId: string;
  date: string;
  itemName: string;
  amount: number;
  status: string;
  reviewComment: string;
  notes: string;
  files: Array<{ name: string; url: string; driveId?: string }>;
}

// 간단한 마크다운 렌더러 구현 (CPA 보고서 파싱용)
const renderMarkdown = (md: string) => {
  if (!md) return null;
  return md.split("\n").map((line, idx) => {
    const trimmed = line.trim();
    
    // 제목 H3
    if (trimmed.startsWith("###")) {
      return (
        <h3 key={idx} style={{ fontSize: "14.5px", fontWeight: "800", color: "var(--color-primary)", marginTop: "18px", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>
          {trimmed.replace(/###/g, "").replace(/\*\*/g, "").trim()}
        </h3>
      );
    }
    // 제목 H4
    if (trimmed.startsWith("####")) {
      return (
        <h4 key={idx} style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)", marginTop: "12px", marginBottom: "6px" }}>
          {trimmed.replace(/####/g, "").replace(/\*\*/g, "").trim()}
        </h4>
      );
    }
    // 수평선
    if (trimmed === "---") {
      return <hr key={idx} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", margin: "14px 0" }} />;
    }
    // 불릿 포인트
    if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
      const rawContent = trimmed.substring(1).trim();
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(rawContent)) !== null) {
        if (match.index > lastIndex) {
          parts.push(rawContent.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} style={{ color: "var(--color-secondary)" }}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < rawContent.length) {
        parts.push(rawContent.substring(lastIndex));
      }

      return (
        <li key={idx} style={{ marginLeft: "14px", marginBottom: "6px", listStyleType: "disc", color: "var(--text-main)" }}>
          {parts.length > 0 ? parts : rawContent}
        </li>
      );
    }
    
    // 테이블 행 파싱 (예: | 구분 | 발생 건수 | 리스크 판정 | 회계 및 감사 의견 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.includes("---")) return null;
      
      const cols = trimmed.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      // 첫번째 테이블 행이 헤더이거나 특정 구조이면 헤더 스타일 적용
      const isHeader = trimmed.includes("구분") || trimmed.includes("발생 건수");
      
      return (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: "8px", padding: "8px", background: isHeader ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "11px", borderRadius: isHeader ? "4px 4px 0 0" : "0" }}>
          {cols.map((col, cIdx) => (
            <span key={cIdx} style={{ fontWeight: isHeader ? "bold" : "normal", color: isHeader ? "var(--color-primary)" : "var(--text-main)" }}>
              {col.replace(/\*\*/g, "")}
            </span>
          ))}
        </div>
      );
    }
    
    // 일반 줄바꿈 및 강조 처리
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(trimmed)) !== null) {
      if (match.index > lastIndex) {
        parts.push(trimmed.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} style={{ color: "var(--color-primary)" }}>{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < trimmed.length) {
      parts.push(trimmed.substring(lastIndex));
    }

    return (
      <p key={idx} style={{ marginBottom: "8px", minHeight: trimmed === "" ? "8px" : "auto", color: "var(--text-main)" }}>
        {parts.length > 0 ? parts : trimmed}
      </p>
    );
  });
};

export default function BudgetDashboard() {
  // 상태 관리
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sheetInitialized, setSheetInitialized] = useState<boolean>(false);
  const [initializingSheet, setInitializingSheet] = useState<boolean>(false);
  const [isLightTheme, setIsLightTheme] = useState<boolean>(false);

  // 사업 결산 관리 상태
  const [projectFilterStatus, setProjectFilterStatus] = useState<"진행중" | "종료">("진행중");
  const [settlementData, setSettlementData] = useState<any>(null);
  const [settlementLoading, setSettlementLoading] = useState<boolean>(false);
  const [closingProject, setClosingProject] = useState<boolean>(false);

  // 사업 대시보드 필터링 탭 상태
  const [activeProjectId, setActiveProjectId] = useState<string>("ALL");

  // 새 사업 추가 모달 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newProjId, setNewProjId] = useState<string>("");
  const [newProjName, setNewProjName] = useState<string>("");
  const [newProjBudget, setNewProjBudget] = useState<string>("");
  const [newProjPeriod, setNewProjPeriod] = useState<string>("");
  const [addingProj, setAddingProj] = useState<boolean>(false);

  // 입력 폼 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>(""); // 콤마 포맷팅용 텍스트
  const [notes, setNotes] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; driveId?: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);

  // AI 검토 엔진 상태
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewResult, setReviewResult] = useState<{
    status: "통과" | "주의" | "거부" | null;
    reviewComment: string;
    suggestions?: string;
  } | null>(null);

  // 아코디언 행 관리
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  
  // 상태별 리스트 필터링
  const [statusFilter, setStatusFilter] = useState<string>("전체");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newProjFileInputRef = useRef<HTMLInputElement>(null);
  const [newProjFiles, setNewProjFiles] = useState<Array<{ name: string; url: string; driveId?: string }>>([]);
  const [uploadingNewProjFile, setUploadingNewProjFile] = useState<boolean>(false);

  // 라이트 테마 활성화 토글 이펙트
  useEffect(() => {
    const root = window.document.documentElement;
    if (isLightTheme) {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
  }, [isLightTheme]);

  // 데이터 로드 함수
  const loadData = async () => {
    try {
      setLoading(true);
      const projRes = await fetch("/api/projects");
      const projData = await projRes.json();
      
      const expRes = await fetch("/api/expenses");
      const expData = await expRes.json();

      if (projData.success && projData.data) {
        setProjects(projData.data);
        if (projData.data.length > 0 && !selectedProjectId) {
          const firstActive = projData.data.find((p: any) => p.status === "진행중");
          setSelectedProjectId(firstActive ? firstActive.id : projData.data[0].id);
        }
        setSheetInitialized(true);
      } else {
        // 시트가 없거나 오류가 발생했을 때
        setSheetInitialized(false);
      }

      if (expData.success && expData.data) {
        setExpenses(expData.data);
      }
    } catch (error) {
      console.error("데이터 로드 오류:", error);
      setSheetInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  // 마운트 시 데이터 호출
  useEffect(() => {
    // 오늘 날짜 기본 설정
    const today = new Date().toISOString().split("T")[0];
    setExpenseDate(today);
    loadData();
  }, []);

  // 구글 시트 데이터베이스 초기화(Projects & Expenses 테이블 및 예제 데이터 세팅)
  const handleInitSheets = async () => {
    try {
      setInitializingSheet(true);
      const res = await fetch("/api/init", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Google Sheets 데이터베이스 테이블이 성공적으로 생성 및 초기화되었습니다!");
        loadData();
      } else {
        alert("구글 시트 초기화 실패: " + data.error);
      }
    } catch (e: any) {
      alert("구글 시트 연동 오류: " + e.message);
    } finally {
      setInitializingSheet(false);
    }
  };

  // 결산 데이터 로드 함수
  const loadSettlementData = async (projId: string) => {
    try {
      setSettlementLoading(true);
      const res = await fetch(`/api/projects/settlement?projectId=${projId}`);
      const data = await res.json();
      if (data.success) {
        setSettlementData(data.data);
      } else {
        console.error("결산 데이터 로드 에러:", data.error);
      }
    } catch (e) {
      console.error("결산 데이터 API 오류:", e);
    } finally {
      setSettlementLoading(false);
    }
  };

  // 탭 변경 시 호출 (필터 변경 및 폼 대상 사업 동기화, 결산 리포트 연계)
  const handleTabChange = async (projId: string) => {
    setActiveProjectId(projId);
    setSettlementData(null);
    
    if (projId !== "ALL" && projId !== "NONE") {
      setSelectedProjectId(projId);
      const proj = projects.find(p => p.id === projId);
      if (proj && proj.status === "종료") {
        await loadSettlementData(projId);
      }
    } else if (projects.length > 0) {
      const firstActive = projects.find(p => p.status === "진행중");
      if (firstActive) {
        setSelectedProjectId(firstActive.id);
      } else {
        setSelectedProjectId(projects[0].id);
      }
    }
  };

  // 사업 종료 및 AI 회계 결산 실행
  const handleCloseProject = async (projId: string) => {
    if (!confirm(`정말 [${projId}] 사업을 종료하고 AI 회계 결산을 진행하시겠습니까?\n종료 후에는 신규 지출 등록이 완전히 제한됩니다.`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/projects/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId })
      });
      const data = await res.json();
      if (data.success) {
        alert("사업이 성공적으로 종료 및 결산 처리되었습니다!");
        
        // 프로젝트 리로드
        const projRes = await fetch("/api/projects");
        const projData = await projRes.json();
        if (projData.success && projData.data) {
          setProjects(projData.data);
        }
        
        // 탭 상태를 '종료'로 바꾸고 프로젝트 활성화
        setProjectFilterStatus("종료");
        await handleTabChange(projId);
      } else {
        alert("사업 종료 처리 실패: " + data.error);
      }
    } catch (e: any) {
      alert("사업 종료 API 에러: " + e.message);
    } finally {
      setLoading(false);
    }
  };


  // 금액 숫자 포맷터 및 한글 변환
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/,/g, "");
    if (/^\d*$/.test(rawVal)) {
      const formatted = rawVal ? parseInt(rawVal, 10).toLocaleString("ko-KR") : "";
      setAmountInput(formatted);
    }
  };

  // 모달 예산 콤마 변경 핸들러
  const handleNewProjBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/,/g, "");
    if (/^\d*$/.test(rawVal)) {
      const formatted = rawVal ? parseInt(rawVal, 10).toLocaleString("ko-KR") : "";
      setNewProjBudget(formatted);
    }
  };

  // 숫자를 한글 금액으로 표시 (예: 50000 -> 오만 원)
  const getKoreanAmount = (numStr: string): string => {
    const num = parseInt(numStr.replace(/,/g, ""), 10);
    if (isNaN(num) || num <= 0) return "";
    
    const units = ["", "만", "억", "조"];
    const nums = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const positions = ["", "십", "백", "천"];
    
    let result = "";
    let splitNum = num;
    let unitIdx = 0;
    
    while (splitNum > 0) {
      const chunk = splitNum % 10000;
      splitNum = Math.floor(splitNum / 10000);
      
      if (chunk === 0) {
        unitIdx++;
        continue;
      }
      
      let chunkStr = "";
      let chunkNum = chunk;
      for (let i = 0; i < 4; i++) {
        const digit = chunkNum % 10;
        chunkNum = Math.floor(chunkNum / 10);
        
        if (digit > 0) {
          chunkStr = nums[digit] + positions[i] + chunkStr;
        }
      }
      
      if (chunkStr.startsWith("일십")) {
        chunkStr = chunkStr.substring(1);
      }
      
      result = chunkStr + units[unitIdx] + result;
      unitIdx++;
    }
    
    return result + " 원";
  };

  // 증빙서류 구글 드라이브 파일 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingFile(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.file) {
        setUploadedFiles(prev => [...prev, data.file]);
      } else {
        alert("파일 업로드 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("업로드 API 호출 오류: " + err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 드래그앤드롭 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingFile(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.file) {
        setUploadedFiles(prev => [...prev, data.file]);
      } else {
        alert("파일 업로드 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("업로드 오류: " + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  // 업로드 칩 제거
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 새 사업 등록 파일 업로드 처리
  const handleNewProjFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (newProjFiles.length >= 10) return alert("파일은 최대 10개까지만 업로드할 수 있습니다.");
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingNewProjFile(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.file) {
        setNewProjFiles(prev => [...prev, data.file]);
      } else {
        alert("파일 업로드 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("업로드 API 호출 오류: " + err.message);
    } finally {
      setUploadingNewProjFile(false);
      if (newProjFileInputRef.current) newProjFileInputRef.current.value = "";
    }
  };

  const handleNewProjDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (newProjFiles.length >= 10) return alert("파일은 최대 10개까지만 업로드할 수 있습니다.");
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingNewProjFile(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.file) {
        setNewProjFiles(prev => [...prev, data.file]);
      } else {
        alert("파일 업로드 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch (err: any) {
      alert("업로드 오류: " + err.message);
    } finally {
      setUploadingNewProjFile(false);
    }
  };

  const handleRemoveNewProjFile = (index: number) => {
    setNewProjFiles(prev => prev.filter((_, i) => i !== index));
  };

  // AI 실시간 예산 적격성 검토 요청
  const handleAICheck = async () => {
    const rawAmount = parseInt(amountInput.replace(/,/g, ""), 10);
    if (!selectedProjectId) return alert("심사할 사업을 선택해 주세요.");
    if (!itemName) return alert("검토할 항목명을 입력해 주세요.");
    if (isNaN(rawAmount) || rawAmount <= 0) return alert("유효한 집행 금액을 입력해 주세요.");
    if (!notes) return alert("적요(상세내용)를 입력해 주세요.");

    try {
      setReviewLoading(true);
      setReviewResult(null);

      const res = await fetch("/api/check-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: expenseDate,
          itemName,
          amount: rawAmount,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success && data.review) {
        setReviewResult(data.review);
      } else {
        alert("AI 검토 중 오류 발생: " + (data.error || "응답 데이터가 올바르지 않습니다."));
      }
    } catch (err: any) {
      alert("AI 검토 API 호출 오류: " + err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  // Google Sheets에 집행 내역 최종 기록
  const handleRecordExpense = async () => {
    if (!reviewResult || reviewResult.status === "거부") return;
    const rawAmount = parseInt(amountInput.replace(/,/g, ""), 10);

    try {
      setLoading(true);
      const res = await fetch("/api/add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: expenseDate,
          itemName,
          amount: rawAmount,
          status: reviewResult.status === "통과" ? "승인" : "주의", // 주의 판정은 그대로 기록 가능
          reviewComment: reviewResult.reviewComment,
          notes,
          files: uploadedFiles,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("예산 집행 계획이 Google Sheets 'Expenses' 시트에 정상 기록되었으며 예산 차감이 완료되었습니다!");
        
        // 입력 폼 초기화
        setItemName("");
        setAmountInput("");
        setNotes("");
        setUploadedFiles([]);
        setReviewResult(null);
        
        // 대시보드 리프레시
        await loadData();
      } else {
        alert("구글 시트 기록 실패: " + data.error);
      }
    } catch (err: any) {
      alert("집행 등록 API 호출 오류: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 새 사업 등록 처리
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawBudget = parseInt(newProjBudget.replace(/,/g, ""), 10);
    if (!newProjId.trim()) return alert("사업 코드를 입력해 주세요.");
    if (!newProjName.trim()) return alert("사업 명칭을 입력해 주세요.");
    if (isNaN(rawBudget) || rawBudget <= 0) return alert("올바른 예산 총액을 입력해 주세요.");
    if (!newProjPeriod.trim()) return alert("사업 기간을 입력해 주세요.");

    try {
      setAddingProj(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newProjId,
          name: newProjName,
          totalBudget: rawBudget,
          period: newProjPeriod,
          files: newProjFiles
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("새로운 관리 사업이 성공적으로 등록되었습니다!");
        setIsModalOpen(false);
        // 모달 폼 초기화
        setNewProjId("");
        setNewProjName("");
        setNewProjBudget("");
        setNewProjPeriod("");
        setNewProjFiles([]);
        
        // 선택 사업 탭을 방금 추가한 사업으로 동기 변경
        setActiveProjectId(newProjId);
        setSelectedProjectId(newProjId);
        
        // 대시보드 데이터 새로고침
        await loadData();
      } else {
        alert("사업 등록 실패: " + data.error);
      }
    } catch (err: any) {
      alert("사업 등록 API 연동 오류: " + err.message);
    } finally {
      setAddingProj(false);
    }
  };

  // 대시보드 통계 산출 (선택된 사업 필터링 반영)
  const isFiltered = activeProjectId !== "ALL";
  const selectedProj = projects.find(p => p.id === activeProjectId);

  // 1) 전체 사업 통계
  const totalBudgetSumAll = projects.reduce((acc, curr) => acc + curr.totalBudget, 0);
  const remainingBudgetSumAll = projects.reduce((acc, curr) => acc + curr.remainingBudget, 0);
  const spentBudgetSumAll = totalBudgetSumAll - remainingBudgetSumAll;
  const remainingPercentSumAll = totalBudgetSumAll > 0 ? Math.round((remainingBudgetSumAll / totalBudgetSumAll) * 100) : 0;

  // 2) 선택된 개별 사업 또는 전체 통계 결정
  const totalBudgetSum = isFiltered && selectedProj ? selectedProj.totalBudget : totalBudgetSumAll;
  const remainingBudgetSum = isFiltered && selectedProj ? selectedProj.remainingBudget : remainingBudgetSumAll;
  const spentBudgetSum = isFiltered && selectedProj ? (selectedProj.totalBudget - selectedProj.remainingBudget) : spentBudgetSumAll;
  const remainingPercentSum = isFiltered && selectedProj 
    ? (selectedProj.totalBudget > 0 ? Math.round((selectedProj.remainingBudget / selectedProj.totalBudget) * 100) : 0)
    : remainingPercentSumAll;

  // 필터링된 집행 목록 산출 (사업 필터 및 상태 필터 종합 적용)
  const filteredExpenses = expenses.filter(exp => {
    const targetProject = projects.find(p => p.id === exp.projectId);
    
    // 1) 대그룹 필터(진행중 vs 종료)와 일치하는 프로젝트의 지출만 노출
    if (targetProject) {
      const isClosed = targetProject.status === "종료";
      if (projectFilterStatus === "진행중" && isClosed) return false;
      if (projectFilterStatus === "종료" && !isClosed) return false;
    } else {
      if (projectFilterStatus === "종료") return false;
    }

    // 2) 사업 코드 필터링
    if (activeProjectId !== "ALL" && activeProjectId !== "NONE" && exp.projectId !== activeProjectId) return false;
    
    // 3) 상태 필터링
    if (statusFilter === "전체") return true;
    return exp.status === statusFilter || (statusFilter === "승인" && exp.status === "통과");
  });

  return (
    <div className="app-container">
      {/* 1. 글로벌 네비게이션 헤더 */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00f2fe"/>
                  <stop offset="1" stopColor="#4facfe"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>SMART BUDGET <span>AI</span></h1>
        </div>
        
        {/* 구글 시트 연결 상태 배지 (초기화 안된 경우에만 표시) */}
        <div className="header-controls">
          {!sheetInitialized && (
            <div className="sheets-connection-badge">
              <div className="pulse-indicator disconnected" id="sync-pulse"></div>
              <div className="sheets-info">
                <span className="status-label">Google Sheets DB</span>
                <span className="status-value">연동 필요 (Disconnected)</span>
              </div>
            </div>
          )}

          {!sheetInitialized && (
            <button
              onClick={handleInitSheets}
              disabled={initializingSheet || loading}
              className="btn btn-primary"
              style={{ padding: "8px 16px", fontSize: "12px" }}
            >
              {initializingSheet ? "시트 구축 중..." : "시트 연동하기"}
            </button>
          )}

          {/* 테마 토글 버튼 */}
          <button 
            onClick={() => setIsLightTheme(!isLightTheme)} 
            className="icon-button" 
            title="테마 변경"
          >
            <svg className="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg className="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* 로딩 인디케이터 */}
      {loading && (
        <div className="loading-overlay">
          <div style={{ textAlign: "center" }}>
            <div className="loading-spinner"></div>
            <p className="loading-text">데이터베이스를 동기화하고 있습니다...</p>
          </div>
        </div>
      )}

      {/* 2. 사업 전환 탭 바 및 새 사업 추가 통합 */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 대그룹 필터 탭 바 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div className="filter-tabs" style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                setProjectFilterStatus("진행중");
                handleTabChange("ALL");
              }}
              className={`filter-tab ${projectFilterStatus === "진행중" ? "active" : ""}`}
              style={{ fontSize: "14px", fontWeight: "bold", padding: "10px 20px" }}
            >
              🟢 진행 중 사업
            </button>
            <button
              onClick={() => {
                setProjectFilterStatus("종료");
                const firstClosed = projects.find(p => p.status === "종료");
                if (firstClosed) {
                  handleTabChange(firstClosed.id);
                } else {
                  handleTabChange("NONE");
                }
              }}
              className={`filter-tab ${projectFilterStatus === "종료" ? "active" : ""}`}
              style={{ fontSize: "14px", fontWeight: "bold", padding: "10px 20px" }}
            >
              🔒 결산 완료 사업
            </button>
          </div>
          
          {/* 새 사업 추가 트리거 버튼 */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "10px" }}
          >
            ➕ 새 사업 추가
          </button>
        </div>

        {/* 소그룹 개별 사업 선택 탭 목록 */}
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <nav className="filter-tabs" style={{ flex: 1, display: "flex", overflowX: "auto", padding: "6px" }}>
            {projectFilterStatus === "진행중" && (
              <button 
                onClick={() => handleTabChange("ALL")}
                className={`filter-tab ${activeProjectId === "ALL" ? "active" : ""}`}
                style={{ fontSize: "13px", padding: "8px 16px", whiteSpace: "nowrap" }}
              >
                📊 전체 사업 대시보드
              </button>
            )}
            {projects
              .filter((proj) => projectFilterStatus === "진행중" ? (proj.status !== "종료") : (proj.status === "종료"))
              .map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleTabChange(proj.id)}
                  className={`filter-tab ${activeProjectId === proj.id ? "active" : ""}`}
                  style={{ fontSize: "13px", padding: "8px 16px", whiteSpace: "nowrap" }}
                >
                  {proj.status === "종료" ? "🔒" : "📁"} [{proj.id}] {proj.name}
                </button>
              ))}
            {projectFilterStatus === "종료" && projects.filter(p => p.status === "종료").length === 0 && (
              <span style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 16px" }}>
                결산 완료된 사업이 존재하지 않습니다.
              </span>
            )}
          </nav>
        </div>
      </div>

      {/* 3. 대시보드 지표 카드 행 (동적 필터 적용) */}
      <section className="metrics-row">
        <div className="metric-card glass-card">
          <div className="metric-icon">📂</div>
          <div className="metric-details">
            <h4>{isFiltered ? "선택된 사업 코드" : "전체 관리 사업"}</h4>
            <div className="metric-value" style={{ fontSize: isFiltered ? "18px" : "20px" }}>
              {isFiltered ? activeProjectId : `${projects.length}개 사업`}
            </div>
            <p className="metric-sub">{isFiltered ? "단일 집중 관제 모드" : "전체 포트폴리오 요약"}</p>
          </div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon">💰</div>
          <div className="metric-details">
            <h4>{isFiltered ? "해당 사업 예산" : "총 예산 규모"}</h4>
            <div className="metric-value">{totalBudgetSum.toLocaleString()}원</div>
            <p className="metric-sub">지정 매칭 지원 예산</p>
          </div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon">📉</div>
          <div className="metric-details">
            <h4>집행 누적액</h4>
            <div className="metric-value">{spentBudgetSum.toLocaleString()}원</div>
            <p className="metric-sub">검증 완료 예산 집행분</p>
          </div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon">❇️</div>
          <div className="metric-details">
            <h4>예산 잔여율</h4>
            <div className="metric-value" style={{ color: "var(--color-primary)" }}>{remainingPercentSum}%</div>
            <p className="metric-sub">{remainingBudgetSum.toLocaleString()}원 잔여</p>
          </div>
          <div className="budget-bar">
            <div className="budget-bar-fill" style={{ width: `${remainingPercentSum}%` }}></div>
          </div>
        </div>
      </section>

      {/* 4. 진행 중인 사업별 예산 잔액 현황 (전체 보기일 때만 혹은 선택된 사업 강조) */}
      <section style={{ width: "100%" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "inline-block", width: "4px", height: "16px", background: "var(--color-primary)", borderRadius: "2px" }}></span>
          {projectFilterStatus === "진행중" 
            ? (isFiltered ? `선택된 사업 상세 예산 현황` : `진행 중인 모든 사업별 예산 현황`)
            : `결산 완료된 사업별 예산 현황`
          }
        </h2>
        
        <div className="dashboard-grid">
          {projects
            .filter(proj => projectFilterStatus === "진행중" ? (proj.status !== "종료") : (proj.status === "종료"))
            .filter(proj => !isFiltered || proj.id === activeProjectId)
            .map((proj) => {
              const ratio = proj.totalBudget > 0 ? Math.round((proj.remainingBudget / proj.totalBudget) * 100) : 0;
              return (
                <div key={proj.id} className="glass-card" style={{ gap: "12px", position: "relative", border: isFiltered ? "1.5px solid var(--color-primary)" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span className={`status-badge ${proj.status === "종료" ? "pass" : "pending"}`}>{proj.id}</span>
                        {proj.status !== "종료" ? (
                          <span className="live-tag">ACTIVE</span>
                        ) : (
                          <span className="live-tag" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>CLOSED</span>
                        )}
                      </div>
                      <h4 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-main)" }}>{proj.name}</h4>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>사업 기간</span>
                      <span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 600 }}>{proj.period}</span>
                    </div>
                  </div>

                  <div className="progress-container">
                    <div className="progress-label-row">
                      <span style={{ color: "var(--text-muted)" }}>잔여 예산 비율</span>
                      <span style={{ color: ratio < 20 ? "var(--status-error)" : ratio < 50 ? "var(--status-warning)" : "var(--status-success)" }}>
                        {ratio}% ({proj.remainingBudget.toLocaleString()}원)
                      </span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className={`progress-bar-fill ${ratio < 20 ? "danger" : ratio < 50 ? "warning" : ""}`}
                        style={{ width: `${ratio}%` }}
                      ></div>
                    </div>
                    <div className="progress-footer" style={{ marginBottom: "8px" }}>
                      <span>집행: {(proj.totalBudget - proj.remainingBudget).toLocaleString()}원</span>
                      <span>총한도: {proj.totalBudget.toLocaleString()}원</span>
                    </div>

                    {proj.status !== "종료" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseProject(proj.id);
                        }}
                        className="btn btn-secondary"
                        style={{
                          width: "100%",
                          marginTop: "16px",
                          padding: "10px",
                          fontSize: "12px",
                          borderRadius: "8px",
                          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#f87171",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}
                      >
                        🔒 사업 종료 및 회계 결산
                      </button>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          marginTop: "16px",
                          padding: "10px",
                          fontSize: "12px",
                          borderRadius: "8px",
                          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          color: "#34d399",
                          fontWeight: "bold",
                          textAlign: "center"
                        }}
                      >
                        🔒 본 사업은 결산 완료되었습니다 (수정 불가)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {projects.filter(proj => projectFilterStatus === "진행중" ? (proj.status !== "종료") : (proj.status === "종료")).length === 0 && (
            <div className="glass-card span-full" style={{ padding: "40px", textAlign: "center", borderStyle: "dashed", color: "var(--text-muted)" }}>
              {projectFilterStatus === "진행중" 
                ? "진행 중인 사업이 없습니다. 상단 '새 사업 추가'를 통해 신규 사업을 등록해 주세요."
                : "결산 완료된 사업이 없습니다. 진행 중인 사업에서 '사업 종료 및 회계 결산'을 수행해 주세요."
              }
            </div>
          )}
        </div>
      </section>

      {/* 5. 실시간 예산 적격성 검토 및 결산 분석 뷰 */}
      <section className="dashboard-grid">
        {/* 좌측 카드: 진행중이면 지출 입력 폼, 종료 상태이면 결산 분석 및 네온 차트 */}
        {selectedProj && selectedProj.status === "종료" ? (
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card-header">
              <h3>🔒 결산 분석 대시보드</h3>
            </div>
            
            {/* 잠금 안내 배너 */}
            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.03) 100%)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: "28px" }}>🔒</div>
              <h4 style={{ color: "#f87171", fontWeight: "bold", fontSize: "14px" }}>본 사업은 결산 완료되었습니다.</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "11.5px", lineHeight: "1.5" }}>
                안전한 국비 집행 감사를 위해 지출 입력, 수정 및 실시간 심사 기능이 완전히 잠금(Read-Only) 처리되었습니다.
              </p>
            </div>

            {/* 네온 바 차트 (바닐라 CSS) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                📊 카테고리별 지출 비중 분석
              </h4>
              
              {settlementLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
                  <div className="loading-spinner"></div>
                </div>
              ) : settlementData && settlementData.categoryDistribution && settlementData.categoryDistribution.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {settlementData.categoryDistribution.map((cat: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-main)", fontWeight: "600" }}>{cat.name}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {cat.percentage}% ({cat.value.toLocaleString()}원)
                        </span>
                      </div>
                      
                      {/* 네온 바 (바닐라 CSS) */}
                      <div
                        style={{
                          height: "10px",
                          width: "100%",
                          background: "var(--border-card)",
                          borderRadius: "5px",
                          overflow: "hidden",
                          position: "relative"
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${cat.percentage}%`,
                            borderRadius: "5px",
                            // 네온 그라데이션 디자인
                            background: idx === 0 
                              ? "linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)" 
                              : idx === 1 
                              ? "linear-gradient(90deg, #34d399 0%, #059669 100%)" 
                              : idx === 2 
                              ? "linear-gradient(90deg, #facc15 0%, #ca8a04 100%)"
                              : "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)",
                            boxShadow: idx === 0 
                              ? "0 0 8px rgba(0, 242, 254, 0.6)" 
                              : idx === 1 
                              ? "0 0 8px rgba(52, 211, 153, 0.6)" 
                              : "none",
                            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "30px" }}>
                  집행 내역이 존재하지 않아 비중 차트를 렌더링할 수 없습니다.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 지출 입력 폼 카드 */
          <div className="glass-card">
            <div className="card-header">
              <h3>📝 신규 예산 집행 계획 입력</h3>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>집행 대상 사업</label>
                <div className="select-custom">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    {projects
                      .filter(proj => proj.status !== "종료")
                      .map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          [{proj.id}] {proj.name} (잔여: {proj.remainingBudget.toLocaleString()}원)
                        </option>
                      ))}
                    {projects.filter(proj => proj.status !== "종료").length === 0 && (
                      <option value="">진행 중인 사업이 없습니다</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>집행 예정 일자</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="custom-input"
                  />
                </div>

                <div className="form-group">
                  <label>집행 항목명</label>
                  <input
                    type="text"
                    placeholder="예: AI 모델 서빙 API 비용, 연구개발용 센서 구매"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="custom-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>집행 금액 (원)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="금액을 입력해 주세요"
                    value={amountInput}
                    onChange={handleAmountChange}
                    className="custom-input"
                    style={{ paddingRight: "40px", fontWeight: "bold" }}
                  />
                  <span style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontWeight: "bold" }}>₩</span>
                </div>
                {amountInput && (
                  <div className="ko-amount-badge">
                    한글 변환: {getKoreanAmount(amountInput)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>적요 (상세 목적 및 소명 사유)</label>
                <textarea
                  placeholder="상세 내용을 적어주세요. 예: 시제품 IoT 허브 제작용 임베디드 모듈 10개 구매(연구재료비)"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="custom-input"
                ></textarea>
              </div>

              {/* 파일 업로드 컴포넌트 */}
              <div className="form-group">
                <label>증빙서류 파일 업로드</label>
                <div className="file-upload-section">
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="drag-drop-zone"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      style={{ display: "none" }} 
                    />
                    <div className="upload-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <p className="upload-prompt">마우스로 증빙서류를 끌어놓거나 <span>파일 선택</span></p>
                    <p className="upload-limit">영수증, 명세서 (PDF, PNG, JPG 최대 50MB)</p>
                    
                    {uploadingFile && (
                      <div style={{ width: "80px", height: "3px", background: "var(--border-card)", borderRadius: "4px", overflow: "hidden", marginTop: "8px" }}>
                        <div style={{ width: "100%", height: "100%", background: "var(--color-primary)", animation: "spin 1.5s linear infinite" }}></div>
                      </div>
                    )}
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="file-chips-container">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="file-chip">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            {file.name}
                          </a>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveFile(idx)} 
                            className="file-remove-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleAICheck}
                disabled={reviewLoading || loading || !selectedProjectId}
                className="btn btn-primary"
                style={{ marginTop: "12px", padding: "14px" }}
              >
                {reviewLoading ? "Gemini AI 회계 가이드라인 심사 중..." : "🔎 실시간 AI 예산 집행 규정 검토"}
              </button>
            </div>
          </div>
        )}

        {/* 우측 카드: 진행중이면 실시간 심사결과 보고서, 종료 상태이면 AI 공인회계사 종합 결산 보고서 */}
        {selectedProj && selectedProj.status === "종료" ? (
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", minHeight: "500px" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📜</span>
                <h3 style={{ fontSize: "15px", fontWeight: "bold" }}>AI 공인회계사 종합 회계 감사 보고서</h3>
              </div>
              <span 
                className="live-tag" 
                style={{ 
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" 
                }}
              >
                CPA AUDITED
              </span>
            </div>

            {settlementLoading ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                <div className="loading-spinner"></div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Gemini AI 공인회계사 감사 보고서를 컴파일 중입니다...</p>
              </div>
            ) : settlementData ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* 핵심 성과 요약 배지들 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div 
                    style={{ 
                      background: "rgba(255,255,255,0.03)", 
                      border: "1px solid var(--border-card)", 
                      borderRadius: "10px", 
                      padding: "10px",
                      textAlign: "center"
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>종합 효율 등급</span>
                    <span 
                      style={{ 
                        fontSize: "22px", 
                        fontWeight: "950", 
                        background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        display: "inline-block",
                        marginTop: "2px"
                      }}
                    >
                      {settlementData.efficiencyGrade} 등급
                    </span>
                  </div>
                  <div 
                    style={{ 
                      background: "rgba(255,255,255,0.03)", 
                      border: "1px solid var(--border-card)", 
                      borderRadius: "10px", 
                      padding: "10px",
                      textAlign: "center"
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>총 집행률</span>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", display: "block", marginTop: "4px" }}>
                      {settlementData.spentRate}%
                    </span>
                  </div>
                  <div 
                    style={{ 
                      background: "rgba(255,255,255,0.03)", 
                      border: "1px solid var(--border-card)", 
                      borderRadius: "10px", 
                      padding: "10px",
                      textAlign: "center"
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>반납 예산율</span>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#34d399", display: "block", marginTop: "4px" }}>
                      {settlementData.savingRate}%
                    </span>
                  </div>
                </div>

                {/* 위험도 감지 대시보드 */}
                <div 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-around", 
                    background: "rgba(0,0,0,0.15)", 
                    padding: "12px", 
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.05)"
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>규정 위반 주의</span>
                    <span style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: settlementData.warningCount > 0 ? "var(--status-warning)" : "var(--text-muted)", marginTop: "2px" }}>
                      ⚠️ {settlementData.warningCount} 건
                    </span>
                  </div>
                  <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>집행 거부(REJECT)</span>
                    <span style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: settlementData.rejectCount > 0 ? "var(--status-error)" : "var(--text-muted)", marginTop: "2px" }}>
                      🚨 {settlementData.rejectCount} 건
                    </span>
                  </div>
                </div>

                {/* CPA 감사 보고서 마크다운 출력 */}
                <div 
                  className="audit-report-container"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: "600px",
                    padding: "20px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid var(--border-card)",
                    fontSize: "13px",
                    lineHeight: "1.8",
                    color: "var(--text-main)",
                    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)"
                  }}
                >
                  <div className="markdown-body">
                    {settlementData.auditReportMarkdown ? (
                      renderMarkdown(settlementData.auditReportMarkdown)
                    ) : (
                      <p style={{ color: "var(--text-muted)" }}>보고서 데이터가 비어 있습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                결산 보고서를 불러오는 데 실패했습니다.
              </div>
            )}
          </div>
        ) : (
          /* AI 심사결과 리포트 카드 */
          <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-header">
              <h3>📑 AI 실시간 회계 심증 보고서</h3>
              <span className="live-tag">LIVE SYNC</span>
            </div>

            {!reviewResult && !reviewLoading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px", color: "var(--text-muted)", gap: "12px" }}>
                <div style={{ fontSize: "40px" }}>⏳</div>
                <h4 style={{ color: "var(--text-main)", fontWeight: 700 }}>심사 대기 중</h4>
                <p style={{ fontSize: "12px" }}>좌측 폼에 지출 내역 정보를 입력한 후 &apos;실시간 AI 검토&apos; 버튼을 눌러주세요.</p>
              </div>
            )}

            {reviewLoading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px", gap: "16px" }}>
                <div className="loading-spinner"></div>
                <h4 style={{ color: "var(--text-main)", fontWeight: 700 }}>가이드라인 및 기집행액 중복 검증 중...</h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "300px" }}>
                  Gemini AI가 국비 집행 규정과 이전 지출 로그({expenses.length}건)를 스캔하여 중복 결제 및 예산 오남용 의심 여부를 연산하고 있습니다.
                </p>
              </div>
            )}

            {reviewResult && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {/* 결과 뱃지 */}
                  <div className={`ai-status-card ${
                    reviewResult.status === "통과" ? "pass" : reviewResult.status === "주의" ? "warning" : "reject"
                  }`}>
                    <span className={`indicator-bulb ${
                      reviewResult.status === "통과" ? "indicator-bulb-pass" : reviewResult.status === "주의" ? "indicator-bulb-warning" : "indicator-bulb-reject"
                    }`}></span>
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "bold" }}>AI 회계 검증 등급</span>
                      <h4 style={{ fontSize: "18px", fontWeight: 900 }}>{reviewResult.status} (AI PASS OPINION)</h4>
                    </div>
                  </div>

                  {/* 사유 내용 */}
                  <div className="ai-opinion-box">
                    <h5 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>AI 종합 검토 의견 사유</h5>
                    <p style={{ color: "var(--text-main)", whiteSpace: "pre-wrap" }}>{reviewResult.reviewComment}</p>
                  </div>

                  {/* 제안 보완사항 */}
                  {reviewResult.suggestions && (
                    <div className="ai-opinion-box" style={{ borderColor: "var(--color-secondary-glow)" }}>
                      <h5 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-secondary)", textTransform: "uppercase", marginBottom: "6px" }}>💡 보완 조치 제안</h5>
                      <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{reviewResult.suggestions}</p>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={handleRecordExpense}
                    disabled={reviewResult.status === "거부" || loading}
                    className="btn btn-success"
                    style={{ width: "100%", padding: "14px" }}
                  >
                    📥 Google Sheets에 최종 기록 및 예산 차감
                  </button>
                  {reviewResult.status === "거부" && (
                    <p style={{ color: "var(--status-error)", fontSize: "11px", textAlign: "center", marginTop: "8px", fontWeight: "bold" }}>
                      ⚠️ 가이드라인 위반 거부(REJECT) 상태에서는 데이터베이스에 기록할 수 없습니다. 내용을 수정해 주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 6. 최근 예산 집행 계획 내역 */}
      <section className="glass-card span-full" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-main)" }}>
            📋 최근 예산 집행 계획 내역 {isFiltered ? `([${activeProjectId}] 필터링됨)` : "(전체 사업)"}
          </h3>
          
          <div className="filter-tabs">
            {["전체", "승인", "주의", "거부", "검토중"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`filter-tab ${statusFilter === status ? "active" : ""}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="pms-table-container">
          <table className="pms-table">
            <thead>
              <tr>
                <th>사업코드 / 명칭</th>
                <th>집행예정일</th>
                <th>집행 항목</th>
                <th style={{ textAlign: "right" }}>집행 금액</th>
                <th style={{ textAlign: "center" }}>AI 검토 상태</th>
                <th style={{ textAlign: "center" }}>증빙서류</th>
                <th style={{ textAlign: "center" }}>상세 리포트</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const targetProject = projects.find(p => p.id === exp.projectId);
                const isExpanded = expandedExpenseId === exp.id;
                
                return (
                  <>
                    <tr key={exp.id}>
                      <td style={{ color: "var(--color-primary)", fontWeight: "bold" }}>
                        {targetProject ? targetProject.name : exp.projectId}
                      </td>
                      <td style={{ color: "var(--text-main)" }}>{exp.date}</td>
                      <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{exp.itemName}</td>
                      <td style={{ textAlign: "right", fontWeight: "extrabold", color: "var(--text-main)" }}>
                        {exp.amount.toLocaleString()} 원
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`status-badge ${
                          exp.status === "승인" || exp.status === "통과" ? "pass" : exp.status === "주의" ? "warning" : exp.status === "거부" ? "reject" : "pending"
                        }`}>
                          {exp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {exp.files && exp.files.length > 0 ? (
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            {exp.files.map((f, i) => (
                              <a
                                key={i}
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.name}
                                style={{ textDecoration: "none", fontSize: "14px" }}
                              >
                                📎
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>없음</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                          className="btn"
                          style={{ padding: "4px 8px", fontSize: "11px", border: "1px solid var(--border-card)" }}
                        >
                          {isExpanded ? "의견닫기 ▲" : "의견열기 ▼"}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${exp.id}-expanded`}>
                        <td colSpan={7} style={{ background: "rgba(0,0,0,0.1)", padding: "16px" }}>
                          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <h4 style={{ fontSize: "12px", fontWeight: "bold", color: "var(--color-primary)" }}>
                                🔍 AI 전문 회계 검토 종합 의견서 (지출 고유 ID: {exp.id})
                              </h4>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>최종 검증 완료</span>
                            </div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                              <div className="ai-opinion-box">
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>소명 및 적요 사항</span>
                                <p style={{ fontSize: "12px" }}>{exp.notes || "적요가 기록되지 않았습니다."}</p>
                              </div>
                              <div className="ai-opinion-box">
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>가이드라인 적격성 검토 결론</span>
                                <p style={{ fontSize: "12px" }}>{exp.reviewComment || "AI 검토 결론이 비어있습니다."}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    해당되는 지출 집행 기록이 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. 신규 사업 추가 모달 팝업 */}
      {isModalOpen && (
        <div className="modal active">
          <div className="modal-content glass-card" style={{ maxWidth: "450px" }}>
            <span className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</span>
            <div className="modal-detail-header" style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold" }}>➕ 신규 관리 사업 추가</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                스마트 예산 관리 시스템에 새로운 정부지원사업을 등록합니다.
              </p>
            </div>
            
            <form onSubmit={handleCreateProject} className="form-grid">
              <div className="form-group">
                <label>사업 코드 (고유 ID)</label>
                <input 
                  type="text" 
                  placeholder="예: PROJ-103" 
                  value={newProjId} 
                  onChange={(e) => setNewProjId(e.target.value)} 
                  className="custom-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>사업 명칭</label>
                <input 
                  type="text" 
                  placeholder="예: 2026 스마트 헬스케어 AI 프로젝트" 
                  value={newProjName} 
                  onChange={(e) => setNewProjName(e.target.value)} 
                  className="custom-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>예산 총액 (원)</label>
                <input 
                  type="text" 
                  placeholder="예: 80,000,000" 
                  value={newProjBudget} 
                  onChange={handleNewProjBudgetChange} 
                  className="custom-input"
                  style={{ fontWeight: "bold" }}
                  required
                />
                {newProjBudget && (
                  <div className="ko-amount-badge" style={{ marginTop: "4px", fontSize: "11px" }}>
                    한글 변환: {getKoreanAmount(newProjBudget)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>사업 기간</label>
                <input 
                  type="text" 
                  placeholder="예: 2026-05-01 ~ 2026-12-31" 
                  value={newProjPeriod} 
                  onChange={(e) => setNewProjPeriod(e.target.value)} 
                  className="custom-input"
                  required
                />
              </div>

              {/* 용역계약서 등 첨부파일 업로드 */}
              <div className="form-group">
                <label>관련 문서 및 계약서 업로드 (최대 10개)</label>
                <div className="file-upload-section">
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleNewProjDrop}
                    onClick={() => newProjFileInputRef.current?.click()}
                    className="drag-drop-zone"
                  >
                    <input 
                      type="file" 
                      ref={newProjFileInputRef} 
                      onChange={handleNewProjFileUpload} 
                      style={{ display: "none" }} 
                    />
                    <div className="upload-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <p className="upload-prompt">마우스로 서류를 끌어놓거나 <span>파일 선택</span></p>
                    <p className="upload-limit">영수증, 명세서 (PDF, PNG, JPG 최대 50MB)</p>
                    
                    {uploadingNewProjFile && (
                      <div style={{ width: "80px", height: "3px", background: "var(--border-card)", borderRadius: "4px", overflow: "hidden", marginTop: "8px" }}>
                        <div style={{ width: "100%", height: "100%", background: "var(--color-primary)", animation: "spin 1.5s linear infinite" }}></div>
                      </div>
                    )}
                  </div>

                  {newProjFiles.length > 0 && (
                    <div className="file-chips-container">
                      {newProjFiles.map((file, idx) => (
                        <div key={idx} className="file-chip">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            {file.name}
                          </a>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveNewProjFile(idx)} 
                            className="file-remove-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={addingProj}
                >
                  {addingProj ? "등록 중..." : "사업 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
