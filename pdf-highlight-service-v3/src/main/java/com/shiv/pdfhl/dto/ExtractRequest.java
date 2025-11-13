package com.shiv.pdfhl.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ExtractRequest {
    @NotBlank
    private String fileName;
    @NotBlank
    private String query;
}
