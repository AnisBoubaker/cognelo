"use client";

import DOMPurify from "dompurify";
import {
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { CodeEditor } from "./code-editor";
import { EquationEditorDialog } from "./equation-editor-dialog";
import { ImageEditorDialog } from "./image-editor-dialog";
import { markdownImageWidth, readMarkdownImageSize, writeMarkdownImageSize, type MarkdownImageSize } from "./image-sizing";
import { renderMarkdownToHtml } from "./markdown";
import { TableEditorDialog } from "./table-editor-dialog";

export type RichTextEditorLocale = "en" | "fr" | "zh" | "ar";

export type RichTextEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  id?: string;
  locale?: RichTextEditorLocale;
  minHeight?: number;
  disabled?: boolean;
  ariaLabel?: string;
  uploadImage?: RichTextEditorImageUpload;
};

export type RichTextEditorImage = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

export type RichTextEditorImageUpload = (file: File) => Promise<RichTextEditorImage>;

const editorCopy = {
  en: {
    editorMode: "Editor mode",
    visual: "Visual",
    markdown: "Markdown",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    resizeEditor: "Resize editor",
    format: "Text format",
    paragraph: "Paragraph",
    heading2: "Heading 2",
    heading3: "Heading 3",
    blockquote: "Quote",
    preformatted: "Code block",
    bold: "Bold",
    italic: "Italic",
    bulletList: "Bulleted list",
    numberedList: "Numbered list",
    link: "Link",
    unlink: "Remove link",
    linkPrompt: "Enter the link URL",
    equation: "Equation",
    addEquation: "Add equation",
    editEquation: "Edit equation",
    equationHelp: "Build the equation with the visual field, shortcut buttons, or on-screen keyboard.",
    equationInput: "Equation",
    equationStyle: "Equation placement",
    equationInline: "Inline",
    equationDisplay: "On its own line",
    equationShortcuts: "Common structures",
    equationKeyboard: "Math keyboard",
    equationLoading: "Loading equation editor…",
    equationLoadError: "The equation editor could not be loaded.",
    equationRequired: "Enter an equation before continuing.",
    equationIncomplete: "Complete every empty box before continuing.",
    equationCancel: "Cancel",
    equationInsert: "Insert equation",
    equationUpdate: "Update equation",
    equationRemove: "Remove equation",
    equationClose: "Close",
    table: "Table",
    addTable: "Add table",
    tableHelp: "Choose the table size. The first row is used as the column header.",
    tableRows: "Rows",
    tableColumns: "Columns",
    tableCancel: "Cancel",
    tableInsert: "Insert table",
    tableClose: "Close",
    tableActions: "Table actions",
    addRowBefore: "Add row before",
    addRowAfter: "Add row after",
    addColumnBefore: "Add column before",
    addColumnAfter: "Add column after",
    removeRow: "Remove current row",
    removeColumn: "Remove current column",
    image: "Image",
    addImage: "Add image",
    editImage: "Edit image",
    imageHelp: "Upload an image and describe it for students who cannot see it.",
    imageFile: "Image file",
    imageReplaceFile: "Replace image (optional)",
    imageAltText: "Alternative text",
    imageAltHelp: "Briefly describe the image's meaning or content.",
    imageTitle: "Title (optional)",
    imageSizeMode: "Size basis",
    imageSizePixels: "Pixels",
    imageSizeOriginalPercent: "Percentage of the original image",
    imageSizeContainerPercent: "Percentage of the container width",
    imageSizeValuePixels: "Width (pixels)",
    imageSizeValueOriginalPercent: "Size (% of original)",
    imageSizeValueContainerPercent: "Width (% of container)",
    imageSizeInvalidPixels: "Enter a whole-pixel width between 1 and 10,000.",
    imageSizeInvalidOriginalPercent: "Enter a percentage between 1 and 500.",
    imageSizeInvalidContainerPercent: "Enter a percentage between 1 and 100.",
    imageSizeDimensionsUnavailable: "Wait for the image dimensions to load, then try again.",
    imagePreview: "Image preview",
    imageFileRequired: "Choose an image before continuing.",
    imageAltRequired: "Add alternative text before continuing.",
    imageCancel: "Cancel",
    imageInsert: "Insert image",
    imageUpdate: "Update image",
    imageRemove: "Remove image",
    imageClose: "Close"
  },
  fr: {
    editorMode: "Mode d'edition",
    visual: "Visuel",
    markdown: "Markdown",
    fullScreen: "Plein écran",
    exitFullScreen: "Quitter le plein écran",
    resizeEditor: "Redimensionner l'éditeur",
    format: "Format du texte",
    paragraph: "Paragraphe",
    heading2: "Titre 2",
    heading3: "Titre 3",
    blockquote: "Citation",
    preformatted: "Bloc de code",
    bold: "Gras",
    italic: "Italique",
    bulletList: "Liste a puces",
    numberedList: "Liste numerotee",
    link: "Lien",
    unlink: "Supprimer le lien",
    linkPrompt: "Saisissez l'adresse du lien",
    equation: "Équation",
    addEquation: "Ajouter une équation",
    editEquation: "Modifier l'équation",
    equationHelp: "Construisez l'équation avec le champ visuel, les raccourcis ou le clavier à l'écran.",
    equationInput: "Équation",
    equationStyle: "Disposition de l'équation",
    equationInline: "Dans le texte",
    equationDisplay: "Sur sa propre ligne",
    equationShortcuts: "Structures courantes",
    equationKeyboard: "Clavier mathématique",
    equationLoading: "Chargement de l'éditeur d'équations…",
    equationLoadError: "Impossible de charger l'éditeur d'équations.",
    equationRequired: "Saisissez une équation avant de continuer.",
    equationIncomplete: "Remplissez toutes les cases vides avant de continuer.",
    equationCancel: "Annuler",
    equationInsert: "Insérer l'équation",
    equationUpdate: "Mettre à jour l'équation",
    equationRemove: "Supprimer l'équation",
    equationClose: "Fermer",
    table: "Tableau",
    addTable: "Ajouter un tableau",
    tableHelp: "Choisissez le nombre de lignes et de colonnes. La première ligne sert d'en-tête.",
    tableRows: "Lignes",
    tableColumns: "Colonnes",
    tableCancel: "Annuler",
    tableInsert: "Insérer le tableau",
    tableClose: "Fermer",
    tableActions: "Actions du tableau",
    addRowBefore: "Ajouter une ligne avant",
    addRowAfter: "Ajouter une ligne après",
    addColumnBefore: "Ajouter une colonne avant",
    addColumnAfter: "Ajouter une colonne après",
    removeRow: "Supprimer la ligne actuelle",
    removeColumn: "Supprimer la colonne actuelle",
    image: "Image",
    addImage: "Ajouter une image",
    editImage: "Modifier l'image",
    imageHelp: "Téléversez une image et décrivez-la pour les étudiants qui ne peuvent pas la voir.",
    imageFile: "Fichier image",
    imageReplaceFile: "Remplacer l'image (facultatif)",
    imageAltText: "Texte alternatif",
    imageAltHelp: "Décrivez brièvement le sens ou le contenu de l'image.",
    imageTitle: "Titre (facultatif)",
    imageSizeMode: "Base du dimensionnement",
    imageSizePixels: "Pixels",
    imageSizeOriginalPercent: "Pourcentage de l'image originale",
    imageSizeContainerPercent: "Pourcentage de la largeur du conteneur",
    imageSizeValuePixels: "Largeur (pixels)",
    imageSizeValueOriginalPercent: "Taille (% de l'original)",
    imageSizeValueContainerPercent: "Largeur (% du conteneur)",
    imageSizeInvalidPixels: "Saisissez une largeur entière entre 1 et 10 000 pixels.",
    imageSizeInvalidOriginalPercent: "Saisissez un pourcentage entre 1 et 500.",
    imageSizeInvalidContainerPercent: "Saisissez un pourcentage entre 1 et 100.",
    imageSizeDimensionsUnavailable: "Attendez le chargement des dimensions de l'image, puis réessayez.",
    imagePreview: "Aperçu de l'image",
    imageFileRequired: "Choisissez une image avant de continuer.",
    imageAltRequired: "Ajoutez un texte alternatif avant de continuer.",
    imageCancel: "Annuler",
    imageInsert: "Insérer l'image",
    imageUpdate: "Mettre à jour l'image",
    imageRemove: "Supprimer l'image",
    imageClose: "Fermer"
  },
  zh: {
    editorMode: "编辑器模式",
    visual: "可视化",
    markdown: "Markdown",
    fullScreen: "全屏",
    exitFullScreen: "退出全屏",
    resizeEditor: "调整编辑器大小",
    format: "文本格式",
    paragraph: "段落",
    heading2: "二级标题",
    heading3: "三级标题",
    blockquote: "引用",
    preformatted: "代码块",
    bold: "粗体",
    italic: "斜体",
    bulletList: "项目符号列表",
    numberedList: "编号列表",
    link: "链接",
    unlink: "移除链接",
    linkPrompt: "输入链接地址",
    equation: "公式",
    addEquation: "添加公式",
    editEquation: "编辑公式",
    equationHelp: "使用可视化输入框、快捷按钮或屏幕键盘构建公式。",
    equationInput: "公式",
    equationStyle: "公式位置",
    equationInline: "行内",
    equationDisplay: "独立一行",
    equationShortcuts: "常用结构",
    equationKeyboard: "数学键盘",
    equationLoading: "正在加载公式编辑器…",
    equationLoadError: "无法加载公式编辑器。",
    equationRequired: "请先输入公式。",
    equationIncomplete: "请先填写所有空白框。",
    equationCancel: "取消",
    equationInsert: "插入公式",
    equationUpdate: "更新公式",
    equationRemove: "删除公式",
    equationClose: "关闭",
    table: "表格",
    addTable: "添加表格",
    tableHelp: "选择行数和列数。第一行将用作列标题。",
    tableRows: "行",
    tableColumns: "列",
    tableCancel: "取消",
    tableInsert: "插入表格",
    tableClose: "关闭",
    tableActions: "表格操作",
    addRowBefore: "在前面添加行",
    addRowAfter: "在后面添加行",
    addColumnBefore: "在前面添加列",
    addColumnAfter: "在后面添加列",
    removeRow: "删除当前行",
    removeColumn: "删除当前列",
    image: "图片",
    addImage: "添加图片",
    editImage: "编辑图片",
    imageHelp: "上传图片，并为无法看到图片的学生添加说明。",
    imageFile: "图片文件",
    imageReplaceFile: "替换图片（可选）",
    imageAltText: "替代文本",
    imageAltHelp: "简要描述图片的含义或内容。",
    imageTitle: "标题（可选）",
    imageSizeMode: "尺寸依据",
    imageSizePixels: "像素",
    imageSizeOriginalPercent: "原图尺寸百分比",
    imageSizeContainerPercent: "容器宽度百分比",
    imageSizeValuePixels: "宽度（像素）",
    imageSizeValueOriginalPercent: "尺寸（原图百分比）",
    imageSizeValueContainerPercent: "宽度（容器百分比）",
    imageSizeInvalidPixels: "请输入 1 到 10,000 之间的整数像素宽度。",
    imageSizeInvalidOriginalPercent: "请输入 1 到 500 之间的百分比。",
    imageSizeInvalidContainerPercent: "请输入 1 到 100 之间的百分比。",
    imageSizeDimensionsUnavailable: "请等待图片尺寸加载后重试。",
    imagePreview: "图片预览",
    imageFileRequired: "请先选择图片。",
    imageAltRequired: "请先添加替代文本。",
    imageCancel: "取消",
    imageInsert: "插入图片",
    imageUpdate: "更新图片",
    imageRemove: "移除图片",
    imageClose: "关闭"
  },
  ar: {
    editorMode: "وضع المحرر",
    visual: "مرئي",
    markdown: "Markdown",
    fullScreen: "ملء الشاشة",
    exitFullScreen: "الخروج من ملء الشاشة",
    resizeEditor: "تغيير حجم المحرر",
    format: "تنسيق النص",
    paragraph: "فقرة",
    heading2: "عنوان 2",
    heading3: "عنوان 3",
    blockquote: "اقتباس",
    preformatted: "كتلة برمجية",
    bold: "عريض",
    italic: "مائل",
    bulletList: "قائمة نقطية",
    numberedList: "قائمة مرقمة",
    link: "رابط",
    unlink: "إزالة الرابط",
    linkPrompt: "أدخل عنوان الرابط",
    equation: "معادلة",
    addEquation: "إضافة معادلة",
    editEquation: "تعديل المعادلة",
    equationHelp: "أنشئ المعادلة باستخدام الحقل المرئي أو الاختصارات أو لوحة المفاتيح على الشاشة.",
    equationInput: "المعادلة",
    equationStyle: "موضع المعادلة",
    equationInline: "ضمن النص",
    equationDisplay: "في سطر مستقل",
    equationShortcuts: "تراكيب شائعة",
    equationKeyboard: "لوحة مفاتيح الرياضيات",
    equationLoading: "جارٍ تحميل محرر المعادلات…",
    equationLoadError: "تعذر تحميل محرر المعادلات.",
    equationRequired: "أدخل معادلة قبل المتابعة.",
    equationIncomplete: "أكمل جميع الخانات الفارغة قبل المتابعة.",
    equationCancel: "إلغاء",
    equationInsert: "إدراج المعادلة",
    equationUpdate: "تحديث المعادلة",
    equationRemove: "حذف المعادلة",
    equationClose: "إغلاق",
    table: "جدول",
    addTable: "إضافة جدول",
    tableHelp: "اختر عدد الصفوف والأعمدة. يُستخدم الصف الأول كرأس للأعمدة.",
    tableRows: "الصفوف",
    tableColumns: "الأعمدة",
    tableCancel: "إلغاء",
    tableInsert: "إدراج الجدول",
    tableClose: "إغلاق",
    tableActions: "إجراءات الجدول",
    addRowBefore: "إضافة صف قبله",
    addRowAfter: "إضافة صف بعده",
    addColumnBefore: "إضافة عمود قبله",
    addColumnAfter: "إضافة عمود بعده",
    removeRow: "حذف الصف الحالي",
    removeColumn: "حذف العمود الحالي",
    image: "صورة",
    addImage: "إضافة صورة",
    editImage: "تعديل الصورة",
    imageHelp: "ارفع صورة وأضف وصفاً للطلاب الذين لا يستطيعون رؤيتها.",
    imageFile: "ملف الصورة",
    imageReplaceFile: "استبدال الصورة (اختياري)",
    imageAltText: "النص البديل",
    imageAltHelp: "صِف معنى الصورة أو محتواها باختصار.",
    imageTitle: "العنوان (اختياري)",
    imageSizeMode: "أساس الحجم",
    imageSizePixels: "بالبكسل",
    imageSizeOriginalPercent: "نسبة من حجم الصورة الأصلي",
    imageSizeContainerPercent: "نسبة من عرض الحاوية",
    imageSizeValuePixels: "العرض (بالبكسل)",
    imageSizeValueOriginalPercent: "الحجم (% من الأصل)",
    imageSizeValueContainerPercent: "العرض (% من الحاوية)",
    imageSizeInvalidPixels: "أدخل عرضاً صحيحاً بين 1 و10,000 بكسل.",
    imageSizeInvalidOriginalPercent: "أدخل نسبة بين 1 و500.",
    imageSizeInvalidContainerPercent: "أدخل نسبة بين 1 و100.",
    imageSizeDimensionsUnavailable: "انتظر تحميل أبعاد الصورة ثم حاول مرة أخرى.",
    imagePreview: "معاينة الصورة",
    imageFileRequired: "اختر صورة قبل المتابعة.",
    imageAltRequired: "أضف نصاً بديلاً قبل المتابعة.",
    imageCancel: "إلغاء",
    imageInsert: "إدراج الصورة",
    imageUpdate: "تحديث الصورة",
    imageRemove: "إزالة الصورة",
    imageClose: "إغلاق"
  }
} as const;

