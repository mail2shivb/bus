// src/main/java/com/shiv/pdfmd/service/PdfPageImageService.java
package com.shiv.pdfmd.service;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;

@Service
@RequiredArgsConstructor
public class PdfPageImageService {

    @Value("${app.pdf.base-path}")
    private String pdfBasePath;

    public byte[] renderPageAsPng(String fileName, int page1Based, int dpi) {
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        if (page1Based < 1) throw new IllegalArgumentException("Page must be >= 1");
        if (dpi < 72) dpi = 72;

        File file = new File(pdfBasePath, fileName);
        if (!file.exists() || !file.isFile()) {
            throw new IllegalArgumentException("PDF not found: " + file.getAbsolutePath());
        }

        try (PDDocument doc = Loader.loadPDF(file)) {
            int total = doc.getNumberOfPages();
            if (page1Based > total) {
                throw new IllegalArgumentException("Page exceeds total pages (" + total + ")");
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            renderer.setSubsamplingAllowed(true);
            BufferedImage bim = renderer.renderImageWithDPI(page1Based - 1, dpi, ImageType.RGB);

            try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                ImageIO.write(bim, "PNG", baos);
                return baos.toByteArray();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to render page: " + e.getMessage(), e);
        }
    }
}
