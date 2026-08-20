// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/bangji_yang/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "Selected publications and preprints.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/bangji_yang/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Research systems and directions.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/bangji_yang/projects/";
          },
        },{id: "nav-cv",
          title: "CV",
          description: "A compact CV generated from the current site data. The PDF icon links to the full CV.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/bangji_yang/cv/";
          },
        },{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/bangji_yang/books/the_godfather/";
            },},{id: "news-i-started-the-mscs-program-at-uiuc-and-joined-prof-ge-liu-s-group-as-a-graduate-research-assistant",
          title: 'I started the MSCS program at UIUC and joined Prof. Ge Liu’s group...',
          description: "",
          section: "News",},{id: "news-we-released-m3-a-multi-modal-multi-agent-multi-round-visual-reasoning-framework-for-text-to-image-generation",
          title: 'We released M3, a multi-modal, multi-agent, multi-round visual reasoning framework for text-to-image generation....',
          description: "",
          section: "News",},{id: "news-our-work-batched-contextual-reinforcement-is-available-as-an-icml-2026-paper-and-arxiv-preprint",
          title: 'Our work Batched Contextual Reinforcement is available as an ICML 2026 paper and...',
          description: "",
          section: "News",},{id: "projects-batched-contextual-reinforcement",
          title: 'Batched Contextual Reinforcement',
          description: "A task-scaling law for efficient LLM reasoning.",
          section: "Projects",handler: () => {
              window.location.href = "/bangji_yang/projects/1_project/";
            },},{id: "projects-m3",
          title: 'M3',
          description: "Multi-modal, multi-agent, multi-round visual reasoning for text-to-image generation.",
          section: "Projects",handler: () => {
              window.location.href = "/bangji_yang/projects/2_project/";
            },},{id: "projects-mutatlas",
          title: 'MutAtlas',
          description: "A PDB-wide energy-guided atlas of protein mutation effects.",
          section: "Projects",handler: () => {
              window.location.href = "/bangji_yang/projects/3_project/";
            },},{id: "projects-confrover",
          title: 'ConfRover',
          description: "Autoregressive modeling of protein conformation and dynamics.",
          section: "Projects",handler: () => {
              window.location.href = "/bangji_yang/projects/4_project/";
            },},{id: "teachings-data-science-fundamentals",
          title: 'Data Science Fundamentals',
          description: "This course covers the foundational aspects of data science, including data collection, cleaning, analysis, and visualization. Students will learn practical skills for working with real-world datasets.",
          section: "Teachings",handler: () => {
              window.location.href = "/bangji_yang/teachings/data-science-fundamentals/";
            },},{id: "teachings-introduction-to-machine-learning",
          title: 'Introduction to Machine Learning',
          description: "This course provides an introduction to machine learning concepts, algorithms, and applications. Students will learn about supervised and unsupervised learning, model evaluation, and practical implementations.",
          section: "Teachings",handler: () => {
              window.location.href = "/bangji_yang/teachings/introduction-to-machine-learning/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/bangji_yang/assets/pdf/bangji_yang_cv.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%62%61%6E%67%6A%69%79%32@%69%6C%6C%69%6E%6F%69%73.%65%64%75", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/Islet-Yang", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/bangji-yang-974b7937b", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