type EquationDialogState = {
  displayMode: boolean;
  latex: string;
  mode: "add" | "edit";
  targetIndex: number | null;
};

type TableCellSelection = {
  columnIndex: number;
  rowIndex: number;
  tableIndex: number;
};

type ImageDialogState = {
  alt: string;
  mode: "add" | "edit";
  size: MarkdownImageSize;
  src: string;
  targetIndex: number | null;
  title: string;
};

const maximumEditorBodyHeight = 1200;

export function RichTextEditor({
  value,
  onChange,
  id,
  locale = "en",
  minHeight = 180,
  disabled = false,
  ariaLabel,
  uploadImage = defaultMediaImageUpload
}: RichTextEditorProps) {
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [equationDialog, setEquationDialog] = useState<EquationDialogState | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [imageDialog, setImageDialog] = useState<ImageDialogState | null>(null);
  const [tableSelection, setTableSelection] = useState<TableCellSelection | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const minimumEditorBodyHeight = getMinimumEditorBodyHeight(minHeight);
  const [editorBodyHeight, setEditorBodyHeight] = useState(() => minimumEditorBodyHeight);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const visualMarkdownRef = useRef<string | null>(null);
  const visualEquationsInteractiveRef = useRef<boolean | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const equationDialogOpeningRef = useRef(false);
  const resizeStartRef = useRef<{ height: number; y: number } | null>(null);
  const copy = editorCopy[locale] ?? editorCopy.en;

  useEffect(() => {
    if (!isFullScreen) {
      return;
    }
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !equationDialog && !imageDialog && !tableDialogOpen) {
        event.preventDefault();
        setIsFullScreen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [equationDialog, imageDialog, isFullScreen, tableDialogOpen]);

  useEffect(() => {
    const visualElement = visualRef.current;
    if (!visualElement) {
      return;
    }
    if (visualMarkdownRef.current === value && visualEquationsInteractiveRef.current === !disabled) {
      return;
    }
    selectionRangeRef.current = null;
    renderVisualEditorHtml(visualElement, value, copy.editEquation, copy.editImage, !disabled);
    setTableSelection(null);
    visualMarkdownRef.current = value;
    visualEquationsInteractiveRef.current = !disabled;
  }, [copy.editEquation, copy.editImage, disabled, value]);

  useEffect(() => {
    renderTableCellSelection(visualRef.current, tableSelection);
  }, [tableSelection]);

  function syncVisualValue({ refreshRenderedMath = false }: { refreshRenderedMath?: boolean } = {}) {
    if (!visualRef.current) {
      return;
    }
    const markdown = editorHtmlToMarkdown(visualRef.current);
    visualMarkdownRef.current = markdown;
    onChange(markdown);
    if (refreshRenderedMath) {
      selectionRangeRef.current = null;
      renderVisualEditorHtml(visualRef.current, markdown, copy.editEquation, copy.editImage, !disabled);
      renderTableCellSelection(visualRef.current, tableSelection);
      visualEquationsInteractiveRef.current = !disabled;
    }
  }

  function runCommand(command: string, commandValue?: string) {
    if (disabled || !visualRef.current) {
      return;
    }
    visualRef.current.focus();
    if (selectionRangeRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRangeRef.current);
    }
    document.execCommand(command, false, commandValue);
    saveSelection();
    syncVisualValue();
  }

  function saveSelection() {
    const editor = visualRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRangeRef.current = range.cloneRange();
    }
  }

  function addLink() {
    if (disabled) {
      return;
    }
    const url = window.prompt(copy.linkPrompt, "https://");
    if (url?.trim()) {
      runCommand("createLink", url.trim());
    }
  }

  function addEquation() {
    if (disabled) {
      return;
    }
    saveSelection();
    equationDialogOpeningRef.current = true;
    setEquationDialog({ displayMode: true, latex: "", mode: "add", targetIndex: null });
  }

  function addTable() {
    if (disabled) {
      return;
    }
    saveSelection();
    equationDialogOpeningRef.current = true;
    setTableDialogOpen(true);
  }

  function addImage() {
    if (disabled) return;
    saveSelection();
    equationDialogOpeningRef.current = true;
    setImageDialog({
      alt: "",
      mode: "add",
      size: { mode: "original-percent", originalWidth: null, value: 100 },
      src: "",
      targetIndex: null,
      title: ""
    });
  }

  function editImage(target: HTMLImageElement) {
    if (disabled || !visualRef.current) return;
    const targetIndex = Array.from(visualRef.current.querySelectorAll("img")).indexOf(target);
    if (targetIndex < 0) return;
    equationDialogOpeningRef.current = true;
    setImageDialog({
      alt: target.getAttribute("alt") ?? "",
      mode: "edit",
      size: readMarkdownImageSize(target.getAttribute("src") ?? "") ?? {
        mode: "original-percent",
        originalWidth: target.naturalWidth || null,
        value: 100
      },
      src: target.getAttribute("src") ?? "",
      targetIndex,
      title: target.getAttribute("title") ?? ""
    });
  }

  async function applyImage({ alt, file, size, title }: { alt: string; file: File | null; size: MarkdownImageSize; title: string }) {
    const visualElement = visualRef.current;
    if (!visualElement || !imageDialog) return;
    const source = file ? (await uploadImage(file)).url : imageDialog.src;
    if (!source) throw new Error(copy.imageFileRequired);
    const src = writeMarkdownImageSize(source, size);
    const image = createVisualImageElement({ alt, src, title }, copy.editImage);
    const currentTarget = imageDialog.targetIndex === null
      ? null
      : visualElement.querySelectorAll<HTMLImageElement>("img")[imageDialog.targetIndex];
    if (imageDialog.mode === "edit") {
      if (!currentTarget) {
        setImageDialog(null);
        return;
      }
      currentTarget.replaceWith(image);
    } else {
      const paragraph = document.createElement("p");
      paragraph.append(image);
      insertVisualBlockElement(visualElement, paragraph, selectionRangeRef.current);
    }
    syncVisualValue({ refreshRenderedMath: true });
    setImageDialog(null);
  }

  function removeImage() {
    const visualElement = visualRef.current;
    const currentTarget = visualElement && imageDialog?.targetIndex !== null && imageDialog?.targetIndex !== undefined
      ? visualElement.querySelectorAll<HTMLImageElement>("img")[imageDialog.targetIndex]
      : null;
    if (!currentTarget) {
      setImageDialog(null);
      return;
    }
    const parent = currentTarget.parentElement;
    currentTarget.remove();
    if (parent && ["p", "div"].includes(parent.tagName.toLowerCase()) && !parent.textContent?.trim() && !parent.querySelector("img")) {
      parent.remove();
    }
    syncVisualValue({ refreshRenderedMath: true });
    setImageDialog(null);
  }

  function insertTable({ columns, rows }: { columns: number; rows: number }) {
    const visualElement = visualRef.current;
    if (!visualElement) {
      return;
    }
    const table = createVisualTable(rows, columns);
    insertVisualBlockElement(visualElement, table, selectionRangeRef.current);
    const tableIndex = Array.from(visualElement.querySelectorAll("table")).indexOf(table);
    syncVisualValue();
    setTableDialogOpen(false);
    setTableSelection({ columnIndex: 0, rowIndex: 0, tableIndex });
  }

  function addTableRow(position: "before" | "after") {
    const context = resolveTableSelection(visualRef.current, tableSelection);
    if (!context) {
      return;
    }
    const row = document.createElement("tr");
    for (let columnIndex = 0; columnIndex < context.columnCount; columnIndex += 1) {
      row.append(createEmptyTableCell("td"));
    }
    if (position === "before") {
      context.row.before(row);
    } else {
      context.row.after(row);
    }
    normalizeVisualTable(context.table);
    setTableSelection({
      ...tableSelection!,
      rowIndex: tableSelection!.rowIndex + (position === "before" ? 1 : 0)
    });
    syncVisualValue();
  }

  function addTableColumn(position: "before" | "after") {
    const context = resolveTableSelection(visualRef.current, tableSelection);
    if (!context) {
      return;
    }
    Array.from(context.table.rows).forEach((row, rowIndex) => {
      const cells = getDirectTableCells(row);
      const currentCell = cells[context.columnIndex];
      const cell = createEmptyTableCell(rowIndex === 0 ? "th" : "td");
      if (!currentCell || (position === "after" && !currentCell.nextElementSibling)) {
        row.append(cell);
      } else if (position === "before") {
        currentCell.before(cell);
      } else {
        currentCell.after(cell);
      }
    });
    normalizeVisualTable(context.table);
    setTableSelection({
      ...tableSelection!,
      columnIndex: tableSelection!.columnIndex + (position === "before" ? 1 : 0)
    });
    syncVisualValue();
  }

  function removeTableRow() {
    const context = resolveTableSelection(visualRef.current, tableSelection);
    if (!context) {
      return;
    }
    if (context.table.rows.length === 1) {
      context.table.remove();
      setTableSelection(null);
      syncVisualValue();
      return;
    }
    context.row.remove();
    normalizeVisualTable(context.table);
    setTableSelection({
      ...tableSelection!,
      rowIndex: Math.min(context.rowIndex, context.table.rows.length - 1)
    });
    syncVisualValue();
  }

  function removeTableColumn() {
    const context = resolveTableSelection(visualRef.current, tableSelection);
    if (!context) {
      return;
    }
    if (context.columnCount === 1) {
      context.table.remove();
      setTableSelection(null);
      syncVisualValue();
      return;
    }
    Array.from(context.table.rows).forEach((row) => {
      getDirectTableCells(row)[context.columnIndex]?.remove();
    });
    normalizeVisualTable(context.table);
    setTableSelection({
      ...tableSelection!,
      columnIndex: Math.min(context.columnIndex, context.columnCount - 2)
    });
    syncVisualValue();
  }

  function editEquation(target: HTMLElement) {
    if (disabled) {
      return;
    }
    const source = readProtectedMathSource(target);
    if (source === null) {
      return;
    }
    const displayMode = target.getAttribute("data-markdown-math-display") === "true";
    const targetIndex = visualRef.current
      ? Array.from(visualRef.current.querySelectorAll("[data-markdown-math-source]")).indexOf(target)
      : -1;
    if (targetIndex < 0) {
      return;
    }
    equationDialogOpeningRef.current = true;
    setEquationDialog({ displayMode, latex: extractMathExpression(source, displayMode), mode: "edit", targetIndex });
  }

  function applyEquation({ displayMode, latex }: { displayMode: boolean; latex: string }) {
    const visualElement = visualRef.current;
    if (!visualElement || !equationDialog) {
      return;
    }
    const source = displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
    const mathElement = createVisualMathElement(source, copy.editEquation);
    if (!mathElement) {
      return;
    }

    const currentTarget = equationDialog.targetIndex === null
      ? null
      : visualElement.querySelectorAll<HTMLElement>("[data-markdown-math-source]")[equationDialog.targetIndex];
    if (equationDialog.mode === "edit") {
      if (!currentTarget) {
        setEquationDialog(null);
        return;
      }
      currentTarget.replaceWith(mathElement);
    } else {
      insertVisualMathElement(visualElement, mathElement, displayMode, selectionRangeRef.current);
    }
    syncVisualValue({ refreshRenderedMath: true });
    setEquationDialog(null);
  }

  function removeEquation() {
    const visualElement = visualRef.current;
    const currentTarget = visualElement && equationDialog?.targetIndex !== null && equationDialog?.targetIndex !== undefined
      ? visualElement.querySelectorAll<HTMLElement>("[data-markdown-math-source]")[equationDialog.targetIndex]
      : null;
    if (!currentTarget) {
      setEquationDialog(null);
      return;
    }
    currentTarget.remove();
    syncVisualValue({ refreshRenderedMath: true });
    setEquationDialog(null);
  }

  function handleVisualClick(event: MouseEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }
    const eventTarget = event.target as HTMLElement;
    const imageTarget = eventTarget.closest<HTMLImageElement>("img");
    if (imageTarget && visualRef.current?.contains(imageTarget)) {
      event.preventDefault();
      editImage(imageTarget);
      return;
    }
    const mathTarget = eventTarget.closest<HTMLElement>("[data-markdown-math-source]");
    if (mathTarget) {
      event.preventDefault();
      editEquation(mathTarget);
      return;
    }
    const tableCell = eventTarget.closest<HTMLTableCellElement>("th, td");
    if (tableCell && visualRef.current?.contains(tableCell)) {
      setTableSelection(findTableCellSelection(visualRef.current, tableCell));
    } else {
      setTableSelection(null);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboardHtml = event.clipboardData.getData("text/html");
    if (clipboardHtml) {
      document.execCommand("insertHTML", false, sanitizePastedEditorHtml(clipboardHtml));
    } else {
      document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    }
    syncVisualValue();
  }

  function handleVisualKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const imageTarget = (event.target as HTMLElement).closest<HTMLImageElement>("img");
    if (imageTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      editImage(imageTarget);
      return;
    }
    const mathTarget = (event.target as HTMLElement).closest<HTMLElement>("[data-markdown-math-source]");
    if (mathTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      editEquation(mathTarget);
      return;
    }
    if (event.key !== "Enter" || !event.shiftKey || disabled) {
      return;
    }
    event.preventDefault();
    const inserted = document.execCommand("insertLineBreak", false);
    if (!inserted) {
      document.execCommand("insertHTML", false, "<br>");
    }
    saveSelection();
    syncVisualValue();
  }

  function startEditorResize(event: ReactPointerEvent<HTMLDivElement>) {
    resizeStartRef.current = { height: editorBodyHeight, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function resizeEditor(event: ReactPointerEvent<HTMLDivElement>) {
    const start = resizeStartRef.current;
    if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    setEditorBodyHeight(clampEditorBodyHeight(start.height + event.clientY - start.y, minimumEditorBodyHeight));
  }

  function finishEditorResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeStartRef.current = null;
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") {
      setEditorBodyHeight((current) => clampEditorBodyHeight(current - 24, minimumEditorBodyHeight));
    } else if (event.key === "ArrowDown") {
      setEditorBodyHeight((current) => clampEditorBodyHeight(current + 24, minimumEditorBodyHeight));
    } else if (event.key === "Home") {
      setEditorBodyHeight(minimumEditorBodyHeight);
    } else if (event.key === "End") {
      setEditorBodyHeight(maximumEditorBodyHeight);
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <div
      aria-label={isFullScreen ? copy.fullScreen : undefined}
      aria-modal={isFullScreen || undefined}
      className={`rich-text-editor${disabled ? " is-disabled" : ""}${isFullScreen ? " is-full-screen" : ""}`}
      role={isFullScreen ? "dialog" : undefined}
      style={{ "--rich-text-editor-body-height": `${editorBodyHeight}px` } as CSSProperties}
    >
      <div className="rich-text-editor-mode-bar">
        <div className="rich-text-editor-mode-tabs" role="tablist" aria-label={copy.editorMode}>
          <button
            aria-selected={mode === "visual"}
            className={mode === "visual" ? "is-active" : ""}
            role="tab"
            type="button"
            onClick={() => setMode("visual")}
          >
            {copy.visual}
          </button>
          <button
            aria-selected={mode === "markdown"}
            className={mode === "markdown" ? "is-active" : ""}
            role="tab"
            type="button"
            onClick={() => setMode("markdown")}
          >
            {copy.markdown}
          </button>
        </div>
        <button
          aria-label={isFullScreen ? copy.exitFullScreen : copy.fullScreen}
          className="rich-text-editor-fullscreen-toggle"
          title={isFullScreen ? copy.exitFullScreen : copy.fullScreen}
          type="button"
          onClick={() => setIsFullScreen((current) => !current)}
        >
          <span aria-hidden="true">{isFullScreen ? "⤢" : "⛶"}</span>
          <span>{isFullScreen ? copy.exitFullScreen : copy.fullScreen}</span>
        </button>
      </div>

      <div className="rich-text-editor-visual-panel" hidden={mode !== "visual"} role="tabpanel">
          <div className="rich-text-editor-toolbar" role="toolbar" aria-label={copy.format}>
            <select
              aria-label={copy.format}
              defaultValue="p"
              disabled={disabled}
              onChange={(event) => runCommand("formatBlock", event.target.value)}
            >
              <option value="p">{copy.paragraph}</option>
              <option value="h2">{copy.heading2}</option>
              <option value="h3">{copy.heading3}</option>
              <option value="blockquote">{copy.blockquote}</option>
              <option value="pre">{copy.preformatted}</option>
            </select>
            <button aria-label={copy.bold} title={copy.bold} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
              <strong>B</strong>
            </button>
            <button aria-label={copy.italic} title={copy.italic} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>
              <em>I</em>
            </button>
            <button aria-label={copy.bulletList} title={copy.bulletList} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>
              • List
            </button>
            <button aria-label={copy.numberedList} title={copy.numberedList} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertOrderedList")}>
              1. List
            </button>
            <button aria-label={copy.link} title={copy.link} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addLink}>
              🔗
            </button>
            <button aria-label={copy.unlink} title={copy.unlink} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("unlink")}>
              {copy.unlink}
            </button>
            <button aria-label={copy.addEquation} title={copy.addEquation} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addEquation}>
              <span aria-hidden="true">∑</span> {copy.equation}
            </button>
            <button aria-label={copy.addTable} title={copy.addTable} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addTable}>
              <span aria-hidden="true">▦</span> {copy.table}
            </button>
            <button aria-label={copy.addImage} title={copy.addImage} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={addImage}>
              <span aria-hidden="true">▧</span> {copy.image}
            </button>
          </div>
          {tableSelection ? (
            <div className="rich-text-editor-table-toolbar" role="toolbar" aria-label={copy.tableActions}>
              <button aria-label={copy.addRowBefore} title={copy.addRowBefore} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTableRow("before")}>
                <span aria-hidden="true">＋↑</span> {copy.addRowBefore}
              </button>
              <button aria-label={copy.addRowAfter} title={copy.addRowAfter} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTableRow("after")}>
                <span aria-hidden="true">＋↓</span> {copy.addRowAfter}
              </button>
              <button aria-label={copy.addColumnBefore} title={copy.addColumnBefore} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTableColumn("before")}>
                <span aria-hidden="true">＋←</span> {copy.addColumnBefore}
              </button>
              <button aria-label={copy.addColumnAfter} title={copy.addColumnAfter} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTableColumn("after")}>
                <span aria-hidden="true">＋→</span> {copy.addColumnAfter}
              </button>
              <button aria-label={copy.removeRow} title={copy.removeRow} type="button" onMouseDown={(event) => event.preventDefault()} onClick={removeTableRow}>
                <span aria-hidden="true">−↕</span> {copy.removeRow}
              </button>
              <button aria-label={copy.removeColumn} title={copy.removeColumn} type="button" onMouseDown={(event) => event.preventDefault()} onClick={removeTableColumn}>
                <span aria-hidden="true">−↔</span> {copy.removeColumn}
              </button>
            </div>
          ) : null}
          <div
            id={id}
            ref={visualRef}
            aria-label={ariaLabel}
            aria-multiline="true"
            className="rich-text-editor-visual markdown-renderer"
            contentEditable={!disabled}
            role="textbox"
            suppressContentEditableWarning
            onBlur={() => {
              saveSelection();
              syncVisualValue({ refreshRenderedMath: !equationDialogOpeningRef.current });
              equationDialogOpeningRef.current = false;
            }}
            onInput={() => {
              saveSelection();
              syncVisualValue();
            }}
            onClick={handleVisualClick}
            onKeyDown={handleVisualKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onPaste={handlePaste}
          />
      </div>
      <div className="rich-text-editor-markdown-source" hidden={mode !== "markdown"} role="tabpanel">
        <CodeEditor
          id={id ? `${id}-markdown` : undefined}
          ariaLabel={ariaLabel}
          height={isFullScreen ? "100%" : editorBodyHeight}
          language="markdown"
          minHeight={isFullScreen ? 0 : minimumEditorBodyHeight}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      <div
        aria-label={copy.resizeEditor}
        aria-orientation="horizontal"
        aria-valuemax={maximumEditorBodyHeight}
        aria-valuemin={minimumEditorBodyHeight}
        aria-valuenow={editorBodyHeight}
        className="rich-text-editor-resize-handle"
        role="separator"
        tabIndex={0}
        title={copy.resizeEditor}
        onKeyDown={handleResizeKeyDown}
        onPointerCancel={finishEditorResize}
        onPointerDown={startEditorResize}
        onPointerMove={resizeEditor}
        onPointerUp={finishEditorResize}
      >
        <span aria-hidden="true" />
      </div>
      {equationDialog ? (
        <EquationEditorDialog
          copy={{
            eyebrow: copy.equation,
            addTitle: copy.addEquation,
            editTitle: copy.editEquation,
            help: copy.equationHelp,
            inputLabel: copy.equationInput,
            styleLabel: copy.equationStyle,
            inline: copy.equationInline,
            display: copy.equationDisplay,
            shortcuts: copy.equationShortcuts,
            keyboard: copy.equationKeyboard,
            loading: copy.equationLoading,
            loadError: copy.equationLoadError,
            required: copy.equationRequired,
            incomplete: copy.equationIncomplete,
            cancel: copy.equationCancel,
            insert: copy.equationInsert,
            update: copy.equationUpdate,
            remove: copy.equationRemove,
            close: copy.equationClose
          }}
          displayMode={equationDialog.displayMode}
          initialLatex={equationDialog.latex}
          locale={locale}
          mode={equationDialog.mode}
          onCancel={() => setEquationDialog(null)}
          onConfirm={applyEquation}
          onRemove={equationDialog.mode === "edit" ? removeEquation : undefined}
        />
      ) : null}
      {tableDialogOpen ? (
        <TableEditorDialog
          copy={{
            eyebrow: copy.table,
            title: copy.addTable,
            help: copy.tableHelp,
            rows: copy.tableRows,
            columns: copy.tableColumns,
            cancel: copy.tableCancel,
            insert: copy.tableInsert,
            close: copy.tableClose
          }}
          onCancel={() => setTableDialogOpen(false)}
          onConfirm={insertTable}
        />
      ) : null}
      {imageDialog ? (
        <ImageEditorDialog
          copy={{
            eyebrow: copy.image,
            addTitle: copy.addImage,
            editTitle: copy.editImage,
            help: copy.imageHelp,
            file: copy.imageFile,
            replaceFile: copy.imageReplaceFile,
            altText: copy.imageAltText,
            altHelp: copy.imageAltHelp,
            optionalTitle: copy.imageTitle,
            sizeMode: copy.imageSizeMode,
            sizePixels: copy.imageSizePixels,
            sizeOriginalPercent: copy.imageSizeOriginalPercent,
            sizeContainerPercent: copy.imageSizeContainerPercent,
            sizeValuePixels: copy.imageSizeValuePixels,
            sizeValueOriginalPercent: copy.imageSizeValueOriginalPercent,
            sizeValueContainerPercent: copy.imageSizeValueContainerPercent,
            sizeInvalidPixels: copy.imageSizeInvalidPixels,
            sizeInvalidOriginalPercent: copy.imageSizeInvalidOriginalPercent,
            sizeInvalidContainerPercent: copy.imageSizeInvalidContainerPercent,
            sizeDimensionsUnavailable: copy.imageSizeDimensionsUnavailable,
            preview: copy.imagePreview,
            requiredFile: copy.imageFileRequired,
            requiredAlt: copy.imageAltRequired,
            cancel: copy.imageCancel,
            insert: copy.imageInsert,
            update: copy.imageUpdate,
            remove: copy.imageRemove,
            close: copy.imageClose
          }}
          initialAlt={imageDialog.alt}
          initialSize={imageDialog.size}
          initialSrc={imageDialog.src}
          initialTitle={imageDialog.title}
          mode={imageDialog.mode}
          onCancel={() => setImageDialog(null)}
          onConfirm={applyImage}
          onRemove={imageDialog.mode === "edit" ? removeImage : undefined}
        />
      ) : null}
    </div>
  );
}

