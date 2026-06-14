import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateImportData,
  applyImportMode,
  regenerateIdsForGreenhouseData,
  EXPORT_TYPES,
  IMPORT_MODES,
  EXPORT_FORMAT_VERSION,
} from '../src/dataImportExport.js';

const APP_CONFIG = { id: 'hxwl-61302', title: '温室营养液配方管理' };

function createMockMultiGhState() {
  return {
    version: '1.0',
    greenhouses: {
      'gh-existing': {
        id: 'gh-existing',
        name: '现有温室',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
    activeGreenhouseId: 'gh-existing',
    data: {
      'gh-existing': {
        records: [
          {
            id: 'rec-existing-1',
            crop: '番茄',
            stage: '育苗期',
            ec: '1.2',
            ph: '5.8',
            npk: '20-20-20',
            status: '在用',
          },
        ],
        adjRecords: [],
        trials: [],
        observations: [],
      },
    },
  };
}

function createValidGreenhouseDataImport() {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportType: EXPORT_TYPES.GREENHOUSE_DATA,
    exportedAt: new Date().toISOString(),
    appId: 'hxwl-61302',
    appTitle: '温室营养液配方管理',
    greenhouseId: 'gh-source',
    greenhouseName: '来源温室',
    records: [
      {
        id: 'rec-src-1',
        crop: '番茄',
        stage: '营养生长期',
        ec: '1.8',
        ph: '5.8',
        npk: '18-10-22',
        status: '在用',
      },
      {
        id: 'rec-src-2',
        crop: '生菜',
        stage: '育苗期',
        ec: '0.8',
        ph: '6.0',
        npk: '20-20-20',
        status: '试配',
      },
    ],
    adjRecords: [
      {
        id: 'adj-src-1',
        recipeId: 'rec-src-1',
        sourceId: 'rec-src-1',
        crop: '番茄',
        stage: '营养生长期',
        reason: '测试调整',
        adjustments: { ec: '2.0' },
      },
    ],
    trials: [
      {
        id: 'trial-src-1',
        recipeId: 'rec-src-2',
        crop: '生菜',
        stage: '育苗期',
        status: '进行中',
      },
    ],
    observations: [
      {
        id: 'obs-src-1',
        trialId: 'trial-src-1',
        date: '2024-01-15',
      },
    ],
  };
}

function createValidFullBackupImport() {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportType: EXPORT_TYPES.FULL_BACKUP,
    exportedAt: new Date().toISOString(),
    appId: 'hxwl-61302',
    appTitle: '温室营养液配方管理',
    version: '1.0',
    greenhouses: {
      'gh-backup-1': {
        id: 'gh-backup-1',
        name: '备份温室A',
        createdAt: '2024-02-01T00:00:00.000Z',
      },
      'gh-backup-2': {
        id: 'gh-backup-2',
        name: '备份温室B',
        createdAt: '2024-03-01T00:00:00.000Z',
      },
    },
    activeGreenhouseId: 'gh-backup-1',
    data: {
      'gh-backup-1': {
        records: [
          {
            id: 'rec-bk-1',
            crop: '番茄',
            stage: '育苗期',
            ec: '1.2',
            ph: '5.8',
            npk: '20-20-20',
            status: '在用',
          },
        ],
        adjRecords: [],
        trials: [
          {
            id: 'trial-bk-1',
            recipeId: 'rec-bk-1',
            crop: '番茄',
            stage: '育苗期',
            status: '完成',
          },
        ],
        observations: [
          {
            id: 'obs-bk-1',
            trialId: 'trial-bk-1',
            date: '2024-02-15',
          },
        ],
      },
      'gh-backup-2': {
        records: [],
        adjRecords: [],
        trials: [],
        observations: [],
      },
    },
    customTemplates: [],
  };
}

