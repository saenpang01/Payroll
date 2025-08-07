// Global state (in-memory "database")
let employees = [];
let timeRecords = [];
let payrollResults = [];

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Set default month for payroll calculation
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('payrollMonth').value = `${year}-${month}`;
    
    // Initial UI update
    updateEmployeeTable();
    updateReportSummary();
});

// --- Tab Management ---
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Deactivate all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show the selected tab content and activate the tab button
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');

    // Refresh data for specific tabs when they are shown
    if (tabName === 'reports') {
        updateReportSummary();
        updateReportTable();
    }
}

// --- CSV Upload (Tab 1) ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) {
        return;
    }

    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const uploadResult = document.getElementById('uploadResult');

    uploadResult.innerHTML = '';
    uploadProgress.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'กำลังอัปโหลด...';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        // This function is called for each row during parsing
        step: function(row, parser) {
            const progress = (row.meta.cursor / file.size * 100).toFixed(2);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `กำลังประมวลผล... ${progress}%`;
        },
        // This function is called when parsing is complete
        complete: function(results) {
            progressBar.style.width = '100%';
            progressText.textContent = 'ประมวลผลเสร็จสิ้น!';

            const scanEvents = results.data;

            // --- New Robust Header Detection ---
            // ค้นหาชื่อคอลัมน์จริงๆ ที่อยู่ในไฟล์ โดยไม่สนใจตัวพิมพ์เล็ก-ใหญ่
            const originalHeaders = results.meta.fields;
            const findHeader = (possibleLowerCaseNames) => {
                return originalHeaders.find(h => possibleLowerCaseNames.includes(h.trim().toLowerCase()));
            };

            const idHeader = findHeader(['sjobno']);
            const nameHeader = findHeader(['sname']);
            const dateHeader = findHeader(['date']);
            const timeHeader = findHeader(['time']);

            // ตรวจสอบว่าพบคอลัมน์ที่จำเป็นทั้งหมดหรือไม่
            if (!idHeader || !dateHeader || !timeHeader) {
                 // เพิ่ม log สำหรับช่วยดีบักใน Console (กด F12 ในเบราว์เซอร์เพื่อดู)
                 console.error("Header validation failed! The app could not find the required columns.");
                 console.log("Required headers (lowercase): 'sjobno', 'date', 'time'. Optional: 'sname'");
                 console.log("Headers found in file:", results.meta.fields);
                 uploadResult.innerHTML = `<p class="error" style="color: #721c24;">ไฟล์ CSV ไม่ถูกต้อง! ไม่พบคอลัมน์ที่จำเป็น (sJobNo, Date, Time) ในไฟล์ที่อัปโหลด</p>`;
                 uploadProgress.classList.add('hidden');
                 return;
            }

            // Process raw scan events to group them by employee and date
            const dailyRecords = {};
            scanEvents.forEach(scan => {
                // ดึงข้อมูลโดยใช้ชื่อคอลัมน์ที่หาเจอ
                const id = scan[idHeader];
                const date = scan[dateHeader];
                const time = scan[timeHeader];

                // ข้ามแถวที่ข้อมูลไม่สมบูรณ์
                if (!id || !date || !time) {
                    return;
                }

                const key = `${id}-${date}`;
                if (!dailyRecords[key]) {
                    // If this is the first scan for this employee on this day, create a new record
                    dailyRecords[key] = {
                        id: id,
                        name: nameHeader ? scan[nameHeader] : '', // ใช้ชื่อถ้าเจอคอลัมน์ sName
                        date: date,
                        timeIn: time,
                        timeOut: time // Initialize timeOut with the first scan time
                    };
                } else {
                    // If a record already exists, update timeIn (earliest) and timeOut (latest)
                    if (time < dailyRecords[key].timeIn) {
                        dailyRecords[key].timeIn = time;
                    }
                    if (time > dailyRecords[key].timeOut) {
                        dailyRecords[key].timeOut = time;
                    }
                }
            });

            // Convert the grouped records object back into an array
            timeRecords = Object.values(dailyRecords);

            // If timeIn and timeOut are the same, it means only one scan. Mark timeOut as not available.
            timeRecords.forEach(record => {
                if (record.timeIn === record.timeOut) {
                    record.timeOut = '-';
                }
            });

            displayUploadResult(timeRecords);
            setTimeout(() => uploadProgress.classList.add('hidden'), 2000);
            
            // Suggest moving to the next tab
            // --- Auto-populate/update employee list from uploaded data ---
            const uploadedEmployees = {};
            timeRecords.forEach(record => {
                // Check if we've already processed this employee ID
                if (!uploadedEmployees[record.id]) {
                    // Check if this employee already exists in our main list
                    const employeeExists = employees.some(e => e.id === record.id);
                    if (!employeeExists) {
                        uploadedEmployees[record.id] = {
                            id: record.id,
                            name: record.name || `พนักงาน #${record.id}`
                        };
                    }
                }
            });

            const newEmployees = Object.values(uploadedEmployees);
            if (newEmployees.length > 0) {
                newEmployees.forEach(emp => {
                    employees.push({ ...emp, type: 'daily', salary: 350, email: '', account: '' });
                });
                updateEmployeeTable(); // Refresh the employee table view
            }

            let alertMessage = `${timeRecords.length} บันทึกข้อมูลรายวันถูกสร้างขึ้นสำเร็จ!`;
            if (newEmployees.length > 0) {
                alertMessage += `\n\nพบและเพิ่มพนักงานใหม่ ${newEmployees.length} คน ไปยังแท็บ "จัดการพนักงาน" โดยอัตโนมัติ`;
            }
            alert(alertMessage);
        },
        error: function(err, file) {
            uploadProgress.classList.add('hidden');
            uploadResult.innerHTML = `<p class="alert alert-error">เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}</p>`;
        }
    });
}

