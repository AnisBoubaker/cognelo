type MonacoCodeEditorValueChange = {
  nextValue: string | undefined;
  readOnly: boolean;
  readOnlyPrefix: string;
  readOnlySuffix: string;
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