describe('dataImportExport.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('validateImportData - 单温室导入', () => {
    it('应该正确验证有效的单温室数据', () => {
      const importData = createValidGreenhouseDataImport();
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.importType).toBe(EXPORT_TYPES.GREENHOUSE_DATA);
      expect(result.cleanData.records).toHaveLength(2);
      expect(result.cleanData.adjRecords).toHaveLength(1);
      expect(result.cleanData.trials).toHaveLength(1);
      expect(result.cleanData.observations).toHaveLength(1);
    });

    it('应该检测缺少必填字段的记录', () => {
      const importData = createValidGreenhouseDataImport();
      importData.records[0].crop = '';
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.preview.formatErrors.length).toBeGreaterThan(0);
      expect(result.cleanData.records).toHaveLength(1);
    });

    it('应该对无效格式返回 errors', () => {
      const state = createMockMultiGhState();
      const result = validateImportData(
        null,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateImportData - 完整备份导入', () => {
    it('应该正确验证有效的完整备份数据', () => {
      const importData = createValidFullBackupImport();
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.importType).toBe(EXPORT_TYPES.FULL_BACKUP);
      expect(Object.keys(result.cleanData.greenhouses)).toHaveLength(2);
      expect(Object.keys(result.cleanData.data)).toHaveLength(2);
      expect(result.cleanData.activeGreenhouseId).toBe('gh-backup-1');
    });

    it('应该在缺少 greenhouses 字段时返回错误', () => {
      const importData = createValidFullBackupImport();
      delete importData.greenhouses;
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('greenhouses'))).toBe(true);
    });

    it('应该在缺少 data 字段时返回错误', () => {
      const importData = createValidFullBackupImport();
      delete importData.data;
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('data'))).toBe(true);
    });

    it('应该对来自不同应用的数据给出警告', () => {
      const importData = createValidFullBackupImport();
      importData.appId = 'different-app';
      importData.appTitle = '其他应用';
      const state = createMockMultiGhState();

      const result = validateImportData(
        importData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('其他应用'))).toBe(true);
    });
  });

  describe('regenerateIdsForGreenhouseData', () => {
    it('应该为所有记录生成新的ID', () => {
      const ghData = {
        records: [
          { id: 'old-rec-1', crop: '番茄', stage: '育苗期' },
          { id: 'old-rec-2', crop: '生菜', stage: '育苗期' },
        ],
        adjRecords: [],
        trials: [],
        observations: [],
      };

      const result = regenerateIdsForGreenhouseData(ghData);

      expect(result.records).toHaveLength(2);
      expect(result.records[0].id).not.toBe('old-rec-1');
      expect(result.records[1].id).not.toBe('old-rec-2');
      expect(result.records[0].id.startsWith('gh-')).toBe(true);
    });

    it('应该正确重映射试验记录关联的 recipeId', () => {
      const ghData = {
        records: [{ id: 'old-rec-1', crop: '番茄', stage: '育苗期' }],
        adjRecords: [],
        trials: [
          {
            id: 'old-trial-1',
            recipeId: 'old-rec-1',
            crop: '番茄',
            stage: '育苗期',
            status: '进行中',
          },
        ],
        observations: [],
      };

      const result = regenerateIdsForGreenhouseData(ghData);
      const newRecordId = result.records[0].id;

      expect(result.trials[0].id).not.toBe('old-trial-1');
      expect(result.trials[0].recipeId).toBe(newRecordId);
    });

    it('应该正确重映射观察记录关联的 trialId', () => {
      const ghData = {
        records: [{ id: 'old-rec-1', crop: '番茄', stage: '育苗期' }],
        adjRecords: [],
        trials: [
          {
            id: 'old-trial-1',
            recipeId: 'old-rec-1',
            crop: '番茄',
            stage: '育苗期',
            status: '进行中',
          },
        ],
        observations: [
          { id: 'old-obs-1', trialId: 'old-trial-1', date: '2024-01-15' },
        ],
      };

      const result = regenerateIdsForGreenhouseData(ghData);
      const newTrialId = result.trials[0].id;

      expect(result.observations[0].id).not.toBe('old-obs-1');
      expect(result.observations[0].trialId).toBe(newTrialId);
    });

    it('应该正确重映射调整记录关联的 recipeId 和 sourceId', () => {
      const ghData = {
        records: [
          { id: 'old-rec-1', crop: '番茄', stage: '育苗期' },
          { id: 'old-rec-2', crop: '番茄', stage: '营养生长期' },
        ],
        adjRecords: [
          {
            id: 'old-adj-1',
            recipeId: 'old-rec-1',
            sourceId: 'old-rec-2',
            crop: '番茄',
            stage: '育苗期',
            reason: '测试',
            adjustments: {},
          },
        ],
        trials: [],
        observations: [],
      };

      const result = regenerateIdsForGreenhouseData(ghData);
      const newRecId1 = result.records[0].id;
      const newRecId2 = result.records[1].id;

      expect(result.adjRecords[0].recipeId).toBe(newRecId1);
      expect(result.adjRecords[0].sourceId).toBe(newRecId2);
    });

    it('应该重映射记录中的 fromTrialId 和 copiedFrom.recipeId', () => {
      const ghData = {
        records: [
          {
            id: 'old-rec-1',
            crop: '番茄',
            stage: '育苗期',
            fromTrialId: 'old-trial-1',
            copiedFrom: { recipeId: 'old-rec-src' },
          },
        ],
        adjRecords: [],
        trials: [
          {
            id: 'old-trial-1',
            recipeId: 'old-rec-1',
            crop: '番茄',
            stage: '育苗期',
            status: '完成',
          },
        ],
        observations: [],
      };

      const result = regenerateIdsForGreenhouseData(ghData);
      const newTrialId = result.trials[0].id;

      expect(result.records[0].fromTrialId).toBe(newTrialId);
    });

    it('应该处理空数据', () => {
      const ghData = { records: [], adjRecords: [], trials: [], observations: [] };
      const result = regenerateIdsForGreenhouseData(ghData);

      expect(result.records).toEqual([]);
      expect(result.adjRecords).toEqual([]);
      expect(result.trials).toEqual([]);
      expect(result.observations).toEqual([]);
    });
  });

  describe('applyImportMode', () => {
    it('OVERWRITE 模式 - 完整备份导入应该覆盖整个状态', () => {
      const state = createMockMultiGhState();
      const backupData = createValidFullBackupImport();

      const validation = validateImportData(
        backupData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      const result = applyImportMode(
        IMPORT_MODES.OVERWRITE,
        state,
        validation.cleanData,
        EXPORT_TYPES.FULL_BACKUP,
        { appConfig: APP_CONFIG }
      );

      expect(Object.keys(result.greenhouses)).toHaveLength(2);
      expect(result.activeGreenhouseId).toBe('gh-backup-1');
      expect(result.greenhouses['gh-backup-1'].name).toBe('备份温室A');
    });

    it('MERGE_CURRENT 模式 - 单温室导入应该合并到当前温室', () => {
      const state = createMockMultiGhState();
      const ghData = createValidGreenhouseDataImport();

      const validation = validateImportData(
        ghData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      const result = applyImportMode(
        IMPORT_MODES.MERGE_CURRENT,
        state,
        validation.cleanData,
        EXPORT_TYPES.GREENHOUSE_DATA,
        { appConfig: APP_CONFIG }
      );

      const targetRecords = result.data['gh-existing'].records;
      expect(targetRecords).toHaveLength(3);
      expect(targetRecords.some((r) => r.id === 'rec-existing-1')).toBe(true);
      expect(targetRecords.some((r) => r.id === 'rec-src-1')).toBe(true);
    });

    it('NEW_GREENHOUSE 模式 - 单温室导入应该创建新温室并重新生成ID', () => {
      const state = createMockMultiGhState();
      const ghData = createValidGreenhouseDataImport();

      const validation = validateImportData(
        ghData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      const result = applyImportMode(
        IMPORT_MODES.NEW_GREENHOUSE,
        state,
        validation.cleanData,
        EXPORT_TYPES.GREENHOUSE_DATA,
        { appConfig: APP_CONFIG, newGreenhouseName: '新导入温室' }
      );

      expect(Object.keys(result.greenhouses)).toHaveLength(2);
      const newGhId = Object.keys(result.greenhouses).find(
        (id) => id !== 'gh-existing'
      );
      expect(newGhId).toBeTruthy();
      expect(result.greenhouses[newGhId].name).toBe('新导入温室');
      expect(result.activeGreenhouseId).toBe(newGhId);

      const newGhData = result.data[newGhId];
      expect(newGhData.records).toHaveLength(2);
      expect(newGhData.records[0].id.startsWith('gh-')).toBe(true);
      expect(newGhData.trials[0].recipeId).toBe(newGhData.records[1].id);
      expect(newGhData.observations[0].trialId).toBe(newGhData.trials[0].id);
    });

    it('SPECIFIC_GREENHOUSE 模式 - 应该合并到指定温室', () => {
      const state = createMockMultiGhState();
      const ghData = createValidGreenhouseDataImport();

      const validation = validateImportData(
        ghData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      const result = applyImportMode(
        IMPORT_MODES.SPECIFIC_GREENHOUSE,
        state,
        validation.cleanData,
        EXPORT_TYPES.GREENHOUSE_DATA,
        { appConfig: APP_CONFIG, targetGhId: 'gh-existing' }
      );

      const targetRecords = result.data['gh-existing'].records;
      expect(targetRecords).toHaveLength(3);
    });

    it('NEW_GREENHOUSE 模式 - 完整备份导入应选择激活温室数据并重新生成ID', () => {
      const state = createMockMultiGhState();
      const backupData = createValidFullBackupImport();

      const validation = validateImportData(
        backupData,
        [],
        [],
        APP_CONFIG,
        [],
        [],
        state
      );

      const result = applyImportMode(
        IMPORT_MODES.NEW_GREENHOUSE,
        state,
        validation.cleanData,
        EXPORT_TYPES.FULL_BACKUP,
        { appConfig: APP_CONFIG, newGreenhouseName: '备份导入温室' }
      );

      expect(Object.keys(result.greenhouses)).toHaveLength(2);
      const newGhId = Object.keys(result.greenhouses).find(
        (id) => id !== 'gh-existing'
      );
      expect(newGhId).toBeTruthy();
      expect(result.greenhouses[newGhId].name).toBe('备份导入温室');

      const newGhData = result.data[newGhId];
      expect(newGhData.records).toHaveLength(1);
      expect(newGhData.trials).toHaveLength(1);
      expect(newGhData.trials[0].recipeId).toBe(newGhData.records[0].id);
      expect(newGhData.observations[0].trialId).toBe(newGhData.trials[0].id);
    });
  });
});
