package com.shiv.pdfhl.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ExtractResponse {
    private String fileName;
    private String query;
    private int totalPages;
    private int matchedPages;
    private List<PageHit> pages;
    private long docLoadMs;
    private long scanMs;
    private int pagesScanned;
    private int parallelism;
}
