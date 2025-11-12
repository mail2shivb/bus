package com.shiv.pdfmd.service;

import com.shiv.pdfmd.dto.ExtractRequest;
import com.shiv.pdfmd.dto.ExtractResponse;
import com.shiv.pdfmd.dto.PageHit;
import com.shiv.pdfmd.util.MarkdownUtil;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class PdfMarkdownService {

    @Value("${app.pdf.base-path}")
    private String pdfBasePath;

    public ExtractResponse extract(ExtractRequest req) {
        File pdfFile = resolveFile(req.getFileName());
        if (!pdfFile.exists() || !pdfFile.isFile()) {
            throw new IllegalArgumentException("PDF not found: " + pdfFile.getAbsolutePath());
        }

        try (PDDocument doc = Loader.loadPDF(Files.readAllBytes(pdfFile.toPath()))) {
            int totalPages = doc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            List<PageHit> hits = new ArrayList<>();
            Pattern pattern = buildPattern(req.getQuery(), req.isCaseSensitive());

            for (int p = 1; p <= totalPages; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String pageText = stripper.getText(doc);

                Matcher m = pattern.matcher(pageText);
                int count = 0;
                while (m.find()) count++;
                if (count == 0) continue;

                String pageMd = MarkdownUtil.toFencedCodeBlock(pageText);
                String snippetMd = MarkdownUtil.buildSnippet(pageText, req.getQuery(), req.isCaseSensitive(),
                        Math.max(20, req.getSnippetPadding()));

                hits.add(PageHit.builder()
                        .pageNumber(p)
                        .pageMarkdown(pageMd)
                        .snippetMarkdown(snippetMd)
                        .occurrences(count)
                        .build());
            }

            return ExtractResponse.builder()
                    .fileName(req.getFileName())
                    .query(req.getQuery())
                    .caseSensitive(req.isCaseSensitive())
                    .totalPages(totalPages)
                    .matchedPages(hits.size())
                    .pages(hits)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to process PDF: " + e.getMessage(), e);
        }
    }

    public String extractCombinedMarkdown(ExtractRequest req) {
        File pdfFile = resolveFile(req.getFileName());
        if (!pdfFile.exists() || !pdfFile.isFile()) {
            throw new IllegalArgumentException("PDF not found: " + pdfFile.getAbsolutePath());
        }

        StringBuilder md = new StringBuilder();
        md.append("# Extracted Pages for `").append(req.getFileName()).append("`");
        md.append("> Query: **").append(req.getQuery()).append("**  ");
        md.append("> Case Sensitive: ").append(req.isCaseSensitive()).append("");

        try (PDDocument doc = Loader.loadPDF(Files.readAllBytes(pdfFile.toPath()))) {
            int totalPages = doc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            Pattern pattern = buildPattern(req.getQuery(), req.isCaseSensitive());
            int matched = 0;

            for (int p = 1; p <= totalPages; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String pageText = stripper.getText(doc);
                Matcher m = pattern.matcher(pageText);
                int count = 0;
                while (m.find()) count++;
                if (count == 0) continue;
                matched++;

                md.append("## Page ").append(p).append(" (matches: ").append(count).append(")");
                String snippet = MarkdownUtil.buildSnippet(pageText, req.getQuery(), req.isCaseSensitive(),
                        Math.max(20, req.getSnippetPadding()));
                if (!snippet.isEmpty()) {
                    md.append(snippet).append("");
                }
                md.append(MarkdownUtil.toFencedCodeBlock(pageText)).append("");
            }

            if (matched == 0) {
                md.append("_No matches found._");
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to process PDF: " + e.getMessage(), e);
        }

        return md.toString();
    }

    private File resolveFile(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        return new File(pdfBasePath, name);
    }

    private Pattern buildPattern(String query, boolean caseSensitive) {
        String escaped = Pattern.quote(query);
        return caseSensitive ? Pattern.compile(escaped) : Pattern.compile(escaped, Pattern.CASE_INSENSITIVE);
    }
}
