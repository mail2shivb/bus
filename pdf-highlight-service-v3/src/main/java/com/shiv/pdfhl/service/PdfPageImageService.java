package com.shiv.pdfhl.service;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StopWatch;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;

@Service
@RequiredArgsConstructor
public class PdfPageImageService {

    @Value("${app.pdf.base-path}")
    private String pdfBasePath;

    public ResponseEntity<byte[]> renderPageAsPngResponse(String fileName, int page1Based) {
        StopWatch sw = new StopWatch("page-image");
        sw.start("loadBytes");
        File pdfFile = resolveFile(fileName);
        byte[] bytes;
        try { bytes = Files.readAllBytes(pdfFile.toPath()); } catch (Exception e) {
            throw new RuntimeException("Failed to read PDF: " + e.getMessage(), e);
        }
        sw.stop();

        sw.start("render");
        byte[] png;
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            if (page1Based < 1 || page1Based > doc.getNumberOfPages()) {
                throw new IllegalArgumentException("Page out of range");
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            renderer.setSubsamplingAllowed(true);
            BufferedImage bim = renderer.renderImageWithDPI(page1Based - 1, 180, ImageType.RGB);
            try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                ImageIO.write(bim, "PNG", baos);
                png = baos.toByteArray();
            }
        } catch (Exception e) {
            throw new RuntimeException("Render failed: " + e.getMessage(), e);
        }
        sw.stop();

        return ResponseEntity.ok()
                .header("X-Doc-Load-ms", String.valueOf(sw.getTaskInfo()[0].getTimeMillis()))
                .header("X-Render-ms", String.valueOf(sw.getTaskInfo()[1].getTimeMillis()))
                .body(png);
    }

    private File resolveFile(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        File f = new File(pdfBasePath, name);
        if (!f.exists() || !f.isFile()) throw new IllegalArgumentException("PDF not found: " + f.getAbsolutePath());
        return f;
    }
}