function displayUploadResult(data) {
    const uploadResult = document.getElementById('uploadResult');
    if (data.length === 0) {
        uploadResult.innerHTML = '<p class="alert alert-info">ประมวลผลไฟล์สำเร็จ แต่ไม่พบข้อมูลการสแกนที่สมบูรณ์ (รหัส, วันที่, เวลา) ในไฟล์</p>';
        return;
    }

    let table = `
        <h4>ตัวอย่างข้อมูลที่อัปโหลด (${data.length} รายการ):</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>รหัสพนักงาน</th>
                        <th>ชื่อ</th>
                        <th>วันที่</th>
                        <th>เวลาเข้า</th>
                        <th>เวลาออก</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Display first 5 rows as a sample
    data.slice(0, 5).forEach(row => {
        table += `
            <tr>
                <td>${row.id || ''}</td>
                <td>${row.name || ''}</td>
                <td>${row.date || ''}</td>
                <td>${row.timeIn || ''}</td>
                <td>${row.timeOut || ''}</td>
            </tr>
        `;
    });

    if (data.length > 5) {
        table += `<tr><td colspan="5">... และอีก ${data.length - 5} รายการ</td></tr>`;
    }

    table += '</tbody></table></div>';
    uploadResult.innerHTML = table;
}

// --- Employee Management (Tab 2) ---
function addEmployee() {
    const empIdInput = document.getElementById('empId');
    const empNameInput = document.getElementById('empName');
    const empSalaryInput = document.getElementById('empSalary');

    const empId = empIdInput.value.trim();
    const empName = empNameInput.value.trim();
    const empType = document.getElementById('empType').value;
    const empSalary = empSalaryInput.value;
    const empEmail = document.getElementById('empEmail').value.trim();
    const empAccount = document.getElementById('empAccount').value.trim();

    if (!empId || !empName || !empSalary) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน: รหัสพนักงาน, ชื่อ, และเงินเดือน/ค่าแรง');
        return;
    }

    if (employees.some(emp => emp.id === empId)) {
        alert('รหัสพนักงานนี้มีอยู่แล้วในระบบ');
        return;
    }

    const newEmployee = {
        id: empId,
        name: empName,
        type: empType,
        salary: parseFloat(empSalary),
        email: empEmail,
        account: empAccount
    };

    employees.push(newEmployee);
    updateEmployeeTable();
    updateReportSummary();

    // Clear form fields for next entry
    empIdInput.value = '';
    empNameInput.value = '';
    empSalaryInput.value = '';
    document.getElementById('empEmail').value = '';
    document.getElementById('empAccount').value = '';
    empIdInput.focus();
}

function loadSampleEmployees() {
    if (employees.length > 0 && !confirm('การกระทำนี้จะลบข้อมูลพนักงานที่มีอยู่และแทนที่ด้วยข้อมูลตัวอย่าง คุณแน่ใจหรือไม่?')) {
        return;
    }
    employees = [
        { id: 'EMP001', name: 'สมชาย ใจดี', type: 'monthly', salary: 35000, email: 'somchai.j@example.com', account: '111-2-33333-4' },
        { id: 'EMP002', name: 'สมหญิง จริงใจ', type: 'monthly', salary: 42000, email: 'somyimg.j@example.com', account: '222-3-44444-5' },
        { id: 'D001', name: 'มานะ อดทน', type: 'daily', salary: 450, email: 'mana.o@example.com', account: '333-4-55555-6' },
        { id: 'D002', name: 'ปิติ ยินดี', type: 'daily', salary: 420, email: 'piti.y@example.com', account: '444-5-66666-7' }
    ];
    updateEmployeeTable();
    updateReportSummary();
    alert('โหลดข้อมูลพนักงานตัวอย่าง 4 คนเรียบร้อยแล้ว');
}

function updateEmployeeTable() {
    const tableBody = document.getElementById('employeeTable');
    if (employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">ยังไม่มีข้อมูลพนักงาน (อัปโหลดไฟล์ CSV หรือเพิ่มด้วยตนเอง)</td></tr>';
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows
    employees.forEach((emp, index) => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${emp.id}</td>
            <td>${emp.name}</td>
            <td>${emp.type === 'monthly' ? 'รายเดือน' : 'รายวัน'}</td>
            <td>${emp.salary.toLocaleString()}</td>
            <td>${emp.email || '-'}</td>
            <td>${emp.account || '-'}</td>
            <td>
                <button class="btn-small btn-edit" onclick="editEmployee(${index})">แก้ไข</button>
                <button class="btn-small btn-danger" onclick="deleteEmployee(${index})">ลบ</button>
            </td>
        `;
    });
}

