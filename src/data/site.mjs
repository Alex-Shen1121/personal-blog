export const site = {
  title: '沈晨玙｜个人主页与博客',
  shortName: '沈晨玙',
  description:
    '沈晨玙的个人主页与博客，记录产品、设计、工程和生活观察，分享正在做的项目、近期近况与长期思考。',
  seo: {
    home: {
      title: '沈晨玙｜个人主页、项目与博客',
      description: '沈晨玙的个人主页与博客，集中展示个人介绍、项目案例、文章与近期近况。'
    },
    blog: {
      title: '博客文章｜产品、设计与前端体验｜沈晨玙',
      description: '沈晨玙的博客文章列表，记录产品、设计、前端体验与内容系统的思考。'
    },
    tags: {
      title: '文章标签导航｜沈晨玙',
      description: '按标签浏览博客文章，快速查看不同主题下的写作内容。'
    },
    categories: {
      title: '文章分类导航｜沈晨玙',
      description: '按分类浏览博客文章，查看不同主题方向下的内容归档。'
    },
    series: {
      title: '文章系列导航｜沈晨玙',
      description: '按系列顺序浏览博客文章，适合连续阅读同一主题。'
    },
    archive: {
      title: '文章归档｜时间线浏览｜沈晨玙',
      description: '按发布时间归档浏览全部博客文章。'
    },
    notFound: {
      title: '页面未找到｜沈晨玙',
      description: '你访问的页面不存在，可以返回首页继续浏览文章、项目与近况。'
    },
    robots: {
      default: 'index,follow,max-image-preview:large',
      notFound: 'noindex,follow'
    }
  },
  siteUrl: 'https://alex-shen1121.github.io/personal-blog/',
  repoBasePath: '/personal-blog/',
  brand: {
    favicon: '/favicon.svg',
    ogImage: '/og-cover.svg'
  },
  rss: {
    path: '/rss.xml',
    title: '沈晨玙博客 RSS 订阅',
    description: '订阅沈晨玙的博客更新，持续获取最新文章与长期写作内容。'
  },
  emailSubscription: {
    title: '邮件订阅',
    description:
      '如果你不看 RSS，也可以通过邮件接收更新。给我发一封订阅邮件后，我会把你加入文章更新提醒名单；只会在发布新文章或重要站点更新时发送。',
    ctaLabel: '发邮件订阅',
    note: '建议直接使用预填好的邮件标题，方便我快速处理。',
    subject: '订阅博客更新',
    body: '你好，我想订阅你的博客更新邮件提醒。\n\n我的邮箱：\n我主要关注的内容方向：\n'
  },
  license: {
    name: 'MIT License',
    url: 'https://github.com/Alex-Shen1121/personal-blog/blob/main/LICENSE'
  },
  changelog: {
    name: 'CHANGELOG',
    url: 'https://github.com/Alex-Shen1121/personal-blog/blob/main/CHANGELOG.md'
  },
  author: {
    name: '沈晨玙',
    role: '产品与前端体验设计实践者',
    email: 'alex@example.com',
    city: '杭州 / Remote',
    intro:
      '我在做的事情，通常都落在产品理解、交互体验与前端实现的交叉点。喜欢把复杂问题拆到足够清晰，再把细节打磨到足够顺手。',
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/Alex-Shen1121',
        kind: 'social',
        meta: '@Alex-Shen1121',
        description: '看项目代码、提交记录和站点迭代。'
      },
      {
        label: '即刻',
        url: 'https://okjk.co/',
        kind: 'social',
        meta: '轻量更新',
        description: '更轻量地同步近况、观察和正在做的事。'
      },
      {
        label: '邮箱',
        url: 'mailto:alex@example.com',
        kind: 'contact',
        meta: '直接联系',
        description: '合作、交流或想打个招呼，都可以直接发邮件。'
      }
    ]
  },
  navigation: [
    { label: '首页', href: '/' },
    { label: '关于', href: '/about/' },
    { label: '项目', href: '/projects/' },
    { label: '文章', href: '/blog/' },
    { label: '近况', href: '/now/' }
  ]
};

