// =================================================================
//                 ระบบคำนวณเงินเดือน - เวอร์ชันใช้งานจริง
// =================================================================

// --- 1. Global State: ตัวแปรหลักสำหรับเก็บข้อมูล ---
let employees = [];
let timeRecords = [];
let payrollResults = [];

// --- 2. Firebase/LocalStorage Data Functions ---
// หมายเหตุ: ส่วนนี้จะทำงานเมื่อคุณใส่ Firebase Config ของคุณ
// ถ้ายังไม่ใส่ จะใช้ LocalStorage เป็นตัวสำรองชั่วคราว
const firebaseConfig = {
  apiKey: "AIzaSyALdFBe881BJSwU7b9MukWDIBEWKESO7OA",
  authDomain: "payroll-54e6f.firebaseapp.com",
  projectId: "payroll-54e6f",
  storageBucket: "payroll-54e6f.firebasestorage.app",
  messagingSenderId: "1042079082074",
  appId: "1:1042079082074:web:f12af17e927e6116185a63"
};

let db;
try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSy...YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase initialized successfully!");
    }
} catch (e) {
    console.error("Firebase initialization failed. Using LocalStorage as fallback.", e);
}

async function saveData(employeeData) {
    if (db) { // ถ้าเชื่อมต่อ Firebase อยู่ ให้ใช้ Firestore
        try {
            await db.collection("employees").doc(employeeData.id).set(employeeData);
        } catch (error) {
            console.error("Error saving to Firebase:", error);
        }
    } else { // ถ้าไม่ ให้ใช้ LocalStorage
        const existingIndex = employees.findIndex(emp => emp.id === employeeData.id);
        if (existingIndex > -1) {
            employees[existingIndex] = employeeData;
        } else {
            employees.push(employeeData);
        }
        localStorage.setItem('payroll_app_employees', JSON.stringify(employees));
    }
}

async function loadData() {
    if (db) {
        try {
            const snapshot = await db.collection("employees").get();
            const loadedEmployees = [];
            snapshot.forEach(doc => loadedEmployees.push(doc.data()));
            employees = loadedEmployees;
        } catch (error) {
            console.error("Error loading from Firebase:", error);
        }
    } else {
        const employeesData = localStorage.getItem('payroll_app_employees');
        if (employeesData) {
            employees = JSON.parse(employeesData);
        }
    }
}

async function deleteData(empId) {
    if (db) {
        try {
            await db.collection("employees").doc(empId).delete();
        } catch (error) {
            console.error("Error deleting from Firebase:", error);
        }
    } else {
        employees = employees.filter(emp => emp.id !== empId);
        localStorage.setItem('payroll_app_employees', JSON.stringify(employees));
    }
}


// --- 3. DOM Ready: สั่งให้ทำงานทันทีที่เปิดหน้าเว็บ ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const payrollMonthElem = document.getElementById('payrollMonth');
    if (payrollMonthElem) payrollMonthElem.value = `${year}-${month}`;
    updateEmployeeTable();
    updateReportSummary();
});

// --- 4. Tab Management ---
function showTab(tabName, clickedButton) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabContent = document.getElementById(tabName);
    if (tabContent) tabContent.classList.add('active');
    if (clickedButton) clickedButton.classList.add('active');
}

// script.js (แก้ไขฟังก์ชันนี้ให้ถูกต้อง)

