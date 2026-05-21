# 📊 스마트 예산 집행 관리 웹앱 (Smart Budget AI)

초보자(비개발자)도 10분 만에 우리 회사만의 **정부 지원 사업 예산 집행 관리 웹앱**을 구축할 수 있도록 만들어진 템플릿입니다. 이 웹앱은 비싼 서버나 데이터베이스 대신, 우리가 매일 사용하는 **구글 스프레드시트와 구글 드라이브**를 뒷단(Backend)으로 사용하여 평생 무료로 운영할 수 있습니다.

---

## 🎯 이 앱이 필요한 분들
- 여러 개의 정부 지원 사업 예산을 동시에 관리해야 하는 실무자
- 엑셀/시트에 일일이 기입하는 노가다에서 벗어나고 싶은 분
- 영수증, 세금계산서 등의 증빙 서류를 사업별로 깔끔하게 모아두고 싶은 분
- 예산이 얼마나 남았는지 시각적인 대시보드로 한눈에 파악하고 싶은 대표/팀장님

---

## 🛠️ 준비물
단 3가지만 있으면 됩니다. 모든 것은 **무료**입니다!
1. **Google 계정**: 데이터를 저장할 스프레드시트와 드라이브를 위해 필요합니다.
2. **GitHub 계정**: 이 앱의 코드를 복사해서 담아둘 창고입니다. (가입: github.com)
3. **Vercel 계정**: 코드를 인터넷에 띄워줄(배포) 서비스입니다. (가입: vercel.com - 깃허브 계정으로 연동 가입 추천)

---

# 🚀 초보자용 10분 완성 설치 가이드

개발을 전혀 몰라도 아래 순서대로 텍스트만 복사/붙여넣기 하시면 완벽하게 나만의 앱이 완성됩니다. 천천히 따라와 주세요!

## Step 1. 앱 소스 코드 복사하기 (Fork)
1. 우측 상단의 **[Fork]** 버튼을 클릭하여 이 소스 코드를 본인의 GitHub 계정으로 복사합니다.
2. 복사된 본인 계정의 저장소 이름을 기억해 둡니다.

