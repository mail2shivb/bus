package com.shiv.pdfhl.service;

import com.shiv.pdfhl.dto.ExtractRequest;
import com.shiv.pdfhl.dto.ExtractResponse;
import com.shiv.pdfhl.dto.PageHit;
import com.shiv.pdfhl.util.MarkdownUtil;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StopWatch;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TextSearchService {

    @Value("${app.pdf.base-path}")
    private String pdfBasePath;

    @Value("${app.search.parallelism:0}")
    private int configuredParallelism;

    public ExtractResponse search(ExtractRequest req) {
        StopWatch sw = new StopWatch("search");
        sw.start("loadBytes");
        File pdfFile = resolveFile(req.getFileName());
        byte[] bytes;
        try { bytes = Files.readAllBytes(pdfFile.toPath()); } catch (Exception e) {
            throw new RuntimeException("Read PDF bytes failed: " + e.getMessage(), e);
        }
        sw.stop();

        int parallelism = configuredParallelism <= 0 ? Runtime.getRuntime().availableProcessors() : configuredParallelism;

        sw.start("scanPages");
        List<PageHit> pages = parallelScan(bytes, req.getQuery(), parallelism);
        sw.stop();

        int total;
        try (PDDocument d = Loader.loadPDF(bytes)) {
            total = d.getNumberOfPages();
        } catch (Exception e) { throw new RuntimeException("Load for total pages failed: " + e.getMessage(), e); }

        return ExtractResponse.builder()
                .fileName(req.getFileName())
                .query(req.getQuery())
                .totalPages(total)
                .matchedPages(pages.size())
                .pages(pages)
                .docLoadMs(sw.getTaskInfo()[0].getTimeMillis())
                .scanMs(sw.getTaskInfo()[1].getTimeMillis())
                .pagesScanned(total)
                .parallelism(parallelism)
                .build();
    }

    private List<PageHit> parallelScan(byte[] bytes, String query, int parallelism) {
        List<PageHit> results = Collections.synchronizedList(new ArrayList<>());
        Pattern pattern = Pattern.compile(Pattern.quote(query), Pattern.CASE_INSENSITIVE);

        int total;
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            total = doc.getNumberOfPages();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        ExecutorService pool = Executors.newFixedThreadPool(parallelism);
        List<Future<Void>> futures = new ArrayList<>();

        for (int page = 1; page <= total; page++) {
            final int p = page;
            futures.add(pool.submit((Callable<Void>) () -> {
                String pageText;
                try (PDDocument d = Loader.loadPDF(bytes)) {
                    PDFTextStripper stripper = new PDFTextStripper();
                    stripper.setSortByPosition(true);
                    stripper.setStartPage(p);
                    stripper.setEndPage(p);
                    pageText = stripper.getText(d);
                }
                Matcher m = pattern.matcher(pageText);
                int count = 0;
                while (m.find()) count++;
                if (count > 0) {
                    results.add(PageHit.builder()
                            .pageNumber(p)
                            .pageMarkdown(MarkdownUtil.toFencedCodeBlock(pageText))
                            .occurrences(count)
                            .build());
                }
                return null;
            }));
        }

        for (Future<Void> f : futures) {
            try { f.get(); } catch (Exception e) { throw new RuntimeException(e); }
        }
        pool.shutdown();

        results.sort((a,b) -> Integer.compare(a.getPageNumber(), b.getPageNumber()));
        return results;
    }

    private File resolveFile(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        return new File(pdfBasePath, name);
    }
}