export const home = {
  hero: {
    eyebrow: '个人主页 / 博客 / 长期更新中',
    title: '把想法做成可用、可感知、可持续迭代的产品体验。',
    positioning: '我是一名聚焦内容产品、品牌表达与前端体验的产品 / 前端实践者。',
    description:
      '这里是沈晨玙的线上据点。我会在这里整理自己的工作方法、记录正在推进的项目，也留一点空间给日常观察与阶段性思考。希望它像一张持续生长的个人名片，而不是一次性的 landing page。',
    primaryCta: { label: '查看文章', href: '/blog/' },
    secondaryCta: { label: '了解我在做什么', href: '/about/' },
    metrics: [
      { value: '6+', label: '年持续做 Web 产品' },
      { value: '12', label: '个完整交付项目经验' },
      { value: '长期', label: '写作与内容整理习惯' }
    ]
  },
  coreCta: {
    eyebrow: '接下来可以直接去看',
    title: '如果你想快速了解我，建议从这三个入口开始。',
    description: '我把首页保留得尽量克制，所以把最常用的去向集中在这里：先看文章判断我的思考方式，再看项目理解做事方法，最后决定要不要继续联系。',
    actions: [
      {
        label: '先看文章',
        href: '/blog/',
        note: '从写作判断我的关注点与表达方式。',
        variant: 'primary'
      },
      {
        label: '看项目方向',
        href: '/projects/',
        note: '快速浏览我正在持续打磨的主题。',
        variant: 'secondary'
      },
      {
        label: '直接联系',
        href: 'mailto:alex@example.com',
        note: '适合合作、交流或简单打个招呼。',
        variant: 'ghost'
      }
    ]
  },
  navigationGuide: {
    eyebrow: '导航导览',
    title: '先看首页，再按主题进入对应页面，会更容易理解这个站点。',
    description: '我把首页保留为总览层，把独立页面作为展开层。这样第一次访问时可以先扫一遍结构，再决定往哪个方向深入。',
    groups: [
      {
        title: '先在首页快速浏览',
        items: [
          { label: '关于我', href: '#about', note: '快速理解我的工作方式与关注点。' },
          { label: '技能 / 技术栈', href: '#skills', note: '看我擅长的问题类型与常用能力组合。' },
          { label: '精选项目', href: '#projects', note: '先看当前重点与长期投入的项目方向。' },
          { label: '精选文章', href: '#blog', note: '通过写作判断我的表达方式与思考路径。' },
          { label: '时间线近况', href: '#now', note: '快速了解我最近在推进什么。' }
        ]
      },
      {
        title: '再进入独立页面展开看',
        items: [
          { label: '关于', href: '/about/', note: '看完整介绍、工作偏好与关注领域。' },
          { label: '项目', href: '/projects/', note: '集中浏览项目主题与案例方向。' },
          { label: '文章', href: '/blog/', note: '查看全部文章与详细内容。' },
          { label: '近况', href: '/now/', note: '查看更完整的阶段性记录。' }
        ]
      }
    ]
  },
  highlights: [
    {
      title: '我擅长的事',
      text: '把模糊需求整理成结构清楚、节奏舒服、能被快速验证的页面与产品原型。'
    },
    {
      title: '我在意的事',
      text: '界面不只要“能用”，还要有秩序感、有语气、有值得留下来的细节。'
    },
    {
      title: '我持续在做的事',
      text: '写文章、整理知识、维护自己的项目库，让内容和作品都能复用、沉淀、继续长。'
    }
  ],
  about: [
    '我不是那种只盯着代码或只盯着设计的人，更喜欢在两者之间搭桥。一个页面为什么这样组织、一段文案为什么这样表达、一个交互为什么这样反馈，我都愿意花时间想清楚。',
    '这些年做过企业站、内容站、活动页和一些偏产品型的小工具。越往后越觉得，好的体验不是“加很多东西”，而是把必要的东西做得更稳、更顺、更有分寸。'
  ],
  featuredProjects: {
    eyebrow: '精选项目',
    title: '这些是我现在持续投入、也最能代表做事方式的项目方向。',
    description: '我更在意项目背后的判断与推进方式，而不只是一个名字。所以首页先展示 1 个当前重点项目和 2 个长期主题，方便快速理解我在做什么。',
    primaryLabel: '当前重点',
    secondaryLabel: '长期主题',
    cta: { label: '查看全部项目', href: '/projects/' },
    items: [
      {
        title: '个人内容站升级计划',
        tag: '内容体系 / 静态站',
        status: { label: '持续迭代中', tone: 'active' },
        description: '把单页介绍站升级成可持续维护的内容站，补齐文章结构、信息架构与 SEO 基础设施。',
        highlights: ['首页结构重做', '文章系统补齐', '信息架构持续梳理'],
        href: '/projects/'
      },
      {
        title: '轻量级文档展示系统',
        tag: '前端工程 / 体验打磨',
        status: { label: '方案沉淀中', tone: 'planning' },
        description: '用更低复杂度的技术方案支持多页内容展示，兼顾部署稳定性与长期可维护性。',
        highlights: ['原生技术栈', '低维护成本'],
        href: '/projects/'
      },
      {
        title: '写作者工作流整理',
        tag: '方法论 / 内容生产',
        status: { label: '长期维护', tone: 'maintained' },
        description: '围绕选题、草稿、归档和复盘，构建一个适合个人长期使用的写作系统。',
        highlights: ['选题到归档', '内容复用机制'],
        href: '/now/'
      }
    ]
  },
  featuredPosts: {
    eyebrow: '精选文章',
    title: '先读这几篇，大概就能理解我最近在想什么。',
    description: '不按发布时间罗列，而是优先放更能代表当前关注点的内容：个人表达、界面判断，以及写作这件事为什么值得长期经营。',
    primaryLabel: '主推阅读',
    secondaryLabel: '延伸阅读'
  },
  updates: {
    eyebrow: '时间线近况',
    title: '最近这段时间，我主要在沿着这些节点往前推进。',
    description: '不做碎片动态流，而是保留几个更能代表阶段变化的更新，让第一次来到首页的人也能快速看懂我现在在做什么。',
    cta: { label: '查看完整近况页', href: '/now/' },
    items: [
      {
        date: '2026.03',
        label: '站点结构升级',
        summary: '正在补齐个人站的内容结构，让主页、文章、项目和近况能互相连接。',
        meta: ['首页重构', '内容架构']
      },
      {
        date: '2026.02',
        label: '表达风格校准',
        summary: '最近重新梳理了自己的设计偏好：更克制的层次、更自然的中文表达、更稳的交互细节。',
        meta: ['设计语言', '交互细节']
      },
      {
        date: '下一步',
        label: '项目案例补全',
        summary: '接下来会继续补充真实项目案例，把这里慢慢经营成一个能代表自己的长期空间。',
        meta: ['案例整理', '长期维护']
      }
    ]
  },
  skills: {
    eyebrow: '技能 / 技术栈',
    title: '我常用的能力组合，基本都围绕内容站、产品体验和前端落地展开。',
    description: '相比单纯罗列工具名，我更希望把“会什么”和“通常怎么用”一起呈现出来：既说明技术栈，也说明自己擅长处理的问题。',
    groups: [
      {
        title: '产品与体验',
        description: '擅长把模糊需求收敛成更清楚的信息结构、页面节奏和交互反馈。',
        items: ['信息架构梳理', '页面叙事设计', '交互节奏与文案细化']
      },
      {
        title: '前端实现',
        description: '偏好低复杂度但完整可维护的实现方式，优先保证结构清晰、上线稳定。',
        items: ['HTML / CSS / Vanilla JS', '响应式布局', '轻量静态站构建']
      },
      {
        title: '内容系统',
        description: '会把写作、展示、归档和复用一起考虑，让内容站能长期生长。',
        items: ['Markdown 内容组织', '信息模块规划', '文档驱动更新流程']
      }
    ],
    stackLabel: '日常使用工具',
    stack: ['Node.js 构建脚本', 'Git / GitHub', 'GitHub Actions', 'GitHub Pages', 'Figma', 'SEO 基础配置']
  },
  tools: ['HTML / CSS / Vanilla JS', 'GitHub Pages', '轻量脚本化内容生成', 'Figma / 文档驱动工作流']
};