function getMinimumEditorBodyHeight(minHeight: number) {
  return Math.max(220, minHeight + 52);
}

function clampEditorBodyHeight(value: number, minimum: number) {
  return Math.min(maximumEditorBodyHeight, Math.max(minimum, Math.round(value)));
}

function renderVisualEditorHtml(element: HTMLElement, markdown: string, editEquationLabel: string, editImageLabel: string, widgetsInteractive: boolean) {
  element.innerHTML = markdownToEditorHtml(markdown);
  prepareVisualMathWidgets(element, editEquationLabel, widgetsInteractive);
  prepareVisualImageWidgets(element, editImageLabel, widgetsInteractive);
}

function prepareVisualImageWidgets(root: ParentNode, editImageLabel: string, interactive = true) {
  root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const width = markdownImageWidth(readMarkdownImageSize(image.getAttribute("src") ?? ""));
    if (width) {
      image.style.height = "auto";
      image.style.width = width;
    }
    image.setAttribute("contenteditable", "false");
    if (!interactive) {
      image.removeAttribute("aria-label");
      image.removeAttribute("role");
      image.removeAttribute("tabindex");
      return;
    }
    image.setAttribute("aria-label", editImageLabel);
    image.setAttribute("role", "button");
    image.setAttribute("tabindex", "0");
  });
}

