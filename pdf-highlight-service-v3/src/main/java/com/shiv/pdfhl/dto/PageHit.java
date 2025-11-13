package com.shiv.pdfhl.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PageHit {
    private int pageNumber;
    private String pageMarkdown;
    private int occurrences;
}
