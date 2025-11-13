package com.shiv.pdfhl.controller;

import com.shiv.pdfhl.dto.ExtractRequest;
import com.shiv.pdfhl.dto.ExtractResponse;
import com.shiv.pdfhl.dto.Rect;
import com.shiv.pdfhl.service.MatchBoxService;
import com.shiv.pdfhl.service.PdfPageImageService;
import com.shiv.pdfhl.service.TextSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SearchController {

    private final TextSearchService textService;
    private final PdfPageImageService imageService;
    private final MatchBoxService boxService;

    @PostMapping(value = "/search", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ExtractResponse search(@Valid @RequestBody ExtractRequest request) {
        return textService.search(request);
    }

    @GetMapping(value = "/page-image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> pageImage(
            @RequestParam("fileName") String fileName,
            @RequestParam("page") int page
    ) {
        return imageService.renderPageAsPngResponse(fileName, page);
    }

    @GetMapping(value = "/page-matches", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Rect>> pageMatches(
            @RequestParam("fileName") String fileName,
            @RequestParam("query") String query,
            @RequestParam("page") int page
    ) {
        return boxService.getMatchBoxesResponse(fileName, query, page);
    }
}