function createVisualImageElement(value: { alt: string; src: string; title: string }, editImageLabel: string) {
  const image = document.createElement("img");
  image.setAttribute("alt", value.alt);
  image.setAttribute("src", value.src);
  if (value.title) image.setAttribute("title", value.title);
  image.setAttribute("contenteditable", "false");
  image.setAttribute("aria-label", editImageLabel);
  image.setAttribute("role", "button");
  image.setAttribute("tabindex", "0");
  return image;
}

function prepareVisualMathWidgets(root: ParentNode, editEquationLabel: string, interactive = true) {
  root.querySelectorAll<HTMLElement>("[data-markdown-math-source]").forEach((element) => {
    if (!interactive) {
      element.removeAttribute("aria-label");
      element.removeAttribute("role");
      element.removeAttribute("tabindex");
      element.removeAttribute("title");
      return;
    }
    element.setAttribute("aria-label", editEquationLabel);
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("title", editEquationLabel);
  });
}

function createVisualMathElement(source: string, editEquationLabel: string) {
  const host = document.createElement("div");
  host.innerHTML = markdownToEditorHtml(source);
  const element = host.querySelector<HTMLElement>("[data-markdown-math-source]");
  if (element) {
    prepareVisualMathWidgets(host, editEquationLabel);
  }
  return element;
}

