package com.shiv.pdfhl.util;

public final class MarkdownUtil {
    private MarkdownUtil() {}
    public static String toFencedCodeBlock(String pageText) {
        return "```text\n" + pageText + "\n```";
    }
}
