package attachmentzip

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"strings"

	zipcrypto "github.com/alexmullins/zip"
)

type Result struct {
	FileName    string
	ContentType string
	SizeBytes   int64
	Bytes       []byte
}

func Build(fileName string, password string, content []byte) (Result, error) {
	name := SanitizeFileName(fileName)
	if name == "" {
		name = "attachment"
	}
	var buf bytes.Buffer
	if strings.TrimSpace(password) != "" {
		writer := zipcrypto.NewWriter(&buf)
		header := &zipcrypto.FileHeader{Name: name, Method: zip.Deflate}
		header.SetPassword(password)
		entry, err := writer.CreateHeader(header)
		if err != nil {
			_ = writer.Close()
			return Result{}, fmt.Errorf("create encrypted zip entry: %w", err)
		}
		if _, err := io.Copy(entry, bytes.NewReader(content)); err != nil {
			_ = writer.Close()
			return Result{}, fmt.Errorf("write encrypted zip content: %w", err)
		}
		if err := writer.Close(); err != nil {
			return Result{}, fmt.Errorf("close encrypted zip: %w", err)
		}
	} else {
		writer := zip.NewWriter(&buf)
		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
		entry, err := writer.CreateHeader(header)
		if err != nil {
			_ = writer.Close()
			return Result{}, fmt.Errorf("create zip entry: %w", err)
		}
		if _, err := io.Copy(entry, bytes.NewReader(content)); err != nil {
			_ = writer.Close()
			return Result{}, fmt.Errorf("write zip content: %w", err)
		}
		if err := writer.Close(); err != nil {
			return Result{}, fmt.Errorf("close zip: %w", err)
		}
	}
	zipName := name
	if !strings.HasSuffix(strings.ToLower(zipName), ".zip") {
		zipName += ".zip"
	}
	return Result{FileName: zipName, ContentType: "application/zip", SizeBytes: int64(buf.Len()), Bytes: buf.Bytes()}, nil
}

func SanitizeFileName(name string) string {
	forbidden := map[rune]bool{
		'/': true, '\n': true, '\r': true, '\t': true, '\x00': true, '\f': true,
		'`': true, '?': true, '*': true, '\\': true, '<': true, '>': true,
		'|': true, '"': true, ':': true, ';': true,
	}
	var b strings.Builder
	for _, r := range strings.TrimSpace(name) {
		if forbidden[r] {
			b.WriteRune('_')
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
