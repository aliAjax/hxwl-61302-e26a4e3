import { useState, useRef } from 'react';
import {
  exportGreenhouseData,
  exportFullBackup,
  downloadJSON,
  generateExportFilename,
  parseImportFile,
  validateImportData,
  applyImportMode,
  EXPORT_TYPES,
  IMPORT_MODES,
  detectImportType,
} from './dataImportExport';
import { saveMultiGreenhouseState } from './greenhouseManager';
import { getAllTemplates, loadCustomTemplates, saveCustomTemplates } from './recipeTemplates';

function useImportExport({
  ghState,
  setGhState,
  activeGhId,
  activeGreenhouse,
  greenhouses,
  records,
  adjRecords,
  trials,
  observations,
  appConfig,
  ensureVersions,
  setCustomTemplatesVersion,
}) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importFileInfo, setImportFileInfo] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importMode, setImportMode] = useState(IMPORT_MODES.MERGE_CURRENT);
  const [importTargetGhId, setImportTargetGhId] = useState('');
  const [importSourceGhId, setImportSourceGhId] = useState('');
  const [importNewGhName, setImportNewGhName] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState(EXPORT_TYPES.GREENHOUSE_DATA);
  const importFileInputRef = useRef(null);

  function handleExport() {
    setExportMode(EXPORT_TYPES.GREENHOUSE_DATA);
    setExportModalOpen(true);
  }

  function handleExportConfirm() {
    let jsonStr, filename;
    const greenhouseInfo = { id: activeGhId, name: activeGreenhouse?.name || '未知温室' };

    if (exportMode === EXPORT_TYPES.FULL_BACKUP) {
      const customTemplates = loadCustomTemplates();
      jsonStr = exportFullBackup(ghState, appConfig, customTemplates);
      filename = generateExportFilename(appConfig, EXPORT_TYPES.FULL_BACKUP);
    } else {
      jsonStr = exportGreenhouseData(records, adjRecords, appConfig, trials, observations, greenhouseInfo);
      filename = generateExportFilename(appConfig, EXPORT_TYPES.GREENHOUSE_DATA, greenhouseInfo);
    }

    downloadJSON(jsonStr, filename);
    setExportModalOpen(false);
  }

  function handleImportFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    setImportFileInfo({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    });
    setImportError(null);
    setImportProcessing(true);

    parseImportFile(file)
      .then((data) => {
        const importType = detectImportType(data);
        const targetGhId = importTargetGhId || activeGhId;
        const validation = validateImportData(data, records, adjRecords, appConfig, trials, observations, ghState, targetGhId);

        if (importType === EXPORT_TYPES.FULL_BACKUP) {
          setImportMode(IMPORT_MODES.OVERWRITE);
          const firstGhId = Object.keys(validation.cleanData.data || {})[0];
          setImportSourceGhId(validation.cleanData.activeGreenhouseId || firstGhId || '');
        } else {
          setImportMode(IMPORT_MODES.MERGE_CURRENT);
        }

        setImportPreview(validation);
        setImportProcessing(false);
      })
      .catch((err) => {
        setImportError(err.message);
        setImportProcessing(false);
        setImportPreview(null);
      });
  }

  function triggerImportFileSelect() {
    setImportModalOpen(true);
    setImportPreview(null);
    setImportError(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId(activeGhId);
    setImportSourceGhId('');
    setImportNewGhName('');
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  }

  function handleImportConfirm() {
    if (!importPreview || !importPreview.valid) return;

    const importType = importPreview.importType;
    const options = {
      appConfig,
      targetGhId: importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE ? (importTargetGhId || activeGhId) : activeGhId,
      sourceGhId: importSourceGhId,
      newGreenhouseName: importNewGhName.trim() || undefined,
    };

    const newState = applyImportMode(importMode, ghState, importPreview.cleanData, importType, options);

    if (importMode === IMPORT_MODES.OVERWRITE && importPreview.cleanData.customTemplates) {
      saveCustomTemplates(importPreview.cleanData.customTemplates);
      setCustomTemplatesVersion((v) => v + 1);
    }

    Object.keys(newState.data || {}).forEach((ghId) => {
      if (newState.data[ghId]?.records) {
        newState.data[ghId].records = ensureVersions(newState.data[ghId].records);
      }
    });

    saveMultiGreenhouseState(newState);
    setGhState(newState);

    let successMessage = '';
    if (importMode === IMPORT_MODES.OVERWRITE) {
      successMessage = `已覆盖整个应用数据！\n\n`;
      const ghCount = Object.keys(newState.greenhouses || {}).length;
      successMessage += `共导入 ${ghCount} 个温室\n`;
      if (importPreview.preview.customTemplateCount > 0) {
        successMessage += `自定义模板：${importPreview.preview.customTemplateCount} 个\n`;
      }
    } else if (importMode === IMPORT_MODES.NEW_GREENHOUSE) {
      const newGhId = newState.activeGreenhouseId;
      const newGhName = newState.greenhouses?.[newGhId]?.name || '新温室';
      successMessage = `已新建温室「${newGhName}」并导入数据！\n\n`;
      const ghData = newState.data?.[newGhId];
      successMessage += `配方记录：${ghData?.records?.length || 0} 条\n`;
      successMessage += `调整记录：${ghData?.adjRecords?.length || 0} 条\n`;
      successMessage += `试验记录：${ghData?.trials?.length || 0} 条\n`;
      successMessage += `观察记录：${ghData?.observations?.length || 0} 条`;
    } else {
      const targetGhId = importMode === IMPORT_MODES.SPECIFIC_GREENHOUSE ? (importTargetGhId || activeGhId) : activeGhId;
      const targetGhName = ghState.greenhouses?.[targetGhId]?.name || '当前温室';
      successMessage = `已导入到温室「${targetGhName}」！\n\n`;

      const preview = importPreview.importType === EXPORT_TYPES.FULL_BACKUP && importSourceGhId
        ? importPreview.preview.impactByGh?.[importSourceGhId]?.preview
        : importPreview.preview;

      if (preview) {
        successMessage += `配方记录：新增 ${preview.records?.newCount || 0} 条，覆盖 ${preview.records?.overwriteCount || 0} 条\n`;
        successMessage += `调整记录：新增 ${preview.adjRecords?.newCount || 0} 条，覆盖 ${preview.adjRecords?.overwriteCount || 0} 条\n`;
        if (preview.trials) {
          successMessage += `试验记录：新增 ${preview.trials.newCount || 0} 条，覆盖 ${preview.trials.overwriteCount || 0} 条\n`;
        }
        if (preview.observations) {
          successMessage += `观察记录：新增 ${preview.observations.newCount || 0} 条，覆盖 ${preview.observations.overwriteCount || 0} 条`;
        }
      }
    }

    setImportModalOpen(false);
    setImportPreview(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId('');
    setImportSourceGhId('');
    setImportNewGhName('');

    alert(successMessage);
  }

  function handleImportCancel() {
    setImportModalOpen(false);
    setImportPreview(null);
    setImportError(null);
    setImportFileInfo(null);
    setImportMode(IMPORT_MODES.MERGE_CURRENT);
    setImportTargetGhId('');
    setImportSourceGhId('');
    setImportNewGhName('');
  }

  return {
    importModalOpen,
    importPreview,
    importFileInfo,
    importError,
    importProcessing,
    importMode,
    setImportMode,
    importTargetGhId,
    setImportTargetGhId,
    importSourceGhId,
    setImportSourceGhId,
    importNewGhName,
    setImportNewGhName,
    exportModalOpen,
    setExportModalOpen,
    exportMode,
    setExportMode,
    importFileInputRef,
    handleExport,
    handleExportConfirm,
    handleImportFileSelect,
    triggerImportFileSelect,
    handleImportConfirm,
    handleImportCancel,
    getAllTemplates,
  };
}

export default useImportExport;
