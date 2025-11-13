package com.shiv.pdfhl.service;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class PageTextCache {
    private static final Map<String, String> CACHE = new ConcurrentHashMap<>();
    public static String key(File f, int page) {
        return f.getAbsolutePath() + "::" + f.lastModified() + "::" + page;
    }
    public static String get(String k) { return CACHE.get(k); }
    public static void put(String k, String v) { CACHE.put(k, v); }
}
