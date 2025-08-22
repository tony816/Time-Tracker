class TimeTracker {
    constructor() {
        this.timeSlots = [];
        this.currentDate = new Date().toISOString().split('T')[0];
        this.selectedPlannedFields = new Set();
        this.selectedActualFields = new Set();
        this.isSelectingPlanned = false;
        this.isSelectingActual = false;
        this.dragStartIndex = -1;
        this.currentColumnType = null;
        this.mergeButton = null;
        this.mergedFields = new Map(); // {type-startIndex-endIndex: mergedValue}
        this.init();
    }

    init() {
        this.generateTimeSlots();
        this.renderTimeEntries();
        this.attachEventListeners();
        this.setCurrentDate();
        this.loadData();
    }

    generateTimeSlots() {
        this.timeSlots = [];
        for (let hour = 4; hour <= 23; hour++) {
            this.timeSlots.push({
                time: `${hour}`,
                planned: '',
                actual: ''
            });
        }
        this.timeSlots.push({
            time: '00',
            planned: '',
            actual: ''
        });
        this.timeSlots.push({
            time: '1',
            planned: '',
            actual: ''
        });
        this.timeSlots.push({
            time: '2',
            planned: '',
            actual: ''
        });
        this.timeSlots.push({
            time: '3',
            planned: '',
            actual: ''
        });
    }

    renderTimeEntries() {
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';
            
            // 병합 상태 확인을 위한 클래스 추가
            const plannedMergeKey = this.findMergeKey('planned', index);
            const actualMergeKey = this.findMergeKey('actual', index);
            
            // 병합 관련 클래스는 제거 - CSS grid로 처리
            
            
            const plannedContent = plannedMergeKey ? 
                this.createMergedField(plannedMergeKey, 'planned', index, slot.planned) :
                `<input type="text" class="input-field planned-input" 
                        data-index="${index}" 
                        data-type="planned" 
                        value="${slot.planned}"
                        placeholder="">`;
                        
            const actualContent = actualMergeKey ? 
                this.createMergedField(actualMergeKey, 'actual', index, slot.actual) :
                `<input type="text" class="input-field actual-input" 
                        data-index="${index}" 
                        data-type="actual" 
                        value="${slot.actual}"
                        placeholder="">`;
            
            entryDiv.innerHTML = `
                ${plannedContent}
                <div class="time-slot">${slot.time}</div>
                ${actualContent}
            `;
            
            entryDiv.dataset.index = index;
            
            // 병합 상태는 개별 필드에서 처리 (행 전체가 아닌)
            
            // 병합된 필드에 대한 행 구분선 처리
            if (plannedMergeKey) {
                const plannedStart = parseInt(plannedMergeKey.split('-')[1]);
                const plannedEnd = parseInt(plannedMergeKey.split('-')[2]);
                if (index >= plannedStart && index < plannedEnd) {
                    entryDiv.classList.add('planned-merged-row');
                }
            }
            
            if (actualMergeKey) {
                const actualStart = parseInt(actualMergeKey.split('-')[1]);
                const actualEnd = parseInt(actualMergeKey.split('-')[2]);
                if (index >= actualStart && index < actualEnd) {
                    entryDiv.classList.add('actual-merged-row');
                }
            }
            
            // 병합되지 않은 필드에만 선택 리스너 추가
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');
            
            // 메인 병합 필드이거나 일반 필드일 때만 선택 리스너 추가
            const hasSelectableField = (plannedField && !plannedField.classList.contains('merged-secondary')) ||
                                      (actualField && !actualField.classList.contains('merged-secondary'));
            
            if (hasSelectableField) {
                this.attachFieldSelectionListeners(entryDiv, index);
            }
            
            container.appendChild(entryDiv);
        });
    }

    attachEventListeners() {
        document.getElementById('date').addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.loadData();
        });

        document.getElementById('timeEntries').addEventListener('input', (e) => {
            if (e.target.classList.contains('input-field')) {
                const index = parseInt(e.target.dataset.index);
                const type = e.target.dataset.type;
                this.timeSlots[index][type] = e.target.value;
                this.calculateTotals();
                this.autoSave();
            }
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveData();
            this.showNotification('데이터가 저장되었습니다!');
        });

        document.getElementById('loadBtn').addEventListener('click', () => {
            this.loadData();
            this.showNotification('데이터를 불러왔습니다!');
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('모든 데이터를 초기화하시겠습니까?')) {
                this.clearData();
                this.showNotification('데이터가 초기화되었습니다!');
            }
        });

        // 날짜 네비게이션 버튼 이벤트
        document.getElementById('prevDayBtn').addEventListener('click', () => {
            this.changeDate(-1);
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date().toISOString().split('T')[0];
            this.setCurrentDate();
            this.loadData();
        });

        document.getElementById('nextDayBtn').addEventListener('click', () => {
            this.changeDate(1);
        });

        // 키보드 이벤트
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearAllSelections();
            }
        });

        document.addEventListener('mouseup', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.dragStartIndex = -1;
            this.currentColumnType = null;
        });
    }

    setCurrentDate() {
        document.getElementById('date').value = this.currentDate;
    }

    calculateTotals() {
        let plannedTotal = 0;
        let actualTotal = 0;

        this.timeSlots.forEach(slot => {
            if (slot.planned) plannedTotal++;
            if (slot.actual) actualTotal++;
        });

        document.getElementById('totalPlanned').textContent = `${plannedTotal}시간`;
        document.getElementById('totalActual').textContent = `${actualTotal}시간`;
    }

    saveData() {
        const data = {
            date: this.currentDate,
            timeSlots: this.timeSlots
        };
        
        localStorage.setItem(`timesheet_${this.currentDate}`, JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem(`timesheet_${this.currentDate}`);
        
        if (savedData) {
            const data = JSON.parse(savedData);
            this.timeSlots = data.timeSlots || this.timeSlots;
        } else {
            this.generateTimeSlots();
        }
        
        this.renderTimeEntries();
        this.calculateTotals();
    }

    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveData();
        }, 2000);
    }

    clearData() {
        this.generateTimeSlots();
        this.renderTimeEntries();
        this.calculateTotals();
        localStorage.removeItem(`timesheet_${this.currentDate}`);
    }

    changeDate(days) {
        const currentDate = new Date(this.currentDate);
        currentDate.setDate(currentDate.getDate() + days);
        this.currentDate = currentDate.toISOString().split('T')[0];
        this.setCurrentDate();
        this.loadData();
    }

    attachFieldSelectionListeners(entryDiv, index) {
        const plannedField = entryDiv.querySelector('.planned-input');
        const actualField = entryDiv.querySelector('.actual-input');
        
        // 계획된 활동 필드 선택 이벤트
        let plannedMouseMoved = false;
        
        plannedField.addEventListener('mousedown', (e) => {
            if (e.target === plannedField && !plannedField.matches(':focus')) {
                e.preventDefault();
                plannedMouseMoved = false;
                this.dragStartIndex = index;
                this.currentColumnType = 'planned';
                this.isSelectingPlanned = true;
            }
        });
        
        plannedField.addEventListener('mousemove', (e) => {
            if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                plannedMouseMoved = true;
            }
        });
        
        plannedField.addEventListener('mouseup', (e) => {
            if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                e.preventDefault();
                e.stopPropagation();
                
                if (!plannedMouseMoved) {
                    // 단일 클릭 - 복수 선택된 경우 모두 해제, 단일/비선택 상태면 토글
                    if (this.selectedPlannedFields.size > 1) {
                        this.clearSelection('planned');
                    } else if (this.selectedPlannedFields.has(index)) {
                        // 이미 선택된 필드 클릭 - 해제
                        this.toggleFieldSelection('planned', index);
                    } else {
                        // 새로운 필드 클릭 - 기존 선택 해제하고 새로 선택
                        this.clearSelection('planned');
                        this.toggleFieldSelection('planned', index);
                    }
                } else {
                    // 드래그 완료
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    this.selectFieldRange('planned', this.dragStartIndex, index);
                }
                
                this.isSelectingPlanned = false;
                this.currentColumnType = null;
            }
        });
        
        plannedField.addEventListener('mouseenter', (e) => {
            if (this.isSelectingPlanned && this.currentColumnType === 'planned' && this.dragStartIndex !== index) {
                plannedMouseMoved = true;
                if (!e.ctrlKey && !e.metaKey) {
                    this.clearSelection('planned');
                }
                this.selectFieldRange('planned', this.dragStartIndex, index);
            }
        });
        
        // 실제 활동 필드 선택 이벤트
        let actualMouseMoved = false;
        
        actualField.addEventListener('mousedown', (e) => {
            if (e.target === actualField && !actualField.matches(':focus')) {
                e.preventDefault();
                actualMouseMoved = false;
                this.dragStartIndex = index;
                this.currentColumnType = 'actual';
                this.isSelectingActual = true;
            }
        });
        
        actualField.addEventListener('mousemove', (e) => {
            if (this.isSelectingActual && this.currentColumnType === 'actual') {
                actualMouseMoved = true;
            }
        });
        
        actualField.addEventListener('mouseup', (e) => {
            if (e.target === actualField && !actualField.matches(':focus') && this.currentColumnType === 'actual') {
                e.preventDefault();
                e.stopPropagation();
                
                if (!actualMouseMoved) {
                    // 단일 클릭 - 복수 선택된 경우 모두 해제, 단일/비선택 상태면 토글
                    if (this.selectedActualFields.size > 1) {
                        this.clearSelection('actual');
                    } else if (this.selectedActualFields.has(index)) {
                        // 이미 선택된 필드 클릭 - 해제
                        this.toggleFieldSelection('actual', index);
                    } else {
                        // 새로운 필드 클릭 - 기존 선택 해제하고 새로 선택
                        this.clearSelection('actual');
                        this.toggleFieldSelection('actual', index);
                    }
                } else {
                    // 드래그 완료
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('actual');
                    }
                    this.selectFieldRange('actual', this.dragStartIndex, index);
                }
                
                this.isSelectingActual = false;
                this.currentColumnType = null;
            }
        });
        
        actualField.addEventListener('mouseenter', (e) => {
            if (this.isSelectingActual && this.currentColumnType === 'actual' && this.dragStartIndex !== index) {
                actualMouseMoved = true;
                if (!e.ctrlKey && !e.metaKey) {
                    this.clearSelection('actual');
                }
                this.selectFieldRange('actual', this.dragStartIndex, index);
            }
        });
    }

    startFieldSelection(type, index, e) {
        this.currentColumnType = type;
        this.dragStartIndex = index;
        
        if (type === 'planned') {
            this.isSelectingPlanned = true;
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection('planned');
            }
            this.toggleFieldSelection('planned', index);
        } else if (type === 'actual') {
            this.isSelectingActual = true;
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection('actual');
            }
            this.toggleFieldSelection('actual', index);
        }
    }

    toggleFieldSelection(type, index) {
        const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.has(index)) {
            selectedSet.delete(index);
            field.classList.remove('field-selected');
        } else {
            selectedSet.add(index);
            field.classList.add('field-selected');
        }
    }

    selectFieldRange(type, startIndex, endIndex) {
        this.clearSelection(type);
        
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        
        for (let i = start; i <= end; i++) {
            const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
            selectedSet.add(i);
            const field = document.querySelector(`[data-index="${i}"] .${type}-input`);
            if (field) {
                field.classList.add('field-selected');
            }
        }
        
        this.showMergeButton(type);
    }
    
    clearSelection(type) {
        if (type === 'planned') {
            this.selectedPlannedFields.forEach(index => {
                const field = document.querySelector(`[data-index="${index}"] .planned-input`);
                if (field) {
                    field.classList.remove('field-selected');
                }
            });
            this.selectedPlannedFields.clear();
        } else if (type === 'actual') {
            this.selectedActualFields.forEach(index => {
                const field = document.querySelector(`[data-index="${index}"] .actual-input`);
                if (field) {
                    field.classList.remove('field-selected');
                }
            });
            this.selectedActualFields.clear();
        }
        this.hideMergeButton();
    }
    
    clearAllSelections() {
        this.clearSelection('planned');
        this.clearSelection('actual');
        this.hideMergeButton();
    }
    
    showMergeButton(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            // 선택된 영역의 시작과 끝 필드 찾기
            const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
            
            if (startField && endField) {
                const startRect = startField.getBoundingClientRect();
                const endRect = endField.getBoundingClientRect();
                
                // 선택된 전체 영역의 정확한 중심 계산
                const areaLeft = startRect.left;
                const areaRight = endRect.left + endRect.width;
                const areaTop = startRect.top;
                const areaBottom = endRect.top + endRect.height;
                
                const centerX = (areaLeft + areaRight) / 2;
                const centerY = (areaTop + areaBottom) / 2;
                
                this.hideMergeButton();
                
                this.mergeButton = document.createElement('button');
                this.mergeButton.className = 'merge-button';
                this.mergeButton.textContent = '병합';
                this.mergeButton.style.left = `${centerX - 25}px`;
                this.mergeButton.style.top = `${centerY - 15}px`;
                
                this.mergeButton.addEventListener('click', () => {
                    this.mergeSelectedFields(type);
                });
                
                document.body.appendChild(this.mergeButton);
            }
        }
    }
    
    hideMergeButton() {
        if (this.mergeButton) {
            document.body.removeChild(this.mergeButton);
            this.mergeButton = null;
        }
    }
    
    mergeSelectedFields(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            // 첫 번째 필드의 값을 가져와서 병합된 값으로 사용
            const firstField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const mergedValue = firstField ? firstField.value : '';
            
            // 병합 정보 저장
            const mergeKey = `${type}-${startIndex}-${endIndex}`;
            this.mergedFields.set(mergeKey, mergedValue);
            
            // 데이터는 첫 번째 셀에만 저장하고 나머지는 빈 값으로 유지
            for (let i = startIndex; i <= endIndex; i++) {
                if (type === 'planned') {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                } else {
                    this.timeSlots[i].actual = i === startIndex ? mergedValue : '';
                }
            }
            
            // UI 다시 렌더링
            this.renderTimeEntries();
            this.clearAllSelections();
            this.calculateTotals();
            this.autoSave();
        }
    }
    
    findMergeKey(type, index) {
        for (let [key, value] of this.mergedFields) {
            if (key.startsWith(`${type}-`)) {
                const [, startStr, endStr] = key.split('-');
                const start = parseInt(startStr);
                const end = parseInt(endStr);
                if (index >= start && index <= end) {
                    return key;
                }
            }
        }
        return null;
    }
    
    createMergedField(mergeKey, type, index, value) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        if (index === start) {
            // 첫 번째 셀에만 병합된 필드 표시
            return `<input type="text" class="input-field ${type}-input merged-field" 
                           data-index="${index}" 
                           data-type="${type}" 
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}"
                           value="${this.mergedFields.get(mergeKey)}"
                           placeholder="">`;
        } else {
            // 병합된 범위의 다른 셀들은 일반 크기를 유지하되 비활성화
            return `<input type="text" class="input-field ${type}-input merged-secondary" 
                           data-index="${index}" 
                           data-type="${type}" 
                           data-merge-key="${mergeKey}"
                           value=""
                           readonly
                           tabindex="-1"
                           style="background: transparent; border: none; cursor: default;"
                           placeholder="">`;
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new TimeTracker();
});