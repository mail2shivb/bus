package com.shiv.pdfmd.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class ExtractResponse {
    private String fileName;
    private String query;
    private boolean caseSensitive;
    private int totalPages;
    private int matchedPages;
    private List<PageHit> pages;
}
