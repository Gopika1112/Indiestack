package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxUploadSize = 10 << 20 // 10 MB

var allowedImageTypes = map[string]bool{
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Only POST is supported")
		return
	}

	// Auth required
	_, _, err := extractAuth(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	// Limit body size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		jsonError(w, http.StatusBadRequest, "TOO_LARGE", "File too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, http.StatusBadRequest, "BAD_REQUEST", "No file provided. Use form field 'file'")
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		jsonError(w, http.StatusBadRequest, "INVALID_TYPE", fmt.Sprintf("Unsupported image type: %s. Allowed: JPEG, PNG, GIF, WebP, SVG", contentType))
		return
	}

	// Read file into memory to compute hash
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read file")
		return
	}

	// Generate unique filename: timestamp + hash + original extension
	hash := sha256.Sum256(fileBytes)
	hashHex := hex.EncodeToString(hash[:])[:16]
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = extensionFromContentType(contentType)
	}
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), hashHex, ext)

	// Determine upload directory
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	// Create directory if not exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("Failed to create upload dir: %v", err)
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to store file")
		return
	}

	// Write file to disk
	destPath := filepath.Join(uploadDir, filename)
	if err := os.WriteFile(destPath, fileBytes, 0644); err != nil {
		log.Printf("Failed to write uploaded file: %v", err)
		jsonError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to store file")
		return
	}

	// Build public URL as a RELATIVE path so the browser resolves it against the
	// current origin (Caddy proxies /uploads/* to this service). Baking an absolute
	// base URL here breaks images when the backend's NEXT_PUBLIC_APP_URL is an
	// internal/unreachable host.
	publicURL := fmt.Sprintf("/uploads/%s", filename)

	jsonSuccess(w, http.StatusOK, map[string]string{
		"url":      publicURL,
		"filename": filename,
		"size":     fmt.Sprintf("%d", len(fileBytes)),
	})
}

func extensionFromContentType(ct string) string {
	switch ct {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	default:
		return ".bin"
	}
}

// validateImageFile checks if the multipart file header is a valid image.
func validateImageFile(header *multipart.FileHeader) error {
	if header.Size > maxUploadSize {
		return fmt.Errorf("file too large (max 10MB)")
	}
	ct := header.Header.Get("Content-Type")
	if !allowedImageTypes[ct] {
		return fmt.Errorf("unsupported image type: %s", ct)
	}
	return nil
}
