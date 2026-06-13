const recipeTemplates = [
  {
    id: 'tomato-seedling',
    crop: '番茄',
    name: '番茄 · 育苗期',
    stage: '育苗期',
    ec: '1.2',
    ph: '5.8',
    npk: '20-20-20',
    memo: '通用均衡肥，子叶展开后开始施用，浓度逐步提高'
  },
  {
    id: 'tomato-vegetative',
    crop: '番茄',
    name: '番茄 · 营养生长期',
    stage: '营养生长期',
    ec: '1.8',
    ph: '5.8',
    npk: '18-10-22',
    memo: '高氮促茎叶，注意钙镁补充防止脐腐病'
  },
  {
    id: 'tomato-flowering',
    crop: '番茄',
    name: '番茄 · 开花期',
    stage: '开花期',
    ec: '2.2',
    ph: '5.8',
    npk: '15-5-30',
    memo: '高钾配方，夜温低时降低浓度，防止徒长'
  },
  {
    id: 'tomato-fruiting',
    crop: '番茄',
    name: '番茄 · 结果期',
    stage: '结果期',
    ec: '2.5',
    ph: '5.7',
    npk: '12-8-36',
    memo: '高钾膨果，增补钙硼，EC过高会导致绿肩果'
  },
  {
    id: 'lettuce-seedling',
    crop: '生菜',
    name: '生菜 · 育苗期',
    stage: '育苗期',
    ec: '0.8',
    ph: '6.0',
    npk: '20-20-20',
    memo: '低盐分育苗，防止烧苗，真叶2片后加量'
  },
  {
    id: 'lettuce-vegetative',
    crop: '生菜',
    name: '生菜 · 营养生长期',
    stage: '营养生长期',
    ec: '1.4',
    ph: '6.0',
    npk: '8-15-36',
    memo: '适合水培槽第3周，高硝态氮促叶片生长'
  },
  {
    id: 'lettuce-flowering',
    crop: '生菜',
    name: '生菜 · 开花期',
    stage: '开花期',
    ec: '1.5',
    ph: '6.0',
    npk: '12-8-24',
    memo: '抽薹前期适当控氮，保持叶片紧凑并降低苦味'
  },
  {
    id: 'lettuce-heading',
    crop: '生菜',
    name: '生菜 · 结球期',
    stage: '结球期',
    ec: '1.6',
    ph: '5.9',
    npk: '10-12-28',
    memo: '结球紧实期，适当增钾，温度高时降EC'
  },
  {
    id: 'strawberry-seedling',
    crop: '草莓',
    name: '草莓 · 育苗期',
    stage: '育苗期',
    ec: '1.0',
    ph: '5.8',
    npk: '20-20-20',
    memo: '假植期用低浓度，促根为主'
  },
  {
    id: 'strawberry-vegetative',
    crop: '草莓',
    name: '草莓 · 营养生长期',
    stage: '营养生长期',
    ec: '1.4',
    ph: '5.7',
    npk: '16-8-24',
    memo: '定植后缓苗结束开始，促花芽分化'
  },
  {
    id: 'strawberry-flowering',
    crop: '草莓',
    name: '草莓 · 开花期',
    stage: '开花期',
    ec: '1.6',
    ph: '5.7',
    npk: '14-6-26',
    memo: '花期补硼，白天温度20-25℃利于授粉'
  },
  {
    id: 'strawberry-fruiting',
    crop: '草莓',
    name: '草莓 · 结果期',
    stage: '结果期',
    ec: '1.8',
    ph: '5.7',
    npk: '12-6-28',
    memo: '补钙镁，观察叶缘，EC偏高会加重白粉病'
  },
  {
    id: 'cucumber-seedling',
    crop: '黄瓜',
    name: '黄瓜 · 育苗期',
    stage: '育苗期',
    ec: '1.0',
    ph: '5.8',
    npk: '20-20-20',
    memo: '子叶期保持湿润，一叶一心后提浓度'
  },
  {
    id: 'cucumber-vegetative',
    crop: '黄瓜',
    name: '黄瓜 · 营养生长期',
    stage: '营养生长期',
    ec: '1.8',
    ph: '5.8',
    npk: '16-8-24',
    memo: '促蔓生长，注意控旺，蹲苗期适当控水'
  },
  {
    id: 'cucumber-flowering',
    crop: '黄瓜',
    name: '黄瓜 · 开花期',
    stage: '开花期',
    ec: '2.2',
    ph: '5.7',
    npk: '14-6-28',
    memo: '瓜码密期增钾，防止化瓜'
  },
  {
    id: 'cucumber-fruiting',
    crop: '黄瓜',
    name: '黄瓜 · 结果期',
    stage: '结果期',
    ec: '2.4',
    ph: '5.7',
    npk: '12-6-32',
    memo: '盛瓜期高钾，注意钙硼同补防畸形瓜'
  },
  {
    id: 'pepper-seedling',
    crop: '辣椒',
    name: '辣椒 · 育苗期',
    stage: '育苗期',
    ec: '1.0',
    ph: '5.9',
    npk: '20-20-20',
    memo: '苗期喜温，保持地温18℃以上'
  },
  {
    id: 'pepper-vegetative',
    crop: '辣椒',
    name: '辣椒 · 营养生长期',
    stage: '营养生长期',
    ec: '1.6',
    ph: '5.9',
    npk: '16-10-22',
    memo: '分枝期增磷促根，门椒坐住前控水'
  },
  {
    id: 'pepper-flowering',
    crop: '辣椒',
    name: '辣椒 · 开花期',
    stage: '开花期',
    ec: '2.0',
    ph: '5.8',
    npk: '14-6-26',
    memo: '花期高温易落花，注意遮阳通风'
  },
  {
    id: 'pepper-fruiting',
    crop: '辣椒',
    name: '辣椒 · 结果期',
    stage: '结果期',
    ec: '2.3',
    ph: '5.8',
    npk: '12-6-30',
    memo: '彩椒转色期增钾，氮肥过多推迟转色'
  },
  {
    id: 'watermelon-seedling',
    crop: '西瓜',
    name: '西瓜 · 育苗期',
    stage: '育苗期',
    ec: '1.0',
    ph: '6.0',
    npk: '20-20-20',
    memo: '嫁接苗接口愈合前控湿，成活后加肥'
  },
  {
    id: 'watermelon-vegetative',
    crop: '西瓜',
    name: '西瓜 · 营养生长期',
    stage: '营养生长期',
    ec: '1.8',
    ph: '6.0',
    npk: '16-10-22',
    memo: '伸蔓期促蔓生长，整枝打杈后追肥'
  },
  {
    id: 'watermelon-flowering',
    crop: '西瓜',
    name: '西瓜 · 开花期',
    stage: '开花期',
    ec: '2.0',
    ph: '5.9',
    npk: '14-8-26',
    memo: '坐瓜节位雌花开放时控水，人工辅助授粉'
  },
  {
    id: 'watermelon-fruiting',
    crop: '西瓜',
    name: '西瓜 · 结果期',
    stage: '结果期',
    ec: '2.4',
    ph: '5.9',
    npk: '10-6-36',
    memo: '膨瓜期高钾大水，采收前7天控水增糖'
  }
];

const cropOptions = [...new Set(recipeTemplates.map((t) => t.crop))];

export { recipeTemplates, cropOptions };
export default recipeTemplates;