export const pages = {
  about: {
    title: '关于我',
    description: '关于沈晨玙的工作方式、关注领域与做事偏好。',
    seo: {
      title: '关于沈晨玙｜工作方式、关注方向与做事偏好',
      description: '了解沈晨玙的工作方式、关注领域、项目判断与长期想做的内容方向。'
    },
    intro:
      '我偏爱那种既有逻辑、又有温度的数字产品。工作里常做的，是把目标、信息、交互和视觉统一到同一个叙事里。',
    sections: [
      {
        title: '我通常怎么工作',
        text: '先厘清信息结构，再收紧界面表达，最后把交互和实现一起对齐。这样做会慢一点进入，但后面会少很多返工。'
      },
      {
        title: '我关注哪些方向',
        text: '内容产品、个人品牌站、知识管理、前端体验优化，以及那些“看似简单、其实需要判断力”的交互细节。'
      },
      {
        title: '我希望作品呈现什么',
        text: '不是炫技，而是让使用者自然感受到：这件事被认真想过、被认真做过。'
      }
    ]
  },
  projects: {
    title: '项目',
    description: '近年持续在做或正在推进的一些项目方向。',
    seo: {
      title: '项目案例与长期主题｜沈晨玙',
      description: '查看沈晨玙正在推进或长期维护的项目方向，涵盖个人博客系统、页面叙事与写作工作流。'
    },
    intro:
      '这里放的不只是“做过什么”，也包括我正在打磨的方向、想继续深挖的问题，以及值得长期维护的主题。',
    items: [
      {
        slug: 'personal-blog-system',
        title: '个人主页与博客系统',
        seo: {
          title: '个人主页与博客系统｜静态内容站项目案例｜沈晨玙',
          description: '个人主页与博客系统项目详情，展示内容结构设计、构建脚本与 GitHub Pages 发布方案。'
        },
        category: '静态生成 / 内容优先',
        status: { label: '已上线并持续迭代', tone: 'live' },
        role: '产品规划 / 信息架构 / 前端实现',
        timeline: '2026.03 - 至今',
        focus: '文章系统、站点结构与长期维护成本控制',
        summary: '用最小但完整的静态方案支撑多页内容站，让写作、展示与后续迭代都更轻盈。',
        stack: ['HTML / CSS / JS', 'Node.js 构建脚本', 'GitHub Pages'],
        gallery: [
          {
            src: '/assets/project-personal-blog-home.svg',
            alt: '个人主页与博客系统首页改版后的桌面端演示图',
            caption: '首页强调个人定位、精选内容与项目入口，让访客第一次进入时更快理解站点结构。'
          },
          {
            src: '/assets/project-personal-blog-detail.svg',
            alt: '个人主页与博客系统项目详情页与文章系统的演示图',
            caption: '项目详情页补充状态、关键信息与案例说明，便于后续继续沉淀真实项目记录。'
          }
        ],
        href: '/blog/',
        linkLabel: '查看文章系统',
        externalLinks: [
          {
            label: '在线预览',
            href: 'https://alex-shen1121.github.io/personal-blog/'
          },
          {
            label: 'GitHub 仓库',
            href: 'https://github.com/Alex-Shen1121/personal-blog'
          }
        ],
        sections: [
          {
            title: '项目背景',
            text: '目标不是再做一个一次性的自我介绍页，而是把个人站升级成可持续更新的内容系统：文章、项目、近况和关于页要互相连起来，形成完整的信息结构。'
          },
          {
            title: '我主要负责什么',
            text: '从内容结构、导航层级、页面节奏到构建脚本与 GitHub Pages 部署，全部按“低复杂度、可长期维护”的思路重新收了一遍。'
          },
          {
            title: '当前进展',
            text: '已经补齐文章列表、标签分类、归档、搜索筛选等基础能力，接下来会继续往项目案例、SEO 和工程化校验上推进。'
          },
          {
            title: '环境与配置约定',
            text: '开发与 CI 统一以 Node.js 22 作为基线，仓库通过 .nvmrc 固定版本；项目当前不依赖运行时 .env，站点链接、仓库基路径、导航、作者信息和品牌资源都集中维护在 src/data/site.mjs，文章内容则放在 content/posts/。如果仓库名、域名或 Pages 路径变化，只需要同步调整 siteUrl 与 repoBasePath。'
          }
        ]
      },
      {
        slug: 'narrative-product-pages',
        title: '案例型产品介绍页',
        seo: {
          title: '案例型产品介绍页｜页面叙事项目方向｜沈晨玙',
          description: '案例型产品介绍页项目方向，聚焦品牌表达、信息节奏与克制的页面叙事设计。'
        },
        category: '品牌表达 / 页面叙事',
        status: { label: '持续打磨方法论', tone: 'active' },
        role: '页面策略 / 文案组织 / 视觉节奏',
        timeline: '长期项目',
        focus: '把复杂信息拆成更顺的阅读路径，并保留品牌气质',
        summary: '擅长把复杂信息拆成更顺的阅读节奏，在不吵闹的设计里建立可信度。',
        stack: ['信息架构', '叙事型页面设计', '轻量前端落地'],
        gallery: [
          {
            src: '/assets/project-narrative-product-page.svg',
            alt: '案例型产品介绍页的信息节奏与模块编排演示图',
            caption: '用更克制的层级、留白与模块切换，把品牌表达、信息解释和行动引导放到同一条阅读路径里。'
          }
        ],
        href: '/about/',
        linkLabel: '查看我的做事方式',
        sections: [
          {
            title: '项目目标',
            text: '这类页面通常要同时完成品牌表达、信息解释和行动转化，所以关键不是堆更多模块，而是把阅读顺序组织得足够自然。'
          },
          {
            title: '方法侧重点',
            text: '我会先拆出用户最关心的问题，再决定哪些信息先出现、哪些信息延后出现，让页面节奏服务理解，而不是只服务视觉热闹。'
          },
          {
            title: '为什么持续维护',
            text: '它既是一个项目方向，也是我长期校准“中文表达 + 页面叙事 + 前端落地”组合能力的练习场。'
          }
        ]
      },
      {
        slug: 'writing-workflow-system',
        title: '个人知识与写作工作流',
        seo: {
          title: '个人知识与写作工作流｜内容系统项目方向｜沈晨玙',
          description: '个人知识与写作工作流项目方向，围绕选题、草稿、归档与复用整理个人内容系统。'
        },
        category: '方法沉淀 / 长期复利',
        status: { label: '长期维护', tone: 'maintained' },
        role: '选题整理 / 内容归档 / 系统复盘',
        timeline: '持续演进',
        focus: '围绕选题、草稿、归档与再利用建立个人内容系统',
        summary: '围绕选题、草稿、归档与再利用，形成适合个人创作者的内容系统。',
        stack: ['Markdown', '知识归档', '内容复用'],
        gallery: [
          {
            src: '/assets/project-writing-workflow-board.svg',
            alt: '个人知识与写作工作流的阶段看板演示图',
            caption: '把选题、草稿、发布与复盘拆成更稳定的阶段，方便长期维护内容生产节奏。'
          }
        ],
        href: '/now/',
        linkLabel: '查看近期推进',
        sections: [
          {
            title: '核心问题',
            text: '很多写作流程的问题并不出在写不出来，而是写完以后没法归档、复用，也很难把零散内容重新串成一个系统。'
          },
          {
            title: '当前做法',
            text: '我会把选题、草稿、正式发布和后续回看拆成几个更稳定的阶段，每个阶段都尽量用低成本工具承接。'
          },
          {
            title: '长期价值',
            text: '它会反过来支撑博客、项目说明和个人表达，让内容不是一次性输出，而是逐步变成自己的方法库。'
          }
        ]
      }
    ]
  },
  blog: {
    title: '文章',
    description: '围绕产品、设计、前端体验与内容系统的写作。',
    seo: {
      title: '博客文章｜产品、设计与前端体验｜沈晨玙',
      description: '沈晨玙的博客文章列表，记录产品、设计、前端体验与内容系统的思考。'
    },
    intro: '这里会持续整理我关于内容、产品体验和工作方法的思考。当前版本已支持 Markdown 驱动的文章生成。'
  },
  now: {
    title: '近况',
    description: '我近期正在关注与推进的事情。',
    seo: {
      title: '近期近况与阶段性推进｜沈晨玙',
      description: '查看沈晨玙最近在推进的项目、设计观察与阶段性记录。'
    },
    intro:
      '这个页面用来记录阶段性的关注点，像一张会更新的工作便签。它不追求完整，但会尽量保持真实。',
    items: [
      '在整理自己的项目表达方式，希望每个项目都能说明“问题是什么、为什么这样做、结果如何”。',
      '重新看了一轮优秀个人网站，发现真正耐看的往往不是堆元素，而是结构、间距、语气都拿捏得很稳。',
      '给自己定了一个小目标：稳定写作，哪怕篇幅不长，也持续输出能代表当前判断的内容。'
    ]
  }
};
