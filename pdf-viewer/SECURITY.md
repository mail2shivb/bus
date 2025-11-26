# Security Considerations

## Known Vulnerabilities

### pdfjs-dist Arbitrary JavaScript Execution (CVE-2024-XXXXX)

**Status:** Known Issue  
**Severity:** High (CVSS 8.8)  
**Affected Versions:** pdfjs-dist <= 4.1.392  
**Current Version:** 3.11.174

#### Description

PDF.js versions up to and including 4.1.392 are vulnerable to arbitrary JavaScript execution when opening a specially crafted malicious PDF file. This vulnerability allows an attacker to execute arbitrary JavaScript in the context of the PDF viewer.

**Reference:** https://github.com/advisories/GHSA-wgrm-67xf-hhpq

#### Why We Can't Update

The project uses `@react-pdf-viewer/core` (v3.12.0) which has a peer dependency constraint of `pdfjs-dist: ^2.16.105 || ^3.0.279`. This prevents upgrading to pdfjs-dist v4.2+ which contains the security fix.

#### Mitigation Strategies

Since this viewer is designed for **trusted document sources only**, the risk is mitigated by:

1. **Trusted Source Enforcement:** Only load PDFs from trusted, validated backend endpoints
2. **Content Security Policy:** Implement strict CSP headers to limit JavaScript execution
3. **Input Validation:** Backend should validate and sanitize PDF files before serving
4. **Sandboxing:** Run the viewer in a sandboxed iframe with restricted permissions
5. **User Warning:** Display warnings when loading PDFs from external or untrusted sources

#### Recommended Deployment Configuration

```html
<!-- Serve viewer in sandboxed iframe -->
<iframe
  src="/pdf-viewer"
  sandbox="allow-scripts allow-same-origin"
  csp="default-src 'self'; script-src 'self'"
></iframe>
```

#### Content Security Policy

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js; 
  object-src 'none'; 
  base-uri 'self';
```

#### Future Actions

- [ ] Monitor @react-pdf-viewer/core for updates supporting pdfjs-dist v4.2+
- [ ] Consider migrating to alternative PDF viewer library if no update is available
- [ ] Implement additional server-side PDF validation
- [ ] Add PDF malware scanning before serving

## Security Best Practices

### For Developers

1. **Never load PDFs from untrusted sources** without proper validation
2. **Implement backend PDF validation** using tools like ClamAV or similar
3. **Use Content Security Policy** headers to restrict script execution
4. **Enable HTTPS** for all PDF file transfers
5. **Log and monitor** all PDF access for suspicious activity

### For Deployment

1. **Backend Validation:** Implement PDF file validation before serving
2. **Access Control:** Restrict PDF endpoint access with proper authentication
3. **Rate Limiting:** Implement rate limiting on `/api/pdf` endpoint
4. **Audit Logging:** Log all PDF access requests
5. **Network Isolation:** Consider network segmentation for PDF processing

## Reporting Security Issues

If you discover a security vulnerability in this viewer, please report it via:
- GitHub Security Advisories: https://github.com/mail2shivb/bus/security/advisories
- Email: [security contact - to be added]

**Do not** open public issues for security vulnerabilities.

## Security Update Policy

This project will:
- Monitor security advisories for all dependencies
- Update to patched versions as soon as compatible
- Document known vulnerabilities transparently
- Provide migration guides when breaking changes are required

Last Updated: 2025-11-16