function insertVisualMathElement(root: HTMLElement, element: HTMLElement, displayMode: boolean, savedRange: Range | null) {
  const range = savedRange && root.contains(savedRange.commonAncestorContainer) ? savedRange : null;
  if (!displayMode) {
    if (range) {
      range.deleteContents();
      range.insertNode(element);
      return;
    }
    const paragraph = document.createElement("p");
    paragraph.append(element);
    root.append(paragraph);
    return;
  }

  const directChild = range ? findDirectEditorChild(root, range.commonAncestorContainer) : null;
  if (directChild?.textContent?.trim()) {
    directChild.after(element);
  } else if (directChild) {
    directChild.replaceWith(element);
  } else {
    root.append(element);
  }
  if (!element.nextElementSibling) {
    const trailingParagraph = document.createElement("p");
    trailingParagraph.append(document.createElement("br"));
    element.after(trailingParagraph);
  }
}

function createVisualTable(rowCount: number, columnCount: number) {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = document.createElement("tr");
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      row.append(createEmptyTableCell(rowIndex === 0 ? "th" : "td"));
    }
    (rowIndex === 0 ? head : body).append(row);
  }

  table.append(head);
  if (body.rows.length) {
    table.append(body);
  }
  return table;
}

function createEmptyTableCell(tag: "td" | "th") {
  const cell = document.createElement(tag);
  cell.append(document.createElement("br"));
  return cell;
}

