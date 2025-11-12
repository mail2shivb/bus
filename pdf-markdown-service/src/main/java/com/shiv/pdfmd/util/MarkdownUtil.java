package com.shiv.pdfmd.util;

public final class MarkdownUtil {
    private MarkdownUtil() {}

    public static String toFencedCodeBlock(String pageText) {
        return "```text\n" + pageText + "\n```";
    }

    public static String buildSnippet(String pageText, String query, boolean caseSensitive, int padChars) {
        if (query == null || query.isEmpty()) return "";
        String hay = caseSensitive ? pageText : pageText.toLowerCase();
        String needle = caseSensitive ? query : query.toLowerCase();

        int idx = hay.indexOf(needle);
        if (idx < 0) return "";

        int start = Math.max(0, idx - padChars);
        int end   = Math.min(pageText.length(), idx + query.length() + padChars);

        String left = pageText.substring(start, idx);
        String match = pageText.substring(idx, idx + query.length());
        String right = pageText.substring(idx + query.length(), end);

        String snippet = escapeForInlineMarkdown(left) + "**" + escapeForInlineMarkdown(match) + "**" + escapeForInlineMarkdown(right);
        return "> " + snippet.replace("\n", "\n> ");
    }

    private static String escapeForInlineMarkdown(String s) {
        return s.replace("\\", "\\\\")
                .replace("_", "\\_")
                .replace("[", "\\[")
                .replace("]", "\\]")
                .replace("`", "\\`");
    }
}
