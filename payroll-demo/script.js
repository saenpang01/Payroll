// Global variables
        let employees = [];
        let attendanceData = [];
        let payrollData = [];
        
        // Initialize current month
        document.getElementById('payrollMonth').value = new Date().toISOString().substr(0, 7);
        
        // Tab management
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
            
            // Update reports when reports tab is selected
            if (tabName === 'reports') {
                updateReports();
            }
        }
        
        // File upload handling
        function handleFileUpload(input) {
            const file = input.files[0];
            if (!file) return;
            
            if (!file.name.toLowerCase().endsWith('.csv')) {
                showAlert('กรุณาเลือกไฟล์ CSV เท่านั้น', 'error');
                return;
            }
            
            showProgress();
            
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        showAlert('พบข้อผิดพลาดในไฟล์ CSV: ' + results.errors[0].message, 'error');
                        hideProgress();
                        return;
                    }
                    
                    processAttendanceData(results.data);
                    hideProgress();
                    showAlert('อัปโหลดไฟล์สำเร็จ! ประมวลผลข้อมูล ' + results.data.length + ' รายการ', 'success');
                },
                error: function(error) {
                    showAlert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + error.message, 'error');
                    hideProgress();
                }
            });
        }
        
        // Process attendance data
        function processAttendanceData(data) {
            // Filter out invalid rows and map to a consistent format
            const rawPunches = data.map(row => {
                const employeeId = (row['sJobNo'] || '').replace(/'/g, '').trim();
                let employeeName = (row['sName'] || '').replace(/'/g, '').split(',')[0].trim();

                // Skip rows that are likely headers or invalid data
                if (!employeeId || !employeeName || employeeName.toLowerCase() === 'null' || employeeName.toLowerCase() === 'sname') {
                    return null;
                }

                return {
                    employeeId: employeeId,
                    employeeName: employeeName,
                    date: row['Date'] || '',
                    time: row['Time'] || ''
                };
            }).filter(Boolean); // Remove null entries

            attendanceData = rawPunches;
            
            // Display preview
            displayAttendancePreview();
            
            // Auto-create employee list from attendance data
            autoCreateEmployeeList();
        }
        
        // Display attendance preview
        function displayAttendancePreview() {
            const preview = document.getElementById('uploadResult');
            const sample = attendanceData.slice(0, 5);
            
            let html = '<div class="table-container"><h3>🎯 ตัวอย่างข้อมูลที่อัปโหลด (5 รายการแรก)</h3><table>';
            html += '<thead><tr><th>รหัสพนักงาน</th><th>ชื่อ</th><th>วันที่</th><th>เวลาที่สแกน</th></tr></thead>';
            html += '<tbody>';
            
            sample.forEach(row => {
                html += `<tr>
                    <td>${row.employeeId}</td>
                    <td>${row.employeeName}</td>
                    <td>${row.date}</td>
                    <td>${row.time}</td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            html += `<div class="alert alert-info">📊 รวมข้อมูลทั้งหมด: ${attendanceData.length} รายการ</div>`;
            
            preview.innerHTML = html;
        }
        
        // Auto-create employee list
        function autoCreateEmployeeList() {
            const uniqueEmployees = new Map();
            
            attendanceData.forEach(record => {
                if (record.employeeId && !uniqueEmployees.has(record.employeeId)) {
                    uniqueEmployees.set(record.employeeId, {
                        id: record.employeeId,
                        name: record.employeeName,
                        type: 'monthly',
                        salary: 30000,
                        email: '',
                        account: '',
                        workStart: '08:00',
                        workEnd: '17:00',
                        lunchBreak: 60
                    });
                }
            });
            
            // Add to employees array if not already exists
            uniqueEmployees.forEach(emp => {
                if (!employees.find(e => e.id === emp.id)) {
                    employees.push(emp);
                }
            });
            
            updateEmployeeTable();
            showAlert(`พบพนักงาน ${uniqueEmployees.size} คน จากข้อมูลเวลาเข้าออกงาน`, 'info');
        }
        
        // Employee management
        function addEmployee() {
            const empData = {
                id: document.getElementById('empId').value,
                name: document.getElementById('empName').value,
                type: document.getElementById('empType').value,
                salary: parseFloat(document.getElementById('empSalary').value) || 0,
                email: document.getElementById('empEmail').value,
                account: document.getElementById('empAccount').value,
                workStart: document.getElementById('workStart').value,
                workEnd: document.getElementById('workEnd').value,
                lunchBreak: parseInt(document.getElementById('lunchBreak').value) || 60
            };
            
            if (!empData.id || !empData.name) {
                showAlert('กรุณากรอกรหัสพนักงานและชื่อ', 'error');
                return;
            }
            
            // Check if employee already exists
            if (employees.find(e => e.id === empData.id)) {
                showAlert('รหัสพนักงานนี้มีอยู่แล้ว', 'error');
                return;
            }
            
            employees.push(empData);
            updateEmployeeTable();
            clearEmployeeForm();
            showAlert('เพิ่มพนักงานเรียบร้อยแล้ว', 'success');
        }
        
        function deleteEmployee(id) {
            if (confirm('คุณต้องการลบพนักงานคนนี้หรือไม่?')) {
                employees = employees.filter(e => e.id !== id);
                updateEmployeeTable();
                showAlert('ลบพนักงานเรียบร้อยแล้ว', 'success');
            }
        }
        
        function updateEmployeeTable() {
            const tbody = document.getElementById('employeeTable');
            tbody.innerHTML = '';
            
            employees.forEach(emp => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.type === 'monthly' ? 'รายเดือน' : 'รายวัน'}</td>
                    <td>${emp.salary.toLocaleString()} ฿</td>
                    <td>${emp.email}</td>
                    <td>${emp.account}</td>
                    <td><button class="btn btn-danger" onclick="deleteEmployee('${emp.id}')">🗑️ ลบ</button></td>
                `;
            });
        }
        
        function clearEmployeeForm() {
            document.getElementById('empId').value = '';
            document.getElementById('empName').value = '';
            document.getElementById('empSalary').value = '';
            document.getElementById('empEmail').value = '';
            document.getElementById('empAccount').value = '';
        }
        
        function loadSampleEmployees() {
            const sampleEmployees = [
                { id: 'EMP001', name: 'นายสมชาย ใจดี', type: 'monthly', salary: 35000, email: 'somchai@company.com', account: '123-4-56789-1', workStart: '08:00', workEnd: '17:00', lunchBreak: 60 },
                { id: 'EMP002', name: 'นางสาวสมหญิง รักงาน', type: 'monthly', salary: 28000, email: 'somying@company.com', account: '123-4-56789-2', workStart: '08:00', workEnd: '17:00', lunchBreak: 60 },
                { id: 'EMP003', name: 'นายสุชาติ ขยันดี', type: 'daily', salary: 500, email: 'suchart@company.com', account: '123-4-56789-3', workStart: '08:00', workEnd: '17:00', lunchBreak: 60 }
            ];
            
            sampleEmployees.forEach(emp => {
                if (!employees.find(e => e.id === emp.id)) {
                    employees.push(emp);
                }
            });
            
            updateEmployeeTable();
            showAlert('โหลดข้อมูลตัวอย่างเรียบร้อยแล้ว', 'success');
        }
        
        // Payroll calculation
        function calculatePayroll() {
            if (employees.length === 0) {
                showAlert('กรุณาเพิ่มข้อมูลพนักงานก่อน', 'error');
                return;
            }
            
            if (attendanceData.length === 0) {
                showAlert('กรุณาอัปโหลดข้อมูลเวลาเข้าออกงานก่อน', 'error');
                return;
            }
            
            const month = document.getElementById('payrollMonth').value;
            const otRate = parseFloat(document.getElementById('otRate').value) || 50;
            const weekendDays = Array.from(document.getElementById('weekendDays').selectedOptions).map(option => parseInt(option.value));
            
            payrollData = [];
            
            employees.forEach(emp => {
                const empAttendance = attendanceData.filter(a => a.employeeId === emp.id);
                const monthAttendance = empAttendance.filter(a => a.date.startsWith(month));
                
                const payrollRecord = calculateEmployeePayroll(emp, monthAttendance, otRate, weekendDays);
                payrollData.push(payrollRecord);
            });
            
            displayPayrollResults();
            showAlert('คำนวณเงินเดือนเรียบร้อยแล้ว', 'success');
        }
        
        function calculateEmployeePayroll(employee, attendance, otRate, weekendDays) {
            // Group punches by date
            const punchesByDate = new Map();
            attendance.forEach(record => {
                if (!record.date || !record.time) return;
                
                const dateKey = record.date;
                if (!punchesByDate.has(dateKey)) {
                    punchesByDate.set(dateKey, []);
                }
                punchesByDate.get(dateKey).push(record.time);
            });

            let totalWorkDays = 0;
            let totalWorkHours = 0;
            let totalOTHours = 0;
            let averageTimeIn = [];

            punchesByDate.forEach((punches, dateStr) => {
                if (punches.length < 2) return; // Need at least an in and out punch

                const date = new Date(dateStr);
                const dayOfWeek = date.getDay();
                const isWeekend = weekendDays.includes(dayOfWeek);

                const timeIn = parseTime(punches.reduce((a, b) => a < b ? a : b));
                const timeOut = parseTime(punches.reduce((a, b) => a > b ? a : b));

                if (!timeIn || !timeOut) return;

                let workHours = (timeOut - timeIn) / (1000 * 60 * 60);
                if (workHours <= 0) return;

                averageTimeIn.push(timeIn);

                if (isWeekend) {
                    // All hours worked on a weekend are considered OT
                    totalOTHours += workHours;
                } else {
                    // It's a regular workday
                    totalWorkDays++;
                    workHours -= employee.lunchBreak / 60; // Subtract lunch break on workdays
                    const workStart = parseTime(employee.workStart);
                    const workEnd = parseTime(employee.workEnd);
                    const standardHours = (workEnd - workStart) / (1000 * 60 * 60) - employee.lunchBreak / 60;

                    if (workHours > standardHours) {
                        totalOTHours += workHours - standardHours;
                        totalWorkHours += standardHours;
                    } else {
                        totalWorkHours += workHours;
                    }
                }
            });
            
            // Calculate salary
            let baseSalary = 0;
            let otPay = totalOTHours * otRate;
            
            if (employee.type === 'monthly') {
                baseSalary = employee.salary;
            } else {
                baseSalary = totalWorkDays * employee.salary;
            }
            
            const totalSalary = baseSalary + otPay;
            
            // Calculate average time in
            let avgTimeIn = '';
            if (averageTimeIn.length > 0) {
                const avgMillis = averageTimeIn.reduce((sum, time) => sum + time.getTime(), 0) / averageTimeIn.length;
                const avgDate = new Date(avgMillis);
                avgTimeIn = avgDate.toTimeString().substr(0, 5);
            }
            
            return {
                employeeId: employee.id,
                employeeName: employee.name,
                employeeType: employee.type,
                workDays: totalWorkDays,
                workHours: Math.round(totalWorkHours * 100) / 100,
                otHours: Math.round(totalOTHours * 100) / 100,
                baseSalary: baseSalary,
                otPay: Math.round(otPay),
                totalSalary: Math.round(totalSalary),
                averageTimeIn: avgTimeIn,
                email: employee.email,
                account: employee.account
            };
        }
        
        function parseTime(timeStr) {
            if (!timeStr) return null;
            const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
        }
        
        function displayPayrollResults() {
            const resultDiv = document.getElementById('calculationResult');
            
            let html = '<div class="table-container"><h3>💰 ผลการคำนวณเงินเดือน</h3><table>';
            html += '<thead><tr><th>รหัส</th><th>ชื่อ</th><th>วันทำงาน</th><th>ชั่วโมงทำงาน</th><th>ชั่วโมง OT</th><th>เงินเดือนพื้นฐาน</th><th>ค่า OT</th><th>รวม</th></tr></thead><tbody>';
            
            let totalBaseSalary = 0;
            let totalOTPay = 0;
            let totalSalary = 0;
            
            payrollData.forEach(record => {
                html += `<tr>
                    <td>${record.employeeId}</td>
                    <td>${record.employeeName}</td>
                    <td>${record.workDays}</td>
                    <td>${record.workHours}</td>
                    <td>${record.otHours}</td>
                    <td>${record.baseSalary.toLocaleString()} ฿</td>
                    <td>${record.otPay.toLocaleString()} ฿</td>
                    <td><strong>${record.totalSalary.toLocaleString()} ฿</strong></td>
                </tr>`;
                
                totalBaseSalary += record.baseSalary;
                totalOTPay += record.otPay;
                totalSalary += record.totalSalary;
            });
            
            html += '</tbody></table></div>';
            
            html += `<div class="summary-cards">
                <div class="card">
                    <h3>เงินเดือนพื้นฐานรวม</h3>
                    <div class="value">${totalBaseSalary.toLocaleString()} ฿</div>
                </div>
                <div class="card">
                    <h3>ค่า OT รวม</h3>
                    <div class="value">${totalOTPay.toLocaleString()} ฿</div>
                </div>
                <div class="card">
                    <h3>เงินเดือนรวมทั้งหมด</h3>
                    <div class="value">${totalSalary.toLocaleString()} ฿</div>
                </div>
            </div>`;
            
            resultDiv.innerHTML = html;
        }
        
        // Bank file generation
        function generateBankFile() {
            if (payrollData.length === 0) {
                showAlert('กรุณาคำนวณเงินเดือนก่อน', 'error');
                return;
            }
            
            const bankType = document.getElementById('bankType').value;
            const companyAccount = document.getElementById('companyAccount').value;
            const companyName = document.getElementById('companyName').value;
            
            if (!companyAccount || !companyName) {
                showAlert('กรุณากรอกข้อมูลบัญชีบริษัทและชื่อบริษัท', 'error');
                return;
            }
            
            let fileContent = '';
            let fileName = '';
            
            switch (bankType) {
                case 'kbank':
                    fileContent = generateKBankFile(payrollData, companyAccount, companyName);
                    fileName = 'payroll_kbank.txt';
                    break;
                case 'scb':
                    fileContent = generateSCBFile(payrollData, companyAccount, companyName);
                    fileName = 'payroll_scb.txt';
                    break;
                case 'bbl':
                    fileContent = generateBBLFile(payrollData, companyAccount, companyName);
                    fileName = 'payroll_bbl.txt';
                    break;
                default:
                    fileContent = generateGenericFile(payrollData, companyAccount, companyName);
                    fileName = 'payroll_generic.csv';
            }
            
            downloadFile(fileContent, fileName);
            showAlert('สร้างไฟล์สำหรับธนาคารเรียบร้อยแล้ว', 'success');
        }
        
        function generateKBankFile(data, companyAccount, companyName) {
            let content = '';
            const today = new Date().toISOString().substr(0, 10).replace(/-/g, '');
            
            // Header
            content += `H${companyAccount.replace(/-/g, '')}${today}${data.length.toString().padStart(6, '0')}\n`;
            
            // Detail records
            data.forEach((record, index) => {
                const seq = (index + 1).toString().padStart(6, '0');
                const account = record.account.replace(/-/g, '');
                const amount = record.totalSalary.toString().padStart(13, '0');
                const name = record.employeeName.padEnd(50, ' ');
                
                content += `D${seq}${account}${amount}${name}\n`;
            });
            
            return content;
        }
        
        function generateSCBFile(data, companyAccount, companyName) {
            let content = '';
            
            data.forEach(record => {
                const account = record.account.replace(/-/g, '');
                const amount = record.totalSalary.toFixed(2);
                const name = record.employeeName;
                
                content += `${account},${amount},${name}\n`;
            });
            
            return content;
        }
        
        function generateBBLFile(data, companyAccount, companyName) {
            let content = 'ACCOUNT,AMOUNT,NAME,REF\n';
            
            data.forEach(record => {
                const account = record.account;
                const amount = record.totalSalary.toFixed(2);
                const name = record.employeeName;
                const ref = record.employeeId;
                
                content += `${account},${amount},${name},${ref}\n`;
            });
            
            return content;
        }
        
        function generateGenericFile(data, companyAccount, companyName) {
            let content = 'Employee ID,Name,Account,Amount\n';
            
            data.forEach(record => {
                content += `${record.employeeId},${record.employeeName},${record.account},${record.totalSalary}\n`;
            });
            
            return content;
        }
        
        function previewBankFile() {
            if (payrollData.length === 0) {
                showAlert('กรุณาคำนวณเงินเดือนก่อน', 'error');
                return;
            }
            
            const resultDiv = document.getElementById('bankFileResult');
            let html = '<div class="table-container"><h3>🏦 ตัวอย่างไฟล์ธนาคาร</h3>';
            html += '<table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>เลขบัญชี</th><th>จำนวนเงิน</th></tr></thead><tbody>';
            
            payrollData.forEach(record => {
                html += `<tr>
                    <td>${record.employeeId}</td>
                    <td>${record.employeeName}</td>
                    <td>${record.account}</td>
                    <td>${record.totalSalary.toLocaleString()} ฿</td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            resultDiv.innerHTML = html;
        }
        
        // Payslip generation
        function generatePayslips() {
            if (payrollData.length === 0) {
                showAlert('กรุณาคำนวณเงินเดือนก่อน', 'error');
                return;
            }
            
            const template = document.getElementById('payslipTemplate').value;
            const companyLogo = document.getElementById('companyLogo').value;
            const companyAddress = document.getElementById('companyAddress').value;
            const companyName = document.getElementById('companyName').value;
            
            // Generate individual payslips
            payrollData.forEach(record => {
                generateIndividualPayslip(record, template, companyLogo, companyAddress, companyName);
            });
            
            showAlert('สร้างสลิปเงินเดือนเรียบร้อยแล้ว', 'success');
        }
        
        function generateIndividualPayslip(record, template, logo, address, companyName) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Company header
            doc.setFontSize(20);
            doc.text(companyName || 'บริษัท ABC จำกัด', 20, 30);
            
            doc.setFontSize(12);
            doc.text(address || '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110', 20, 40);
            
            // Title
            doc.setFontSize(16);
            doc.text('ใบแจ้งเงินเดือน (PAYSLIP)', 20, 60);
            
            // Employee info
            doc.setFontSize(12);
            doc.text(`รหัสพนักงาน: ${record.employeeId}`, 20, 80);
            doc.text(`ชื่อ: ${record.employeeName}`, 20, 90);
            doc.text(`ประเภท: ${record.employeeType === 'monthly' ? 'รายเดือน' : 'รายวัน'}`, 20, 100);
            
            // Work summary
            doc.text(`วันทำงาน: ${record.workDays} วัน`, 20, 120);
            doc.text(`ชั่วโมงทำงาน: ${record.workHours} ชั่วโมง`, 20, 130);
            doc.text(`ชั่วโมง OT: ${record.otHours} ชั่วโมง`, 20, 140);
            doc.text(`เวลาเข้างานเฉลี่ย: ${record.averageTimeIn}`, 20, 150);
            
            // Salary breakdown
            doc.line(20, 170, 190, 170);
            doc.text('รายการเงินได้', 20, 180);
            doc.text(`เงินเดือน/ค่าแรง: ${record.baseSalary.toLocaleString()} บาท`, 30, 190);
            doc.text(`ค่าทำงานล่วงเวลา: ${record.otPay.toLocaleString()} บาท`, 30, 200);
            
            doc.line(20, 210, 190, 210);
            doc.setFontSize(14);
            doc.text(`เงินได้รวม: ${record.totalSalary.toLocaleString()} บาท`, 20, 220);
            
            // Footer
            doc.setFontSize(10);
            doc.text(`สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')}`, 20, 270);
            
            // Save PDF
            doc.save(`payslip_${record.employeeId}.pdf`);
        }
        
        function sendAllPayslips() {
            if (payrollData.length === 0) {
                showAlert('กรุณาคำนวณเงินเดือนก่อน', 'error');
                return;
            }
            
            const autoEmail = document.getElementById('autoEmail').checked;
            
            if (!autoEmail) {
                showAlert('กรุณาเปิดใช้งานการส่งอีเมลอัตโนมัติ', 'error');
                return;
            }
            
            // Simulate email sending
            let emailsSent = 0;
            
            payrollData.forEach(record => {
                if (record.email) {
                    // Simulate email sending delay
                    setTimeout(() => {
                        emailsSent++;
                        if (emailsSent === payrollData.length) {
                            showAlert(`ส่งสลิปเงินเดือนทางอีเมลเรียบร้อยแล้ว (${emailsSent} คน)`, 'success');
                        }
                    }, 100 * emailsSent);
                }
            });
            
            if (emailsSent === 0) {
                showAlert('ไม่พบอีเมลของพนักงาน กรุณาเพิ่มอีเมลในข้อมูลพนักงาน', 'error');
            }
        }
        
        // Reports
        function updateReports() {
            if (payrollData.length === 0) {
                document.getElementById('totalEmployees').textContent = employees.length;
                document.getElementById('totalSalary').textContent = '0 ฿';
                document.getElementById('totalOT').textContent = '0 ชม.';
                document.getElementById('avgWorkDays').textContent = '0 วัน';
                document.getElementById('reportTable').innerHTML = '';
                return;
            }
            
            // Update summary cards
            const totalSalary = payrollData.reduce((sum, record) => sum + record.totalSalary, 0);
            const totalOT = payrollData.reduce((sum, record) => sum + record.otHours, 0);
            const avgWorkDays = payrollData.reduce((sum, record) => sum + record.workDays, 0) / payrollData.length;
            
            document.getElementById('totalEmployees').textContent = payrollData.length;
            document.getElementById('totalSalary').textContent = totalSalary.toLocaleString() + ' ฿';
            document.getElementById('totalOT').textContent = Math.round(totalOT * 100) / 100 + ' ชม.';
            document.getElementById('avgWorkDays').textContent = Math.round(avgWorkDays * 100) / 100 + ' วัน';
            
            // Update report table
            const tbody = document.getElementById('reportTable');
            tbody.innerHTML = '';
            
            payrollData.forEach(record => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${record.employeeId}</td>
                    <td>${record.employeeName}</td>
                    <td>${record.workDays}</td>
                    <td>${record.workHours}</td>
                    <td>${record.otHours}</td>
                    <td>${record.baseSalary.toLocaleString()} ฿</td>
                    <td>${record.otPay.toLocaleString()} ฿</td>
                    <td><strong>${record.totalSalary.toLocaleString()} ฿</strong></td>
                    <td>${record.averageTimeIn}</td>
                `;
            });
        }
        
        // Utility functions
        function showAlert(message, type) {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.textContent = message;
            
            document.body.insertBefore(alertDiv, document.body.firstChild);
            
            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }
        
        function showProgress() {
            document.getElementById('uploadProgress').classList.remove('hidden');
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                document.getElementById('progressBar').style.width = progress + '%';
                if (progress >= 100) {
                    clearInterval(interval);
                }
            }, 100);
        }
        
        function hideProgress() {
            setTimeout(() => {
                document.getElementById('uploadProgress').classList.add('hidden');
                document.getElementById('progressBar').style.width = '0%';
            }, 500);
        }
        
        function downloadFile(content, filename) {
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }
        
        function exportCalculation() {
            if (payrollData.length === 0) {
                showAlert('ไม่มีข้อมูลการคำนวณเงินเดือน', 'error');
                return;
            }
            
            let csv = 'รหัสพนักงาน,ชื่อ,ประเภท,วันทำงาน,ชั่วโมงทำงาน,ชั่วโมง OT,เงินเดือนพื้นฐาน,ค่า OT,เงินรวม,เวลาเข้างานเฉลี่ย\n';
            
            payrollData.forEach(record => {
                csv += `${record.employeeId},${record.employeeName},${record.employeeType},${record.workDays},${record.workHours},${record.otHours},${record.baseSalary},${record.otPay},${record.totalSalary},${record.averageTimeIn}\n`;
            });
            
            downloadFile(csv, 'payroll_calculation.csv');
            showAlert('ส่งออกผลการคำนวณเรียบร้อยแล้ว', 'success');
        }
        
        function exportReport() {
            exportCalculation();
        }
        
        function printReport() {
            window.print();
        }
        
        // Drag and drop functionality
        const uploadArea = document.querySelector('.upload-area');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                document.getElementById('csvFile').files = files;
                handleFileUpload(document.getElementById('csvFile'));
            }
        });
        
        // Initialize weekend selection
        document.getElementById('weekendDays').selectedIndex = 6; // Saturday selected by default