function insertVisualBlockElement(root: HTMLElement, element: HTMLElement, savedRange: Range | null) {
  const range = savedRange && root.contains(savedRange.commonAncestorContainer) ? savedRange : null;
  const directChild = range ? findDirectEditorChild(root, range.commonAncestorContainer) : null;
  if (directChild?.textContent?.trim()) {
    directChild.after(element);
  } else if (directChild) {
    directChild.replaceWith(element);
  } else {
    root.append(element);
  }
  if (!element.nextElementSibling) {
    const trailingParagraph = document.createElement("p");
    trailingParagraph.append(document.createElement("br"));
    element.after(trailingParagraph);
  }
}

function findTableCellSelection(root: HTMLElement, cell: HTMLTableCellElement): TableCellSelection | null {
  const table = cell.closest("table");
  const row = cell.parentElement;
  if (!(table instanceof HTMLTableElement) || !(row instanceof HTMLTableRowElement)) {
    return null;
  }
  const tableIndex = Array.from(root.querySelectorAll("table")).indexOf(table);
  const rowIndex = Array.from(table.rows).indexOf(row);
  const columnIndex = getDirectTableCells(row).indexOf(cell);
  if (tableIndex < 0 || rowIndex < 0 || columnIndex < 0) {
    return null;
  }
  return { columnIndex, rowIndex, tableIndex };
}