function updateTimeRecordsTable() {
    const displayDiv = document.getElementById('timeRecordsDisplay');
    if (!displayDiv) return;

    // สร้างตารางและส่วนหัว (Header)
    let tableHtml = `
        <h3>ข้อมูลดิบจากไฟล์ CSV (ประมวลผลแล้ว)</h3>
        <table class="styled-table">
            <thead>
                <tr>
                    <th>รหัสพนักงาน</th>
                    <th>วันที่</th>
                    <th>เวลาเข้า</th>
                    <th>เวลาออก</th>
                    <th>จำนวนสแกน</th>
                </tr>
            </thead>
            <tbody>
    `;

    // ถ้าไม่มีข้อมูล ให้แสดงข้อความ
    if (timeRecords.length === 0) {
        tableHtml += `<tr><td colspan="5">กรุณาอัปโหลดไฟล์ CSV เพื่อดูข้อมูล</td></tr>`;
    } else {
        // วนลูปสร้างแต่ละแถวของข้อมูล
        timeRecords.forEach(rec => {
            tableHtml += `
                <tr>
                    <td>${rec.id}</td>
                    <td>${rec.date}</td>
                    
                    <td><strong>${rec.timeIn}</strong></td>  
                    <td><strong>${rec.timeOut}</strong></td>
                    <td>${rec.scanCount} ครั้ง</td>
                </tr>
            `;
        });
    }

    tableHtml += `</tbody></table>`;
    displayDiv.innerHTML = tableHtml;
}
// --- 5. CSV Upload ---

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // ค้นหา Header แบบยืดหยุ่น
            const findHeader = (fields, names) => fields.find(h => h && names.includes(h.trim().toLowerCase()));
            
            // ใช้ชื่อ header จากไฟล์จริง 'sJobNo', 'Date', 'Time'
            const idHeader = findHeader(results.meta.fields, ['sjobno']); 
            const dateHeader = findHeader(results.meta.fields, ['date']);
            const timeHeader = findHeader(results.meta.fields, ['time']);

            if (!idHeader || !dateHeader || !timeHeader) {
                alert('ไฟล์ CSV ไม่ถูกต้อง! ไม่พบ Header sJobNo, Date, หรือ Time');
                return;
            }

            const dailyRecords = {};
            results.data.forEach(scan => {
                const id = scan[idHeader];
                const date = scan[dateHeader];
                const time = scan[timeHeader];

                // ตรวจสอบข้อมูลสำคัญ
                if (!id || id.trim() === '0' || !date || !time) return;

                const key = `${id}-${date}`;
                if (!dailyRecords[key]) {
                    dailyRecords[key] = {
                        id,
                        date,
                        times: [] // เปลี่ยนชื่อเป็น times ให้สื่อความหมาย
                    };
                }
                dailyRecords[key].times.push(time);
            });

            // ประมวลผลเวลาเข้า-ออกที่ถูกต้อง
            timeRecords = Object.values(dailyRecords).map(rec => {
                rec.times.sort(); // เรียงลำดับเวลาจากน้อยไปมาก
                const timeIn = rec.times[0];
                const timeOut = (rec.times.length > 1) ? rec.times[rec.times.length - 1] : timeIn;
                
                return {
                    id: rec.id,
                    date: rec.date,
                    timeIn: timeIn,   // เวลาเข้าที่ถูกต้อง
                    timeOut: timeOut, // เวลาออกที่ถูกต้อง
                    scanCount: rec.times.length
                };
            });

            alert(`อัปโหลดสำเร็จ! พบข้อมูลการทำงาน ${timeRecords.length} รายการ`);
            updateTimeRecordsTable();
        }
    });
}



// --- 6. Employee Management ---
async function addEmployee() {
    const empId = document.getElementById('empId').value.trim();
    const empName = document.getElementById('empName').value.trim();
    if (!empId || !empName) { alert('กรุณากรอกรหัสและชื่อพนักงาน'); return; }
    const employeeData = {
        id: empId, name: empName,
        salary: document.getElementById('empSalary').value || 0,
        type: document.getElementById('empType').value || 'monthly',
        email: document.getElementById('empEmail').value || '',
        account: document.getElementById('empAccount').value || ''
    };
    await saveData(employeeData);
    await loadData();
    updateEmployeeTable();
    const empForm = document.getElementById('empForm');
    if (empForm) empForm.reset();
}

function updateEmployeeTable() {
    const tableBody = document.getElementById('employeeTableBody'); if (!tableBody) return;
    tableBody.innerHTML = '';
    employees.forEach(emp => {
        const row = tableBody.insertRow();
        row.innerHTML = `<td>${emp.id}</td><td>${emp.name}</td><td>${emp.type}</td><td>${parseFloat(emp.salary).toLocaleString('th-TH')}</td><td><button onclick="editEmployee('${emp.id}')">แก้ไข</button><button onclick="deleteEmployee('${emp.id}')">ลบ</button></td>`;
    });
}

function editEmployee(empId) {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
        document.getElementById('empId').value = emp.id;
        document.getElementById('empName').value = emp.name;
        document.getElementById('empType').value = emp.type;
        document.getElementById('empSalary').value = emp.salary;
        document.getElementById('empEmail').value = emp.email;
        document.getElementById('empAccount').value = emp.account;
    }
}

