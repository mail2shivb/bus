package com.shiv.pdfhl.service;

import com.shiv.pdfhl.dto.Rect;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StopWatch;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MatchBoxService {

    @Value("${app.pdf.base-path}")
    private String pdfBasePath;

    public ResponseEntity<List<Rect>> getMatchBoxesResponse(String fileName, String query, int page1Based) {
        StopWatch sw = new StopWatch("page-matches");
        sw.start("loadBytes");
        File pdfFile = resolveFile(fileName);
        byte[] bytes;
        try { bytes = Files.readAllBytes(pdfFile.toPath()); } catch (Exception e) {
            throw new RuntimeException("Failed to read PDF: " + e.getMessage(), e);
        }
        sw.stop();

        sw.start("boxes");
        List<Rect> rects = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            if (page1Based < 1 || page1Based > doc.getNumberOfPages()) {
                throw new IllegalArgumentException("Page out of range");
            }
            PositionCollector stripper = new PositionCollector(page1Based);
            stripper.setSortByPosition(true);
            stripper.getText(doc);
            List<TextPosition> positions = stripper.positions;
            StringBuilder sb = new StringBuilder();
            for (TextPosition tp : positions) sb.append(tp.getUnicode());

            String hay = sb.toString().toLowerCase();
            String needle = query.toLowerCase();
            Pattern pattern = Pattern.compile(Pattern.quote(needle));
            Matcher m = pattern.matcher(hay);

            float scale = 180f / 72f;
            while (m.find()) {
                rects.addAll(boxesForRange(positions, m.start(), m.end(), scale));
            }
        } catch (Exception e) {
            throw new RuntimeException("Boxes failed: " + e.getMessage(), e);
        }
        sw.stop();

        return ResponseEntity.ok()
                .header("X-Doc-Load-ms", String.valueOf(sw.getTaskInfo()[0].getTimeMillis()))
                .header("X-Boxes-ms", String.valueOf(sw.getTaskInfo()[1].getTimeMillis()))
                .body(rects);
    }

    private static List<Rect> boxesForRange(List<TextPosition> positions, int start, int end, float scale) {
        List<Rect> out = new ArrayList<>();
        if (start < 0 || end > positions.size()) return out;

        float curY = Float.NaN;
        float minX = Float.MAX_VALUE, maxX = -Float.MAX_VALUE, minY = Float.MAX_VALUE, maxY = -Float.MAX_VALUE;

        for (int i = start; i < end; i++) {
            TextPosition tp = positions.get(i);
            float y = tp.getYDirAdj();
            float x = tp.getXDirAdj();
            float w = tp.getWidthDirAdj();
            float h = tp.getHeightDir();

            if (Float.isNaN(curY)) curY = y;
            boolean newLine = Math.abs(y - curY) > (h * 0.5f);
            if (newLine) {
                if (maxX > minX) out.add(scaleRect(minX, minY, maxX - minX, maxY - minY, scale));
                curY = y;
                minX = Float.MAX_VALUE; maxX = -Float.MAX_VALUE;
                minY = Float.MAX_VALUE; maxY = -Float.MAX_VALUE;
            }

            minX = Math.min(minX, x);
            minY = Math.min(minY, y - h);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y);
        }
        if (maxX > minX) out.add(scaleRect(minX, minY, maxX - minX, maxY - minY, scale));
        return out;
    }

    private static Rect scaleRect(float x, float y, float w, float h, float scale) {
        return new Rect(x * scale, y * scale, w * scale, h * scale);
    }

    private File resolveFile(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        File f = new File(pdfBasePath, name);
        if (!f.exists() || !f.isFile()) throw new IllegalArgumentException("PDF not found: " + f.getAbsolutePath());
        return f;
    }

    static class PositionCollector extends PDFTextStripper {
        final int page;
        final List<TextPosition> positions = new ArrayList<>();
        PositionCollector(int page1Based) throws java.io.IOException {
            this.page = page1Based;
            setStartPage(page);
            setEndPage(page);
        }
        @Override
        protected void writeString(String text, java.util.List<TextPosition> textPositions) throws java.io.IOException {
            positions.addAll(textPositions);
        }
    }
}