function renderTableCellSelection(root: HTMLElement | null, selection: TableCellSelection | null) {
  if (!root) {
    return;
  }
  root.querySelectorAll("[data-rte-table-active]").forEach((cell) => cell.removeAttribute("data-rte-table-active"));
  const context = resolveTableSelection(root, selection);
  context?.cell.setAttribute("data-rte-table-active", "true");
}

function resolveTableSelection(root: HTMLElement | null, selection: TableCellSelection | null) {
  if (!root || !selection) {
    return null;
  }
  const table = root.querySelectorAll<HTMLTableElement>("table")[selection.tableIndex];
  const row = table?.rows[selection.rowIndex];
  const cell = row ? getDirectTableCells(row)[selection.columnIndex] : undefined;
  if (!table || !row || !cell) {
    return null;
  }
  const columnCount = Math.max(...Array.from(table.rows).map((tableRow) => getDirectTableCells(tableRow).length));
  return {
    cell,
    columnCount,
    columnIndex: selection.columnIndex,
    row,
    rowIndex: selection.rowIndex,
    table
  };
}

function getDirectTableCells(row: HTMLTableRowElement) {
  return Array.from(row.children).filter((child): child is HTMLTableCellElement =>
    child instanceof HTMLTableCellElement
  );
}

function normalizeVisualTable(table: HTMLTableElement) {
  const rows = Array.from(table.rows);
  if (!rows.length) {
    table.remove();
    return;
  }
  const columnCount = Math.max(...rows.map((row) => getDirectTableCells(row).length), 1);
  const head = document.createElement("thead");
  const body = document.createElement("tbody");

  rows.forEach((row, rowIndex) => {
    while (getDirectTableCells(row).length < columnCount) {
      row.append(createEmptyTableCell(rowIndex === 0 ? "th" : "td"));
    }
    getDirectTableCells(row).forEach((cell) => {
      const desiredTag = rowIndex === 0 ? "th" : "td";
      if (cell.tagName.toLowerCase() === desiredTag) {
        cell.removeAttribute("colspan");
        cell.removeAttribute("rowspan");
        return;
      }
      const replacement = document.createElement(desiredTag);
      replacement.innerHTML = cell.innerHTML;
      cell.replaceWith(replacement);
    });
    (rowIndex === 0 ? head : body).append(row);
  });

  table.replaceChildren(head);
  if (body.rows.length) {
    table.append(body);
  }
}