async function deleteEmployee(empId) {
    const emp = employees.find(e => e.id === empId);
    if (emp && confirm(`ต้องการลบพนักงาน ${emp.name}?`)) {
        await deleteData(empId);
        await loadData();
        updateEmployeeTable();
        updateReportSummary();
    }
}

// --- 7. Payroll Calculation ---
function calculatePayroll() {
    const payrollMonthInput = document.getElementById('payrollMonth').value;
    if (!payrollMonthInput) {
        alert('กรุณาเลือกเดือนที่ต้องการคำนวณ');
        return;
    }
    if (timeRecords.length === 0) {
        alert('กรุณาอัปโหลดข้อมูลเวลาทำงานก่อน');
        return;
    }

    const [year, month] = payrollMonthInput.split('-');
    payrollResults = [];

    employees.forEach(emp => {
        // กรองข้อมูลเวลาของพนักงานในเดือนที่เลือก
        const empTimeRecords = timeRecords.filter(record => {
            // การแปลงรูปแบบวันที่ 'd/M/yyyy' เป็น 'yyyy-MM' เพื่อเปรียบเทียบ
            const dateParts = record.date.split('/');
            if (dateParts.length !== 3) return false;
            // สร้างปีเต็มจาก 2 หลักสุดท้าย เช่น 25 -> 2025
            const recordYear = `20${dateParts[2]}`; 
            const recordMonth = dateParts[1].padStart(2, '0');
            
            return record.id === emp.id && recordMonth === month && recordYear === year;
        });
        
        // ใช้ข้อมูลที่กรองได้มาคำนวณโดยตรง
        const totalWorkDays = empTimeRecords.length;
        let totalWorkHours = 0;
        let totalOtHours = 0;

        empTimeRecords.forEach(record => {
            if (record.timeIn && record.timeOut && record.timeIn !== record.timeOut) {
                const timeIn = new Date(`1970-01-01T${record.timeIn}`);
                const timeOut = new Date(`1970-01-01T${record.timeOut}`);
                let workHours = (timeOut - timeIn) / 3600000;
                if (workHours < 0) workHours += 24; // กรณีข้ามคืน

                totalWorkHours += workHours;

                // คำนวณ OT หากทำงานเกิน 8 ชม. ต่อวัน
                if (workHours > 8) {
                    totalOtHours += (workHours - 8);
                }
            }
        });

        const salary = parseFloat(emp.salary);
        const grossSalary = (emp.type === 'monthly') ? salary : salary * totalWorkDays;
        const hourlyRate = (emp.type === 'monthly' ? salary / 30 : salary) / 8;
        const otPay = totalOtHours * hourlyRate * 1.5;
        const totalSalary = grossSalary + otPay;

        payrollResults.push({
            id: emp.id,
            name: emp.name,
            workDays: totalWorkDays,
            workHours: totalWorkHours,
            otHours: totalOtHours,
            grossSalary,
            otPay,
            totalSalary
        });
    });

    updateReportTable();
    updateReportSummary();
    alert('คำนวณเงินเดือนและอัปเดตรายงานเรียบร้อย!');
}

// --- 8. Reports ---
function updateReportSummary() {
    const totalEmployeesElem = document.getElementById('totalEmployees');
    const totalSalaryElem = document.getElementById('totalSalary');
    const totalOTElem = document.getElementById('totalOT');
    const avgWorkDaysElem = document.getElementById('avgWorkDays');
    if (totalEmployeesElem) totalEmployeesElem.textContent = `${employees.length} คน`;
    const totalSalary = payrollResults.reduce((sum, r) => sum + r.totalSalary, 0);
    const totalOT = payrollResults.reduce((sum, r) => sum + r.otHours, 0);
    const totalDays = payrollResults.reduce((sum, r) => sum + r.workDays, 0);
    const avgDays = employees.length > 0 ? (totalDays / employees.length) : 0;
    if (totalSalaryElem) totalSalaryElem.textContent = `${totalSalary.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท`;
    if (totalOTElem) totalOTElem.textContent = `${totalOT.toFixed(2)} ชม.`;
    if (avgWorkDaysElem) avgWorkDaysElem.textContent = `${avgDays.toFixed(1)} วัน`;
}

