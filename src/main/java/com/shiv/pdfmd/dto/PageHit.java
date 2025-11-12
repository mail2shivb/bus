package com.shiv.pdfmd.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PageHit {
    private int pageNumber;          // 1-based
    private String pageMarkdown;     // entire page as fenced code block
    private String snippetMarkdown;  // short snippet with bolded match
    private int occurrences;         // number of matches on page
}
