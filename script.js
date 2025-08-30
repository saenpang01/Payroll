         // --- 1. Global State ---
        const CONSOLIDATION_WINDOW_HOURS = 3;
        let employees = [];
        let timeRecords = [];
        let orphanScans = [];

        // --- 2. Core Application Logic ---

        async function fetchAllEmployeesFromGoogleSheet() {
            const monthlySheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPeXCWESqvqiaslhR8j-YvPBsPUi8RGDX8GKJ9w4XrUSbjrp2OotRG9zFz2oRdIFooVk7RVVKTD1cL/pub?gid=166039384&single=true&output=csv';
            const dailySheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPeXCWESqvqiaslhR8j-YvPBsPUi8RGDX8GKJ9w4XrUSbjrp2OotRG9zFz2oRdIFooVk7RVVKTD1cL/pub?gid=1323019072&single=true&output=csv';

            const processSheetData = (csvText, employeeType) => {
                const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
                if (!result.data.length || !result.meta.fields) return [];
                const requiredKeys = ['id', 'scanid', 'name', 'salary'];
                const fieldMap = {};
                result.meta.fields.forEach(f => {
                    const cleanField = f.trim().toLowerCase();
                    if (requiredKeys.includes(cleanField)) fieldMap[cleanField] = f;
                    if (cleanField === 'nickname') fieldMap.nickname = f;
                    if (cleanField === 'position') fieldMap.position = f;
                });

                if (requiredKeys.some(key => !fieldMap[key])) {
                     console.error(`Missing required columns in sheet: ${employeeType}`);
                     return [];
                }
                return result.data.map(emp => ({
                    ID: emp[fieldMap.id]?.trim() || 'N/A',
                    scanId: emp[fieldMap.scanid]?.trim() || '',
                    NAME: emp[fieldMap.name]?.trim() || 'N/A',
                    SALARY: emp[fieldMap.salary]?.trim() || '0',
                    NICKNAME: emp[fieldMap.nickname]?.trim() || '',
                    POSITION: emp[fieldMap.position]?.trim() || '',
                    type: employeeType
                }));
            };
            try {
                const [monthlyResults, dailyResults] = await Promise.all([
                    fetch(monthlySheetURL).then(res => res.ok ? res.text() : Promise.reject(`Monthly sheet fetch failed: ${res.statusText}`)),
                    fetch(dailySheetURL).then(res => res.ok ? res.text() : Promise.reject(`Daily sheet fetch failed: ${res.statusText}`))
                ]);
                employees = [...processSheetData(monthlyResults, 'รายเดือน'), ...processSheetData(dailyResults, 'รายวัน')];
                if (employees.length > 0) {
                    showMessage('upload', `✅ โหลดข้อมูลพนักงาน ${employees.length} คนสำเร็จ!`, 'success');
                    populateEmployeeDropdown();
                } else {
                    showMessage('upload', `❌ ไม่สามารถโหลดข้อมูลพนักงานได้`, 'error');
                }
            } catch (error) {
                console.error('Error fetching from Google Sheet:', error);
                showMessage('upload', '❌ เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน', 'error');
            }
        }

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // --- Reset State ---
    timeRecords = [];
    orphanScans = [];
    document.getElementById('calculationResult').innerHTML = '';
    document.getElementById('individualReportResult').innerHTML = '';
    document.getElementById('errorReportContainer').innerHTML = '';
    
    const uploadProgress = document.getElementById('uploadProgress');
    uploadProgress.classList.remove('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = 'กำลังประมวลผล...';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            document.getElementById('progressFill').style.width = '100%';
            document.getElementById('progressText').textContent = 'ประมวลผลเสร็จสิ้น';

            const idHeader = results.meta.fields.find(h => h && h.trim().toLowerCase() === 'sjobno');
            const dateHeader = results.meta.fields.find(h => h && h.trim().toLowerCase() === 'date');
            const timeHeader = results.meta.fields.find(h => h && h.trim().toLowerCase() === 'time');

            if (!idHeader || !dateHeader || !timeHeader) {
                showMessage('upload', `ไฟล์ CSV ไม่ถูกต้อง! ไม่พบคอลัมน์ sJobNo, Date, Time`, 'error');
                uploadProgress.classList.add('hidden');
                return;
            }

            const parseDateTime = (dateStr, timeStr) => {
                const dateParts = dateStr.split('/');
                const timeParts = timeStr.split(':');
                return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
            };

            const sortedScans = results.data
                .filter(s => s[idHeader] && s[dateHeader] && s[timeHeader])
                .sort((a, b) => {
                    const aDateTime = parseDateTime(a[dateHeader], a[timeHeader]);
                    const bDateTime = parseDateTime(b[dateHeader], b[timeHeader]);
                    if (a[idHeader].trim() !== b[idHeader].trim()) {
                        return a[idHeader].trim().localeCompare(b[idHeader].trim());
                    }
                    return aDateTime.getTime() - bDateTime.getTime();
                });
                
            // --- [VIBE-CODE] NEW: CONSOLIDATE REPEATED SCANS WITHIN 5 MINUTES ---
            const consolidatedScans = [];
            if (sortedScans.length > 0) {
                for (let i = 0; i < sortedScans.length - 1; i++) {
                    const currentScan = sortedScans[i];
                    const nextScan = sortedScans[i + 1];

                    // Check if the next scan is from the same employee
                    if (currentScan[idHeader].trim() === nextScan[idHeader].trim()) {
                        const currentTime = parseDateTime(currentScan[dateHeader], currentScan[timeHeader]);
                        const nextTime = parseDateTime(nextScan[dateHeader], nextScan[timeHeader]);
                        const diffMinutes = (nextTime - currentTime) / (1000 * 60);

                        // If the difference is less than 5 minutes, skip the current scan
                        if (diffMinutes <= 5) {
                            continue; // The next iteration will handle the `nextScan`
                        }
                    }
                    consolidatedScans.push(currentScan);
                }
                // Always add the very last scan
                consolidatedScans.push(sortedScans[sortedScans.length - 1]);
            }
            // --- END OF CONSOLIDATION LOGIC ---

            const scansByEmployee = consolidatedScans.reduce((acc, scan) => {
                const id = scan[idHeader].trim();
                if (!acc[id]) acc[id] = [];
                acc[id].push(scan);
                return acc;
            }, {});
            
            for (const id in scansByEmployee) {
                const employeeScans = scansByEmployee[id];
                let inScanRecord = null;

                employeeScans.forEach(scan => {
                    const scanTime = parseDateTime(scan[dateHeader], scan[timeHeader]);

                    if (!inScanRecord) {
                        if (scanTime.getHours() >= 13) {
                            timeRecords.push({
                                scanId: id,
                                date: scan[dateHeader].trim(),
                                times: [scan[timeHeader].trim()],
                                incomplete: true,
                                problem: 'Forgot IN'
                            });
                        } else {
                            inScanRecord = scan;
                        }
                    } else {
                        const inScanTime = parseDateTime(inScanRecord[dateHeader], inScanRecord[timeHeader]);
                        const durationHours = (scanTime - inScanTime) / (1000 * 60 * 60);

                        if (durationHours > 15) {
                            timeRecords.push({
                                scanId: id,
                                date: inScanRecord[dateHeader].trim(),
                                times: [inScanRecord[timeHeader].trim()],
                                incomplete: true,
                                problem: 'Forgot OUT'
                            });
                            inScanRecord = scan; 
                        } else if (scanTime.getHours() < 2) { 
                            timeRecords.push({
                                scanId: id,
                                date: inScanRecord[dateHeader].trim(),
                                times: [inScanRecord[timeHeader].trim()],
                                incomplete: true,
                                problem: 'Forgot OUT'
                            });
                            inScanRecord = scan;
                        } else {
                            timeRecords.push({
                                scanId: id,
                                date: inScanRecord[dateHeader].trim(),
                                times: [inScanRecord[timeHeader].trim(), scan[timeHeader].trim()],
                                incomplete: false,
                                problem: null
                            });
                            inScanRecord = null;
                        }
                    }
                });

                if (inScanRecord) {
                    timeRecords.push({
                        scanId: id,
                        date: inScanRecord[dateHeader].trim(),
                        times: [inScanRecord[timeHeader].trim()],
                        incomplete: true,
                        problem: 'Forgot OUT'
                    });
                }
            }
            
            timeRecords.sort((a,b) => convertToDate(a.date) - convertToDate(b.date));

            document.getElementById('uploadResult').innerHTML = `<div class="success">✅ ประมวลผลสำเร็จ! พบข้อมูลทั้งหมด ${timeRecords.length} รายการ</div>`;
            document.getElementById('calculationSection').classList.remove('hidden');
            
            setTimeout(() => { uploadProgress.classList.add('hidden'); }, 2000);
        },
        error: (err) => {
            showMessage('upload', `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`, 'error');
            uploadProgress.classList.add('hidden');
        }
    });
}