function updateReportTable() {
    const tableBody = document.getElementById('reportTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (payrollResults.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9">ยังไม่มีข้อมูลการคำนวณ</td></tr>`; // เพิ่ม colspan เป็น 9
        return;
    }
    payrollResults.forEach(result => {
        const row = tableBody.insertRow();
        // เพิ่มคอลัมน์ใหม่สำหรับปุ่ม
        row.innerHTML = `
            <td>${result.id}</td><td>${result.name}</td>
            <td>${result.workDays}</td><td>${result.workHours.toFixed(2)}</td>
            <td>${result.otHours.toFixed(2)}</td>
            <td>${result.grossSalary.toLocaleString('th-TH')}</td>
            <td>${result.otPay.toFixed(2)}</td>
            <td><strong>${result.totalSalary.toLocaleString('th-TH', {minimumFractionDigits: 2})}</strong></td>
            <td><button class="btn-payslip" onclick="generatePayslip('${result.id}')">📄 ดูสลิป</button></td>
        `;
    });
}

//=================================================================
// 9. Payslip Generation: ฟังก์ชันใหม่สำหรับสร้างสลิป PDF
// =================================================================
function generatePayslip(employeeId) {
    const { jsPDF } = window.jspdf;
    const result = payrollResults.find(r => r.id === employeeId);
    const employee = employees.find(e => e.id === employeeId);

    if (!result || !employee) {
        alert("ไม่พบข้อมูลสำหรับสร้างสลิปของพนักงานรหัส: " + employeeId);
        return;
    }

    const doc = new jsPDF();
    const payrollMonth = document.getElementById('payrollMonth').value;
    const [year, month] = payrollMonth.split('-');
    const issueDate = new Date().toLocaleDateString('th-TH');

    // --- ตั้งค่า Font (สำคัญมากสำหรับภาษาไทย) ---
    // หมายเหตุ: jsPDF ไม่รองรับภาษาไทยโดยตรง เราจะใช้วิธีแสดงผลเป็นภาษาอังกฤษ
    // หากต้องการภาษาไทยสมบูรณ์ จะต้องใช้ library เพิ่มเติมเช่น "jspdf-autotable" พร้อม font ภาษาไทย
    
    // --- Header ---
    doc.setFontSize(18);
    doc.text("Payslip / สลิปเงินเดือน", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("Your Company Name", 105, 30, { align: 'center' });

    // --- Employee Info ---
    doc.setFontSize(10);
    doc.text(`Period: ${month}/${year}`, 14, 45);
    doc.text(`Issue Date: ${issueDate}`, 14, 50);
    
    doc.text(`Employee ID: ${employee.id}`, 140, 45);
    doc.text(`Name: ${employee.name}`, 140, 50);

    // --- Earnings ---
    doc.line(14, 60, 196, 60); // เส้นคั่น
    doc.setFontSize(14);
    doc.text("Earnings (รายรับ)", 14, 68);
    doc.setFontSize(12);
    doc.autoTable({
        startY: 72,
        head: [['Description', 'Amount (THB)']],
        body: [
            ['Basic Salary', result.grossSalary.toFixed(2)],
            ['Overtime (OT) Pay', result.otPay.toFixed(2)],
        ],
        theme: 'plain',
        styles: { fontSize: 12 },
        headStyles: { fontStyle: 'bold' }
    });

    // --- Deductions (ตัวอย่าง) ---
    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("Deductions (รายการหัก)", 14, finalY);
    doc.setFontSize(12);
    doc.autoTable({
        startY: finalY + 4,
        head: [['Description', 'Amount (THB)']],
        body: [
            ['Social Security', '0.00'], // Placeholder
            ['Tax', '0.00'], // Placeholder
        ],
        theme: 'plain',
        styles: { fontSize: 12 },
        headStyles: { fontStyle: 'bold' }
    });

    // --- Summary ---
    finalY = doc.lastAutoTable.finalY + 10;
    const totalEarnings = result.grossSalary + result.otPay;
    const totalDeductions = 0.00; // Placeholder
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Net Salary (ยอดสุทธิ)", 140, finalY, { align: 'right' });
    doc.text(`${result.totalSalary.toFixed(2)} THB`, 196, finalY, { align: 'right' });

    // --- Save File ---
    doc.save(`payslip-${employee.id}-${payrollMonth}.pdf`);
}

function exportReport() { alert('ฟังก์ชันส่งออกรายงานยังไม่ถูกสร้าง'); }
function printReport() { alert('ฟังก์ชันพิมพ์รายงานยังไม่ถูกสร้าง'); }
function loadSampleEmployees() { alert('ฟังก์ชันโหลดข้อมูลตัวอย่างยังไม่ถูกสร้าง'); }