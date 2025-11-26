<?php
// main.php에서 데이터 처리 및 캐시를 수행합니다.
require_once __DIR__ . '/main.php';
?>
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>급식 정보</title>
    <style>
        body{font-family: Arial, Helvetica, sans-serif;margin:20px}
        #meal-boxes{display:flex;gap:12px}
        .meal-box{border:1px solid #ddd;padding:12px;border-radius:6px;min-width:120px}
        .food{margin-top:8px;color:#333}
        .date{font-size:18px}
        #quote-box{margin-top:16px;color:#666}
        form input, form select{padding:6px;margin-right:8px}
    </style>
</head>
<body>
    <form method="get" style="margin-bottom:12px">
        <label>교육청 코드(ATPT_OFCDC_SC_CODE): <input name="office" value="<?php echo isset($_GET['office'])?htmlspecialchars($_GET['office']):'E10'; ?>" /></label>
        <label>학교 코드(SD_SCHUL_CODE): <input name="school" value="<?php echo isset($_GET['school'])?htmlspecialchars($_GET['school']):'7331058'; ?>" /></label>
        <label>날짜(YYYYMMDD): <input name="date" value="<?php echo isset($_GET['date'])?htmlspecialchars($_GET['date']):date('Ymd'); ?>" /></label>
        <button type="submit">불러오기</button>
    </form>

    <h1 class="date"><?php echo isset($message) ? htmlspecialchars($message) : '급식 정보'; ?></h1>
    <div id="meal-boxes">
        <div class="meal-box">조식
            <div class="food"><?php echo isset($breakfast['ddishNm']) && $breakfast['ddishNm'] ? htmlspecialchars($breakfast['ddishNm']) : '급식 미제공'; ?></div>
        </div>
        <div class="meal-box">중식
            <div class="food"><?php echo isset($lunch['ddishNm']) && $lunch['ddishNm'] ? htmlspecialchars($lunch['ddishNm']) : '급식 미제공'; ?></div>
        </div>
        <div class="meal-box">석식
            <div class="food"><?php echo isset($dinner['ddishNm']) && $dinner['ddishNm'] ? htmlspecialchars($dinner['ddishNm']) : '급식 미제공'; ?></div>
        </div>
    </div>
    <div id="quote-box">
        <div class="message2say">"컴파일도 식후경"</div>
    </div>
</body>
</html>