function findDirectEditorChild(root: HTMLElement, node: Node) {
  let current = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  while (current?.parentElement && current.parentElement !== root) {
    current = current.parentElement;
  }
  return current?.parentElement === root ? current : null;
}

function extractMathExpression(source: string, displayMode: boolean) {
  if (displayMode && source.startsWith("$$") && source.endsWith("$$")) {
    return source.slice(2, -2).trim();
  }
  if (source.startsWith("\\(") && source.endsWith("\\)")) {
    return source.slice(2, -2).trim();
  }
  if (source.startsWith("$") && source.endsWith("$")) {
    return source.slice(1, -1).trim();
  }
  return source.trim();
}

function markdownToEditorHtml(markdown: string) {
  const html = DOMPurify.sanitize(renderMarkdownToHtml(markdown, { protectMath: true }), {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_ATTR: ["contenteditable", "data-markdown-math-display", "data-markdown-math-source", "translate"]
  });
  return html.trim() ? html : "<p><br></p>";
}

function sanitizePastedEditorHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_ATTR: ["alt", "checked", "class", "disabled", "href", "src", "title", "type"],
    ALLOWED_TAGS: [
      "a", "b", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "input", "li", "ol", "p", "pre",
      "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"
    ]
  });
}

function editorHtmlToMarkdown(root: HTMLElement) {
  return serializeChildren(root)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serializeChildren(node: Node): string {
  return Array.from(node.childNodes).map(serializeNode).join("");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownPreservingMath(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const mathSource = readProtectedMathSource(element);
  if (mathSource !== null) {
    return element.getAttribute("data-markdown-math-display") === "true" ? `${mathSource}\n\n` : mathSource;
  }
  const tag = element.tagName.toLowerCase();
  const content = serializeChildren(element);

  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `*${content}*`;
  if (tag === "del") return `~~${content}~~`;
  if (tag === "code" && element.parentElement?.tagName.toLowerCase() !== "pre") return `\`${element.textContent ?? ""}\``;
  if (tag === "a") return `[${content}](${element.getAttribute("href") ?? ""})`;
  if (tag === "img") return serializeImage(element as HTMLImageElement);
  if (tag === "input" && (element as HTMLInputElement).type === "checkbox") return (element as HTMLInputElement).checked ? "[x] " : "[ ] ";
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n---\n\n";
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag.slice(1)))} ${content.trim()}\n\n`;
  if (tag === "p" || tag === "div") return `${escapeMarkdownBlockStart(content.trim())}\n\n`;
  if (tag === "blockquote") return `${content.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  if (tag === "pre") {
    const language = element.querySelector("code")?.className.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "";
    return `\`\`\`${language}\n${element.textContent?.replace(/\n$/, "") ?? ""}\n\`\`\`\n\n`;
  }
  if (tag === "ul" || tag === "ol") return serializeList(element, tag === "ol") + "\n";
  if (tag === "table") return serializeTable(element);
  if (tag === "li") return content;
  return content;
}

function serializeImage(image: HTMLImageElement) {
  const alt = (image.getAttribute("alt") ?? "").replace(/([\\\]])/g, "\\$1");
  const src = image.getAttribute("src") ?? "";
  const title = image.getAttribute("title")?.replace(/([\\"])/g, "\\$1");
  return `![${alt}](${src}${title ? ` "${title}"` : ""})`;
}

async function defaultMediaImageUpload(file: File): Promise<RichTextEditorImage> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/media-assets", {
    method: "POST",
    body: formData,
    credentials: "include"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.asset) {
    throw new Error(body?.error?.message ?? "The image could not be uploaded.");
  }
  return body.asset as RichTextEditorImage;
}

function readProtectedMathSource(element: HTMLElement) {
  const encodedSource = element.getAttribute("data-markdown-math-source");
  if (encodedSource === null) {
    return null;
  }
  try {
    return decodeURIComponent(encodedSource);
  } catch {
    return encodedSource;
  }
}

function serializeList(list: HTMLElement, ordered: boolean): string {
  return Array.from(list.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((child, index) => {
      const item = child as HTMLElement;
      const directContent = Array.from(item.childNodes)
        .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && ["ul", "ol"].includes((node as HTMLElement).tagName.toLowerCase())))
        .map(serializeNode)
        .join("")
        .trim();
      const nested: string = Array.from(item.children)
        .filter((nestedElement) => ["ul", "ol"].includes(nestedElement.tagName.toLowerCase()))
        .map((nestedElement) => serializeList(nestedElement as HTMLElement, nestedElement.tagName.toLowerCase() === "ol").split("\n").map((line: string) => `  ${line}`).join("\n"))
        .join("\n");
      return `${ordered ? `${index + 1}.` : "-"} ${directContent}${nested ? `\n${nested}` : ""}`;
    })
    .join("\n");
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}\[\]])/g, "\\$1");
}

function escapeMarkdownPreservingMath(value: string) {
  const mathSourcePattern = /\$\$[\s\S]*?\$\$|\\\((?:\\.|[^\\\n])*?\\\)|\$(?!\$)(?!\s)(?:\\.|[^\\$\n])*?[^\\$\s]\$(?!\$)/g;
  let markdown = "";
  let offset = 0;

  for (const match of value.matchAll(mathSourcePattern)) {
    const source = match[0];
    const index = match.index;
    const expression = source.startsWith("$$")
      ? source.slice(2, -2)
      : source.startsWith("\\(")
        ? source.slice(2, -2)
        : source.slice(1, -1);
    if (!expression.trim()) {
      continue;
    }
    markdown += escapeMarkdown(value.slice(offset, index)) + source;
    offset = index + source.length;
  }

  return markdown + escapeMarkdown(value.slice(offset));
}

function escapeMarkdownBlockStart(value: string) {
  return value.replace(/^(\s*)(#{1,6}|>|[-+]|\d+[.)])\s/, "$1\\$2 ");
}

function serializeTable(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) => serializeChildren(cell).trim().replace(/\|/g, "\\|"))
  );
  if (!rows.length) {
    return "";
  }
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
  const header = normalizedRows[0];
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n") + "\n";
}
