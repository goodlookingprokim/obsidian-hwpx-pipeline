/**
 * 시연용 샘플 HWPX 파일 생성 스크립트
 * 실행: node create-sample-hwpx.mjs
 */
import { HwpxDocument, loadSkeletonHwpx } from '@ubermensch1218/hwpxcore';
import fs from 'fs';
import path from 'path';

async function createSampleHwpx() {
    const skeleton = loadSkeletonHwpx();
    const doc = await HwpxDocument.open(skeleton);

    // 제목
    const titleStyle = doc.ensureRunStyle({ bold: true, fontSize: 2200 });
    doc.addParagraph('교실 환경 개선 사업 추진 계획(안)', { charPrIdRef: titleStyle });

    // 빈 줄
    doc.addParagraph('');

    // 소제목: 1. 목적
    const headingStyle = doc.ensureRunStyle({ bold: true, fontSize: 1400 });
    doc.addParagraph('1. 목  적', { charPrIdRef: headingStyle });
    doc.addParagraph('쾌적한 교실 환경 조성을 통한 학생 학습 능률 향상 및 교직원 근무 환경 개선을 위하여 노후 에어컨 교체 사업을 추진하고자 함.');

    // 빈 줄
    doc.addParagraph('');

    // 소제목: 2. 현황
    doc.addParagraph('2. 현  황', { charPrIdRef: headingStyle });
    doc.addParagraph('가. 설치 현황: 총 24개 교실 중 18개 교실 에어컨 설치(설치율 75%)');
    doc.addParagraph('나. 노후 현황: 설치 10년 이상 노후 에어컨 12대 교체 필요');
    doc.addParagraph('다. 미설치 교실: 6개 교실 신규 설치 필요');

    // 빈 줄
    doc.addParagraph('');

    // 소제목: 3. 추진 계획
    doc.addParagraph('3. 추진 계획', { charPrIdRef: headingStyle });

    // 표 추가
    const tablePara = doc.addParagraph('');
    const borderFillId = doc.ensureBasicBorderFill();
    const table = tablePara.addTable(4, 4, { borderFillIdRef: borderFillId });

    // 표 헤더
    table.setCellText(0, 0, '구분');
    table.setCellText(0, 1, '수량');
    table.setCellText(0, 2, '예산(천원)');
    table.setCellText(0, 3, '비고');

    // 표 데이터
    table.setCellText(1, 0, '노후 에어컨 교체');
    table.setCellText(1, 1, '12대');
    table.setCellText(1, 2, '18,000');
    table.setCellText(1, 3, '10년 이상 노후');

    table.setCellText(2, 0, '신규 에어컨 설치');
    table.setCellText(2, 1, '6대');
    table.setCellText(2, 2, '12,000');
    table.setCellText(2, 3, '미설치 교실');

    table.setCellText(3, 0, '합계');
    table.setCellText(3, 1, '18대');
    table.setCellText(3, 2, '30,000');
    table.setCellText(3, 3, '-');

    // 빈 줄
    doc.addParagraph('');

    // 소제목: 4. 기대 효과
    doc.addParagraph('4. 기대 효과', { charPrIdRef: headingStyle });
    doc.addParagraph('가. 전체 교실 에어컨 설치율 100% 달성');
    doc.addParagraph('나. 에너지 효율 향상으로 연간 전기료 약 15% 절감 예상');
    doc.addParagraph('다. 쾌적한 학습 환경 조성으로 학생 만족도 향상');

    // 빈 줄
    doc.addParagraph('');

    // 소제목: 5. 행정 사항
    doc.addParagraph('5. 행정 사항', { charPrIdRef: headingStyle });
    doc.addParagraph('가. 추진 일정: 2026. 3. ~ 2026. 7.');
    doc.addParagraph('나. 소요 예산: 30,000천원 (시설개선비)');
    doc.addParagraph('다. 담당 부서: 행정실');

    // 저장
    const bytes = await doc.save();

    const outputDir = path.join(process.cwd(), 'samples');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, '교실환경개선_추진계획.hwpx');
    fs.writeFileSync(outputPath, bytes);

    console.log(`✅ 샘플 HWPX 파일 생성 완료: ${outputPath}`);
    console.log(`   파일 크기: ${(bytes.length / 1024).toFixed(1)} KB`);
}

createSampleHwpx().catch(console.error);