function calculateWorkHoursAndOT(dailyTimeRecords, employee) {
    if (!dailyTimeRecords.times || dailyTimeRecords.times.length < 2) {
        return { workHours: 0, otHours: 0, otWarning: false, totalDurationMilliseconds: 0 };
    }

    const timeIn = new Date('1970/01/01 ' + dailyTimeRecords.times[0]);
    let timeOut = new Date('1970/01/01 ' + dailyTimeRecords.times[1]);
    if (timeOut < timeIn) { timeOut.setDate(timeOut.getDate() + 1); }
    
    // [VIBE-CODE] เก็บค่าผลต่างของเวลาดิบเป็นมิลลิวินาที
    const totalDurationMilliseconds = timeOut - timeIn;
    
    // 1. คำนวณชั่วโมงทำงานดิบ (ยังไม่หักพัก)
    let workHours = totalDurationMilliseconds / (1000 * 60 * 60);
    
    // 2. หักเวลาพักเที่ยง 1 ชั่วโมง
    const BREAK_DEDUCTION_THRESHOLD = 6;
    if (workHours > BREAK_DEDUCTION_THRESHOLD) {
        workHours -= 1;
    }

    // 3. คำนวณ OT
    let otHours = 0;
    let otWarning = false;
    const STANDARD_WORK_HOURS = 8;

    if (workHours > STANDARD_WORK_HOURS) {
        const rawOtHours = workHours - STANDARD_WORK_HOURS;
        otHours = Math.floor(rawOtHours);

        const otMinutesFraction = (rawOtHours - otHours) * 60;
        if (otMinutesFraction >= 55 && otMinutesFraction < 60) {
            otWarning = true;
        }

        if (otHours > 3) {
            otHours = 3;
        }
    }

    // [VIBE-CODE] คืนค่า totalDurationMilliseconds เพิ่มเข้าไป
    return { 
        workHours: workHours, 
        otHours: otHours, 
        otWarning: otWarning,
        totalDurationMilliseconds: totalDurationMilliseconds 
    };
}

        function calculateAndDisplaySummary() {
            const startDateInput = document.getElementById('calc_start_date').value;
            const endDateInput = document.getElementById('calc_end_date').value;
            const otRate = parseFloat(document.getElementById('otRate').value) || 50;

            if (!startDateInput || !endDateInput) {
                alert('กรุณาเลือกช่วงวันที่สำหรับคำนวณ');
                return;
            }

            const reportStartDate = new Date(startDateInput);
            reportStartDate.setHours(0, 0, 0, 0); 
            const reportEndDate = new Date(endDateInput);
            reportEndDate.setHours(23, 59, 59, 999);

            const filteredRecords = timeRecords.filter(rec => {
                const workDate = convertToDate(rec.date);
                workDate.setHours(0,0,0,0);
                return workDate >= reportStartDate && workDate <= reportEndDate;
            });
            
            if (filteredRecords.length === 0) {
                document.getElementById('calculationResult').innerHTML = '<p style="color: #cc0000; text-align: center; margin-top: 1rem;">ไม่พบข้อมูลการทำงานที่สมบูรณ์ในช่วงวันที่ที่คุณเลือก</p>';
                return; 
            }

            const summary = {};
            filteredRecords.forEach(rec => {
                const employee = employees.find(emp => emp.scanId == rec.scanId); 
                if (employee) {
                    if (!summary[employee.scanId]) {
                        summary[employee.scanId] = {
                            id: employee.ID, name: employee.NAME, nickname: employee.NICKNAME, position: employee.POSITION,
                            type: employee.type, salary: parseFloat(employee.SALARY.replace(/[^\d.-]/g, '')) || 0,
                            totalOtHours: 0, workDays: 0
                        };
                    }
                    const { otHours } = calculateWorkHoursAndOT(rec, employee);
                    summary[employee.scanId].totalOtHours += otHours;
                    summary[employee.scanId].workDays++;
                }
            });

            let tableHTML = `
                <h4>สรุปผลการคำนวณ (${formatDate(startDateInput)} - ${formatDate(endDateInput)})</h4>
                <table>
                    <thead>
                        <tr><th>ID</th><th>ชื่อพนักงาน</th><th>ตำแหน่ง</th><th>วันทำงาน</th><th>ชม.OT</th><th>ค่า OT</th><th>ฐานเงินเดือน</th><th>ยอดจ่ายสุทธิ</th></tr>
                    </thead>
                    <tbody>`;
            
            Object.values(summary).sort((a,b) => a.id.localeCompare(b.id)).forEach(data => {
                const otPay = data.totalOtHours * otRate;
                const baseSalary = data.type === 'รายวัน' ? data.salary * data.workDays : data.salary;
                const totalPay = baseSalary + otPay;
                const displayName = `${data.name} (${data.nickname.toLowerCase()})`;
                tableHTML += `
                    <tr>
                        <td>${data.id}</td><td>${displayName}</td><td>${data.position}</td>
                        <td style="text-align: center;">${data.workDays}</td>
                        <td style="text-align: center;">${data.totalOtHours}</td>
                        <td>${otPay.toLocaleString('th-TH')} ฿</td>
                        <td>${baseSalary.toLocaleString('th-TH')} ฿</td>
                        <td><strong>${totalPay.toLocaleString('th-TH')} ฿</strong></td>
                    </tr>`;
            });
            
            tableHTML += '</tbody></table>';
            document.getElementById('calculationResult').innerHTML = tableHTML;
        }

