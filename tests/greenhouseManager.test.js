import { describe, it, expect, beforeEach } from 'vitest';
import { ensureVersions, copyRecipeToGreenhouse, createEmptyGreenhouseData } from '../src/greenhouseManager.js';

function createMockMultiGhState() {
  return {
    version: '1.0',
    greenhouses: {
      'gh-source': {
        id: 'gh-source',
        name: '源温室',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      'gh-target': {
        id: 'gh-target',
        name: '目标温室',
        createdAt: '2024-02-01T00:00:00.000Z',
      },
    },
    activeGreenhouseId: 'gh-source',
    data: {
      'gh-source': {
        records: [
          {
            id: 'rec-src-1',
            crop: '番茄',
            stage: '育苗期',
            ec: '1.2',
            ph: '5.8',
            npk: '20-20-20',
            status: '在用',
            version: 1,
          },
        ],
        adjRecords: [],
        trials: [],
        observations: [],
      },
      'gh-target': createEmptyGreenhouseData(),
    },
  };
}

describe('greenhouseManager.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('ensureVersions', () => {
    it('应该为没有版本号的记录分配递增版本号', () => {
      const items = [
        { crop: '番茄', stage: '育苗期' },
        { crop: '番茄', stage: '育苗期' },
        { crop: '番茄', stage: '育苗期' },
      ];

      const result = ensureVersions(items);

      expect(result[0].version).toBe(1);
      expect(result[1].version).toBe(2);
      expect(result[2].version).toBe(3);
    });

    it('同作物同生长期版本号应该独立递增', () => {
      const items = [
        { crop: '番茄', stage: '育苗期' },
        { crop: '番茄', stage: '营养生长期' },
        { crop: '番茄', stage: '育苗期' },
        { crop: '生菜', stage: '育苗期' },
        { crop: '番茄', stage: '营养生长期' },
        { crop: '生菜', stage: '育苗期' },
      ];

      const result = ensureVersions(items);

      const tomatoSeedling = result.filter((r) => r.crop === '番茄' && r.stage === '育苗期');
      expect(tomatoSeedling.map((r) => r.version).sort()).toEqual([1, 2]);

      const tomatoVegetative = result.filter((r) => r.crop === '番茄' && r.stage === '营养生长期');
      expect(tomatoVegetative.map((r) => r.version).sort()).toEqual([1, 2]);

      const lettuceSeedling = result.filter((r) => r.crop === '生菜' && r.stage === '育苗期');
      expect(lettuceSeedling.map((r) => r.version).sort()).toEqual([1, 2]);
    });

    it('应该保留已有版本号并跳过它们', () => {
      const items = [
        { crop: '番茄', stage: '育苗期', version: 2 },
        { crop: '番茄', stage: '育苗期' },
        { crop: '番茄', stage: '育苗期', version: 5 },
        { crop: '番茄', stage: '育苗期' },
      ];

      const result = ensureVersions(items);

      const versions = result.map((r) => r.version).sort((a, b) => a - b);
      expect(versions).toEqual([1, 2, 3, 5]);
    });

    it('应该正确处理混合不同作物和阶段的已有版本号', () => {
      const items = [
        { crop: '番茄', stage: '育苗期', version: 3 },
        { crop: '番茄', stage: '育苗期' },
        { crop: '生菜', stage: '育苗期', version: 1 },
        { crop: '生菜', stage: '育苗期' },
        { crop: '番茄', stage: '营养生长期' },
        { crop: '番茄', stage: '营养生长期' },
      ];

      const result = ensureVersions(items);

      const tomatoSeedling = result.filter((r) => r.crop === '番茄' && r.stage === '育苗期');
      expect(tomatoSeedling.map((r) => r.version).sort()).toEqual([1, 3]);

      const lettuceSeedling = result.filter((r) => r.crop === '生菜' && r.stage === '育苗期');
      expect(lettuceSeedling.map((r) => r.version).sort()).toEqual([1, 2]);

      const tomatoVegetative = result.filter((r) => r.crop === '番茄' && r.stage === '营养生长期');
      expect(tomatoVegetative.map((r) => r.version).sort()).toEqual([1, 2]);
    });

    it('应该返回原始数组并修改其内容', () => {
      const items = [
        { crop: '番茄', stage: '育苗期' },
        { crop: '番茄', stage: '育苗期' },
      ];

      const result = ensureVersions(items);

      expect(result).toBe(items);
    });

    it('空数组应该返回空数组', () => {
      const result = ensureVersions([]);
      expect(result).toEqual([]);
    });
  });

  describe('copyRecipeToGreenhouse', () => {
    it('应该将配方复制到目标温室并生成新ID', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      expect(result.data['gh-target'].records).toHaveLength(1);
      const copied = result.data['gh-target'].records[0];
      expect(copied.id).not.toBe(recipe.id);
      expect(copied.id.startsWith('gh-')).toBe(true);
    });

    it('复制的配方在目标温室同作物同生长期无记录时版本号应为1', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.version).toBe(1);
    });

    it('复制的配方在目标温室已有同作物同生长期记录时版本号应递增', () => {
      const state = createMockMultiGhState();
      state.data['gh-target'].records = [
        {
          id: 'rec-target-1',
          crop: '番茄',
          stage: '育苗期',
          ec: '1.1',
          ph: '5.7',
          npk: '20-20-20',
          status: '在用',
          version: 1,
        },
        {
          id: 'rec-target-2',
          crop: '番茄',
          stage: '育苗期',
          ec: '1.3',
          ph: '5.8',
          npk: '20-20-20',
          status: '在用',
          version: 2,
        },
      ];
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.version).toBe(3);
    });

    it('复制的配方默认状态应该是「试配」', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.status).toBe('试配');
    });

    it('应该可以自定义复制后的状态', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe, '在用');

      const copied = result.data['gh-target'].records[0];
      expect(copied.status).toBe('在用');
    });

    it('复制的配方应该包含 copiedFrom 元数据', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.copiedFrom).toBeTruthy();
      expect(copied.copiedFrom.greenhouseId).toBe('gh-source');
      expect(copied.copiedFrom.greenhouseName).toBe('源温室');
      expect(copied.copiedFrom.recipeId).toBe(recipe.id);
      expect(copied.copiedFrom.copiedAt).toBeTruthy();
    });

    it('复制的配方应该在 timeline 中记录复制来源', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.timeline).toBeTruthy();
      expect(copied.timeline).toHaveLength(1);
      expect(copied.timeline[0].by).toContain('源温室');
      expect(copied.timeline[0].status).toBe('试配');
    });

    it('不同作物或阶段的版本号应该独立递增', () => {
      const state = createMockMultiGhState();
      state.data['gh-target'].records = [
        {
          id: 'rec-target-0',
          crop: '番茄',
          stage: '育苗期',
          ec: '1.0',
          ph: '5.7',
          npk: '20-20-20',
          status: '在用',
          version: 1,
        },
        {
          id: 'rec-target-1',
          crop: '番茄',
          stage: '育苗期',
          ec: '1.1',
          ph: '5.7',
          npk: '20-20-20',
          status: '在用',
          version: 2,
        },
        {
          id: 'rec-target-2',
          crop: '生菜',
          stage: '育苗期',
          ec: '0.8',
          ph: '6.0',
          npk: '20-20-20',
          status: '在用',
          version: 1,
        },
      ];
      const tomatoRecipe = {
        id: 'rec-src-tomato',
        crop: '番茄',
        stage: '育苗期',
        ec: '1.2',
        ph: '5.8',
        npk: '20-20-20',
        status: '在用',
      };
      const lettuceRecipe = {
        id: 'rec-src-lettuce',
        crop: '生菜',
        stage: '育苗期',
        ec: '0.9',
        ph: '6.0',
        npk: '20-20-20',
        status: '在用',
      };

      let result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', tomatoRecipe);
      result = copyRecipeToGreenhouse(result, 'gh-source', 'gh-target', lettuceRecipe);

      const targetRecords = result.data['gh-target'].records;
      const tomatoRecords = targetRecords.filter((r) => r.crop === '番茄' && r.stage === '育苗期');
      const lettuceRecords = targetRecords.filter((r) => r.crop === '生菜' && r.stage === '育苗期');

      expect(tomatoRecords.map((r) => r.version).sort()).toEqual([1, 2, 3]);
      expect(lettuceRecords.map((r) => r.version).sort()).toEqual([1, 2]);
    });

    it('复制的配方应该保留原配方的核心属性', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      const copied = result.data['gh-target'].records[0];
      expect(copied.crop).toBe(recipe.crop);
      expect(copied.stage).toBe(recipe.stage);
      expect(copied.ec).toBe(recipe.ec);
      expect(copied.ph).toBe(recipe.ph);
      expect(copied.npk).toBe(recipe.npk);
    });

    it('源温室或目标温室不存在时应该返回原状态', () => {
      const state = createMockMultiGhState();
      const recipe = state.data['gh-source'].records[0];

      const result1 = copyRecipeToGreenhouse(state, 'gh-nonexistent', 'gh-target', recipe);
      expect(result1).toBe(state);

      const result2 = copyRecipeToGreenhouse(state, 'gh-source', 'gh-nonexistent', recipe);
      expect(result2).toBe(state);
    });

    it('复制的配方应该添加到目标温室记录的开头', () => {
      const state = createMockMultiGhState();
      state.data['gh-target'].records = [
        {
          id: 'rec-target-old',
          crop: '番茄',
          stage: '育苗期',
          ec: '1.0',
          ph: '5.7',
          npk: '20-20-20',
          status: '在用',
          version: 1,
        },
      ];
      const recipe = state.data['gh-source'].records[0];

      const result = copyRecipeToGreenhouse(state, 'gh-source', 'gh-target', recipe);

      expect(result.data['gh-target'].records[0].id).not.toBe('rec-target-old');
      expect(result.data['gh-target'].records[1].id).toBe('rec-target-old');
    });
  });
});
