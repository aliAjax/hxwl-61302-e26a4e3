import { describe, it, expect, beforeEach } from 'vitest';
import {
  recipeTemplates,
  cropOptions,
  cropStageRanges,
  CUSTOM_TEMPLATES_STORAGE_KEY,
  loadCustomTemplates,
  saveCustomTemplates,
  getAllTemplates,
  addCustomTemplate,
  deleteCustomTemplate,
  getAllCropOptions
} from '../src/recipeTemplates.js';

describe('recipeTemplates.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('内置模板数据', () => {
    it('recipeTemplates 应该包含番茄、生菜、草莓、黄瓜、辣椒、西瓜六种作物', () => {
      const crops = [...new Set(recipeTemplates.map((t) => t.crop))];
      expect(crops).toContain('番茄');
      expect(crops).toContain('生菜');
      expect(crops).toContain('草莓');
      expect(crops).toContain('黄瓜');
      expect(crops).toContain('辣椒');
      expect(crops).toContain('西瓜');
    });

    it('每个模板都应该包含必要字段', () => {
      recipeTemplates.forEach((t) => {
        expect(t.id).toBeTruthy();
        expect(t.crop).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.stage).toBeTruthy();
        expect(t.ec).toBeTruthy();
        expect(t.ph).toBeTruthy();
        expect(t.npk).toBeTruthy();
      });
    });

    it('每个作物都应该有育苗期、营养生长期、开花期、结果期（或对应阶段）', () => {
      const crops = [...new Set(recipeTemplates.map((t) => t.crop))];
      crops.forEach((crop) => {
        const stages = recipeTemplates
          .filter((t) => t.crop === crop)
          .map((t) => t.stage);
        expect(stages.length).toBeGreaterThanOrEqual(4);
        expect(stages).toContain('育苗期');
        expect(stages).toContain('营养生长期');
      });
    });

    it('每个模板 ID 应该唯一', () => {
      const ids = recipeTemplates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('cropOptions', () => {
    it('cropOptions 应该等于所有内置模板的作物去重结果', () => {
      const expectedCrops = [...new Set(recipeTemplates.map((t) => t.crop))];
      expect(cropOptions.sort()).toEqual(expectedCrops.sort());
    });

    it('cropOptions 应该包含 6 种作物', () => {
      expect(cropOptions).toHaveLength(6);
    });
  });

  describe('cropStageRanges', () => {
    it('应该为每个作物+阶段组合都有 EC/PH 范围', () => {
      recipeTemplates.forEach((t) => {
        const key = `${t.crop}||${t.stage}`;
        const range = cropStageRanges[key];
        expect(range).toBeTruthy();
        expect(range.ecMin).toBeDefined();
        expect(range.ecMax).toBeDefined();
        expect(range.phMin).toBeDefined();
        expect(range.phMax).toBeDefined();
        expect(range.ecMin).toBeLessThanOrEqual(range.ecMax);
        expect(range.phMin).toBeLessThanOrEqual(range.phMax);
      });
    });

    it('EC 和 PH 值范围应该合理', () => {
      Object.values(cropStageRanges).forEach((range) => {
        expect(range.ecMin).toBeGreaterThan(0);
        expect(range.ecMax).toBeLessThan(5);
        expect(range.phMin).toBeGreaterThanOrEqual(5);
        expect(range.phMax).toBeLessThanOrEqual(7);
      });
    });
  });

  describe('CUSTOM_TEMPLATES_STORAGE_KEY', () => {
    it('应该是正确的存储键', () => {
      expect(CUSTOM_TEMPLATES_STORAGE_KEY).toBe('hxwl-61302-custom-recipe-templates');
    });
  });

  describe('自定义模板 - 加载和保存', () => {
    it('无本地存储数据时 loadCustomTemplates 应返回空数组', () => {
      expect(loadCustomTemplates()).toEqual([]);
    });

    it('存储无效 JSON 时 loadCustomTemplates 应返回空数组', () => {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, 'invalid-json');
      expect(loadCustomTemplates()).toEqual([]);
    });

    it('存储非数组时 loadCustomTemplates 应返回空数组', () => {
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify({ not: 'array' }));
      expect(loadCustomTemplates()).toEqual([]);
    });

    it('saveCustomTemplates 应该正确保存到 localStorage', () => {
      const templates = [
        { id: 'custom-1', crop: '番茄', stage: '育苗期' }
      ];
      saveCustomTemplates(templates);
      const saved = JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_STORAGE_KEY));
      expect(saved).toEqual(templates);
    });

    it('loadCustomTemplates 应该正确读取保存的数据', () => {
      const templates = [
        { id: 'custom-1', crop: '番茄', stage: '育苗期', ec: '1.2', ph: '5.8', npk: '20-20-20', name: '测试' }
      ];
      localStorage.setItem(CUSTOM_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      expect(loadCustomTemplates()).toEqual(templates);
    });
  });

  describe('getAllTemplates', () => {
    it('无自定义模板时应该只返回内置模板并标记 isCustom: false', () => {
      const all = getAllTemplates();
      expect(all).toHaveLength(recipeTemplates.length);
      all.forEach((t) => {
        expect(t.isCustom).toBe(false);
      });
    });

    it('有自定义模板时应该合并内置和自定义模板', () => {
      const customTemplate = {
        id: 'custom-1',
        crop: '番茄',
        stage: '育苗期',
        name: '自定义测试',
        ec: '1.3',
        ph: '5.9',
        npk: '20-10-20',
        memo: '测试'
      };
      localStorage.setItem(
        CUSTOM_TEMPLATES_STORAGE_KEY,
        JSON.stringify([customTemplate])
      );

      const all = getAllTemplates();
      expect(all).toHaveLength(recipeTemplates.length + 1);

      const custom = all.find((t) => t.id === 'custom-1');
      expect(custom).toBeTruthy();
      expect(custom.isCustom).toBe(true);
      expect(custom.crop).toBe('番茄');

      const builtin = all.find((t) => t.id === 'tomato-seedling');
      expect(builtin).toBeTruthy();
      expect(builtin.isCustom).toBe(false);
    });
  });

  describe('addCustomTemplate', () => {
    it('应该添加自定义模板并生成唯一 ID', () => {
      const template = {
        crop: '番茄',
        stage: '育苗期',
        name: '新增测试',
        ec: '1.4',
        ph: '6.0',
        npk: '19-19-19',
        memo: '测试添加'
      };

      const result = addCustomTemplate(template);
      expect(result.id).toBeTruthy();
      expect(result.id.startsWith('custom-')).toBe(true);
      expect(result.isCustom).toBe(true);
      expect(result.createdAt).toBeTruthy();
      expect(result.crop).toBe('番茄');
      expect(result.name).toBe('新增测试');

      const saved = loadCustomTemplates();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe(result.id);
    });

    it('多次添加的模板 ID 应该不同', () => {
      const t1 = addCustomTemplate({ crop: '番茄', stage: '育苗期', name: 'a' });
      const t2 = addCustomTemplate({ crop: '生菜', stage: '育苗期', name: 'b' });
      expect(t1.id).not.toBe(t2.id);

      const saved = loadCustomTemplates();
      expect(saved).toHaveLength(2);
    });
  });

  describe('deleteCustomTemplate', () => {
    it('应该正确删除指定 ID 的模板', () => {
      const t1 = addCustomTemplate({ crop: '番茄', stage: '育苗期', name: 'A' });
      const t2 = addCustomTemplate({ crop: '生菜', stage: '育苗期', name: 'B' });

      const remaining = deleteCustomTemplate(t1.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(t2.id);

      const saved = loadCustomTemplates();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe(t2.id);
    });

    it('删除不存在的 ID 时不应该报错', () => {
      addCustomTemplate({ crop: '番茄', stage: '育苗期', name: 'A' });
      const remaining = deleteCustomTemplate('non-existent-id');
      expect(remaining).toHaveLength(1);
    });

    it('删除所有模板后应该返回空数组', () => {
      const t1 = addCustomTemplate({ crop: '番茄', stage: '育苗期', name: 'A' });
      deleteCustomTemplate(t1.id);
      const remaining = deleteCustomTemplate('another-id');
      expect(remaining).toEqual([]);
    });
  });

  describe('getAllCropOptions', () => {
    it('无自定义模板时应该返回和 cropOptions 相同的作物', () => {
      const options = getAllCropOptions();
      expect(options.sort()).toEqual(cropOptions.sort());
    });

    it('自定义模板添加新作物时应该包含该作物', () => {
      addCustomTemplate({
        crop: '茄子',
        stage: '育苗期',
        name: '茄子·育苗期',
        ec: '1.0',
        ph: '6.0',
        npk: '20-20-20'
      });

      const options = getAllCropOptions();
      expect(options).toContain('茄子');
      expect(options.length).toBe(cropOptions.length + 1);
    });

    it('同一作物多次添加不应该重复出现', () => {
      addCustomTemplate({
        crop: '番茄',
        stage: '测试期',
        name: '测试',
        ec: '1.0',
        ph: '6.0',
        npk: '20-20-20'
      });
      addCustomTemplate({
        crop: '番茄',
        stage: '另一期',
        name: '测试2',
        ec: '1.0',
        ph: '6.0',
        npk: '20-20-20'
      });

      const options = getAllCropOptions();
      const tomatoCount = options.filter((c) => c === '番茄').length;
      expect(tomatoCount).toBe(1);
    });
  });
});
