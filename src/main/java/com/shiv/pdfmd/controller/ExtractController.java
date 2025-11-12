// src/main/java/com/shiv/pdfmd/controller/ExtractController.java
package com.shiv.pdfmd.controller;

import com.shiv.pdfmd.service.PdfPageImageService;
import com.shiv.pdfmd.dto.ExtractRequest;
import com.shiv.pdfmd.dto.ExtractResponse;
import com.shiv.pdfmd.service.PdfMarkdownService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/extract")
@RequiredArgsConstructor
public class ExtractController {

    private final PdfMarkdownService service;
    private final PdfPageImageService imageService; // <-- add this

    @PostMapping(value = "/markdown", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ExtractResponse extractMarkdown(@Valid @RequestBody ExtractRequest request) {
        return service.extract(request);
    }

    @PostMapping(value = "/markdown/combined", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> extractCombined(@Valid @RequestBody ExtractRequest request) {
        String md = service.extractCombinedMarkdown(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"extract.md\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(md);
    }

    // NEW: exact page-as-image
    @GetMapping(value = "/page-image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> pageImage(
            @RequestParam String fileName,
            @RequestParam int page,               // 1-based page number
            @RequestParam(defaultValue = "160") int dpi // 96-200 is fine
    ) {
        byte[] png = imageService.renderPageAsPng(fileName, page, dpi);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(png);
    }
}
