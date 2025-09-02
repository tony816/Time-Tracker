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
        this.init();
    }

    init() {
        this.generateTimeSlots();
        this.renderTimeEntries();
        this.attachEventListeners();
        this.setCurrentDate();
        this.loadData();
        this.attachModalEventListeners();
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
        
        for (let i = start; i <= end; i++) {
            if (type === 'planned') {
                this.timeSlots[i].planned = '';
            } else {
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
            
            for (let i = startIndex; i <= endIndex; i++) {
                if (type === 'planned') {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                } else {
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
    
    createMergedField(mergeKey, type, index, value) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
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
            const firstIndex = Math.min(...selectedSet);
            
            const mergeKey = this.findMergeKey(type, firstIndex);
            let dataIndex = firstIndex;
            if(mergeKey){
                const mainField = document.querySelector(`[data-merge-key="${mergeKey}"].merged-main`);
                if(mainField) {
                    dataIndex = parseInt(mainField.dataset.index);
                }
            }
            this.openScheduleModal(type, dataIndex);
        });
        
        document.body.appendChild(this.scheduleButton);
    }
    
    openScheduleModal(type, index) {
        const modal = document.getElementById('scheduleModal');
        const timeField = document.getElementById('scheduleTime');
        const activityField = document.getElementById('scheduleActivity');
        
        const mergeKey = this.findMergeKey(type, index);
        const value = mergeKey ? this.mergedFields.get(mergeKey) : this.timeSlots[index][type];

        timeField.value = this.timeSlots[index].time + '시';
        if(mergeKey) {
            const endIdx = parseInt(mergeKey.split('-')[2]);
            const endTime = this.timeSlots[endIdx].time;
            timeField.value += ` - ${parseInt(endTime) + 1}시`;
        }

        activityField.value = value || '';
        
        modal.style.display = 'flex';
        
        modal.dataset.type = type;
        modal.dataset.index = index;
        
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
        delete modal.dataset.index;
    }
    
    saveScheduleFromModal() {
        const modal = document.getElementById('scheduleModal');
        const type = modal.dataset.type;
        const index = parseInt(modal.dataset.index);
        const activity = document.getElementById('scheduleActivity').value.trim();
        
        if (type && index !== undefined) {
            const mergeKey = this.findMergeKey(type, index);
            if (mergeKey) {
                this.mergedFields.set(mergeKey, activity);
            } else {
                this.timeSlots[index][type] = activity;
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