function editEmployee(index) {
    // การแก้ไขเบื้องต้นผ่าน prompt (ในแอปจริงอาจใช้ modal)
    const emp = employees[index];
    const newName = prompt(`แก้ไขชื่อของพนักงาน (ID: ${emp.id}):`, emp.name);
    if (newName && newName.trim() !== '') {
        employees[index].name = newName.trim();
        updateEmployeeTable();
    }
}

function deleteEmployee(index) {
    const emp = employees[index];
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน "${emp.name}"?`)) {
        employees.splice(index, 1); // ลบพนักงานออกจาก array
        updateEmployeeTable();
        updateReportSummary();
    }
}

// --- Payroll Calculation (Tab 3) ---
function calculatePayroll() { alert('ฟังก์ชัน "คำนวณเงินเดือน" ยังไม่ได้ถูกสร้าง'); }
function exportCalculation() { alert('ฟังก์ชัน "ส่งออกผลการคำนวณ" ยังไม่ได้ถูกสร้าง'); }

// --- Bank File (Tab 4) ---
function generateBankFile() { alert('ฟังก์ชัน "สร้างไฟล์สำหรับธนาคาร" ยังไม่ได้ถูกสร้าง'); }
function previewBankFile() { alert('ฟังก์ชัน "ดูตัวอย่างไฟล์" ยังไม่ได้ถูกสร้าง'); }

// --- Payslips (Tab 5) ---
function generatePayslips() { alert('ฟังก์ชัน "สร้างสลิปเงินเดือนทั้งหมด" ยังไม่ได้ถูกสร้าง'); }
function sendAllPayslips() { alert('ฟังก์ชัน "ส่งสลิปทั้งหมดทางอีเมล" ยังไม่ได้ถูกสร้าง'); }

// --- Reports (Tab 6) ---
function updateReportSummary() {
    document.getElementById('totalEmployees').textContent = employees.length;
    // ... more summary calculations
}
function updateReportTable() {
    const tableBody = document.getElementById('reportTable');
    tableBody.innerHTML = '<tr><td colspan="9">คำนวณเงินเดือนก่อนเพื่อดูรายงาน</td></tr>';
}
function exportReport() { alert('ฟังก์ชัน "ส่งออกรายงาน Excel" ยังไม่ได้ถูกสร้าง'); }
function printReport() { alert('ฟังก์ชัน "พิมพ์รายงาน" ยังไม่ได้ถูกสร้าง'); }