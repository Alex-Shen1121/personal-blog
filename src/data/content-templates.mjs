export const contentTemplates = [
  {
    key: 'insight',
    slug: 'insight',
    name: '观点文章',
    nameEn: 'Insight essay',
    description: '围绕一个清晰判断展开，适合产品、设计、个人表达与经验总结类写作。',
    summary: '先给出观点，再解释为什么成立，最后收束到一个更稳的结论。',
    outline: ['问题切入', '核心判断', '展开论证', '结尾收束'],
    recommendedFor: ['设计判断', '个人表达', '产品观察']
  },
  {
    key: 'playbook',
    slug: 'playbook',
    name: '方法清单',
    nameEn: 'Playbook',
    description: '把经验整理成步骤、原则和检查项，适合流程型、方法型内容。',
    summary: '强调结构和复用性，让一篇内容可以反复作为行动参考。',
    outline: ['适用场景', '核心原则', '操作步骤', '检查项 / 下一步'],
    recommendedFor: ['写作流程', '知识管理', '工作方法']
  },
  {
    key: 'field-note',
    slug: 'field-note',
    name: '阶段记录',
    nameEn: 'Field note',
    description: '记录最近在做什么、改了什么、学到了什么，适合迭代日志与项目阶段复盘。',
    summary: '用较轻的结构保留上下文，方便后续继续补写与串联。',
    outline: ['当前背景', '本次变化', '关键观察', '后续动作'],
    recommendedFor: ['项目迭代', '版本记录', '阶段总结']
  }
];

export const contentTemplateMap = new Map(contentTemplates.map((template) => [template.key, template]));
export const contentTemplateKeys = new Set(contentTemplates.map((template) => template.key));

export const getContentTemplate = (key = '') => contentTemplateMap.get(String(key).trim()) ?? null;
