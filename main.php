ini_set('display_errors', '0'); // 운영 환경에서는 기본적으로 끕니다

// 개발 편의: 에러를 보고 싶으면 display_errors를 1로 설정하세요.
// ini_set('display_errors', '1');
// error_reporting(E_ALL);

// 날짜 처리: GET 'date'가 있으면 사용, 없으면 오늘
if (isset($_GET['date'])) {
    $date = DateTime::createFromFormat('Ymd', $_GET['date']);
    if ($date) {
        $outputDate = $date->format('Y년 m월 d일');
        $SearchDate = $_GET['date'];
        $message = $outputDate . " 급식";
    } else {
        $SearchDate = date("Ymd");
        $message = "날짜 형식 오류. 오늘의 급식을 표시합니다.";
    }
} else {
    $SearchDate = date("Ymd");
    $message = "오늘은 " . date("m", time()) . "월" . date("d", time()) . "일 입니다";
}

// 학교 코드(교육청 코드와 학교 코드)를 GET 파라미터로 받습니다.
$defaultOffice = 'E10';
$defaultSchool = '7331058';
$office = isset($_GET['office']) && $_GET['office'] !== '' ? $_GET['office'] : $defaultOffice;
$school = isset($_GET['school']) && $_GET['school'] !== '' ? $_GET['school'] : $defaultSchool;

// 캐싱 폴더 경로
$cacheFolder = __DIR__ . DIRECTORY_SEPARATOR . 'DB';
if (!is_dir($cacheFolder)) {
    mkdir($cacheFolder, 0755, true);
}

// 날짜를 기준으로 파일명 생성
$fileName = $cacheFolder . DIRECTORY_SEPARATOR . $SearchDate . '.txt';

// 캐싱 파일 감지
if (file_exists($fileName)) {
    $cachedData = file_get_contents($fileName);
    $cachedData = json_decode($cachedData, true);

    $breakfast = isset($cachedData['breakfast']) ? $cachedData['breakfast'] : [];
    $lunch = isset($cachedData['lunch']) ? $cachedData['lunch'] : [];
    $dinner = isset($cachedData['dinner']) ? $cachedData['dinner'] : [];
} else {
    // API 요청 및 응답 받아오기
    $OpenAPIKEY = '7c7578d165144d6d91b83484497faaee';
    $apiUrl = 'https://open.neis.go.kr/hub/mealServiceDietInfo?ATPT_OFCDC_SC_CODE=' . urlencode($office) . '&SD_SCHUL_CODE=' . urlencode($school) . '&KEY=' . $OpenAPIKEY . '&MLSV_YMD=' . $SearchDate;

    $response = @file_get_contents($apiUrl);
    if ($response === false) {
        // API 요청 실패 — 빈값으로 처리
        $breakfast = [];
        $lunch = [];
        $dinner = [];
    } else {
        // XML을 SimpleXMLElement로 파싱
        $xml = @new SimpleXMLElement($response);

        // 안전하게 row 존재 여부 확인
        if (isset($xml->row) && count($xml->row) > 0) {
            $rows = $xml->row;
            // 각 식사 항목을 초기화
            $breakfast = ['mmealScNm' => '', 'ddishNm' => ''];
            $lunch = ['mmealScNm' => '', 'ddishNm' => ''];
            $dinner = ['mmealScNm' => '', 'ddishNm' => ''];

            foreach ($rows as $r) {
                $mname = (string)$r->MMEAL_SC_NM;
                $dd = preg_replace('/\([^)]+\)/', '', (string)$r->DDISH_NM);
                if (strpos($mname, '조식') !== false) {
                    $breakfast = ['mmealScNm' => $mname, 'ddishNm' => $dd];
                } elseif (strpos($mname, '중식') !== false) {
                    $lunch = ['mmealScNm' => $mname, 'ddishNm' => $dd];
                } elseif (strpos($mname, '석식') !== false) {
                    $dinner = ['mmealScNm' => $mname, 'ddishNm' => $dd];
                }
            }
        } else {
            $breakfast = [];
            $lunch = [];
            $dinner = [];
        }

        // 캐시에 저장 (항상 쓰도록 함)
        file_put_contents($fileName, json_encode(['breakfast' => $breakfast, 'lunch' => $lunch, 'dinner' => $dinner]));
    }
}