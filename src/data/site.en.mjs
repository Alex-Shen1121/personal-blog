export const siteEn = {
  title: 'Alex Shen | Personal Site & Blog',
  shortName: 'Alex Shen',
  description:
    'Alex Shen’s personal site and blog about product thinking, design, frontend experience, and long-term content systems.',
  brandMark: 'A',
  seo: {
    home: {
      title: 'Alex Shen | Personal site, projects, and blog',
      description: 'A lightweight personal site about product work, project thinking, and writing.'
    },
    blog: {
      title: 'Blog | Product, design, and frontend experience | Alex Shen',
      description: 'English entry for Alex Shen’s blog, with translated posts and selected writing.'
    }
  },
  navigation: [
    { label: 'Home', href: '/en/' },
    { label: 'About', href: '/en/about/' },
    { label: 'Projects', href: '/en/projects/' },
    { label: 'Blog', href: '/en/blog/' },
    { label: 'Now', href: '/en/now/' }
  ],
  author: {
    name: 'Alex Shen',
    role: 'Product & frontend experience practitioner',
    email: 'alex@example.com',
    city: 'Hangzhou / Remote',
    intro:
      'My work usually sits at the intersection of product thinking, interaction design, and frontend implementation. I like turning vague complexity into clear structure, then polishing the details until the experience feels natural.',
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/Alex-Shen1121',
        kind: 'social'
      },
      {
        label: 'Jike',
        url: 'https://okjk.co/',
        kind: 'social'
      },
      {
        label: 'Email',
        url: 'mailto:alex@example.com',
        kind: 'contact'
      }
    ]
  },
  announcement: {
    eyebrow: 'Site update',
    badge: 'Spring 2026',
    title: 'The site now includes RSS, email subscription, analytics, feedback entry, and an English experience.',
    description:
      'I am still iterating on the structure and content depth, but the multilingual foundation is now in place for core pages and selected posts.',
    meta: ['Bilingual entry available', 'GitHub Pages deployed', 'Still evolving'],
    primaryAction: {
      label: 'View changelog',
      href: 'https://github.com/Alex-Shen1121/personal-blog/blob/main/CHANGELOG.md'
    },
    secondaryAction: {
      label: 'Read the blog',
      href: '/en/blog/'
    }
  },
  emailSubscription: {
    title: 'Email subscription',
    description:
      'If RSS is not your thing, you can subscribe by email. I will only send updates for new posts or meaningful site changes.',
    ctaLabel: 'Subscribe by email',
    note: 'The subject line is prefilled so I can process it quickly.',
    subject: 'Subscribe to blog updates',
    body: 'Hi, I would like to subscribe to your blog updates.\n\nMy email:\nTopics I care about:\n'
  },
  feedback: {
    title: 'Feedback',
    description:
      'If you spot an error, want to ask a follow-up question, or hope I write more about a topic, feel free to send feedback.',
    note: 'Good for corrections, feature ideas, topic requests, or simple notes after reading.',
    email: {
      label: 'Send feedback by email',
      subject: 'Blog feedback',
      body: 'Hi, I would like to share some thoughts about the blog or site.\n\nPage URL:\nFeedback:\nTopics I would like to read next (optional):\nContact info (optional):\n'
    },
    issue: {
      label: 'Open a GitHub issue',
      url: 'https://github.com/Alex-Shen1121/personal-blog/issues/new'
    },
    footerLabel: 'Feedback'
  },
  home: {
    hero: {
      eyebrow: 'Personal site / blog / work in progress',
      title: 'Turning ideas into product experiences that are clear, usable, and sustainable.',
      description:
        'This is the English entry of my personal site. I use it to document projects, writing, and the way I think about content, interface quality, and implementation.',
      primaryCta: { label: 'Read the blog', href: '/en/blog/' },
      secondaryCta: { label: 'About me', href: '/en/about/' },
      metrics: [
        { value: '6+', label: 'years building web products' },
        { value: '12', label: 'projects delivered end to end' },
        { value: 'Long-term', label: 'writing and content habit' }
      ]
    },
    sections: {
      aboutTitle: 'What I do',
      aboutText:
        'I focus on the overlap between product structure, brand expression, and frontend experience. I care less about visual noise and more about whether a page helps people understand, trust, and continue.',
      postsTitle: 'Selected writing',
      postsText: 'A few translated posts to quickly understand how I think and work.',
      projectsTitle: 'Project directions',
      projectsText: 'Long-term themes I keep refining, instead of one-off portfolio snapshots.'
    }
  },
  pages: {
    about: {
      title: 'About',
      description: 'How I work, what I pay attention to, and what kind of products I like to build.',
      intro:
        'I like digital products that feel both logical and humane. Most of my work is about aligning goals, information, interaction, and visual rhythm into one coherent story.',
      sections: [
        {
          title: 'How I usually work',
          text: 'I start by clarifying information structure, then tighten the interface expression, and finally align interaction with implementation. It takes a little longer up front, but saves a lot of rework later.'
        },
        {
          title: 'What I care about',
          text: 'Content products, personal brand sites, knowledge systems, frontend experience refinement, and those seemingly simple interactions that actually need judgment.'
        },
        {
          title: 'What I want my work to feel like',
          text: 'Not flashy for its own sake, but thoughtful enough that people can feel it was seriously considered and carefully made.'
        }
      ]
    },
    projects: {
      title: 'Projects',
      description: 'A few long-term project directions I keep refining.',
      intro:
        'This page is less about listing everything I have done and more about showing the themes I continue to invest in.',
      items: [
        {
          title: 'Personal site & blog system',
          summary:
            'A lightweight static setup for writing, showcasing work, and iterating without unnecessary maintenance cost.',
          href: '/en/blog/'
        },
        {
          title: 'Narrative product pages',
          summary:
            'Turning complex information into smoother reading paths while keeping the page calm and trustworthy.',
          href: '/en/about/'
        },
        {
          title: 'Writing workflow system',
          summary:
            'A practical content workflow around capture, drafting, publishing, and long-term reuse.',
          href: '/en/now/'
        }
      ]
    },
    blog: {
      title: 'Blog',
      description: 'Translated posts and selected writing in English.',
      intro:
        'This English section currently includes translated core posts. The Chinese site remains the fuller source of truth while the bilingual structure keeps expanding.'
    },
    now: {
      title: 'Now',
      description: 'A short snapshot of what I am focusing on lately.',
      intro:
        'This page is a lightweight log of current themes. It is not meant to be complete, only current and honest.',
      items: [
        'Refining how projects are explained so each one can answer: what problem was addressed, why this direction was chosen, and what result it created.',
        'Reviewing excellent personal sites again and noticing that the strongest ones are rarely loud; they are usually clear, measured, and well paced.',
        'Keeping a small promise to myself: write consistently, even when the pieces are short, as long as they reflect my current judgment.'
      ]
    }
  },
  ui: {
    skipToContent: 'Skip to content',
    toggleTheme: 'Toggle theme',
    openNavigation: 'Open navigation',
    backToTop: 'Back to top',
    footerSite: 'Site',
    footerLinks: 'Links',
    footerMeta: 'Built as a lightweight static site and updated continuously.',
    readMore: 'Read more',
    readPost: 'Read post',
    languageSwitchLabel: '中文',
    rssLabel: 'RSS',
    emailLabel: 'Email subscription'
  }
};