function generateIndividualReport() {
    const empScanId = document.getElementById('report_employee_select').value;
    const startDateInput = document.getElementById('report_start_date').value;
    const endDateInput = document.getElementById('report_end_date').value;

    if (!empScanId || !startDateInput || !endDateInput) {
        alert('กรุณาเลือกพนักงานและช่วงวันที่ให้ครบถ้วน');
        return;
    }
    
    // ตั้งค่าวันที่ให้เป็น UTC เพื่อหลีกเลี่ยงปัญหา Timezone
    const reportStartDate = new Date(startDateInput);
    reportStartDate.setUTCHours(0, 0, 0, 0);
    const reportEndDate = new Date(endDateInput);
    reportEndDate.setUTCHours(23, 59, 59, 999); // สิ้นสุดวัน

    const employee = employees.find(emp => emp.scanId == empScanId); 

    if (!employee) {
        document.getElementById('individualReportResult').innerHTML = '<p>ไม่พบข้อมูลพนักงาน</p>';
        return;
    }
    
    // --- [VIBE-CODE] BUG FIX: สร้าง Map ด้วย Key วันที่ที่เป็นมาตรฐาน (YYYY-MM-DD) ---
    const recordsByDate = timeRecords
        .filter(rec => rec.scanId == empScanId)
        .reduce((acc, rec) => {
            // แปลง Key จาก "DD/MM/YYYY" -> "YYYY-MM-DD"
            const parts = rec.date.split('/');
            const key = `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
            acc[key] = rec;
            return acc;
        }, {});

    let tableHTML = `
        <h4>รายงานของ: ${employee.NAME} (${formatDate(startDateInput)} - ${formatDate(endDateInput)})</h4>
        <table>
            <thead>
                <tr><th>วันที่</th><th>เวลาเข้า</th><th>เวลาออก</th><th>ชั่วโมงทำงาน</th><th>ชั่วโมง OT</th></tr>
            </thead>
            <tbody>`;

    let totalWork = 0, totalOT = 0;
    
    // --- [VIBE-CODE] FINAL FIXED LOGIC: วนลูปและใช้ Key มาตรฐานในการค้นหา ---
    for (let day = new Date(reportStartDate); day <= reportEndDate; day.setDate(day.getDate() + 1)) {
        
        // สร้าง Key สำหรับค้นหาในรูปแบบ "YYYY-MM-DD"
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        const lookupKey = `${y}-${m}-${d}`;

        // สร้างวันที่สำหรับแสดงผลในรูปแบบ "DD/MM/YYYY"
        const displayDate = `${d}/${m}/${y}`;
        
        const rec = recordsByDate[lookupKey]; // ค้นหาข้อมูลด้วย Key ที่เป็นมาตรฐาน

        if (rec) {
            // กรณีพบข้อมูลของวันนี้
            const { workHours, otHours, otWarning } = calculateWorkHoursAndOT(rec, employee);
            
            if (rec.incomplete) {
                let timeInText = (rec.problem === 'Forgot IN') ? 'ไม่มีสแกนเข้า' : rec.times[0];
                let timeOutText = (rec.problem === 'Forgot OUT') ? 'ไม่มีสแกนออก' : rec.times[0];
                
                tableHTML += `
                    <tr class="row-incomplete">
                        <td>${rec.date}</td>
                        <td>${timeInText}</td>
                        <td>${timeOutText}</td>
                        <td style="text-align: center;">-</td>
                        <td style="text-align: center;">-</td>
                    </tr>`;
            } else {
                totalWork += workHours;
                totalOT += otHours;
                tableHTML += `
                    <tr>
                        <td>${rec.date}</td>
                        <td>${rec.times[0]}</td>
                        <td>${rec.times[1]}</td>
                        <td>${workHours.toFixed(1)} ชม.</td>
                        <td class="${otWarning ? 'ot-warning' : ''}" title="${otWarning ? 'ทำ OT เกือบครบชั่วโมงถัดไป' : ''}">${otHours}</td>
                    </tr>`;
            }
        } else {
            // กรณีไม่พบข้อมูลของวันนี้
            tableHTML += `
                <tr class="row-no-scan">
                    <td>${displayDate}</td>
                    <td colspan="4">ไม่มีการสแกน</td>
                </tr>`;
        }
    }
    // --- END OF FIXED LOGIC ---

    tableHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>รวม (เฉพาะข้อมูลที่สมบูรณ์)</strong></td>
                    <td><strong>${totalWork.toFixed(2)}</strong></td>
                    <td><strong>${totalOT}</strong></td>
                </tr>
            </tfoot>
        </table>`;

    document.getElementById('individualReportResult').innerHTML = tableHTML;
}

        // --- 3. Utility and UI Functions ---

        function displayOrphanScanReport() {
            const container = document.getElementById('errorReportContainer');
            if (orphanScans.length === 0) {
                container.innerHTML = '';
                return;
            }
            const scansWithNames = orphanScans.map(scan => {
                const employee = employees.find(emp => emp.scanId == scan.scanId);
                return { ...scan, name: employee ? employee.NAME : `ไม่พบ ID: ${scan.scanId}` };
            });
            let tableHTML = `
                <h3 style="color: #d00;">🚨 รายการที่ต้องตรวจสอบ (${scansWithNames.length} รายการ)</h3>
                <p>ข้อมูลเหล่านี้ไม่ถูกนำไปคำนวณ และต้องได้รับการแก้ไขด้วยตนเอง</p>
                <table>
                    <thead><tr><th>ชื่อพนักงาน</th><th>วันที่</th><th>เวลาที่สแกน</th><th>ปัญหาที่พบ</th></tr></thead>
                    <tbody>`;
            scansWithNames.forEach(scan => {
                tableHTML += `
                    <tr class="row-incomplete">
                        <td>${scan.name}</td>
                        <td>${formatDate(scan.date)}</td>
                        <td>${scan.time}</td>
                        <td>${scan.problem}</td>
                    </tr>`;
            });
            tableHTML += '</tbody></table>';
            container.innerHTML = tableHTML;
        }

        function populateEmployeeDropdown() {
            const select = document.getElementById('report_employee_select');
            select.innerHTML = '<option value="">-- กรุณาเลือกพนักงาน --</option>';
            const validEmployees = employees.filter(emp => emp && emp.scanId && emp.NAME);
            validEmployees.sort((a, b) => a.NAME.localeCompare(b.NAME))
                .forEach(emp => {
                    const option = document.createElement('option');
                    option.value = emp.scanId;
                    option.textContent = `${emp.NAME} (${emp.type})`;
                    select.appendChild(option);
                });
        }
        
        function convertToDate(dmyString) {
            const parts = dmyString.split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        
        function formatDate(dateString) {
            if (!dateString) return '';
            if (dateString.includes('/')) return dateString;
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }

        function showTab(tabName, clickedButton) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            clickedButton.classList.add('active');
        }
        
        function showMessage(containerId, message, type = 'info') {
            const target = document.getElementById(containerId);
            if (!target) return;
            const container = (target.id === 'upload' || target.id === 'reports') ? document.getElementById('uploadResult') : target;
            const messageEl = document.createElement('div');
            messageEl.className = type;
            messageEl.innerHTML = message;
            container.innerHTML = '';
            container.appendChild(messageEl);
        }

        function formatDuration(ms) {
            if (ms < 0) ms = 0;
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return `${hours} ชม. ${String(minutes).padStart(2, '0')} นาที ${String(seconds).padStart(2, '0')} วิ`;
        }

        // --- 4. Initialize ---
        document.addEventListener('DOMContentLoaded', () => {
            fetchAllEmployeesFromGoogleSheet();
        });