## Step 2. 구글 스프레드시트 데이터베이스 만들기
1. [구글 시트(Google Sheets)](https://docs.google.com/spreadsheets)에 접속하여 비어있는 새 스프레드시트를 만듭니다.
2. 화면 하단의 시트 탭 이름을 더블 클릭하여 `Projects`와 `Expenses` 라는 이름으로 총 2개의 탭(시트)을 만듭니다. (스펠링과 대소문자에 주의해 주세요!)
3. **시트 주소창(URL)**을 보면 `https://docs.google.com/spreadsheets/d/여기부터~여기까지/edit` 처럼 복잡한 영어와 숫자가 섞인 긴 주소가 있습니다. `d/`와 `/edit` 사이의 텍스트가 **시트 ID (GOOGLE_SHEET_ID)** 입니다. 이 아이디를 메모장에 복사해 둡니다.

## Step 3. 구글 클라우드 서비스 계정 (API 키) 발급받기
앱이 내 구글 시트에 접근해서 글을 쓸 수 있도록 '가상의 로봇 직원'을 한 명 고용하는 과정입니다.

1. [Google Cloud Console](https://console.cloud.google.com/) 에 접속합니다.
2. 상단 메뉴에서 **[프로젝트 만들기]**를 눌러 새 프로젝트를 생성합니다.
3. 좌측 햄버거 메뉴(≡)를 누르고 **[API 및 서비스] -> [라이브러리]**로 이동합니다.
4. 검색창에 **`Google Sheets API`**를 검색하고 **[사용]** 버튼을 누릅니다.
5. 좌측 메뉴에서 **[사용자 인증 정보]**로 이동한 뒤, 상단 **[+ 사용자 인증 정보 만들기] -> [서비스 계정]**을 클릭합니다.
6. 이름(예: budget-bot)을 대충 입력하고 완료합니다.
7. 생성된 서비스 계정의 **[이메일 주소]**를 복사해 둡니다. (메모장에 저장 - **GOOGLE_SERVICE_ACCOUNT_EMAIL**)
8. 이메일 주소를 클릭해서 상세 페이지로 들어간 뒤, 상단 **[키]** 탭을 누릅니다.
9. **[키 추가] -> [새 키 만들기] -> [JSON]**을 선택하여 키 파일을 다운로드합니다.
10. 다운받은 JSON 파일을 메모장으로 열고, `"private_key": "-----BEGIN PRIVATE KEY-----\n어쩌고저쩌고\n-----END PRIVATE KEY-----\n"` 부분에서 `-----BEGIN...` 부터 끝까지의 긴 글씨를 복사합니다. (메모장에 저장 - **GOOGLE_PRIVATE_KEY**)

### 💡 (매우 중요) 구글 시트에 로봇 직원 초대하기
아까 Step 2에서 만든 구글 스프레드시트로 돌아갑니다.
우측 상단 **[공유]** 버튼을 누르고, 방금 복사해 둔 '서비스 계정 이메일 주소'를 입력하여 **'편집자'** 권한으로 공유(초대)해 줍니다. 

## Step 4. 파일 업로드를 위한 구글 드라이브 세팅 (GAS)
영수증이나 문서를 내 구글 드라이브로 직접 보내기 위한 과정입니다.

1. 파일을 저장할 구글 드라이브 폴더를 하나 만듭니다.
2. 해당 폴더에 들어가서 인터넷 주소창을 보면 `folders/어쩌고저쩌고` 부분이 있습니다. 이 폴더 ID를 복사해 둡니다.
3. [구글 앱스 스크립트 대시보드](https://script.google.com/home) 에 접속해서 좌측 상단 **[+ 새 프로젝트]**를 누릅니다.
4. 기존 코드를 싹 지우고 아래 코드를 복사해서 붙여넣습니다:
```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var fileData = data.fileData; // base64 string
    var filename = data.filename;
    var mimeType = data.mimeType;
    
    // Base64 디코딩
    var decoded = Utilities.base64Decode(fileData);
    var blob = Utilities.newBlob(decoded, mimeType, filename);
    
    // ★여기에 아까 복사한 폴더 ID를 붙여넣으세요!★
    var folderId = "이곳에_본인의_폴더_ID를_넣으세요"; 
    var folder = DriveApp.getFolderById(folderId);
    
    // 파일 생성 및 권한 설정
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var response = { success: true, url: file.getUrl(), downloadUrl: file.getDownloadUrl(), driveId: file.getId() };
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
```
5. 상단 디스켓(저장) 버튼을 누르고, 우측 상단 파란색 **[ 배포 ] -> [ 새 배포 ]**를 누릅니다.
6. 톱니바퀴를 눌러 **[웹 앱]**을 선택하고, 액세스 권한이 있는 사용자를 반드시 **[모든 사용자(Anyone)]**로 설정한 뒤 배포합니다.
7. 화면에 나오는 **'웹 앱 URL (`https://script.google.com/macros/...`)'** 전체를 복사합니다. (메모장에 저장 - **NEXT_PUBLIC_GAS_UPLOAD_URL**)

## Step 5. Vercel에 앱 띄우기 (최종 단계)
이제 모아둔 재료들을 인터넷에 올리기만 하면 됩니다!

1. [Vercel](https://vercel.com/dashboard) 에 접속하고 로그인합니다.
2. 우측 상단 **[Add New...] -> [Project]**를 클릭합니다.
3. 아까 Step 1에서 복사(Fork)해둔 GitHub 저장소가 보입니다. **[Import]** 버튼을 누릅니다.
4. 설정 화면이 나오면 다른 건 건드리지 말고 중간의 **[Environment Variables] (환경 변수)** 섹션을 펼칩니다.
5. 여태까지 메모장에 모아둔 4가지 보물(환경 변수)을 하나씩 입력하고 `Add`를 누릅니다.
   - Name: `GOOGLE_SERVICE_ACCOUNT_EMAIL` / Value: 아까 그 이메일
   - Name: `GOOGLE_PRIVATE_KEY` / Value: 아까 그 어마어마하게 긴 비밀키 전체
   - Name: `GOOGLE_SHEET_ID` / Value: 시트 주소 일부
   - Name: `NEXT_PUBLIC_GAS_UPLOAD_URL` / Value: 구글 앱스 스크립트 주소
6. 4개를 다 넣었다면, 드디어 하단의 **[Deploy] (배포하기)** 파란색 버튼을 클릭합니다.
7. 폭죽이 터지는 화면이 나오면 배포 성공입니다! 여러분만의 예산 관리 웹앱이 탄생했습니다. 🎉

---
**💡 팁:** Vercel에서 제공하는 주소(`https://...vercel.app`)를 즐겨찾기 해두고, 회사 사람들과 공유해서 함께 쓰시면 됩니다!
