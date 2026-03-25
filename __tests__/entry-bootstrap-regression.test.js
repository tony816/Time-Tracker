const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('script.js exposes TimeTracker but no longer bootstraps on DOMContentLoaded', () => {
    assert.match(scriptSource, /window\.TimeTracker\s*=\s*TimeTracker\s*;/);
    assert.doesNotMatch(scriptSource, /DOMContentLoaded/);
    assert.doesNotMatch(scriptSource, /window\.tracker\s*=\s*new\s+TimeTracker/);
});

test('main.js is responsible for app bootstrap and animation keyframes injection', () => {
    assert.match(mainSource, /document\.getElementById\('tt-animation-keyframes'\)/);
    assert.match(mainSource, /document\.addEventListener\('DOMContentLoaded',\s*initTracker,\s*\{\s*once:\s*true\s*\}\)/);
    assert.match(mainSource, /window\.tracker\s*=\s*new\s+window\.TimeTracker\(\)/);
});

test('index.html loads dependency modules before script.js and main.js', () => {
    const scriptTagIndex = (srcPath) => htmlSource.search(
        new RegExp(`<script[^>]*\\bsrc="${srcPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`)
    );

    const actualGridCoreIdx = scriptTagIndex('core/actual-grid-core.js');
    const activityCoreIdx = scriptTagIndex('core/activity-core.js');
    const dateCoreIdx = scriptTagIndex('core/date-core.js');
    const durationCoreIdx = scriptTagIndex('core/duration-core.js');
    const gridMetricsCoreIdx = scriptTagIndex('core/grid-metrics-core.js');
    const inputFormatCoreIdx = scriptTagIndex('core/input-format-core.js');
    const textCoreIdx = scriptTagIndex('core/text-core.js');
    const timeCoreIdx = scriptTagIndex('core/time-core.js');
    const actualActivityRendererIdx = scriptTagIndex('ui/actual-activity-list-renderer.js');
    const controllerStateAccessIdx = scriptTagIndex('controllers/controller-state-access.js');
    const actualModalControllerIdx = scriptTagIndex('controllers/actual-modal-controller.js');
    const inlinePlanDropdownControllerIdx = scriptTagIndex('controllers/inline-plan-dropdown-controller.js');
    const plannedCatalogRoutineControllerIdx = scriptTagIndex('controllers/planned-catalog-routine-controller.js');
    const plannedEditorControllerIdx = scriptTagIndex('controllers/planned-editor-controller.js');
    const persistenceControllerIdx = scriptTagIndex('controllers/persistence-controller.js');
    const supabaseSyncControllerIdx = scriptTagIndex('controllers/supabase-sync-controller.js');
    const timeEntryRenderControllerIdx = scriptTagIndex('controllers/time-entry-render-controller.js');
    const lifecycleControllerIdx = scriptTagIndex('controllers/lifecycle-controller.js');
    const selectionOverlayControllerIdx = scriptTagIndex('controllers/selection-overlay-controller.js');
    const schedulePreviewControllerIdx = scriptTagIndex('controllers/schedule-preview-controller.js');
    const scriptIdx = scriptTagIndex('script.js');
    const mainIdx = scriptTagIndex('main.js');

    assert.ok(timeCoreIdx >= 0, 'core/time-core.js include should exist');
    assert.ok(durationCoreIdx >= 0, 'core/duration-core.js include should exist');
    assert.ok(inputFormatCoreIdx >= 0, 'core/input-format-core.js include should exist');
    assert.ok(dateCoreIdx >= 0, 'core/date-core.js include should exist');
    assert.ok(textCoreIdx >= 0, 'core/text-core.js include should exist');
    assert.ok(activityCoreIdx >= 0, 'core/activity-core.js include should exist');
    assert.ok(actualGridCoreIdx >= 0, 'core/actual-grid-core.js include should exist');
    assert.ok(gridMetricsCoreIdx >= 0, 'core/grid-metrics-core.js include should exist');
    assert.ok(actualActivityRendererIdx >= 0, 'ui/actual-activity-list-renderer.js include should exist');
    assert.ok(controllerStateAccessIdx >= 0, 'controllers/controller-state-access.js include should exist');
    assert.ok(actualModalControllerIdx >= 0, 'controllers/actual-modal-controller.js include should exist');
    assert.ok(inlinePlanDropdownControllerIdx >= 0, 'controllers/inline-plan-dropdown-controller.js include should exist');
    assert.ok(plannedCatalogRoutineControllerIdx >= 0, 'controllers/planned-catalog-routine-controller.js include should exist');
    assert.ok(plannedEditorControllerIdx >= 0, 'controllers/planned-editor-controller.js include should exist');
    assert.ok(persistenceControllerIdx >= 0, 'controllers/persistence-controller.js include should exist');
    assert.ok(supabaseSyncControllerIdx >= 0, 'controllers/supabase-sync-controller.js include should exist');
    assert.ok(timeEntryRenderControllerIdx >= 0, 'controllers/time-entry-render-controller.js include should exist');
    assert.ok(lifecycleControllerIdx >= 0, 'controllers/lifecycle-controller.js include should exist');
    assert.ok(selectionOverlayControllerIdx >= 0, 'controllers/selection-overlay-controller.js include should exist');
    assert.ok(schedulePreviewControllerIdx >= 0, 'controllers/schedule-preview-controller.js include should exist');
    assert.ok(scriptIdx >= 0, 'script.js include should exist');
    assert.ok(mainIdx >= 0, 'main.js include should exist');
    assert.ok(timeCoreIdx < durationCoreIdx, 'duration-core.js should load after time-core.js');
    assert.ok(durationCoreIdx < inputFormatCoreIdx, 'input-format-core.js should load after duration-core.js');
    assert.ok(inputFormatCoreIdx < dateCoreIdx, 'date-core.js should load after input-format-core.js');
    assert.ok(dateCoreIdx < textCoreIdx, 'text-core.js should load after date-core.js');
    assert.ok(textCoreIdx < activityCoreIdx, 'activity-core.js should load after text-core.js');
    assert.ok(activityCoreIdx < actualGridCoreIdx, 'actual-grid-core.js should load after activity-core.js');
    assert.ok(actualGridCoreIdx < gridMetricsCoreIdx, 'grid-metrics-core.js should load after actual-grid-core.js');
    assert.ok(gridMetricsCoreIdx < actualActivityRendererIdx, 'ui/actual-activity-list-renderer.js should load after grid-metrics-core.js');
    assert.ok(actualActivityRendererIdx < controllerStateAccessIdx, 'controllers/controller-state-access.js should load after ui/actual-activity-list-renderer.js');
    assert.ok(controllerStateAccessIdx < actualModalControllerIdx, 'controllers/actual-modal-controller.js should load after controllers/controller-state-access.js');
    assert.ok(actualModalControllerIdx < inlinePlanDropdownControllerIdx, 'controllers/inline-plan-dropdown-controller.js should load after controllers/actual-modal-controller.js');
    assert.ok(inlinePlanDropdownControllerIdx < plannedCatalogRoutineControllerIdx, 'controllers/planned-catalog-routine-controller.js should load after controllers/inline-plan-dropdown-controller.js');
    assert.ok(plannedCatalogRoutineControllerIdx < plannedEditorControllerIdx, 'controllers/planned-editor-controller.js should load after controllers/planned-catalog-routine-controller.js');
    assert.ok(plannedEditorControllerIdx < persistenceControllerIdx, 'controllers/persistence-controller.js should load after controllers/planned-editor-controller.js');
    assert.ok(persistenceControllerIdx < supabaseSyncControllerIdx, 'controllers/supabase-sync-controller.js should load after controllers/persistence-controller.js');
    assert.ok(supabaseSyncControllerIdx < timeEntryRenderControllerIdx, 'controllers/time-entry-render-controller.js should load after controllers/supabase-sync-controller.js');
    assert.ok(timeEntryRenderControllerIdx < lifecycleControllerIdx, 'controllers/lifecycle-controller.js should load after controllers/time-entry-render-controller.js');
    assert.ok(lifecycleControllerIdx < selectionOverlayControllerIdx, 'controllers/selection-overlay-controller.js should load after controllers/lifecycle-controller.js');
    assert.ok(selectionOverlayControllerIdx < schedulePreviewControllerIdx, 'controllers/schedule-preview-controller.js should load after controllers/selection-overlay-controller.js');
    assert.ok(schedulePreviewControllerIdx < scriptIdx, 'controllers/schedule-preview-controller.js should load before script.js');
    assert.ok(selectionOverlayControllerIdx < scriptIdx, 'controllers/selection-overlay-controller.js should load before script.js');
    assert.ok(lifecycleControllerIdx < scriptIdx, 'controllers/lifecycle-controller.js should load before script.js');
    assert.ok(timeEntryRenderControllerIdx < scriptIdx, 'controllers/time-entry-render-controller.js should load before script.js');
    assert.ok(supabaseSyncControllerIdx < scriptIdx, 'controllers/supabase-sync-controller.js should load before script.js');
    assert.ok(persistenceControllerIdx < scriptIdx, 'controllers/persistence-controller.js should load before script.js');
    assert.ok(plannedCatalogRoutineControllerIdx < scriptIdx, 'controllers/planned-catalog-routine-controller.js should load before script.js');
    assert.ok(plannedEditorControllerIdx < scriptIdx, 'controllers/planned-editor-controller.js should load before script.js');
    assert.ok(controllerStateAccessIdx < scriptIdx, 'controllers/controller-state-access.js should load before script.js');
    assert.ok(actualModalControllerIdx < scriptIdx, 'controllers/actual-modal-controller.js should load before script.js');
    assert.ok(inlinePlanDropdownControllerIdx < scriptIdx, 'controllers/inline-plan-dropdown-controller.js should load before script.js');
    assert.ok(actualActivityRendererIdx < scriptIdx, 'ui/actual-activity-list-renderer.js should load before script.js');
    assert.ok(schedulePreviewControllerIdx < scriptIdx, 'controllers/schedule-preview-controller.js should load before script.js');
    assert.ok(scriptIdx < mainIdx, 'main.js should load after script.js');
});
