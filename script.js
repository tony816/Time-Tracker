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
            
            // 병합된 필드가 있는 행에 클래스 추가 (해당 열에만 적용)
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
            
            // 병합되지 않은 필드에만 선택 리스너 추가
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');
            
            // 모든 필드에 선택 리스너 추가 (병합된 필드 포함)
            if (plannedField || actualField) {
                this.attachFieldSelectionListeners(entryDiv, index);
            }
            
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

        // 리사이즈/스크롤 시 오버레이 재계산
        window.addEventListener('resize', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton(); // 리사이즈 시 버튼 숨김
        });
        window.addEventListener('scroll', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton(); // 스크롤 시 버튼 숨김
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
        
        // --- 계획(왼쪽) 열: 병합 블록 단일 클릭 토글 ---
        if (plannedField) {
            plannedField.addEventListener('click', (e) => {
                const mergeKey = this.findMergeKey('planned', index);
                if (!mergeKey) return; // 일반 셀은 기존 동작 유지

                e.preventDefault();
                e.stopPropagation();

                if (this.isMergeRangeSelected('planned', mergeKey)) {
                    // 이미 전체 병합 범위가 선택되어 있으면 해제
                    this.clearSelection('planned');
                } else {
                    // 병합 범위 전체를 선택
                    this.selectMergedRange('planned', mergeKey);
                }
            });
        }
        
        if (plannedField) {
            plannedField.addEventListener('mousedown', (e) => {
                const mergedKeyP = this.findMergeKey('planned', index);
                if (mergedKeyP) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (e.target === plannedField && !plannedField.matches(':focus')) {
                    e.preventDefault();
                    plannedMouseMoved = false;
                    this.dragStartIndex = index;
                    this.currentColumnType = 'planned';
                    this.isSelectingPlanned = true;
                }
            });
        }
        
        if (plannedField) {
            plannedField.addEventListener('mousemove', (e) => {
                const mergedKeyP = this.findMergeKey('planned', index);
                if (mergedKeyP) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                    plannedMouseMoved = true;
                }
            });
            
            plannedField.addEventListener('mouseup', (e) => {
            const mergedKeyP = this.findMergeKey('planned', index);
            if (mergedKeyP) {
                // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                e.preventDefault();
                e.stopPropagation();
                
                if (!plannedMouseMoved) {
                    // 병합된 필드인지 확인
                    const mergeKey = this.findMergeKey('planned', index);
                    if (mergeKey) {
                        // 병합된 필드 클릭 시 전체 병합 영역 선택
                        this.selectMergedRange('planned', mergeKey);
                    } else {
                        // 일반 필드 클릭 처리
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
                const mergedKeyP = this.findMergeKey('planned', index);
                if (mergedKeyP) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (this.isSelectingPlanned && this.currentColumnType === 'planned' && this.dragStartIndex !== index) {
                    plannedMouseMoved = true;
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    this.selectFieldRange('planned', this.dragStartIndex, index);
                }
            });
        }
        
        // 실제 활동 필드 선택 이벤트
        let actualMouseMoved = false;
        
        // --- 실제(오른쪽) 열: 병합 블록 단일 클릭 토글 ---
        if (actualField) {
            actualField.addEventListener('click', (e) => {
                const mergeKey = this.findMergeKey('actual', index);
                if (!mergeKey) return;

                e.preventDefault();
                e.stopPropagation();

                if (this.isMergeRangeSelected('actual', mergeKey)) {
                    this.clearSelection('actual');
                } else {
                    this.selectMergedRange('actual', mergeKey);
                }
            });
        }
        
        if (actualField) {
            actualField.addEventListener('mousedown', (e) => {
                const mergedKeyA = this.findMergeKey('actual', index);
                if (mergedKeyA) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (e.target === actualField && !actualField.matches(':focus')) {
                    e.preventDefault();
                    actualMouseMoved = false;
                    this.dragStartIndex = index;
                    this.currentColumnType = 'actual';
                    this.isSelectingActual = true;
                }
            });
        }
        
        if (actualField) {
            actualField.addEventListener('mousemove', (e) => {
                const mergedKeyA = this.findMergeKey('actual', index);
                if (mergedKeyA) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (this.isSelectingActual && this.currentColumnType === 'actual') {
                    actualMouseMoved = true;
                }
            });
            
            actualField.addEventListener('mouseup', (e) => {
            const mergedKeyA = this.findMergeKey('actual', index);
            if (mergedKeyA) {
                // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            if (e.target === actualField && !actualField.matches(':focus') && this.currentColumnType === 'actual') {
                e.preventDefault();
                e.stopPropagation();
                
                if (!actualMouseMoved) {
                    // 병합된 필드인지 확인
                    const mergeKey = this.findMergeKey('actual', index);
                    if (mergeKey) {
                        // 병합된 필드 클릭 시 전체 병합 영역 선택
                        this.selectMergedRange('actual', mergeKey);
                    } else {
                        // 일반 필드 클릭 처리
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
                const mergedKeyA = this.findMergeKey('actual', index);
                if (mergedKeyA) {
                    // 병합 블록은 드래그 선택 상태를 건드리지 않음 (클릭 토글만 사용)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
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
        
        this.showMergeButton(type);
        this.updateSelectionOverlay(type);
    }
    
    clearSelection(type) {
        if (type === 'planned') {
            this.selectedPlannedFields.forEach(index => {
                const field = document.querySelector(`[data-index="${index}"] .planned-input`);
                if (field) {
                    field.classList.remove('field-selected');
                    const row = field.closest('.time-entry');
                    if (row) {
                        row.classList.remove('selected-merged-planned', 'selected-merged-actual');
                    }
                }
            });
            this.selectedPlannedFields.clear();
        } else if (type === 'actual') {
            this.selectedActualFields.forEach(index => {
                const field = document.querySelector(`[data-index="${index}"] .actual-input`);
                if (field) {
                    field.classList.remove('field-selected');
                    const row = field.closest('.time-entry');
                    if (row) {
                        row.classList.remove('selected-merged-planned', 'selected-merged-actual');
                    }
                }
            });
            this.selectedActualFields.clear();
        }
        this.hideMergeButton();
        this.hideUndoButton();
        this.removeSelectionOverlay(type);
    }
    
    clearAllSelections() {
        this.clearSelection('planned');
        this.clearSelection('actual');
        this.hideMergeButton();
        this.hideUndoButton();
        this.removeSelectionOverlay('planned');
        this.removeSelectionOverlay('actual');
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
                
                let centerX, centerY;
                
                // 선택된 셀의 개수에 따른 중심축 계산
                const selectedCount = selectedIndices.length;
                
                if (selectedCount % 2 === 1) {
                    // 홀수 개: 중간 셀의 중심축에 위치
                    const middleIndex = selectedIndices[Math.floor(selectedCount / 2)];
                    const middleField = document.querySelector(`[data-index="${middleIndex}"] .${type}-input`);
                    const middleRect = middleField.getBoundingClientRect();
                    centerX = middleRect.left + (middleRect.width / 2);
                    centerY = middleRect.top + (middleRect.height / 2);
                } else {
                    // 짝수 개: 중간 두 셀 사이의 구분선 중심에 위치
                    const midIndex1 = Math.floor(selectedCount / 2) - 1;
                    const midIndex2 = Math.floor(selectedCount / 2);
                    const field1 = document.querySelector(`[data-index="${selectedIndices[midIndex1]}"] .${type}-input`);
                    const field2 = document.querySelector(`[data-index="${selectedIndices[midIndex2]}"] .${type}-input`);
                    const rect1 = field1.getBoundingClientRect();
                    const rect2 = field2.getBoundingClientRect();
                    
                    centerX = (rect1.left + rect1.width / 2 + rect2.left + rect2.width / 2) / 2;
                    centerY = (rect1.bottom + rect2.top) / 2; // 두 셀 사이의 경계선
                }
                
                this.hideMergeButton();
                
                // 스크롤 오프셋 계산
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
        if (this.mergeButton) {
            document.body.removeChild(this.mergeButton);
            this.mergeButton = null;
        }
    }
    
    showUndoButton(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        // 병합된 영역의 중심 계산
        const startField = document.querySelector(`[data-index="${start}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${end}"] .${type}-input`);
        
        if (startField && endField) {
            const startRect = startField.getBoundingClientRect();
            const endRect = endField.getBoundingClientRect();
            
            // 중심점 계산
            const centerX = startRect.left + (startRect.width / 2);
            const centerY = startRect.top + ((endRect.bottom - startRect.top) / 2);
            
            this.hideUndoButton();
            
            // 스크롤 오프셋 계산
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
        if (this.undoButton) {
            document.body.removeChild(this.undoButton);
            this.undoButton = null;
        }
    }
    
    undoMerge(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        // 병합 정보 제거
        this.mergedFields.delete(mergeKey);
        
        // 각 셀을 개별 필드로 복원 (빈 값으로)
        for (let i = start; i <= end; i++) {
            if (type === 'planned') {
                this.timeSlots[i].planned = '';
            } else {
                this.timeSlots[i].actual = '';
            }
        }
        
        // UI 다시 렌더링
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
            // 첫 번째 셀에 병합된 메인 필드 표시 
            return `<input type="text" class="input-field ${type}-input merged-field merged-main" 
                           data-index="${index}" 
                           data-type="${type}" 
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}"
                           value="${this.mergedFields.get(mergeKey)}"
                           placeholder="">`;
        } else {
            // 병합된 범위의 다른 셀들 - 병합된 데이터 표시하고 클릭 가능하게 함
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

    selectMergedRange(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        // 해당 타입의 기존 선택만 해제 (다른 타입은 건드리지 않음)
        this.clearSelection(type);
        
        // 병합된 전체 범위 선택 (해당 타입의 열만)
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            const field = document.querySelector(`[data-index="${i}"] .${type}-input`);
            if (field) {
                // 모든 병합된 필드(main, secondary 포함)에 선택 스타일 적용
                field.classList.add('field-selected');
                // 해당 행에도 선택 표시 클래스 추가 (타입별로)
                const row = field.closest('.time-entry');
                if (row) {
                    row.classList.add(type === 'planned' ? 'selected-merged-planned' : 'selected-merged-actual');
                }
            }
        }
        
        // 병합된 필드는 이미 병합되어 있으므로 되돌리기 버튼을 표시
        this.showUndoButton(type, mergeKey);
        this.updateSelectionOverlay(type);
    }

    ensureSelectionOverlay(type) {
        if (!this.selectionOverlay[type]) {
            const el = document.createElement('div');
            el.className = 'selection-overlay';
            el.dataset.type = type;

            // 중복 바인딩 방지: 항상 최신 핸들러로 교체
            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearSelection(type);     // 해당 열(계획/실제)만 해제
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

    // 현재 선택 집합을 한 박스로 덮도록 위치/크기 갱신
    updateSelectionOverlay(type) {
        const selectedSet = (type === 'planned') ? this.selectedPlannedFields : this.selectedActualFields;
        if (!selectedSet || selectedSet.size < 1) {
            this.removeSelectionOverlay(type);
            return;
        }

        // 연속 구간 가정(드래그/병합 선택) — 비연속이면 첫~끝 구간으로 처리
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

        // 하단 행 보더(기본 2px)를 마지막 행까지 덮기
        const lastRow   = endField.closest('.time-entry');
        const rowStyle  = lastRow ? window.getComputedStyle(lastRow) : null;
        const bottomBW  = rowStyle ? parseFloat(rowStyle.borderBottomWidth || '0') : 0;

        const overlay   = this.ensureSelectionOverlay(type);
        const left      = startRect.left + window.scrollX;
        const top       = startRect.top  + window.scrollY;
        const width     = startRect.width; // 같은 열이므로 동일 폭
        const height    = (endRect.bottom - startRect.top) + bottomBW;

        overlay.style.left   = `${left}px`;
        overlay.style.top    = `${top}px`;
        overlay.style.width  = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    // 현재 선택 집합이 특정 병합 범위 전체를 정확히 담고 있는지 판정
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
            // 인풋 자체에서 이미 처리한 클릭은 무시 (인풋 쪽에서 stopPropagation 호출)
            // 행 바탕을 클릭했을 때만 동작하게 설계

            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField  = entryDiv.querySelector('.actual-input');
            if (!plannedField && !actualField) return;

            const rowRect      = entryDiv.getBoundingClientRect();
            const x = e.clientX, y = e.clientY;

            // 왼쪽(계획) 컬럼 폭 안을 눌렀는지
            if (plannedField) {
                const pr = plannedField.getBoundingClientRect();
                const inPlannedCol = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlannedCol) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();      // ← 행에서 처리했으면 더 이상 인풋 핸들러로 가지 않게
                        // 같은 병합범위가 이미 선택돼 있으면 해제, 아니면 선택
                        if (this.isMergeRangeSelected('planned', mk)) this.clearSelection('planned');
                        else this.selectMergedRange('planned', mk);
                        return;
                    }
                }
            }

            // 오른쪽(실제) 컬럼 폭 안을 눌렀는지
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
        });       // bubble 단계 (기본값)
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