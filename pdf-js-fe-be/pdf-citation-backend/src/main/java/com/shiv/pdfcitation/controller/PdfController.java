package com.shiv.pdfcitation.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;

@RestController
@RequestMapping("/api")
public class PdfController {

    @Value("${app.pdf.base-path}")
    private String basePath;

    @GetMapping(value = "/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<Resource> getPdf(@RequestParam("fileName") String fileName) {
        // very basic path safety
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\"")) {
            return ResponseEntity.badRequest().build();
        }
        File f = new File(basePath, fileName);
        if (!f.exists() || !f.isFile()) {
            return ResponseEntity.notFound().build();
        }
        Resource res = new FileSystemResource(f);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(res);
    }
}
