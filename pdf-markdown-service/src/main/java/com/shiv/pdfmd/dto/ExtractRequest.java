package com.shiv.pdfmd.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ExtractRequest {
    @NotBlank
    private String fileName;
    @NotBlank
    private String query;
    private boolean caseSensitive = false;
    private int snippetPadding = 60;
}
