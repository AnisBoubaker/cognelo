type MonacoCodeEditorValueChange = {
  nextValue: string | undefined;
  readOnly: boolean;
  readOnlyPrefix: string;
  readOnlySuffix: string;
};

type EditableMonacoOffsets = {
  startOffset: number;
  endOffset: number;
};

type EditableMonacoSelection = {
  startOffset: number;
  endOffset: number;
};

export function getEditableMonacoValue({
  nextValue,
  readOnly,
  readOnlyPrefix,
  readOnlySuffix
}: MonacoCodeEditorValueChange): string | null {
  if (readOnly) {
    return null;
  }

  const nextText = nextValue ?? "";
  if (!readOnlyPrefix && !readOnlySuffix) {
    return nextText;
  }

  if (!nextText.startsWith(readOnlyPrefix) || !nextText.endsWith(readOnlySuffix)) {
    return null;
  }

  return nextText.slice(readOnlyPrefix.length, nextText.length - readOnlySuffix.length);
}

export function getEditableMonacoOffsets(
  modelValue: string,
  readOnlyPrefix: string,
  readOnlySuffix: string
): EditableMonacoOffsets {
  const startOffset = Math.min(readOnlyPrefix.length, modelValue.length);
  return {
    startOffset,
    endOffset: Math.max(startOffset, modelValue.length - readOnlySuffix.length)
  };
}

export function clampMonacoSelectionToEditableOffsets(
  selection: EditableMonacoSelection,
  editableOffsets: EditableMonacoOffsets
): EditableMonacoSelection {
  return {
    startOffset: Math.min(
      editableOffsets.endOffset,
      Math.max(editableOffsets.startOffset, selection.startOffset)
    ),
    endOffset: Math.min(
      editableOffsets.endOffset,
      Math.max(editableOffsets.startOffset, selection.endOffset)
    )
  };
}
