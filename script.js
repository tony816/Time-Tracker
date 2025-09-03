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
        this.undoButton = null;
        this.mergedFields = new Map(); // {type-startIndex-endIndex: mergedValue}
        this.selectionOverlay = { planned: null, actual: null };
        this.scheduleButton = null;
        // 타이머 관련 속성 추가
        this.timers = new Map(); // {index: {running, elapsed, startTime, intervalId}}
        this.timerInterval = null;
        this.init();
    }

    init() {
        this.generateTimeSlots();
        this.renderTimeEntries();
        this.attachEventListeners();
        this.setCurrentDate();
        this.loadData();
        this.attachModalEventListeners();
        this.attachActivityModalEventListeners();
    }

    generateTimeSlots() {
        this.timeSlots = [];
        for (let hour = 4; hour <= 23; hour++) {
            this.timeSlots.push({
                time: `${hour}`,
                planned: '',
                actual: '',
                timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
                activityLog: { title: '', details: '', outcome: '' }
            });
        }
        this.timeSlots.push({
            time: '00',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '', outcome: '' }
        });
        this.timeSlots.push({
            time: '1',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '', outcome: '' }
        });
        this.timeSlots.push({
            time: '2',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '', outcome: '' }
        });
        this.timeSlots.push({
            time: '3',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '', outcome: '' }
        });
    }

    renderTimeEntries() {
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';
            
            const plannedMergeKey = this.findMergeKey('planned', index);
            const actualMergeKey = this.findMergeKey('actual', index);
            
            const plannedContent = plannedMergeKey ? 
                this.createMergedField(plannedMergeKey, 'planned', index, slot.planned) :
                `<input type="text" class="input-field planned-input" 
                        data-index="${index}" 
                        data-type="planned" 
                        value="${slot.planned}"
                        placeholder="">`;
                        
            const actualContent = actualMergeKey ? 
                this.createMergedField(actualMergeKey, 'actual', index, slot.actual) :
                this.createTimerField(index, slot);
            
            // 시간 열 병합 확인
            const timeMergeKey = this.findMergeKey('time', index);
            const timerControls = this.createTimerControls(index, slot);
            
            let timeContent;
            if (timeMergeKey) {
                timeContent = this.createMergedTimeField(timeMergeKey, index, slot);
            } else {
                timeContent = `<div class="time-slot-container">
                    <div class="time-label">${slot.time}</div>
                    ${timerControls}
                </div>`;
            }
            
            entryDiv.innerHTML = `
                ${plannedContent}
                ${timeContent}
                ${actualContent}
            `;
            
            entryDiv.dataset.index = index;
            
            if (plannedMergeKey) {
                const plannedStart = parseInt(plannedMergeKey.split('-')[1]);
                const plannedEnd = parseInt(plannedMergeKey.split('-')[2]);
                if (index >= plannedStart && index < plannedEnd) {
                    entryDiv.classList.add('has-planned-merge');
                }
            }
            
            if (actualMergeKey) {
                const actualStart = parseInt(actualMergeKey.split('-')[1]);
                const actualEnd = parseInt(actualMergeKey.split('-')[2]);
                if (index >= actualStart && index < actualEnd) {
                    entryDiv.classList.add('has-actual-merge');
                }
            }
            
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');
            
            if (plannedField || actualField) {
                this.attachFieldSelectionListeners(entryDiv, index);
                this.attachCellClickListeners(entryDiv, index);
            }
            
            // 타이머 이벤트 리스너 추가
            this.attachTimerListeners(entryDiv, index);
            this.attachActivityLogListener(entryDiv, index);
            
            this.attachRowWideClickTargets(entryDiv, index);
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

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearAllSelections();
            }
        });
        
        // 타이머 결과 입력 필드 이벤트 리스너
        document.getElementById('timeEntries').addEventListener('input', (e) => {
            if (e.target.classList.contains('timer-result-input')) {
                const index = parseInt(e.target.dataset.index);
                this.timeSlots[index].actual = e.target.value;
                this.calculateTotals();
                this.autoSave();
            }
        });

        document.addEventListener('mouseup', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.dragStartIndex = -1;
            this.currentColumnType = null;
        });

        window.addEventListener('resize', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
        });
        window.addEventListener('scroll', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.hideScheduleButton();
        });
    }

    setCurrentDate() {
        document.getElementById('date').value = this.currentDate;
    }

    calculateTotals() {
        let plannedTotal = 0;
        let actualTotal = 0;
        let timerTotal = 0;
        let executedPlans = 0;

        this.timeSlots.forEach(slot => {
            if (slot.planned && slot.planned.trim() !== '') {
                plannedTotal++;
                if (slot.actual && slot.actual.trim() !== '') {
                    executedPlans++;
                }
            }
            if (slot.actual && slot.actual.trim() !== '') {
                actualTotal++;
            }
            if (slot.timer && slot.timer.elapsed > 0) {
                timerTotal += slot.timer.elapsed;
            }
        });

        // 기본 합계 표시
        document.getElementById('totalPlanned').textContent = `${plannedTotal}시간`;
        document.getElementById('totalActual').textContent = `${actualTotal}시간`;

        // 분석 데이터 계산 및 표시
        this.updateAnalysis(plannedTotal, executedPlans, timerTotal);
    }

    updateAnalysis(plannedTotal, executedPlans, timerTotalSeconds) {
        // 실행율 계산
        const executionRate = plannedTotal > 0 ? Math.round((executedPlans / plannedTotal) * 100) : 0;
        const executionRateElement = document.getElementById('executionRate');
        executionRateElement.textContent = `${executionRate}%`;
        
        // 실행율에 따른 색상 변경
        executionRateElement.className = 'analysis-value';
        if (executionRate >= 80) {
            executionRateElement.classList.add('good');
        } else if (executionRate >= 60) {
            executionRateElement.classList.add('warning');
        } else if (executionRate > 0) {
            executionRateElement.classList.add('poor');
        }

        // 타이머 사용 시간 계산
        const timerHours = Math.floor(timerTotalSeconds / 3600);
        const timerMinutes = Math.floor((timerTotalSeconds % 3600) / 60);
        let timerDisplay = '';
        
        if (timerHours > 0) {
            timerDisplay = `${timerHours}시간 ${timerMinutes}분`;
        } else if (timerMinutes > 0) {
            timerDisplay = `${timerMinutes}분`;
        } else if (timerTotalSeconds > 0) {
            timerDisplay = `${timerTotalSeconds}초`;
        } else {
            timerDisplay = '0분';
        }
        
        const timerUsageElement = document.getElementById('timerUsage');
        timerUsageElement.textContent = timerDisplay;
        
        // 타이머 사용 시간에 따른 색상 변경
        timerUsageElement.className = 'analysis-value';
        if (timerTotalSeconds > 0) {
            timerUsageElement.classList.add('good');
        }
    }

    saveData() {
        const data = {
            date: this.currentDate,
            timeSlots: this.timeSlots,
            mergedFields: Object.fromEntries(this.mergedFields)
        };
        
        localStorage.setItem(`timesheet_${this.currentDate}`, JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem(`timesheet_${this.currentDate}`);
        
        if (savedData) {
            const data = JSON.parse(savedData);
            this.timeSlots = data.timeSlots || this.timeSlots;
            
            // 타이머 데이터 복원 시 실행중인 타이머는 정지
            this.timeSlots.forEach(slot => {
                if (slot.timer && slot.timer.running) {
                    slot.timer.running = false;
                    slot.timer.startTime = null;
                }
                // 타이머 객체가 없는 기존 데이터 호환성
                if (!slot.timer) {
                    slot.timer = { running: false, elapsed: 0, startTime: null, method: 'manual' };
                }
                // 활동 로그 객체가 없는 기존 데이터 호환성
                if (!slot.activityLog) {
                    slot.activityLog = { title: '', details: '', outcome: '' };
                }
            });
            
            if (data.mergedFields) {
                this.mergedFields = new Map(Object.entries(data.mergedFields));
            } else {
                this.mergedFields.clear();
            }
        } else {
            this.generateTimeSlots();
            this.mergedFields.clear();
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
        this.mergedFields.clear();
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
        
        if (plannedField) {
            plannedField.addEventListener('click', (e) => {
                const mergeKey = this.findMergeKey('planned', index);
                if (!mergeKey) return;

                e.preventDefault();
                e.stopPropagation();

                if (this.isMergeRangeSelected('planned', mergeKey)) {
                    this.clearSelection('planned');
                } else {
                    this.clearAllSelections();
                    this.selectMergedRange('planned', mergeKey);
                }
            });
        }
        if (actualField) {
            actualField.addEventListener('click', (e) => {
                const mergeKey = this.findMergeKey('actual', index);
                if (!mergeKey) return;

                e.preventDefault();
                e.stopPropagation();

                if (this.isMergeRangeSelected('actual', mergeKey)) {
                    this.clearSelection('actual');
                } else {
                    this.clearAllSelections();
                    this.selectMergedRange('actual', mergeKey);
                }
            });
        }

        let plannedMouseMoved = false;
        if (plannedField) {
            plannedField.addEventListener('mousedown', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (e.target === plannedField && !plannedField.matches(':focus')) {
                    e.preventDefault();
                    plannedMouseMoved = false;
                    this.dragStartIndex = index;
                    this.currentColumnType = 'planned';
                    this.isSelectingPlanned = true;
                }
            });
            plannedField.addEventListener('mousemove', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                    plannedMouseMoved = true;
                }
            });
            plannedField.addEventListener('mouseup', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!plannedMouseMoved) {
                        if (this.selectedPlannedFields.has(index) && this.selectedPlannedFields.size === 1) {
                            this.clearSelection('planned');
                        } else {
                            this.clearAllSelections();
                            this.selectFieldRange('planned', index, index);
                        }
                    } else {
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
                if (this.findMergeKey('planned', index)) return;
                if (this.isSelectingPlanned && this.currentColumnType === 'planned' && this.dragStartIndex !== index) {
                    plannedMouseMoved = true;
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    this.selectFieldRange('planned', this.dragStartIndex, index);
                }
            });
        }
        
        let actualMouseMoved = false;
        if (actualField) {
            actualField.addEventListener('mousedown', (e) => {
                if (this.findMergeKey('actual', index)) return;
                if (e.target === actualField && !actualField.matches(':focus')) {
                    e.preventDefault();
                    actualMouseMoved = false;
                    this.dragStartIndex = index;
                    this.currentColumnType = 'actual';
                    this.isSelectingActual = true;
                }
            });
            actualField.addEventListener('mousemove', (e) => {
                if (this.findMergeKey('actual', index)) return;
                if (this.isSelectingActual && this.currentColumnType === 'actual') {
                    actualMouseMoved = true;
                }
            });
            actualField.addEventListener('mouseup', (e) => {
                if (this.findMergeKey('actual', index)) return;
                if (e.target === actualField && !actualField.matches(':focus') && this.currentColumnType === 'actual') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!actualMouseMoved) {
                        if (this.selectedActualFields.has(index) && this.selectedActualFields.size === 1) {
                            this.clearSelection('actual');
                        } else {
                            this.clearAllSelections();
                            this.selectFieldRange('actual', index, index);
                        }
                    } else {
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
                if (this.findMergeKey('actual', index)) return;
                if (this.isSelectingActual && this.currentColumnType === 'actual' && this.dragStartIndex !== index) {
                    actualMouseMoved = true;
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('actual');
                    }
                    this.selectFieldRange('actual', this.dragStartIndex, index);
                }
            });
        }
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
        
        this.updateSelectionOverlay(type);
        
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        if (selectedSet.size > 1) {
            this.showMergeButton(type);
        }
        this.showScheduleButtonForSelection(type);
    }
    
    clearSelection(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        selectedSet.forEach(index => {
            const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
            if (field) {
                field.classList.remove('field-selected');
                const row = field.closest('.time-entry');
                if (row) {
                    row.classList.remove('selected-merged-planned', 'selected-merged-actual');
                }
            }
        });
        selectedSet.clear();
        
        this.hideMergeButton();
        this.hideUndoButton();
        this.removeSelectionOverlay(type);
        this.hideScheduleButton();
    }
    
    clearAllSelections() {
        this.clearSelection('planned');
        this.clearSelection('actual');
    }
    
    showMergeButton(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
            
            if (startField && endField) {
                const startRect = startField.getBoundingClientRect();
                const endRect = endField.getBoundingClientRect();
                
                let centerX, centerY;
                
                const selectedCount = selectedIndices.length;
                
                if (selectedCount % 2 === 1) {
                    const middleIndex = selectedIndices[Math.floor(selectedCount / 2)];
                    const middleField = document.querySelector(`[data-index="${middleIndex}"] .${type}-input`);
                    const middleRect = middleField.getBoundingClientRect();
                    centerX = middleRect.left + (middleRect.width / 2);
                    centerY = middleRect.top + (middleRect.height / 2);
                } else {
                    const midIndex1 = Math.floor(selectedCount / 2) - 1;
                    const midIndex2 = Math.floor(selectedCount / 2);
                    const field1 = document.querySelector(`[data-index="${selectedIndices[midIndex1]}"] .${type}-input`);
                    const field2 = document.querySelector(`[data-index="${selectedIndices[midIndex2]}"] .${type}-input`);
                    const rect1 = field1.getBoundingClientRect();
                    const rect2 = field2.getBoundingClientRect();
                    
                    centerX = (rect1.left + rect1.width / 2 + rect2.left + rect2.width / 2) / 2;
                    centerY = (rect1.bottom + rect2.top) / 2;
                }
                
                this.hideMergeButton();
                
                const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
                const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
                
                this.mergeButton = document.createElement('button');
                this.mergeButton.className = 'merge-button';
                this.mergeButton.textContent = '병합';
                this.mergeButton.style.left = `${centerX + scrollX - 25}px`;
                this.mergeButton.style.top = `${centerY + scrollY - 15}px`;
                
                this.mergeButton.addEventListener('click', () => {
                    this.mergeSelectedFields(type);
                });
                
                document.body.appendChild(this.mergeButton);
            }
        }
    }
    
    hideMergeButton() {
        if (this.mergeButton && this.mergeButton.parentNode) {
            this.mergeButton.parentNode.removeChild(this.mergeButton);
            this.mergeButton = null;
        }
    }
    
    showUndoButton(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        const startField = document.querySelector(`[data-index="${start}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${end}"] .${type}-input`);
        
        if (startField && endField) {
            const startRect = startField.getBoundingClientRect();
            const endRect = endField.getBoundingClientRect();
            
            const centerX = startRect.left + (startRect.width / 2);
            const centerY = startRect.top + ((endRect.bottom - startRect.top) / 2);
            
            this.hideUndoButton();
            
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            
            this.undoButton = document.createElement('button');
            this.undoButton.className = 'undo-button';
            this.undoButton.style.left = `${centerX + scrollX - 15}px`;
            this.undoButton.style.top = `${centerY + scrollY - 15}px`;
            
            this.undoButton.addEventListener('click', () => {
                this.undoMerge(type, mergeKey);
            });
            
            document.body.appendChild(this.undoButton);
        }
    }
    
    hideUndoButton() {
        if (this.undoButton && this.undoButton.parentNode) {
            this.undoButton.parentNode.removeChild(this.undoButton);
            this.undoButton = null;
        }
    }
    
    undoMerge(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        this.mergedFields.delete(mergeKey);
        
        // 좌측 계획 열 병합 해제 시 모든 열 동기화 해제
        if (type === 'planned') {
            // 중앙 시간 열과 우측 실제 활동 열 병합도 함께 해제
            const timeRangeKey = `time-${start}-${end}`;
            const actualMergeKey = `actual-${start}-${end}`;
            this.mergedFields.delete(timeRangeKey);
            this.mergedFields.delete(actualMergeKey);
            
            for (let i = start; i <= end; i++) {
                this.timeSlots[i].planned = '';
                this.timeSlots[i].actual = '';
            }
        } else {
            // 우측 열만 해제
            for (let i = start; i <= end; i++) {
                this.timeSlots[i].actual = '';
            }
        }
        
        this.renderTimeEntries();
        this.clearAllSelections();
        this.calculateTotals();
        this.autoSave();
    }

    mergeSelectedFields(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            const firstField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const mergedValue = firstField ? firstField.value : '';
            
            const mergeKey = `${type}-${startIndex}-${endIndex}`;
            this.mergedFields.set(mergeKey, mergedValue);
            
            // 좌측 계획 열이 병합될 때 모든 열을 동기화 병합
            if (type === 'planned') {
                // 중앙 시간 열 병합 (시간 범위 표시)
                const timeRangeKey = `time-${startIndex}-${endIndex}`;
                const startTime = this.timeSlots[startIndex].time;
                const endTime = this.timeSlots[endIndex].time;
                const timeRangeValue = `${startTime}-${endTime}`;
                this.mergedFields.set(timeRangeKey, timeRangeValue);
                
                // 우측 실제 활동 열 병합 (기존 값이 있다면 유지, 없으면 빈 값)
                const actualMergeKey = `actual-${startIndex}-${endIndex}`;
                const firstActualField = document.querySelector(`[data-index="${startIndex}"] .timer-result-input`);
                const actualMergedValue = firstActualField ? firstActualField.value : '';
                this.mergedFields.set(actualMergeKey, actualMergedValue);
                
                // 데이터 업데이트
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                    this.timeSlots[i].actual = i === startIndex ? actualMergedValue : '';
                }
            } else {
                // 우측 열만 병합하는 경우
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].actual = i === startIndex ? mergedValue : '';
                }
            }
            
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
    
    createTimerField(index, slot) {
        return `<div class="actual-field-container">
                    <input type="text" class="input-field actual-input timer-result-input" 
                           data-index="${index}" 
                           data-type="actual" 
                           value="${slot.actual}"
                           placeholder="활동 기록">
                    <button class="activity-log-btn" data-index="${index}" title="상세 기록">📝</button>
                </div>`;
    }

    createMergedTimeField(mergeKey, index, slot) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        if (index === start) {
            // 병합된 시간 필드의 주 셀 - 시간 범위 표시 및 단일 타이머 컨트롤
            const timerControls = this.createTimerControls(index, slot);
            
            // 시간 범위 생성 (12시-13시 형태)
            const startTime = this.timeSlots[start].time;
            const endTime = this.timeSlots[end].time;
            const timeRangeDisplay = `${startTime}-${endTime}`;
            
            return `<div class="time-slot-container merged-time-main" 
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label">${timeRangeDisplay}</div>
                        ${timerControls}
                    </div>`;
        } else {
            // 병합된 시간 필드의 보조 셀 - 완전히 숨김 처리하여 디자인 보존
            return `<div class="time-slot-container merged-time-secondary" 
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label merged-secondary-hidden"></div>
                    </div>`;
        }
    }

    createTimerControls(index, slot) {
        const currentHour = new Date().getHours();
        const slotTime = parseInt(slot.time);
        const hasPlannedActivity = slot.planned && slot.planned.trim() !== '';
        const isCurrentTime = currentHour === slotTime;
        const canStart = hasPlannedActivity && isCurrentTime;
        const isRunning = slot.timer.running;
        const hasElapsed = slot.timer.elapsed > 0;
        
        let buttonIcon = '▶️';
        let buttonAction = 'start';
        let buttonDisabled = !canStart && !isRunning;
        
        if (isRunning) {
            buttonIcon = '⏸️';
            buttonAction = 'pause';
            buttonDisabled = false;
        } else if (hasElapsed) {
            buttonIcon = '▶️';
            buttonAction = 'resume';
            buttonDisabled = !canStart;
        }
        
        const stopButtonStyle = isRunning || hasElapsed ? 'display: inline-block;' : 'display: none;';
        const timerDisplayStyle = isRunning || hasElapsed ? 'display: block;' : 'display: none;';
        const timerDisplay = this.formatTime(slot.timer.elapsed);
        
        return `
            <div class="timer-controls-container ${isRunning ? 'timer-running' : ''}" data-index="${index}">
                <div class="timer-controls">
                    <button class="timer-btn timer-start-pause" 
                            data-index="${index}" 
                            data-action="${buttonAction}"
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonIcon}
                    </button>
                    <button class="timer-btn timer-stop" 
                            data-index="${index}" 
                            data-action="stop"
                            style="${stopButtonStyle}">
                        ⏹️
                    </button>
                </div>
                <div class="timer-display" style="${timerDisplayStyle}">${timerDisplay}</div>
            </div>
        `;
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    getCurrentTimeIndex() {
        const now = new Date();
        const currentHour = now.getHours();
        
        // 4시-23시는 순서대로
        if (currentHour >= 4 && currentHour <= 23) {
            return currentHour - 4;
        }
        // 0시-3시는 마지막 부분
        if (currentHour >= 0 && currentHour <= 3) {
            return 20 + currentHour;
        }
        return -1; // 해당 시간 없음
    }
    
    canStartTimer(index) {
        const slot = this.timeSlots[index];
        const currentTimeIndex = this.getCurrentTimeIndex();
        const hasPlannedActivity = slot.planned && slot.planned.trim() !== '';
        
        return hasPlannedActivity && currentTimeIndex === index;
    }
    
    createMergedField(mergeKey, type, index, value) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        if (type === 'actual') {
            // 우측 실제 활동 열의 경우 입력 필드와 버튼을 포함하는 컨테이너로 처리
            if (index === start) {
                return `<div class="actual-field-container merged-actual-main" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <input type="text" class="input-field actual-input timer-result-input merged-field" 
                                   data-index="${index}" 
                                   data-type="actual" 
                                   data-merge-key="${mergeKey}"
                                   value="${this.mergedFields.get(mergeKey)}"
                                   placeholder="활동 기록">
                            <button class="activity-log-btn" data-index="${index}" title="상세 기록">📝</button>
                        </div>`;
            } else {
                return `<div class="actual-field-container merged-actual-secondary" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <input type="text" class="input-field actual-input merged-secondary" 
                                   data-index="${index}" 
                                   data-type="actual" 
                                   data-merge-key="${mergeKey}"
                                   value="${this.mergedFields.get(mergeKey)}"
                                   readonly
                                   tabindex="-1"
                                   style="cursor: pointer; opacity: 0;"
                                   placeholder="">
                        </div>`;
            }
        } else {
            // 좌측 계획 열의 경우 기존 로직 유지
            if (index === start) {
                return `<input type="text" class="input-field ${type}-input merged-field merged-main" 
                               data-index="${index}" 
                               data-type="${type}" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}"
                               value="${this.mergedFields.get(mergeKey)}"
                               placeholder="">`;
            } else {
                return `<input type="text" class="input-field ${type}-input merged-secondary" 
                               data-index="${index}" 
                               data-type="${type}" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}"
                               value="${this.mergedFields.get(mergeKey)}"
                               readonly
                               tabindex="-1"
                               style="cursor: pointer;"
                               placeholder="">`;
            }
        }
    }

    selectMergedRange(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        this.clearSelection(type);
        
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            const field = document.querySelector(`[data-index="${i}"] .${type}-input`);
            if (field) {
                field.classList.add('field-selected');
                const row = field.closest('.time-entry');
                if (row) {
                    row.classList.add(type === 'planned' ? 'selected-merged-planned' : 'selected-merged-actual');
                }
            }
        }
        
        this.updateSelectionOverlay(type);
        this.showUndoButton(type, mergeKey);
        this.showScheduleButtonForSelection(type);
    }

    ensureSelectionOverlay(type) {
        if (!this.selectionOverlay[type]) {
            const el = document.createElement('div');
            el.className = 'selection-overlay';
            el.dataset.type = type;

            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearSelection(type);
            };

            document.body.appendChild(el);
            this.selectionOverlay[type] = el;
        }
        return this.selectionOverlay[type];
    }

    removeSelectionOverlay(type) {
        const el = this.selectionOverlay[type];
        if (el && el.parentNode) el.parentNode.removeChild(el);
        this.selectionOverlay[type] = null;
    }

    updateSelectionOverlay(type) {
        const selectedSet = (type === 'planned') ? this.selectedPlannedFields : this.selectedActualFields;
        if (!selectedSet || selectedSet.size < 1) {
            this.removeSelectionOverlay(type);
            return;
        }

        const idx = Array.from(selectedSet).sort((a,b)=>a-b);
        const startIndex = idx[0];
        const endIndex   = idx[idx.length - 1];

        const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
        const endField   = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
        if (!startField || !endField) {
            this.removeSelectionOverlay(type);
            return;
        }

        const startRect = startField.getBoundingClientRect();
        const endRect   = endField.getBoundingClientRect();

        const lastRow   = endField.closest('.time-entry');
        const rowStyle  = lastRow ? window.getComputedStyle(lastRow) : null;
        const bottomBW  = rowStyle ? parseFloat(rowStyle.borderBottomWidth || '0') : 0;

        const overlay   = this.ensureSelectionOverlay(type);
        const left      = startRect.left + window.scrollX;
        const top       = startRect.top  + window.scrollY;
        const width     = startRect.width;
        const height    = (endRect.bottom - startRect.top) + bottomBW;

        overlay.style.left   = `${left}px`;
        overlay.style.top    = `${top}px`;
        overlay.style.width  = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    isMergeRangeSelected(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr, 10);
        const end   = parseInt(endStr, 10);
        const set   = (type === 'planned') ? this.selectedPlannedFields : this.selectedActualFields;

        if (set.size !== (end - start + 1)) return false;
        for (let i = start; i <= end; i++) {
            if (!set.has(i)) return false;
        }
        return true;
    }

    attachRowWideClickTargets(entryDiv, index) {
        entryDiv.addEventListener('click', (e) => {
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField  = entryDiv.querySelector('.actual-input');
            if (!plannedField && !actualField) return;

            const rowRect      = entryDiv.getBoundingClientRect();
            const x = e.clientX, y = e.clientY;

            if (plannedField) {
                const pr = plannedField.getBoundingClientRect();
                const inPlannedCol = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlannedCol) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.isMergeRangeSelected('planned', mk)) this.clearSelection('planned');
                        else this.selectMergedRange('planned', mk);
                        return;
                    }
                }
            }

            if (actualField) {
                const ar = actualField.getBoundingClientRect();
                const inActualCol = (x >= ar.left && x <= ar.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inActualCol) {
                    const mk = this.findMergeKey('actual', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.isMergeRangeSelected('actual', mk)) this.clearSelection('actual');
                        else this.selectMergedRange('actual', mk);
                        return;
                    }
                }
            }
        });
    }

    attachCellClickListeners(entryDiv, index) {
        // This function is now intentionally left empty 
        // to avoid conflicts with the unified mouseup/click handling logic
        // in attachFieldSelectionListeners.
    }

    hideScheduleButton() {
        if (this.scheduleButton) {
            if (this.scheduleButton.parentNode) {
                this.scheduleButton.parentNode.removeChild(this.scheduleButton);
            }
            this.scheduleButton = null;
        }
    }

    showScheduleButtonForSelection(type) {
        this.hideScheduleButton();
        
        // 스케줄 입력 버튼은 계획(planned) 컬럼에서만 표시
        if (type !== 'planned') return;
    
        const overlay = this.selectionOverlay[type];
        if (!overlay) return;
        
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        if (selectedSet.size === 0) return;
    
        const rect = overlay.getBoundingClientRect();
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        
        this.scheduleButton = document.createElement('button');
        this.scheduleButton.className = 'schedule-button';
        this.scheduleButton.textContent = '스케줄 입력';
        this.scheduleButton.style.left = `${rect.right + scrollX + 5}px`;
        this.scheduleButton.style.top = `${rect.top + scrollY}px`;
        
        this.scheduleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const firstIndex = selectedIndices[0];
            const lastIndex = selectedIndices[selectedIndices.length - 1];
            
            this.openScheduleModal(type, firstIndex, lastIndex);
        });
        
        document.body.appendChild(this.scheduleButton);
    }
    
    openScheduleModal(type, startIndex, endIndex = null) {
        const modal = document.getElementById('scheduleModal');
        const timeField = document.getElementById('scheduleTime');
        const activityField = document.getElementById('scheduleActivity');
        
        const actualEndIndex = endIndex !== null ? endIndex : startIndex;
        const mergeKey = this.findMergeKey(type, startIndex);
        const value = mergeKey ? this.mergedFields.get(mergeKey) : this.timeSlots[startIndex][type];

        // 시간 범위 표시
        const startTime = this.timeSlots[startIndex].time;
        if (actualEndIndex === startIndex) {
            timeField.value = startTime + '시';
        } else {
            const endTime = parseInt(this.timeSlots[actualEndIndex].time);
            const nextHour = endTime === 23 ? 0 : (endTime === 3 ? 4 : endTime + 1);
            timeField.value = `${startTime}시 - ${nextHour}시`;
        }

        activityField.value = value || '';
        
        modal.style.display = 'flex';
        
        modal.dataset.type = type;
        modal.dataset.startIndex = startIndex;
        modal.dataset.endIndex = actualEndIndex;
        
        setTimeout(() => {
            activityField.focus();
        }, 100);
        
        this.hideScheduleButton();
    }
    
    closeScheduleModal() {
        const modal = document.getElementById('scheduleModal');
        modal.style.display = 'none';
        
        document.getElementById('scheduleTime').value = '';
        document.getElementById('scheduleActivity').value = '';
        
        delete modal.dataset.type;
        delete modal.dataset.startIndex;
        delete modal.dataset.endIndex;
    }
    
    saveScheduleFromModal() {
        const modal = document.getElementById('scheduleModal');
        const type = modal.dataset.type;
        const startIndex = parseInt(modal.dataset.startIndex);
        const endIndex = parseInt(modal.dataset.endIndex);
        const activity = document.getElementById('scheduleActivity').value.trim();
        
        if (type && startIndex !== undefined && endIndex !== undefined) {
            if (startIndex === endIndex) {
                // 단일 셀
                this.timeSlots[startIndex][type] = activity;
            } else {
                // 병합된 셀 - 병합 생성 또는 업데이트
                const mergeKey = `${type}-${startIndex}-${endIndex}`;
                this.mergedFields.set(mergeKey, activity);
                
                // 시간대별로 데이터 설정
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i][type] = i === startIndex ? activity : '';
                }
            }
            
            this.renderTimeEntries();
            this.calculateTotals();
            this.autoSave();
        }
        
        this.closeScheduleModal();
    }
    
    attachModalEventListeners() {
        const modal = document.getElementById('scheduleModal');
        const closeBtn = document.getElementById('closeModal');
        const saveBtn = document.getElementById('saveSchedule');
        const cancelBtn = document.getElementById('cancelSchedule');
        const activityField = document.getElementById('scheduleActivity');
        
        closeBtn.addEventListener('click', () => {
            this.closeScheduleModal();
        });
        
        saveBtn.addEventListener('click', () => {
            this.saveScheduleFromModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeScheduleModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeScheduleModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeScheduleModal();
            }
        });
        
        activityField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.saveScheduleFromModal();
            }
        });
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

    // 타이머 관련 메서드들 추가
    attachTimerListeners(entryDiv, index) {
        const timerBtns = entryDiv.querySelectorAll('.timer-btn');
        
        timerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const btnIndex = parseInt(btn.dataset.index);
                
                switch(action) {
                    case 'start':
                        this.startTimer(btnIndex);
                        break;
                    case 'pause':
                        this.pauseTimer(btnIndex);
                        break;
                    case 'resume':
                        this.resumeTimer(btnIndex);
                        break;
                    case 'stop':
                        this.stopTimer(btnIndex);
                        break;
                }
            });
        });
    }

    startTimer(index) {
        if (!this.canStartTimer(index)) return;
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        slot.timer.method = 'timer';
        
        this.startTimerInterval();
        this.renderTimeEntries();
    }

    pauseTimer(index) {
        const slot = this.timeSlots[index];
        slot.timer.running = false;
        slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
        slot.timer.startTime = null;
        
        this.stopTimerInterval();
        this.renderTimeEntries();
    }

    resumeTimer(index) {
        if (!this.canStartTimer(index)) return;
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        
        this.startTimerInterval();
        this.renderTimeEntries();
    }

    stopTimer(index) {
        const slot = this.timeSlots[index];
        
        if (slot.timer.running) {
            slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
        }
        
        slot.timer.running = false;
        slot.timer.startTime = null;
        
        // 자동 기록: 타이머 시간을 actual 필드에 기록
        if (slot.timer.elapsed > 0) {
            const timeStr = this.formatTime(slot.timer.elapsed);
            slot.actual = slot.planned ? `${slot.planned} (${timeStr})` : timeStr;
        }
        
        this.stopTimerInterval();
        this.renderTimeEntries();
        this.calculateTotals();
        this.autoSave();
    }

    stopAllTimers() {
        this.timeSlots.forEach((slot, index) => {
            if (slot.timer.running) {
                slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
                slot.timer.running = false;
                slot.timer.startTime = null;
            }
        });
        this.stopTimerInterval();
    }

    startTimerInterval() {
        if (this.timerInterval) return;
        
        this.timerInterval = setInterval(() => {
            this.updateRunningTimers();
        }, 1000);
    }

    stopTimerInterval() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateRunningTimers() {
        let hasRunningTimer = false;
        
        this.timeSlots.forEach((slot, index) => {
            if (slot.timer.running) {
                hasRunningTimer = true;
                const currentElapsed = slot.timer.elapsed + Math.floor((Date.now() - slot.timer.startTime) / 1000);
                const displayElement = document.querySelector(`[data-index="${index}"] .timer-display`);
                if (displayElement) {
                    displayElement.textContent = this.formatTime(currentElapsed);
                }
            }
        });
        
        if (!hasRunningTimer) {
            this.stopTimerInterval();
        }
    }

    // 활동 로그 관련 메서드들
    attachActivityLogListener(entryDiv, index) {
        const activityBtn = entryDiv.querySelector('.activity-log-btn');
        if (activityBtn) {
            activityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openActivityLogModal(index);
            });
        }
    }

    openActivityLogModal(index) {
        const modal = document.getElementById('activityLogModal');
        const slot = this.timeSlots[index];
        
        document.getElementById('activityTime').value = `${slot.time}시`;
        document.getElementById('activityTitle').value = slot.activityLog.title || '';
        document.getElementById('activityDetails').value = slot.activityLog.details || '';
        document.getElementById('activityOutcome').value = slot.activityLog.outcome || '';
        
        modal.style.display = 'flex';
        modal.dataset.index = index;
        
        setTimeout(() => {
            document.getElementById('activityTitle').focus();
        }, 100);
    }

    closeActivityLogModal() {
        const modal = document.getElementById('activityLogModal');
        modal.style.display = 'none';
        
        document.getElementById('activityTitle').value = '';
        document.getElementById('activityDetails').value = '';
        document.getElementById('activityOutcome').value = '';
        
        delete modal.dataset.index;
    }

    saveActivityLogFromModal() {
        const modal = document.getElementById('activityLogModal');
        const index = parseInt(modal.dataset.index);
        
        if (index !== undefined && index >= 0) {
            const slot = this.timeSlots[index];
            slot.activityLog.title = document.getElementById('activityTitle').value.trim();
            slot.activityLog.details = document.getElementById('activityDetails').value.trim();
            slot.activityLog.outcome = document.getElementById('activityOutcome').value.trim();
            
            // 활동 로그가 있으면 실제 활동 필드에 제목 표시
            if (slot.activityLog.title) {
                slot.actual = slot.activityLog.title;
            }
            
            this.renderTimeEntries();
            this.calculateTotals();
            this.autoSave();
        }
        
        this.closeActivityLogModal();
    }

    attachActivityModalEventListeners() {
        const modal = document.getElementById('activityLogModal');
        const closeBtn = document.getElementById('closeActivityModal');
        const saveBtn = document.getElementById('saveActivityLog');
        const cancelBtn = document.getElementById('cancelActivityLog');
        
        closeBtn.addEventListener('click', () => {
            this.closeActivityLogModal();
        });
        
        saveBtn.addEventListener('click', () => {
            this.saveActivityLogFromModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeActivityLogModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeActivityLogModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeActivityLogModal();
            }
        });
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