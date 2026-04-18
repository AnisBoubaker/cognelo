"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export const locales = ["en", "fr", "zh"] as const;
export type Locale = (typeof locales)[number];

type MessageTree = {
  [key: string]: string | MessageTree;
};

const messages: Record<Locale, MessageTree> = {
  en: {
    locale: {
      label: "Language",
      en: "English",
      fr: "Français",
      zh: "中文"
    },
    common: {
      add: "Add",
      cancel: "Cancel",
      close: "Close",
      create: "Create",
      download: "Download",
      edit: "Edit",
      loading: "Loading...",
      logout: "Logout",
      noDescription: "No description yet.",
      open: "Open",
      remove: "Remove",
      redirecting: "Redirecting...",
      save: "Save",
      saving: "Saving..."
    },
    nav: {
      dashboard: "Dashboard",
      courses: "Courses",
      newCourse: "New course",
      account: "Account",
      accountMenu: "Open account menu"
    },
    status: {
      draft: "Draft",
      published: "Published",
      archived: "Archived"
    },
    roles: {
      admin: "Admin",
      teacher: "Teacher",
      student: "Student"
    },
    activityLifecycle: {
      draft: "Draft",
      published: "Published",
      paused: "Paused",
      archived: "Archived"
    },
    materialKinds: {
      folder: "Folder",
      text: "Text",
      markdown: "Markdown",
      pdf: "PDF",
      link: "Link",
      github_repo: "GitHub repo",
      code_example: "Code example",
      dataset: "Dataset",
      file: "File",
      module: "Module"
    },
    login: {
      title: "Sign in",
      subtitle: "Use the seeded teacher account to create courses and activities.",
      email: "Email",
      password: "Password",
      submit: "Sign in",
      submitting: "Signing in...",
      error: "Login failed."
    },
    dashboard: {
      eyebrow: "Dashboard",
      welcome: "Welcome back",
      roles: "Roles: {roles}",
      coursesEyebrow: "Courses",
      coursesTitle: "Manage learning spaces",
      coursesText: "Create, publish, archive, and open the course workspace.",
      activitiesEyebrow: "Activities",
      activitiesTitle: "Plugin-ready foundation",
      activitiesText: "Attach placeholders now, then add homework graders, quizzes, and tutoring modules later.",
      researchEyebrow: "Research",
      researchTitle: "Metadata first",
      researchText: "Activities carry configurable metadata from the start."
    },
    courses: {
      eyebrow: "Courses",
      title: "Course workspace",
      create: "Create course",
      emptyDescription: "No description yet.",
      activityCount: "{count} activities",
      loadError: "Unable to load courses."
    },
    courseForm: {
      title: "Title",
      description: "Description",
      status: "Publication status",
      create: "Create course",
      save: "Save course",
      saveError: "Unable to save course."
    },
    newCourse: {
      eyebrow: "New course",
      title: "Create a course"
    },
    editCourse: {
      eyebrow: "Edit course",
      fallbackTitle: "Course",
      loadError: "Unable to load course."
    },
    courseDetail: {
      defaultActivityTitle: "Placeholder activity",
      defaultFolderTitle: "New folder",
      defaultRepoTitle: "GitHub repository",
      edit: "Edit",
      loadError: "Unable to load course.",
      activitiesEyebrow: "Activities",
      activitiesTitle: "Attached activities",
      noActivities: "No activities yet.",
      activityShellEyebrow: "Activity shell",
      activityShellTitle: "Add activity",
      activityTitle: "Title",
      activityType: "Type",
      attachActivity: "Attach activity",
      createActivityError: "Unable to create activity.",
      materialsEyebrow: "Materials",
      materialsTitle: "Course material",
      addMaterial: "Add material",
      noMaterials: "No materials yet.",
      source: "Source",
      location: "Location",
      topLevel: "Top level",
      githubUrl: "GitHub repository URL",
      file: "File",
      maxFileSize: "Maximum file size: 25 MB.",
      addMaterialSubmit: "Add material",
      addMaterialError: "Unable to add material.",
      chooseFile: "Choose a file to upload.",
      folderTitlePlaceholder: "Folder title",
      fileTitlePlaceholder: "Uses file name if blank",
      repoTitlePlaceholder: "Repository title",
      metadataOnly: "Metadata only",
      removeConfirm: 'Remove "{title}" from this course?',
      removeError: "Unable to remove material.",
      updateError: "Unable to update material.",
      moveError: "Unable to move material.",
      invalidFolderMove: "A folder cannot be moved inside one of its own children.",
      titleHeader: "Title",
      typeHeader: "Type",
      sourceHeader: "Source",
      actionsHeader: "Actions",
      saveMaterial: "Save material",
      githubEditLabel: "GitHub repository URL",
      openMaterial: "Open {title}",
      downloadMaterial: "Download {title}",
      editMaterial: "Edit {title}",
      removeMaterial: "Remove {title}",
      dragMaterial: "Drag {title}",
      dragToMove: "Drag to move",
      expandFolder: "Expand {title}",
      collapseFolder: "Collapse {title}",
      expandFolderTitle: "Expand folder",
      collapseFolderTitle: "Collapse folder",
      moveToTopLevel: "Drop here to move to top level",
      openActivity: "Open activity",
      removeActivity: "Remove activity",
      removeActivityConfirm: 'Remove activity "{title}" from this course?',
      removeActivityError: "Unable to remove activity."
    },
    parsons: {
      eyebrow: "Parsons problem",
      title: "Parsons problem",
      inCourse: "In course: {title}",
      backToCourse: "Back to course",
      loadError: "Unable to load activity.",
      authoringEyebrow: "Teacher setup",
      authoringTitle: "Configure the problem",
      activityTitle: "Activity title",
      activityDescription: "Activity description",
      prompt: "Prompt",
      solution: "Reference solution",
      language: "Language",
      stripIndentation: "Remove indentation from the student version",
      previewEyebrow: "Preview",
      previewTitle: "Generated scrambled blocks",
      previewText: "These blocks are generated from the reference solution and shown to the student in scrambled order.",
      saved: "Parsons problem saved.",
      saveError: "Unable to save the Parsons problem.",
      studentEyebrow: "Student workspace",
      studentTitle: "Rebuild the solution",
      reset: "Reset blocks",
      check: "Check answer",
      keyboardHint: "Click a line to activate it, then use the arrow keys to move it. Click again to deactivate it.",
      correct: "Correct. The program order and indentation are both right.",
      orderFeedback: "{count} block(s) are still out of order.",
      indentFeedback: "{count} block(s) still need indentation changes.",
      moveUp: "Move block up",
      moveDown: "Move block down",
      indent: "Indent block",
      outdent: "Outdent block",
      unsupportedTitle: "Activity view not available",
      unsupportedText: "This screen currently supports Parsons problems."
    }
  },
  fr: {
    locale: {
      label: "Langue",
      en: "English",
      fr: "Français",
      zh: "中文"
    },
    common: {
      add: "Ajouter",
      cancel: "Annuler",
      close: "Fermer",
      create: "Créer",
      download: "Télécharger",
      edit: "Modifier",
      loading: "Chargement...",
      logout: "Se déconnecter",
      noDescription: "Aucune description pour le moment.",
      open: "Ouvrir",
      remove: "Supprimer",
      redirecting: "Redirection...",
      save: "Enregistrer",
      saving: "Enregistrement..."
    },
    nav: {
      dashboard: "Tableau de bord",
      courses: "Cours",
      newCourse: "Nouveau cours",
      account: "Compte",
      accountMenu: "Ouvrir le menu du compte"
    },
    status: {
      draft: "Brouillon",
      published: "Publié",
      archived: "Archivé"
    },
    roles: {
      admin: "Admin",
      teacher: "Enseignant",
      student: "Étudiant"
    },
    activityLifecycle: {
      draft: "Brouillon",
      published: "Publié",
      paused: "En pause",
      archived: "Archivé"
    },
    materialKinds: {
      folder: "Dossier",
      text: "Texte",
      markdown: "Markdown",
      pdf: "PDF",
      link: "Lien",
      github_repo: "Dépôt GitHub",
      code_example: "Exemple de code",
      dataset: "Jeu de données",
      file: "Fichier",
      module: "Module"
    },
    login: {
      title: "Connexion",
      subtitle: "Utilisez le compte enseignant initial pour créer des cours et des activités.",
      email: "Courriel",
      password: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion...",
      error: "Échec de la connexion."
    },
    dashboard: {
      eyebrow: "Tableau de bord",
      welcome: "Bon retour",
      roles: "Rôles : {roles}",
      coursesEyebrow: "Cours",
      coursesTitle: "Gérer les espaces d'apprentissage",
      coursesText: "Créez, publiez, archivez et ouvrez l'espace de travail du cours.",
      activitiesEyebrow: "Activités",
      activitiesTitle: "Base prête pour des extensions",
      activitiesText: "Ajoutez des espaces réservés maintenant, puis des correcteurs, quiz et modules de tutorat plus tard.",
      researchEyebrow: "Recherche",
      researchTitle: "Métadonnées d'abord",
      researchText: "Les activités portent des métadonnées configurables dès le départ."
    },
    courses: {
      eyebrow: "Cours",
      title: "Espace des cours",
      create: "Créer un cours",
      emptyDescription: "Aucune description pour le moment.",
      activityCount: "{count} activités",
      loadError: "Impossible de charger les cours."
    },
    courseForm: {
      title: "Titre",
      description: "Description",
      status: "Statut de publication",
      create: "Créer le cours",
      save: "Enregistrer le cours",
      saveError: "Impossible d'enregistrer le cours."
    },
    newCourse: {
      eyebrow: "Nouveau cours",
      title: "Créer un cours"
    },
    editCourse: {
      eyebrow: "Modifier le cours",
      fallbackTitle: "Cours",
      loadError: "Impossible de charger le cours."
    },
    courseDetail: {
      defaultActivityTitle: "Activité provisoire",
      defaultFolderTitle: "Nouveau dossier",
      defaultRepoTitle: "Dépôt GitHub",
      edit: "Modifier",
      loadError: "Impossible de charger le cours.",
      activitiesEyebrow: "Activités",
      activitiesTitle: "Activités associées",
      noActivities: "Aucune activité pour le moment.",
      activityShellEyebrow: "Structure d'activité",
      activityShellTitle: "Ajouter une activité",
      activityTitle: "Titre",
      activityType: "Type",
      attachActivity: "Associer l'activité",
      createActivityError: "Impossible de créer l'activité.",
      materialsEyebrow: "Matériel pédagogique",
      materialsTitle: "Matériel du cours",
      addMaterial: "Ajouter une ressource",
      noMaterials: "Aucune ressource pour le moment.",
      source: "Source",
      location: "Emplacement",
      topLevel: "Niveau supérieur",
      githubUrl: "URL du dépôt GitHub",
      file: "Fichier",
      maxFileSize: "Taille maximale du fichier : 25 Mo.",
      addMaterialSubmit: "Ajouter la ressource",
      addMaterialError: "Impossible d'ajouter la ressource.",
      chooseFile: "Choisissez un fichier à téléverser.",
      folderTitlePlaceholder: "Titre du dossier",
      fileTitlePlaceholder: "Utilise le nom du fichier si vide",
      repoTitlePlaceholder: "Titre du dépôt",
      metadataOnly: "Métadonnées uniquement",
      removeConfirm: 'Supprimer "{title}" de ce cours ?',
      removeError: "Impossible de supprimer la ressource.",
      updateError: "Impossible de mettre à jour la ressource.",
      moveError: "Impossible de déplacer la ressource.",
      invalidFolderMove: "Un dossier ne peut pas être déplacé dans l'un de ses propres enfants.",
      titleHeader: "Titre",
      typeHeader: "Type",
      sourceHeader: "Source",
      actionsHeader: "Actions",
      saveMaterial: "Enregistrer la ressource",
      githubEditLabel: "URL du dépôt GitHub",
      openMaterial: "Ouvrir {title}",
      downloadMaterial: "Télécharger {title}",
      editMaterial: "Modifier {title}",
      removeMaterial: "Supprimer {title}",
      dragMaterial: "Déplacer {title}",
      dragToMove: "Glisser pour déplacer",
      expandFolder: "Développer {title}",
      collapseFolder: "Réduire {title}",
      expandFolderTitle: "Développer le dossier",
      collapseFolderTitle: "Réduire le dossier",
      moveToTopLevel: "Déposer ici pour revenir au niveau supérieur",
      openActivity: "Ouvrir l'activité",
      removeActivity: "Supprimer l'activité",
      removeActivityConfirm: 'Supprimer l’activité "{title}" de ce cours ?',
      removeActivityError: "Impossible de supprimer l'activité."
    },
    parsons: {
      eyebrow: "Problème de Parsons",
      title: "Problème de Parsons",
      inCourse: "Dans le cours : {title}",
      backToCourse: "Retour au cours",
      loadError: "Impossible de charger l'activité.",
      authoringEyebrow: "Configuration enseignant",
      authoringTitle: "Configurer le problème",
      activityTitle: "Titre de l'activité",
      activityDescription: "Description de l'activité",
      prompt: "Consigne",
      solution: "Solution de référence",
      language: "Langage",
      stripIndentation: "Retirer l'indentation dans la version étudiante",
      previewEyebrow: "Aperçu",
      previewTitle: "Blocs mélangés générés",
      previewText: "Ces blocs sont générés à partir de la solution de référence et présentés à l'étudiant dans un ordre mélangé.",
      saved: "Le problème de Parsons a été enregistré.",
      saveError: "Impossible d'enregistrer le problème de Parsons.",
      studentEyebrow: "Espace étudiant",
      studentTitle: "Reconstruire la solution",
      reset: "Réinitialiser les blocs",
      check: "Vérifier la réponse",
      keyboardHint: "Cliquez sur une ligne pour l’activer, puis utilisez les flèches du clavier pour la déplacer. Cliquez à nouveau pour la désactiver.",
      correct: "Correct. L'ordre du programme et l'indentation sont justes.",
      orderFeedback: "{count} bloc(s) ne sont pas encore dans le bon ordre.",
      indentFeedback: "{count} bloc(s) ont encore une indentation incorrecte.",
      moveUp: "Monter le bloc",
      moveDown: "Descendre le bloc",
      indent: "Indenter le bloc",
      outdent: "Désindenter le bloc",
      unsupportedTitle: "Vue d'activité non disponible",
      unsupportedText: "Cet écran prend actuellement en charge les problèmes de Parsons."
    }
  },
  zh: {
    locale: {
      label: "语言",
      en: "English",
      fr: "Français",
      zh: "中文"
    },
    common: {
      add: "添加",
      cancel: "取消",
      close: "关闭",
      create: "创建",
      download: "下载",
      edit: "编辑",
      loading: "加载中...",
      logout: "退出登录",
      noDescription: "暂无描述。",
      open: "打开",
      remove: "删除",
      redirecting: "正在跳转...",
      save: "保存",
      saving: "保存中..."
    },
    nav: {
      dashboard: "仪表盘",
      courses: "课程",
      newCourse: "新建课程",
      account: "账户",
      accountMenu: "打开账户菜单"
    },
    status: {
      draft: "草稿",
      published: "已发布",
      archived: "已归档"
    },
    roles: {
      admin: "管理员",
      teacher: "教师",
      student: "学生"
    },
    activityLifecycle: {
      draft: "草稿",
      published: "已发布",
      paused: "已暂停",
      archived: "已归档"
    },
    materialKinds: {
      folder: "文件夹",
      text: "文本",
      markdown: "Markdown",
      pdf: "PDF",
      link: "链接",
      github_repo: "GitHub 仓库",
      code_example: "代码示例",
      dataset: "数据集",
      file: "文件",
      module: "模块"
    },
    login: {
      title: "登录",
      subtitle: "使用预置教师账号来创建课程和活动。",
      email: "邮箱",
      password: "密码",
      submit: "登录",
      submitting: "登录中...",
      error: "登录失败。"
    },
    dashboard: {
      eyebrow: "仪表盘",
      welcome: "欢迎回来",
      roles: "角色：{roles}",
      coursesEyebrow: "课程",
      coursesTitle: "管理学习空间",
      coursesText: "创建、发布、归档并打开课程工作区。",
      activitiesEyebrow: "活动",
      activitiesTitle: "可扩展活动基础",
      activitiesText: "现在先添加占位活动，之后再接入作业评分、测验和辅导模块。",
      researchEyebrow: "研究",
      researchTitle: "元数据优先",
      researchText: "活动从一开始就支持可配置元数据。"
    },
    courses: {
      eyebrow: "课程",
      title: "课程工作区",
      create: "创建课程",
      emptyDescription: "暂无描述。",
      activityCount: "{count} 个活动",
      loadError: "无法加载课程。"
    },
    courseForm: {
      title: "标题",
      description: "描述",
      status: "发布状态",
      create: "创建课程",
      save: "保存课程",
      saveError: "无法保存课程。"
    },
    newCourse: {
      eyebrow: "新建课程",
      title: "创建课程"
    },
    editCourse: {
      eyebrow: "编辑课程",
      fallbackTitle: "课程",
      loadError: "无法加载课程。"
    },
    courseDetail: {
      defaultActivityTitle: "占位活动",
      defaultFolderTitle: "新建文件夹",
      defaultRepoTitle: "GitHub 仓库",
      edit: "编辑",
      loadError: "无法加载课程。",
      activitiesEyebrow: "活动",
      activitiesTitle: "已附加活动",
      noActivities: "暂无活动。",
      activityShellEyebrow: "活动占位",
      activityShellTitle: "添加活动",
      activityTitle: "标题",
      activityType: "类型",
      attachActivity: "添加活动",
      createActivityError: "无法创建活动。",
      materialsEyebrow: "资料",
      materialsTitle: "课程资料",
      addMaterial: "添加资料",
      noMaterials: "暂无资料。",
      source: "来源",
      location: "位置",
      topLevel: "顶层",
      githubUrl: "GitHub 仓库地址",
      file: "文件",
      maxFileSize: "文件大小上限：25 MB。",
      addMaterialSubmit: "添加资料",
      addMaterialError: "无法添加资料。",
      chooseFile: "请选择要上传的文件。",
      folderTitlePlaceholder: "文件夹名称",
      fileTitlePlaceholder: "留空则使用文件名",
      repoTitlePlaceholder: "仓库标题",
      metadataOnly: "仅元数据",
      removeConfirm: '确定要从课程中删除“{title}”吗？',
      removeError: "无法删除资料。",
      updateError: "无法更新资料。",
      moveError: "无法移动资料。",
      invalidFolderMove: "文件夹不能移动到自己的子项中。",
      titleHeader: "标题",
      typeHeader: "类型",
      sourceHeader: "来源",
      actionsHeader: "操作",
      saveMaterial: "保存资料",
      githubEditLabel: "GitHub 仓库地址",
      openMaterial: "打开 {title}",
      downloadMaterial: "下载 {title}",
      editMaterial: "编辑 {title}",
      removeMaterial: "删除 {title}",
      dragMaterial: "拖动 {title}",
      dragToMove: "拖动以移动",
      expandFolder: "展开 {title}",
      collapseFolder: "折叠 {title}",
      expandFolderTitle: "展开文件夹",
      collapseFolderTitle: "折叠文件夹",
      moveToTopLevel: "拖到这里可移动到顶层",
      openActivity: "打开活动",
      removeActivity: "删除活动",
      removeActivityConfirm: '确定要从课程中删除“{title}”活动吗？',
      removeActivityError: "无法删除活动。"
    },
    parsons: {
      eyebrow: "Parsons 题",
      title: "Parsons 题",
      inCourse: "所属课程：{title}",
      backToCourse: "返回课程",
      loadError: "无法加载活动。",
      authoringEyebrow: "教师配置",
      authoringTitle: "配置题目",
      activityTitle: "活动标题",
      activityDescription: "活动描述",
      prompt: "题目说明",
      solution: "参考答案",
      language: "语言",
      stripIndentation: "在学生版本中移除缩进",
      previewEyebrow: "预览",
      previewTitle: "生成后的打乱代码块",
      previewText: "这些代码块由参考答案自动生成，并以打乱顺序展示给学生。",
      saved: "Parsons 题已保存。",
      saveError: "无法保存 Parsons 题。",
      studentEyebrow: "学生作答区",
      studentTitle: "重建答案",
      reset: "重置代码块",
      check: "检查答案",
      keyboardHint: "点击某一行以激活它，然后用方向键移动它。再次点击即可取消激活。",
      correct: "答案正确。程序顺序和缩进都正确。",
      orderFeedback: "仍有 {count} 个代码块顺序不正确。",
      indentFeedback: "仍有 {count} 个代码块缩进不正确。",
      moveUp: "上移代码块",
      moveDown: "下移代码块",
      indent: "增加缩进",
      outdent: "减少缩进",
      unsupportedTitle: "此活动视图暂不可用",
      unsupportedText: "当前这个页面只支持 Parsons 题。"
    }
  }
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getMessage(locale: Locale, key: string) {
  return key.split(".").reduce<string | MessageTree | undefined>((current, part) => {
    if (!current || typeof current === "string") {
      return current;
    }
    return current[part];
  }, messages[locale]);
}

function interpolate(message: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

function detectInitialLocale() {
  if (typeof window === "undefined") {
    return "en" as Locale;
  }

  const saved = window.localStorage.getItem("cognara-locale");
  if (saved && locales.includes(saved as Locale)) {
    return saved as Locale;
  }

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("fr")) {
    return "fr";
  }
  if (browser.startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("cognara-locale", locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => setLocaleState(nextLocale),
      t: (key, vars) => {
        const message = getMessage(locale, key);
        return typeof message === "string" ? interpolate(message, vars) : key;
      }
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return context;
}
